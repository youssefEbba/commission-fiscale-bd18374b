import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  marcheApi, MarcheDto, MARCHE_STATUT_LABELS, MARCHE_DOCUMENT_TYPES, TypeDocumentMarche,
  conventionApi, ConventionDto,
  delegueApi, DelegueDto,
  DocumentDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DocumentGED from "@/components/ged/DocumentGED";
import { ArrowLeft, Gavel, Loader2, Paperclip } from "lucide-react";

const STATUT_COLORS: Record<string, string> = {
  EN_COURS: "bg-blue-100 text-blue-800",
  AVENANT: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground break-words">{value ?? "—"}</p>
  </div>
);

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtAmount = (n?: number) =>
  n != null ? `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MRU` : "—";

const MarcheDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const [marche, setMarche] = useState<MarcheDto | null>(null);
  const [convention, setConvention] = useState<ConventionDto | null>(null);
  const [delegues, setDelegues] = useState<DelegueDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [gedOpen, setGedOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isDelegate = hasRole(["AUTORITE_UPM", "AUTORITE_UEP"]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const m = await marcheApi.getById(Number(id));
      setMarche(m);
      const tasks: Promise<any>[] = [];
      if (m.conventionId) tasks.push(conventionApi.getById(m.conventionId).then(setConvention).catch(() => {}));
      tasks.push(delegueApi.getAll().then(setDelegues).catch(() => {}));
      await Promise.allSettled(tasks);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Impossible de charger le marché", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadDocs = async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      setDocs(await marcheApi.getDocuments(Number(id)));
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => { load(); loadDocs(); }, [id]);

  const handleUpload = async (mId: number, type: string, file: File) => {
    await marcheApi.uploadDocument(mId, type as TypeDocumentMarche, file);
  };
  const handleRefresh = async () => { await loadDocs(); };
  const handleDelete = async (mId: number, docId: number) => { await marcheApi.deleteDocument(mId, docId); };
  const handleReplace = async (mId: number, docId: number, file: File) => { await marcheApi.replaceDocument(mId, docId, file); };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  if (!marche) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">Marché introuvable</div>
      </DashboardLayout>
    );
  }

  const canManage = (isAC || isDelegate) && marche.statut !== "CLOTURE" && marche.statut !== "ANNULE";
  const delegueDetails = (marche.delegueIds || [])
    .map(dId => delegues.find(d => d.id === dId))
    .filter(Boolean) as DelegueDto[];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/marches")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Gavel className="h-6 w-6 text-primary" />
                {marche.numeroMarche || `Marché #${marche.id}`}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">{marche.intitule || "—"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className={`${STATUT_COLORS[marche.statut] || ""}`}>{MARCHE_STATUT_LABELS[marche.statut]}</Badge>
            {marche.demandeCorrectionId ? (
              <Badge className="bg-green-100 text-green-800">Marché / Contrat</Badge>
            ) : (
              <Badge variant="outline">Attribution / Adjudication</Badge>
            )}
            <Button variant="outline" onClick={() => setGedOpen(true)}>
              <Paperclip className="h-4 w-4 mr-2" /> Documents ({docs.length})
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="N° Attribution / Marché" value={marche.numeroMarche} />
            <Field label="Intitulé" value={marche.intitule} />
            <Field label="Date signature" value={fmtDate(marche.dateSignature)} />
            <Field label="Montant contrat HT" value={fmtAmount(marche.montantContratHt ?? marche.montantContratTtc)} />
            <Field label="Statut" value={MARCHE_STATUT_LABELS[marche.statut]} />
            <Field
              label="Type"
              value={marche.demandeCorrectionId ? "Marché / Contrat (issu d'une demande)" : "Attribution / Adjudication"}
            />
          </CardContent>
        </Card>

        {convention && (
          <Card>
            <CardHeader><CardTitle className="text-base">Convention rattachée</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field
                label="Référence"
                value={
                  <button
                    className="text-primary hover:underline"
                    onClick={() => navigate(`/dashboard/conventions/${convention.id}`)}
                  >
                    {convention.reference || `#${convention.id}`}
                  </button>
                }
              />
              <Field label="Intitulé" value={convention.intitule} />
              <Field label="Bailleur" value={convention.bailleurNom || convention.bailleur} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Représentants affectés</CardTitle></CardHeader>
          <CardContent>
            {delegueDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun représentant affecté.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {delegueDetails.map(d => (
                  <Badge key={d.id} variant="secondary" className="px-3 py-1">
                    {d.nomComplet} ({d.role === "AUTORITE_UPM" ? "UPM" : "UEP"})
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DocumentGED
        open={gedOpen}
        onOpenChange={setGedOpen}
        title={`Documents — Marché ${marche.numeroMarche || `#${marche.id}`}`}
        dossierId={marche.id}
        documentTypes={MARCHE_DOCUMENT_TYPES}
        documents={docs}
        loading={docsLoading}
        canUpload={canManage}
        canManageDocuments={canManage}
        onUpload={handleUpload}
        onRefresh={handleRefresh}
        onDeleteDocument={handleDelete}
        onReplaceDocument={handleReplace}
      />
    </DashboardLayout>
  );
};

export default MarcheDetail;
