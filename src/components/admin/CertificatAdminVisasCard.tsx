import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { certificatCreditApi, CertificatStatut, CertificatVisaEtatDto } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { tTypeDocument } from "@/i18n/enums";
import { formatDate } from "@/i18n/format";
import { showApiError, showSuccess } from "@/lib/feedback";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, CheckCircle, Loader2, AlertTriangle, Unlock } from "lucide-react";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";

/** Statuts autorisant l'ouverture administrateur du crédit. */
const OUVERTURE_STATUTS: CertificatStatut[] = ["VALIDE_PRESIDENT", "EN_OUVERTURE_DGTCP"];

interface Props {
  certificatId: number;
  statut: CertificatStatut;
  /** Rafraîchit le certificat parent après une action administrateur. */
  onSuccess?: () => void;
  /** Change à chaque rafraîchissement du certificat parent → recharge les visas. */
  refreshKey?: number;
  /** Ouvre le formulaire de montants (mode administrateur) de la page parente. */
  onOpenMontantsAdmin?: () => void;
  /** Génère le certificat à signer (même PDF que le Président), fourni par la page parente. */
  onGenerateCertificatToSign?: () => Promise<unknown> | void;
}

const CertificatAdminVisasCard = ({ certificatId, statut, onSuccess, refreshKey, onOpenMontantsAdmin, onGenerateCertificatToSign }: Props) => {
  const [generating, setGenerating] = useState(false);
  const { t } = useTranslation();
  const { hasPermission, hasRole } = useAuth();
  const isAdmin = hasRole(["ADMIN_SI"]);
  const canVisaOverride = hasPermission("certificat.visa.admin_override") || isAdmin;
  const canOuvertureOverride = hasPermission("certificat.ouverture.admin_override") || isAdmin;

  const [visas, setVisas] = useState<CertificatVisaEtatDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<CertificatVisaEtatDto | null>(null);
  const [motif, setMotif] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [ouvertureOpen, setOuvertureOpen] = useState(false);
  const [ouvertureMotif, setOuvertureMotif] = useState("");
  const [ouvertureSubmitting, setOuvertureSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await certificatCreditApi.getVisas(certificatId);
      setVisas(Array.isArray(data) ? data : []);
    } catch {
      setVisas([]);
    } finally {
      setLoading(false);
    }
  }, [certificatId]);

  useEffect(() => { if (canVisaOverride) load(); }, [canVisaOverride, load, refreshKey]);

  const [pecOpen, setPecOpen] = useState(false);
  const [pecMotif, setPecMotif] = useState("");
  const [pecSubmitting, setPecSubmitting] = useState(false);

  if (!canVisaOverride && !canOuvertureOverride) return null;

  const roleLabel = (role: string) => t(`roles:${role}`, { defaultValue: role });

  const isPresidentTarget = target?.role === "PRESIDENT";
  // Fichier exigé uniquement pour le Président et si le document n'est pas déjà déposé.
  const fileRequired = isPresidentTarget && !target?.documentRequisPresent;

  const openDialog = (v: CertificatVisaEtatDto) => {
    setTarget(v);
    setMotif("");
    setFile(null);
  };

  const submit = async () => {
    if (!target || !motif.trim()) return;
    if (fileRequired && !file) return;
    setSubmitting(true);
    try {
      const res = await certificatCreditApi.poserVisaAdmin(
        certificatId,
        target.role,
        motif.trim(),
        isPresidentTarget ? file : null,
      );
      if (Array.isArray(res?.visas)) setVisas(res.visas);
      else await load();
      setTarget(null);
      showSuccess(
        t("mise_en_place:detail.admin_visas.toast_title"),
        t("mise_en_place:detail.admin_visas.toast_desc", { role: roleLabel(target.role) }),
      );
      onSuccess?.();
    } catch (e) {
      showApiError(e, t("mise_en_place:detail.admin_visas.error_title"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitOuverture = async () => {
    if (!ouvertureMotif.trim()) return;
    setOuvertureSubmitting(true);
    try {
      await certificatCreditApi.ouvertureAdmin(certificatId, ouvertureMotif.trim());
      setOuvertureOpen(false);
      setOuvertureMotif("");
      showSuccess(
        t("mise_en_place:detail.admin_ouverture.toast_title"),
        t("mise_en_place:detail.admin_ouverture.toast_desc"),
      );
      await load();
      onSuccess?.();
    } catch (e) {
      showApiError(e, t("mise_en_place:detail.admin_ouverture.error_title"));
    } finally {
      setOuvertureSubmitting(false);
    }
  };

  const submitPec = async () => {
    if (!pecMotif.trim()) return;
    setPecSubmitting(true);
    try {
      await certificatCreditApi.priseEnChargeAdmin(certificatId, pecMotif.trim());
      setPecOpen(false);
      showSuccess(t("mise_en_place:detail.admin_pec.toast_title"), t("mise_en_place:detail.admin_pec.toast_desc"));
      await load();
      onSuccess?.();
    } catch (e) {
      showApiError(e, t("mise_en_place:detail.admin_pec.error_title"));
    } finally {
      setPecSubmitting(false);
    }
  };

  const dgtcpRow = visas?.find((v) => v.role === "DGTCP");
  const montantsBlocked = !!dgtcpRow && !dgtcpRow.pose && !dgtcpRow.visableParAdmin
    && dgtcpRow.codeBlocage === "MONTANTS_MANQUANTS";

  const ouvertureAvailable = canOuvertureOverride && OUVERTURE_STATUTS.includes(statut);

  return (
    <>
      {canVisaOverride && (
        <Card className="border-primary/30">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{t("mise_en_place:detail.admin_visas.title")}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{t("mise_en_place:detail.admin_visas.description")}</p>

            {statut === "ENVOYEE" && (
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t("mise_en_place:detail.admin_pec.title")}</p>
                  <p className="text-[11px] text-muted-foreground">{t("mise_en_place:detail.admin_pec.description")}</p>
                </div>
                <Button size="sm" onClick={() => { setPecMotif(""); setPecOpen(true); }}>
                  {t("mise_en_place:detail.admin_pec.action")}
                </Button>
              </div>
            )}

            {montantsBlocked && onOpenMontantsAdmin && (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t("mise_en_place:detail.admin_montants.title")}</p>
                  <p className="text-[11px] text-amber-700">{dgtcpRow?.motifBlocage}</p>
                </div>
                <Button size="sm" onClick={onOpenMontantsAdmin}>
                  {t("mise_en_place:detail.admin_montants.action")}
                </Button>
              </div>
            )}

            {loading && !visas ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("common:states.loading")}
              </div>
            ) : !visas || visas.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("common:states.empty")}</p>
            ) : (
              <div className="space-y-2">
                {visas.map((v) => {
                  const isPresident = v.role === "PRESIDENT";
                  return (
                    <div key={v.role} className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{roleLabel(v.role)}</span>
                          {v.pose ? (
                            <Badge className="bg-green-100 text-green-700 text-[10px]">
                              <CheckCircle className="h-3 w-3 me-1" />
                              {isPresident
                                ? t("mise_en_place:detail.admin_visas.state_validated")
                                : t("mise_en_place:detail.admin_visas.state_posed")}
                            </Badge>
                          ) : !v.requis ? (
                            <Badge variant="outline" className="text-[10px]">{t("mise_en_place:detail.admin_visas.state_not_concerned")}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                              {t("mise_en_place:detail.admin_visas.state_pending")}
                            </Badge>
                          )}
                          {v.visaParAdmin && (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                              {t("mise_en_place:detail.admin_visas.by_admin")}
                            </Badge>
                          )}
                        </div>
                        {v.pose && (v.datePose || v.utilisateurNom) && (
                          <p className="text-[11px] text-muted-foreground">
                            {t("mise_en_place:detail.admin_visas.posed_meta", {
                              date: v.datePose ? formatDate(v.datePose) : "—",
                              user: v.utilisateurNom || "—",
                            })}
                          </p>
                        )}
                        {isPresident && v.codeDocumentRequis && (
                          <p className="text-[11px] text-muted-foreground">
                            {t("mise_en_place:detail.admin_visas.doc_required")} : {tTypeDocument(v.codeDocumentRequis)} —{" "}
                            <span className={v.documentRequisPresent ? "text-green-700" : "text-amber-700"}>
                              {v.documentRequisPresent
                                ? t("mise_en_place:detail.admin_visas.doc_present")
                                : t("mise_en_place:detail.admin_visas.doc_missing")}
                            </span>
                          </p>
                        )}
                        {!v.pose && !v.visableParAdmin && v.motifBlocage && (
                          <p className="text-[11px] text-amber-700 flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {v.motifBlocage}
                          </p>
                        )}
                      </div>
                      {!v.pose && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!v.visableParAdmin}
                          title={!v.visableParAdmin ? v.motifBlocage ?? undefined : undefined}
                          onClick={() => openDialog(v)}
                        >
                          {isPresident
                            ? t("mise_en_place:detail.admin_visas.action_validate")
                            : t("mise_en_place:detail.admin_visas.action_visa", { role: roleLabel(v.role) })}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {ouvertureAvailable && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Unlock className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">{t("mise_en_place:detail.admin_ouverture.title")}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{t("mise_en_place:detail.admin_ouverture.description")}</p>
            <p className="text-[11px] text-destructive flex items-start gap-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {t("mise_en_place:detail.admin_ouverture.warning")}
            </p>
            <Button variant="destructive" size="sm" onClick={() => { setOuvertureMotif(""); setOuvertureOpen(true); }}>
              {t("mise_en_place:detail.admin_ouverture.action")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!target} onOpenChange={(o) => { if (!o && !submitting) setTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isPresidentTarget
                ? t("mise_en_place:detail.admin_visas.action_validate")
                : t("mise_en_place:detail.admin_visas.action_visa", { role: target ? roleLabel(target.role) : "" })}
            </DialogTitle>
            <DialogDescription>
              {t("mise_en_place:detail.admin_visas.dialog_warning", { role: target ? roleLabel(target.role) : "" })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("mise_en_place:detail.admin_visas.motif_label")} *</Label>
              <Textarea
                rows={3}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder={t("mise_en_place:detail.admin_visas.motif_placeholder")}
              />
            </div>
            {isPresidentTarget && (
              <div className="space-y-1.5">
                <Label>
                  {tTypeDocument(target?.codeDocumentRequis || "CERTIFICAT_CREDIT_IMPOTS")}{" "}
                  {fileRequired ? "*" : `(${t("mise_en_place:detail.admin_visas.file_optional")})`}
                </Label>
                <Input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {fileRequired && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("mise_en_place:detail.admin_visas.file_required_hint")}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={submitting}>
              {t("common:actions.cancel")}
            </Button>
            <Button onClick={submit} disabled={submitting || !motif.trim() || (fileRequired && !file)}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {t("mise_en_place:detail.admin_visas.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pecOpen} onOpenChange={(o) => { if (!o && !pecSubmitting) setPecOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("mise_en_place:detail.admin_pec.dialog_title")}</DialogTitle>
            <DialogDescription>{t("mise_en_place:detail.admin_pec.dialog_warning")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("mise_en_place:detail.admin_visas.motif_label")} *</Label>
            <Textarea rows={3} value={pecMotif} onChange={(e) => setPecMotif(e.target.value)} placeholder={t("mise_en_place:detail.admin_visas.motif_placeholder")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPecOpen(false)} disabled={pecSubmitting}>{t("common:actions.cancel")}</Button>
            <Button onClick={submitPec} disabled={pecSubmitting || !pecMotif.trim()}>
              {pecSubmitting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {t("mise_en_place:detail.admin_visas.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ouvertureOpen} onOpenChange={(o) => { if (!o && !ouvertureSubmitting) setOuvertureOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("mise_en_place:detail.admin_ouverture.dialog_title")}
            </DialogTitle>
            <DialogDescription>{t("mise_en_place:detail.admin_ouverture.dialog_warning")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("mise_en_place:detail.admin_ouverture.motif_label")} *</Label>
            <Textarea
              rows={3}
              value={ouvertureMotif}
              onChange={(e) => setOuvertureMotif(e.target.value)}
              placeholder={t("mise_en_place:detail.admin_ouverture.motif_placeholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOuvertureOpen(false)} disabled={ouvertureSubmitting}>
              {t("common:actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={submitOuverture} disabled={ouvertureSubmitting || !ouvertureMotif.trim()}>
              {ouvertureSubmitting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {t("mise_en_place:detail.admin_ouverture.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CertificatAdminVisasCard;
