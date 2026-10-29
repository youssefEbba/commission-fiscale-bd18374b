import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
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
import { tStatutMarche, tTypeDocument } from "@/i18n/enums";
import { formatAmount, formatDate } from "@/i18n/format";
import { displayRef } from "@/lib/displayRef";
import { canEditMarche } from "@/lib/marcheEditability";
import { formatApiErrorMessage } from "@/lib/api";
import { conventionBailleurs, marcheConventionIds } from "@/lib/conventionEditability";

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
  const smartBack = useSmartBack("/dashboard/marches");
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const [marche, setMarche] = useState<MarcheDto | null>(null);
  /** Conventions du marché dans l'ordre serveur (principale en tête) ; null = lecture refusée/échouée. */
  const [conventions, setConventions] = useState<{ id: number; conv: ConventionDto | null }[]>([]);
  const [delegues, setDelegues] = useState<DelegueDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [gedOpen, setGedOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  usePageTitle("marches:detail.title", { ref: marche ? displayRef(marche) : "" });

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
      const ids = marcheConventionIds(m);
      tasks.push(
        Promise.allSettled(ids.map((cid) => conventionApi.getById(cid))).then((res) =>
          setConventions(ids.map((cid, i) => ({ id: cid, conv: res[i].status === "fulfilled" ? (res[i] as PromiseFulfilledResult<ConventionDto>).value : null }))),
        ),
      );
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
    setDocsError(null);
    setDocs([]);
    try {
      setDocs(await marcheApi.getDocuments(Number(id)));
    } catch (error) {
      setDocs([]);
      setDocsError(formatApiErrorMessage(error, t("marches:detail.load_error")));
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

  const canManage = (isAC || isDelegate) && canEditMarche(marche.statut) && !docsError;
  const delegueDetails = (marche.delegueIds || [])
    .map(dId => delegues.find(d => d.id === dId))
    .filter(Boolean) as DelegueDto[];

  const devise = conventions[0]?.conv?.deviseOrigine || "MRU";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={smartBack}>
              <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("marches:detail.back")}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Gavel className="h-6 w-6 text-primary" />
                {displayRef(marche)}
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
              <Paperclip className="h-4 w-4 me-2" /> {docsError ? t("marches:actions.documents") : t("marches:detail.documents_count", { count: docs.length })}
            </Button>
          </div>
        </div>

        {docsError && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{docsError}</p>}

        <Card>
          <CardHeader><CardTitle className="text-base">{t("marches:detail.sections.general")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label={t("marches:fields.numero")} value={marche.numeroMarche} />
            <Field label={t("marches:fields.intitule")} value={marche.intitule} />
            <Field label={t("marches:type_marche.type_marche")} value={marche.typeMarche ? t(`marches:type_marche.${marche.typeMarche}`) : t("marches:type_marche.non_renseigne")} />
            <Field label={t("marches:fields.date_signature")} value={formatDate(marche.dateSignature)} />
            <Field
              label={t("marches:fields.montant_ht")}
              value={formatAmount(marche.montantContratHt ?? marche.montantContratTtc, { currency: devise, minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            />
            <Field label={t("marches:fields.statut")} value={tStatutMarche(marche.statut)} />
            <Field label={t("marches:fields.autorite")} value={marche.autoriteContractanteNom || "—"} />
            <Field
              label={t("marches:fields.type")}
              value={marche.demandeCorrectionId ? t("marches:type.contrat_long") : t("marches:type.attribution")}
            />
          </CardContent>
        </Card>

        {conventions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("marches:detail.sections.conventions")}</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-border rounded-md border border-border">
                {conventions.map(({ id: cid, conv }, i) => (
                  <li key={cid} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.5fr)] gap-2 px-3 py-2 text-sm items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <button className="text-primary hover:underline truncate" onClick={() => navigate(`/dashboard/conventions/${cid}`)}>
                        {conv?.reference || `#${cid}`}
                      </button>
                      {i === 0 && <Badge variant="secondary" className="text-[10px] shrink-0">{t("marches:detail.convention_principale")}</Badge>}
                    </div>
                    <span className="text-foreground truncate" title={conv?.intitule || ""}>{conv?.intitule || "—"}</span>
                    <span className="text-muted-foreground truncate">
                      {conv ? (conventionBailleurs(conv).map((b) => b.nom).join(", ") || "—") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
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
        title={t("marches:ged.title", { ref: displayRef(marche) })}
        dossierId={marche.id}
        documentTypes={MARCHE_DOCUMENT_TYPES.map(v => ({ value: v, label: tTypeDocument(v) }))}
        documents={docs}
        loading={docsLoading}
        loadError={docsError}
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
