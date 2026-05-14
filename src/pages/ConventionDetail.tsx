import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  conventionApi, ConventionDto, CONVENTION_STATUT_LABELS,
  DocumentDto, MARCHE_DOCUMENT_TYPES, CONVENTION_DOCUMENT_TYPES, TypeDocumentConvention,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DocumentGED from "@/components/ged/DocumentGED";
import { ArrowLeft, FileText, Loader2, Paperclip } from "lucide-react";

const STATUT_COLORS: Record<string, string> = {
  EN_ATTENTE: "bg-orange-100 text-orange-800",
  VALIDE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
  ANNULEE: "bg-gray-100 text-gray-800",
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground break-words">{value ?? "—"}</p>
  </div>
);

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtAmount = (n?: number, suffix = "") =>
  n != null ? `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}${suffix ? ` ${suffix}` : ""}` : "—";

const ConventionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const [conv, setConv] = useState<ConventionDto | null>(null);
  const [loading, setLoading] = useState(true);

  const [gedOpen, setGedOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isAdmin = hasRole(["ADMIN_SI"]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await conventionApi.getById(Number(id));
      setConv(data);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Impossible de charger la convention", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadDocs = async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      setDocs(await conventionApi.getDocuments(Number(id)));
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => { load(); loadDocs(); }, [id]);

  const handleUpload = async (cId: number, type: string, file: File) => {
    await conventionApi.uploadDocument(cId, type as TypeDocumentConvention, file);
  };
  const handleRefresh = async () => { await loadDocs(); };
  const handleDelete = async (cId: number, docId: number) => { await conventionApi.deleteDocument(cId, docId); };
  const handleReplace = async (cId: number, docId: number, file: File) => { await conventionApi.replaceDocument(cId, docId, file); };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  if (!conv) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">Convention introuvable</div>
      </DashboardLayout>
    );
  }

  const canManage = (isAC || isAdmin) && conv.statut !== "VALIDE" && conv.statut !== "ANNULEE";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/conventions")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                {conv.reference || `Convention #${conv.id}`}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">{conv.intitule || "—"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className={`${STATUT_COLORS[conv.statut] || ""}`}>{CONVENTION_STATUT_LABELS[conv.statut]}</Badge>
            <Button variant="outline" onClick={() => setGedOpen(true)}>
              <Paperclip className="h-4 w-4 mr-2" /> Documents ({docs.length})
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Référence" value={conv.reference} />
            <Field label="Référence projet" value={conv.projectReference} />
            <Field label="Intitulé" value={conv.intitule} />
            <Field label="Bailleur" value={conv.bailleurNom || conv.bailleur} />
            <Field label="Détails bailleur" value={conv.bailleurDetails} />
            <Field label="Autorité contractante" value={conv.autoriteContractanteNom} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Dates & financier</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Date signature" value={fmtDate(conv.dateSignature)} />
            <Field label="Date début" value={fmtDate(conv.dateDebut)} />
            <Field label="Date fin" value={fmtDate(conv.dateFin)} />
            <Field label="Devise d'origine" value={conv.deviseOrigine} />
            <Field label="Montant devise" value={fmtAmount(conv.montantDevise, conv.deviseOrigine || "")} />
            <Field label="Taux de change" value={conv.tauxChange ?? "—"} />
            <Field label="Montant MRU" value={fmtAmount(conv.montantMru, "MRU")} />
            <Field label="Date création" value={fmtDate(conv.dateCreation)} />
          </CardContent>
        </Card>

        {(conv.dateValidation || conv.motifRejet) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Suivi de validation</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Statut" value={CONVENTION_STATUT_LABELS[conv.statut]} />
              <Field label="Date validation" value={fmtDate(conv.dateValidation)} />
              <Field label="Validée par (user ID)" value={conv.valideParUserId} />
              {conv.motifRejet && <Field label="Motif de rejet" value={conv.motifRejet} />}
            </CardContent>
          </Card>
        )}
      </div>

      <DocumentGED
        open={gedOpen}
        onOpenChange={setGedOpen}
        title={`Documents — ${conv.reference || `#${conv.id}`}`}
        dossierId={conv.id}
        documentTypes={CONVENTION_DOCUMENT_TYPES}
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

export default ConventionDetail;
