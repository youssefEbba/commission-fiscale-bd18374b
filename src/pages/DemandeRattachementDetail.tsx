import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Download, ExternalLink, FileText, Loader2, User, XCircle } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { demandeRattachementApi, type DemandeRattachementDto, type DocumentDto } from "@/lib/api";
import { openDocument, downloadDocument } from "@/lib/openDocument";
import { showApiError, showSuccess } from "@/lib/feedback";
import { formatDateTime } from "@/i18n/format";
import { tTypeDocument } from "@/i18n/enums";
import { useSmartBack } from "@/hooks/useSmartBack";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { statutVariant } from "./DemandesRattachement";

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="space-y-0.5">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground break-words">{value || "—"}</p>
  </div>
);

/** Fiche d'une demande de rattachement : justificatifs d'abord, puis l'entité, puis le demandeur. Aucun mot de passe affiché. */
export default function DemandeRattachementDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(["rattachement"]);
  usePageTitle("rattachement:detail.title");
  const smartBack = useSmartBack("/dashboard/demandes-rattachement");
  const [d, setD] = useState<DemandeRattachementDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmRefuse, setConfirmRefuse] = useState(false);
  const [motif, setMotif] = useState("");
  const [motifError, setMotifError] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { setD(await demandeRattachementApi.getById(Number(id))); }
    catch (e) { showApiError(e, t("errors.load")); }
    finally { setLoading(false); }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!d) return;
    setActing(true);
    try { setD(await demandeRattachementApi.approuver(d.id)); showSuccess(t("detail.toast_approved")); await load(); }
    catch (e) { showApiError(e); }
    finally { setActing(false); setConfirmApprove(false); }
  };

  const refuse = async () => {
    if (!d) return;
    if (!motif.trim()) { setMotifError(true); return; }
    setActing(true);
    try { await demandeRattachementApi.refuser(d.id, motif.trim()); showSuccess(t("detail.toast_refused")); setConfirmRefuse(false); await load(); }
    catch (e) { showApiError(e); }
    finally { setActing(false); }
  };

  const open = async (doc: DocumentDto, download = false) => {
    try { await (download ? downloadDocument : openDocument)({ id: doc.id, nomFichier: doc.nomFichier }); }
    catch (e) { showApiError(e, t("detail.open_error")); }
  };

  if (loading) return <DashboardLayout><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  if (!d) return <DashboardLayout><p className="text-center text-muted-foreground py-20">{t("detail.not_found")}</p></DashboardLayout>;

  const enAttente = d.statut === "EN_ATTENTE";
  const docs = (d.documents || []).filter((x) => x.actif !== false);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={smartBack}><ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />{t("detail.back")}</Button>
          <h1 className="text-xl font-bold text-foreground">{t("detail.title")} <span dir="ltr">{d.reference || `#${d.id}`}</span></h1>
          <Badge variant={statutVariant(d.statut)}>{t(`statut.${d.statut}`)}</Badge>
        </div>

        {/* 1. Justificatifs */}
        <Card className="border-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />{t("detail.pieces_title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("detail.pieces_hint")}</p>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">{t("detail.pieces_empty")}</p> : (
              <ul className="divide-y divide-border">
                {docs.map((doc) => {
                  const code = doc.codeDocument || doc.type;
                  return (
                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{tTypeDocument(code as never) || code}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.nomFichier}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => open(doc)}><ExternalLink className="h-4 w-4 me-1" />{t("detail.open_doc")}</Button>
                        <Button size="sm" variant="outline" onClick={() => open(doc, true)}><Download className="h-4 w-4 me-1" />{t("detail.download")}</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 2. Entité */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />{t("detail.entite_title")}</CardTitle>
            {d.entiteNouvelle
              ? <Badge variant="outline" className="border-accent bg-accent/20 text-foreground">{t("detail.entite_nouvelle")}</Badge>
              : <Badge variant="secondary">{t("detail.entite_existante")}</Badge>}
          </CardHeader>
          <CardContent className="space-y-4">
            {d.entiteNouvelle && (
              <div className="flex gap-2 rounded-md border border-accent bg-accent/10 p-3 text-sm text-foreground">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-accent-foreground" />{t("detail.entite_nouvelle_hint")}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("detail.f_type")} value={d.typeEntite ? t(`type_entite.${d.typeEntite}`) : null} />
              <Field label={t("detail.f_nom")} value={d.entiteNouvelle ? d.entiteNom : (d.entiteNomAffiche || d.entiteNom)} />
              {d.entiteNouvelle && (
                <>
                  <Field label={t("detail.f_sigle")} value={d.entiteSigle} />
                  <Field label={t("detail.f_nif")} value={d.entiteNif} />
                  <Field label={t("detail.f_adresse")} value={d.entiteAdresse} />
                  {d.typeEntite === "ENTREPRISE"
                    ? <Field label={t("detail.f_activite")} value={d.entiteActivite} />
                    : <Field label={t("detail.f_ministere")} value={d.entiteMinistereTutelle} />}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. Demandeur */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary" />{t("detail.demandeur_title")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("detail.f_nom_complet")} value={d.nomComplet} />
            <Field label={t("detail.f_qualite")} value={d.roleDemande ? t(`roles.${d.roleDemande}`) : null} />
            <Field label={t("detail.f_username")} value={d.username} />
            <Field label={t("detail.f_email")} value={d.email} />
            <Field label={t("detail.f_telephone")} value={d.telephone} />
            <Field label={t("detail.f_date")} value={formatDateTime(d.dateDemande)} />
          </CardContent>
        </Card>

        {/* Décision */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">{t("detail.decision_title")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {enAttente ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setConfirmApprove(true)} disabled={acting}><CheckCircle2 className="h-4 w-4 me-1" />{t("detail.approve")}</Button>
                <Button variant="destructive" onClick={() => { setMotif(""); setMotifError(false); setConfirmRefuse(true); }} disabled={acting}><XCircle className="h-4 w-4 me-1" />{t("detail.refuse")}</Button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {d.dateDecision && <p className="text-muted-foreground">{t("detail.decided_on", { date: formatDateTime(d.dateDecision) })}{d.decideurNom ? ` — ${d.decideurNom}` : ""}</p>}
                {d.statut === "REFUSEE" && d.motifRefus && <Field label={t("detail.motif_refus")} value={d.motifRefus} />}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.confirm_approve_title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="list-disc ps-5 space-y-1 text-sm text-muted-foreground">
                {d.entiteNouvelle && <li>{t("detail.confirm_approve_new", { nom: d.entiteNom })}</li>}
                <li>{t("detail.confirm_approve_account", { username: d.username })}</li>
                <li>{t("detail.confirm_approve_mail")}</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); approve(); }} disabled={acting}>
              {acting && <Loader2 className="h-4 w-4 me-1 animate-spin" />}{t("detail.approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRefuse} onOpenChange={setConfirmRefuse}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("detail.confirm_refuse_title")}</AlertDialogTitle></AlertDialogHeader>
          <div className="space-y-1">
            <Label>{t("detail.motif_label")} *</Label>
            <Textarea value={motif} onChange={(e) => { setMotif(e.target.value); setMotifError(false); }} placeholder={t("detail.motif_placeholder")} rows={4} />
            {motifError && <p className="text-sm text-destructive">{t("detail.motif_required")}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); refuse(); }} disabled={acting}>
              {acting && <Loader2 className="h-4 w-4 me-1 animate-spin" />}{t("detail.refuse")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
