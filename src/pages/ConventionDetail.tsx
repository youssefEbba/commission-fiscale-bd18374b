import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  conventionApi, ConventionDto,
  DocumentDto, CONVENTION_DOCUMENT_TYPES, TypeDocumentConvention,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DocumentGED from "@/components/ged/DocumentGED";
import { ArrowLeft, FileText, Loader2, Paperclip } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutConvention } from "@/i18n/enums";
import { formatDate, formatAmount, formatNumber } from "@/i18n/format";

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

const ConventionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { t } = useTranslation(["conventions", "common"]);

  const [conv, setConv] = useState<ConventionDto | null>(null);
  const [loading, setLoading] = useState(true);

  const [gedOpen, setGedOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isAdmin = hasRole(["ADMIN_SI"]);

  usePageTitle("conventions:detail.title", { ref: conv?.reference || `#${id}` });

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await conventionApi.getById(Number(id));
      setConv(data);
    } catch (e: any) {
      toast({ title: t("common:errors.title", "Erreur"), description: e.message || t("conventions:detail.load_error"), variant: "destructive" });
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
        <div className="text-center py-20 text-muted-foreground">{t("conventions:detail.not_found")}</div>
      </DashboardLayout>
    );
  }

  const canManage = (isAC || isAdmin) && conv.statut !== "VALIDE" && conv.statut !== ("ANNULEE" as any);
  const devise = conv.deviseOrigine || "MRU";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/conventions")}>
              <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("conventions:detail.back")}
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
            <Badge className={`${STATUT_COLORS[conv.statut] || ""}`}>{tStatutConvention(conv.statut)}</Badge>
            <Button variant="outline" onClick={() => setGedOpen(true)}>
              <Paperclip className="h-4 w-4 me-2" /> {t("conventions:detail.documents_button", { count: docs.length })}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("conventions:detail.section_general")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label={t("conventions:fields.reference_required").replace(" *", "")} value={conv.reference} />
            <Field label={t("conventions:fields.project_reference")} value={conv.projectReference} />
            <Field label={t("conventions:fields.intitule")} value={conv.intitule} />
            <Field label={t("conventions:fields.bailleur")} value={conv.bailleurNom || conv.bailleur} />
            <Field label={t("conventions:fields.bailleur_details")} value={conv.bailleurDetails} />
            <Field label={t("conventions:fields.autorite_contractante")} value={conv.autoriteContractanteNom} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("conventions:detail.section_dates_financial")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label={t("conventions:fields.date_signature")} value={formatDate(conv.dateSignature)} />
            <Field label={t("conventions:fields.date_debut")} value={formatDate((conv as any).dateDebut)} />
            <Field label={t("conventions:fields.date_fin")} value={formatDate(conv.dateFin)} />
            <Field label={t("conventions:fields.devise")} value={conv.deviseOrigine} />
            <Field label={t("conventions:fields.montant_devise")} value={conv.montantDevise != null ? formatAmount(conv.montantDevise, { currency: devise, minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"} />
            <Field label={t("conventions:fields.taux_change")} value={conv.tauxChange != null ? formatNumber(conv.tauxChange) : "—"} />
            <Field label={t("conventions:fields.montant_mru")} value={conv.montantMru != null ? formatAmount(conv.montantMru, { currency: "MRU", minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"} />
            <Field label={t("conventions:fields.date_creation")} value={formatDate(conv.dateCreation)} />
          </CardContent>
        </Card>

        {(conv.dateValidation || conv.motifRejet) && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("conventions:detail.section_validation")}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label={t("conventions:fields.statut")} value={tStatutConvention(conv.statut)} />
              <Field label={t("conventions:fields.date_validation")} value={formatDate(conv.dateValidation)} />
              <Field label={t("conventions:fields.validated_by")} value={conv.valideParUserId} />
              {conv.motifRejet && <Field label={t("conventions:fields.motif_rejet")} value={conv.motifRejet} />}
            </CardContent>
          </Card>
        )}
      </div>

      <DocumentGED
        open={gedOpen}
        onOpenChange={setGedOpen}
        title={t("conventions:docs.modal_title", { ref: conv.reference || `#${conv.id}` })}
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
