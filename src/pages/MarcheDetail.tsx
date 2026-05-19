import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  marcheApi, MarcheDto, MARCHE_DOCUMENT_TYPES, TypeDocumentMarche,
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
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutMarche } from "@/i18n/enums";
import { formatAmount, formatDate } from "@/i18n/format";

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

const MarcheDetail = () => {
  const { t } = useTranslation();
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

  usePageTitle("marches:detail.title", { ref: marche?.numeroMarche || `#${marche?.id ?? ""}` });

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isDelegate = hasRole(["AUTORITE_UPM", "AUTORITE_UEP"]);

  const errTitle = t("common:toast.error", { defaultValue: "Erreur" });

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
      toast({ title: errTitle, description: e.message || t("marches:detail.load_error"), variant: "destructive" });
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
        <div className="text-center py-20 text-muted-foreground">{t("marches:detail.not_found")}</div>
      </DashboardLayout>
    );
  }

  const canManage = (isAC || isDelegate) && marche.statut !== "CLOTURE" && marche.statut !== "ANNULE";
  const delegueDetails = (marche.delegueIds || [])
    .map(dId => delegues.find(d => d.id === dId))
    .filter(Boolean) as DelegueDto[];

  const devise = convention?.deviseOrigine || "MRU";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/marches")}>
              <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("marches:detail.back")}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Gavel className="h-6 w-6 text-primary" />
                {marche.numeroMarche || t("marches:detail.title_fallback", { id: marche.id })}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">{marche.intitule || "—"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className={`${STATUT_COLORS[marche.statut] || ""}`}>{tStatutMarche(marche.statut)}</Badge>
            {marche.demandeCorrectionId ? (
              <Badge className="bg-green-100 text-green-800">{t("marches:type.contrat")}</Badge>
            ) : (
              <Badge variant="outline">{t("marches:type.attribution")}</Badge>
            )}
            <Button variant="outline" onClick={() => setGedOpen(true)}>
              <Paperclip className="h-4 w-4 me-2" /> {t("marches:detail.documents_count", { count: docs.length })}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("marches:detail.sections.general")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label={t("marches:fields.numero")} value={marche.numeroMarche} />
            <Field label={t("marches:fields.intitule")} value={marche.intitule} />
            <Field label={t("marches:fields.date_signature")} value={formatDate(marche.dateSignature)} />
            <Field
              label={t("marches:fields.montant_ht")}
              value={formatAmount(marche.montantContratHt ?? marche.montantContratTtc, { currency: devise, minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            />
            <Field label={t("marches:fields.statut")} value={tStatutMarche(marche.statut)} />
            <Field
              label={t("marches:fields.type")}
              value={marche.demandeCorrectionId ? t("marches:type.contrat_long") : t("marches:type.attribution")}
            />
          </CardContent>
        </Card>

        {convention && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("marches:detail.sections.convention")}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field
                label={t("marches:fields.reference")}
                value={
                  <button
                    className="text-primary hover:underline"
                    onClick={() => navigate(`/dashboard/conventions/${convention.id}`)}
                  >
                    {convention.reference || `#${convention.id}`}
                  </button>
                }
              />
              <Field label={t("marches:fields.intitule")} value={convention.intitule} />
              <Field label={t("marches:fields.bailleur")} value={convention.bailleurNom || convention.bailleur} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">{t("marches:detail.sections.delegues")}</CardTitle></CardHeader>
          <CardContent>
            {delegueDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("marches:detail.delegues_empty")}</p>
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
        title={t("marches:ged.title", { ref: marche.numeroMarche || `#${marche.id}` })}
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
