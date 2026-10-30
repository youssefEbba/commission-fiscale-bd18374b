import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DocumentGED, { GEDDocument } from "@/components/ged/DocumentGED";
import { useAuth } from "@/contexts/AuthContext";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useGedPieces } from "@/hooks/useGedPieces";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";
import {
  avenantApi, AvenantDto, certificatCreditApi, CertificatCreditDto,
  demandeCorrectionApi, DemandeCorrectionDto,
} from "@/lib/api";
import { avenantActions, canUploadAvenantPieces } from "@/lib/avenants";
import { tStatutDemande, tTypeAvenant } from "@/i18n/enums";
import { formatAmount, formatDate, formatDateTime } from "@/i18n/format";
import AvenantStatutBadge from "@/components/avenants/AvenantStatutBadge";
import AvenantMotifDialog from "@/components/avenants/AvenantMotifDialog";
import AvenantApplyDialog from "@/components/avenants/AvenantApplyDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, CheckCircle2, Circle, FileText, FilePen, Loader2, RefreshCw,
  XCircle, PlayCircle, ClipboardCheck, ExternalLink,
} from "lucide-react";

type Geste = "prise_en_charge" | "validation" | "rejet";

const AvenantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const smartBack = useSmartBack("/dashboard/modifications");
  const { t } = useTranslation(["modifications", "common"]);
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const [avenant, setAvenant] = useState<AvenantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docs, setDocs] = useState<GEDDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [gedOpen, setGedOpen] = useState(false);
  const [geste, setGeste] = useState<Geste | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [certificat, setCertificat] = useState<CertificatCreditDto | null>(null);
  const [correction, setCorrection] = useState<DemandeCorrectionDto | null>(null);
  const [applyPreparing, setApplyPreparing] = useState(false);

  const ged = useGedPieces("MODIFICATION_CI");
  const ref = avenant?.numero || (avenant ? `#${avenant.id}` : "");
  usePageTitle("modifications:detail.title", { ref: ref || `#${id ?? ""}` });

  const loadDocs = async (avId: number) => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const list = await avenantApi.getDocuments(avId);
      setDocs(list.map((d) => ({ ...d, type: d.codeDocument })));
    } catch (e: any) {
      setDocs([]);
      setDocsError(e?.message || t("modifications:detail.pieces_error"));
    } finally {
      setDocsLoading(false);
    }
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const a = await avenantApi.getById(Number(id));
      setAvenant(a);
      loadDocs(a.id);
    } catch (e: any) {
      setAvenant(null);
      setLoadError(e?.message || t("modifications:detail.load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const canUpload = !!avenant && canUploadAvenantPieces(avenant, hasPermission);

  // Après un dépôt : ouvrir directement les pièces.
  useEffect(() => {
    if (avenant && canUpload && searchParams.get("pieces") === "1") {
      setGedOpen(true);
      searchParams.delete("pieces");
      setSearchParams(searchParams, { replace: true });
    }
  }, [avenant, canUpload, searchParams, setSearchParams]);

  const okToast = (description: string) => toast({ title: t("common:success", { defaultValue: "Succès" }), description });
  const errToast = (e: any) => toast({ title: t("common:error", { defaultValue: "Erreur" }), description: e?.message || String(e), variant: "destructive" });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  if (!avenant) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 space-y-4">
          <p className="text-muted-foreground">{loadError || t("modifications:detail.not_found")}</p>
          <Button variant="outline" onClick={smartBack}>
            <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t("modifications:detail.back")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const a = avenant;
  const actions = avenantActions(a, hasPermission);
  const financier = a.type === "FINANCIER";
  const hasActions = !!(actions.priseEnCharge || actions.rejet || actions.validation || actions.application);
  // Rejet à l'examen (DEPOSE, DGTCP) ou à la validation (Président / administrateur).
  const rejetAdmin = actions.rejet === "admin";

  const runGeste = async (motif: string) => {
    try {
      let res: AvenantDto;
      if (geste === "prise_en_charge") {
        res = await avenantApi.priseEnCharge(a.id, actions.priseEnCharge === "admin" ? motif : null);
        okToast(t("modifications:toast.prise_en_charge_ok"));
      } else if (geste === "validation") {
        res = await avenantApi.validation(a.id, actions.validation === "admin" ? motif : null);
        okToast(financier ? t("modifications:toast.validation_financier_ok") : t("modifications:toast.validation_ok"));
      } else {
        res = await avenantApi.rejet(a.id, motif);
        okToast(t("modifications:toast.rejet_ok"));
      }
      setAvenant(res);
      load();
    } catch (e) {
      errToast(e);
      throw e;
    }
  };

  const openApply = async () => {
    if (!financier) { setApplyOpen(true); return; }
    setApplyPreparing(true);
    const [certRes, corrRes] = await Promise.allSettled([
      certificatCreditApi.getById(a.certificatCreditId),
      a.demandeCorrectionId != null ? demandeCorrectionApi.getById(a.demandeCorrectionId) : Promise.resolve(null),
    ]);
    setCertificat(certRes.status === "fulfilled" ? certRes.value : null);
    setCorrection(corrRes.status === "fulfilled" ? corrRes.value : null);
    if (certRes.status === "rejected") errToast(certRes.reason);
    setApplyPreparing(false);
    setApplyOpen(true);
  };

  const gesteMode = geste === "prise_en_charge" ? actions.priseEnCharge : geste === "validation" ? actions.validation : actions.rejet;
  const adminHint = gesteMode === "admin"
    ? (geste === "prise_en_charge" ? t("modifications:dialogs.admin_hint_dgtcp") : t("modifications:dialogs.admin_hint_president"))
    : undefined;

  // Étapes du circuit
  const rejeteAExamen = a.statut === "REJETE" && !a.dateExamen;
  const rejeteAValidation = a.statut === "REJETE" && !!a.dateExamen && !a.dateValidation;
  const steps: Array<{ key: string; date?: string | null; done: boolean; rejected: boolean; hint?: string }> = [
    { key: "depot", date: a.dateDepot, done: true, rejected: false },
    { key: "examen", date: a.dateExamen, done: !!a.dateExamen, rejected: rejeteAExamen },
    { key: "validation", date: a.dateValidation, done: !!a.dateValidation, rejected: rejeteAValidation, hint: financier ? t("modifications:detail.steps.validation_financier_hint") : undefined },
    { key: "application", date: a.dateApplication, done: !!a.dateApplication, rejected: false },
  ];

  const nextKey = a.statut === "DEPOSE" ? "depose"
    : a.statut === "EN_COURS_TRAITEMENT" ? (a.demandeCorrectionId != null ? "en_cours_correction" : financier ? "en_cours_financier" : "en_cours")
    : a.statut === "ADOPTE" ? "adopte"
    : a.statut === "APPLIQUE" ? "applique" : null;

  const snapshotRows: Array<{ key: string; avant?: number | null; apres?: number | null }> = [
    { key: "cordon", avant: a.montantCordonAvant, apres: a.montantCordonApres },
    { key: "tva", avant: a.montantTVAInterieureAvant, apres: a.montantTVAInterieureApres },
    { key: "solde_cordon", avant: a.soldeCordonAvant, apres: a.soldeCordonApres },
    { key: "solde_tva", avant: a.soldeTVAAvant, apres: a.soldeTVAApres },
    { key: "tva_import", avant: a.tvaImportationRestanteAvant, apres: a.tvaImportationRestanteApres },
  ];
  const hasSnapshot = a.statut === "APPLIQUE" && snapshotRows.some((r) => r.avant != null || r.apres != null);
  const amount = (v?: number | null) => (v == null ? t("modifications:na") : formatAmount(v));

  const currentDocs = (() => {
    const byType = new Map<string, GEDDocument>();
    docs.forEach((d) => {
      const prev = byType.get(d.type);
      if (!prev || (d.actif !== false && (d.version ?? 0) >= (prev.version ?? 0))) byType.set(d.type, d);
    });
    return Array.from(byType.values());
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={smartBack}>
              <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t("modifications:detail.back")}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FilePen className="h-6 w-6 text-primary" />
                {t("modifications:detail.title", { ref })}
              </h1>
              <p className="text-muted-foreground text-sm">{tTypeAvenant(a.type)}</p>
            </div>
          </div>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 me-2" /> {t("modifications:actions.refresh")}
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">{t("modifications:detail.info_title")}</CardTitle>
            <AvenantStatutBadge statut={a.statut} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("modifications:detail.fields.certificat")}</span>
                <p className="font-medium">
                  <Link to={`/dashboard/certificats/${a.certificatCreditId}`} className="text-primary hover:underline">
                    {a.certificatReference || a.certificatNumero || `#${a.certificatCreditId}`}
                  </Link>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("modifications:detail.fields.entreprise")}</span>
                <p className="font-medium">{a.entrepriseNom || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("modifications:detail.fields.autorite")}</span>
                <p className="font-medium">{a.autoriteContractanteNom || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("modifications:detail.fields.type")}</span>
                <p className="font-medium">{tTypeAvenant(a.type)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("modifications:detail.fields.date_signature")}</span>
                <p className="font-medium">{a.dateSignature ? formatDate(a.dateSignature) : "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("modifications:detail.fields.date_depot")}</span>
                <p className="font-medium">{a.dateDepot ? formatDate(a.dateDepot) : "—"}</p>
              </div>
              {financier && (
                <>
                  <div>
                    <span className="text-muted-foreground">{t("modifications:detail.fields.credit_exterieur_propose")}</span>
                    <p className="font-medium">{amount(a.creditExterieurPropose)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("modifications:detail.fields.credit_interieur_propose")}</span>
                    <p className="font-medium">{amount(a.creditInterieurPropose)}</p>
                  </div>
                </>
              )}
            </div>
            {a.motif && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t("modifications:detail.fields.motif")}</span>
                <p className="whitespace-pre-wrap">{a.motif}</p>
              </div>
            )}

            {nextKey && (
              <p className="text-sm rounded-md border border-border bg-muted/40 p-3">{t(`modifications:detail.next.${nextKey}`)}</p>
            )}

            {hasActions && (
              <div className="pt-4 border-t border-border flex flex-wrap gap-2">
                {actions.priseEnCharge && (
                  <Button size="sm" onClick={() => setGeste("prise_en_charge")}>
                    <ClipboardCheck className="h-4 w-4 me-1" /> {t("modifications:actions.prise_en_charge")}
                    {actions.priseEnCharge === "admin" && <Badge variant="secondary" className="ms-2 text-[10px]">{t("modifications:actions.admin_badge")}</Badge>}
                  </Button>
                )}
                {actions.validation && (
                  <Button size="sm" onClick={() => setGeste("validation")}>
                    <CheckCircle2 className="h-4 w-4 me-1" /> {t("modifications:actions.valider")}
                    {actions.validation === "admin" && <Badge variant="secondary" className="ms-2 text-[10px]">{t("modifications:actions.admin_badge")}</Badge>}
                  </Button>
                )}
                {actions.application && (
                  <Button size="sm" onClick={openApply} disabled={applyPreparing}>
                    {applyPreparing ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <PlayCircle className="h-4 w-4 me-1" />}
                    {t("modifications:actions.appliquer")}
                  </Button>
                )}
                {actions.rejet && (
                  <Button size="sm" variant="destructive" onClick={() => setGeste("rejet")}>
                    <XCircle className="h-4 w-4 me-1" /> {t("modifications:actions.rejeter")}
                    {rejetAdmin && <Badge variant="secondary" className="ms-2 text-[10px]">{t("modifications:actions.admin_badge")}</Badge>}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {a.statut === "REJETE" && (
          <Card className="border-destructive/40">
            <CardHeader><CardTitle className="text-base text-destructive">{t("modifications:detail.motif_rejet")}</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{a.motifRejet || "—"}</p></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">{t("modifications:detail.steps_title")}</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {steps.map((s) => (
                <li key={s.key} className="flex items-start gap-3">
                  {s.rejected ? <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    : s.done ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <div className="text-sm">
                    <p className="font-medium">{t(`modifications:detail.steps.${s.key}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.rejected ? t("modifications:detail.steps.rejected") : s.date ? formatDateTime(s.date) : t("modifications:detail.steps.pending")}
                    </p>
                    {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {financier && a.demandeCorrectionId != null && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("modifications:detail.correction_title")}</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 text-sm">
              <Link to={`/dashboard/demandes/${a.demandeCorrectionId}`} className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                {a.demandeCorrectionReference || `#${a.demandeCorrectionId}`} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              {a.demandeCorrectionStatut && <Badge variant="outline">{tStatutDemande(a.demandeCorrectionStatut)}</Badge>}
              <p className="w-full text-xs text-muted-foreground">{t("modifications:detail.correction_hint")}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> {t("modifications:detail.pieces_title")}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setGedOpen(true)}>
              {canUpload ? t("modifications:detail.pieces_manage") : t("modifications:detail.pieces_view")}
            </Button>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : docsError ? (
              <p className="text-xs text-destructive">{docsError}</p>
            ) : currentDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t("modifications:detail.pieces_empty")}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {currentDocs.map((d) => (
                  <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{ged.labelOf(d.type)}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.nomFichier}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{formatDate(d.dateUpload)}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {a.statut !== "DEPOSE" && <p className="mt-3 text-xs text-muted-foreground">{t("modifications:detail.pieces_locked")}</p>}
          </CardContent>
        </Card>

        {hasSnapshot && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("modifications:detail.avant_apres_title")}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs">
                    <th className="text-start font-medium py-2">{t("modifications:detail.avant_apres.libelle")}</th>
                    <th className="text-end font-medium py-2">{t("modifications:detail.avant_apres.avant")}</th>
                    <th className="text-end font-medium py-2">{t("modifications:detail.avant_apres.apres")}</th>
                    <th className="text-end font-medium py-2">{t("modifications:detail.avant_apres.ecart")}</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotRows.map((r) => (
                    <tr key={r.key} className="border-t border-border">
                      <td className="py-2">{t(`modifications:detail.avant_apres.rows.${r.key}`)}</td>
                      <td className="py-2 text-end">{amount(r.avant)}</td>
                      <td className="py-2 text-end font-medium">{amount(r.apres)}</td>
                      <td className="py-2 text-end text-muted-foreground">{r.avant != null && r.apres != null ? amount(r.apres - r.avant) : t("modifications:na")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      <DocumentGED
        open={gedOpen}
        onOpenChange={setGedOpen}
        title={t("modifications:detail.pieces_dialog_title", { ref })}
        dossierId={a.id}
        documentTypes={ged.options.map((o) => ({ value: o.code, label: o.label }))}
        documents={docs}
        loading={docsLoading}
        loadError={docsError}
        canUpload={canUpload}
        onUpload={async (dossierId, code, file) => { await avenantApi.uploadDocument(dossierId, code, file); }}
        onRefresh={async (dossierId) => { await loadDocs(dossierId); }}
      />

      <AvenantMotifDialog
        open={geste !== null}
        onOpenChange={(o) => { if (!o) setGeste(null); }}
        title={geste ? t(`modifications:dialogs.${geste}_title`) : ""}
        description={geste === "validation" && financier ? t("modifications:dialogs.validation_financier_desc") : geste ? t(`modifications:dialogs.${geste}_desc`) : undefined}
        motifRequired={geste === "rejet" || gesteMode === "admin"}
        adminHint={adminHint}
        confirmLabel={geste === "rejet" ? t("modifications:actions.rejeter") : geste === "validation" ? t("modifications:actions.valider") : t("modifications:actions.prise_en_charge")}
        destructive={geste === "rejet"}
        onConfirm={runGeste}
      />

      {actions.application && (
        <AvenantApplyDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          avenant={a}
          certificat={certificat}
          correction={correction}
          onApplied={(res) => { setAvenant(res); load(); }}
        />
      )}
    </DashboardLayout>
  );
};

export default AvenantDetail;
