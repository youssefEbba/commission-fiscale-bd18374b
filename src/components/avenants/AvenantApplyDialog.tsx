import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";
import { avenantApi, AvenantDto, CertificatCreditDto, DemandeCorrectionDto, UtilisationCreditDto, utilisationCreditApi, formatApiErrorMessage } from "@/lib/api";
import {
  AvenantRecapForm, buildApplicationRequest, checkAvenantRecap,
  initialAvenantRecap, previewSoldesApresAvenant, utilisationsEnCours,
} from "@/lib/avenants";
import { tStatutUtilisation } from "@/i18n/enums";
import { formatAmount, formatNumber } from "@/i18n/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avenant: AvenantDto;
  certificat: CertificatCreditDto | null;
  /** Demande de correction adoptée (avenant financier) : source des crédits retenus. */
  correction: DemandeCorrectionDto | null;
  onApplied: (avenant: AvenantDto) => void;
}

const fmtSigned = (v: number) => `${v > 0 ? "+" : ""}${formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Application d'un avenant adopté par la DGTCP. Avenant financier : nouveau récapitulatif et aperçu des soldes. */
export default function AvenantApplyDialog({ open, onOpenChange, avenant, certificat, correction, onApplied }: Props) {
  const { t } = useTranslation(["modifications", "common"]);
  const { toast } = useToast();
  const financier = avenant.type === "FINANCIER";
  const [form, setForm] = useState<AvenantRecapForm>(() => initialAvenantRecap(certificat, {}, avenant));
  const [busy, setBusy] = useState(false);
  // Refus du serveur (409 utilisation en cours, 400 montant…) affiché dans la fenêtre.
  const [serverError, setServerError] = useState<string | null>(null);
  // Utilisations en cours du crédit : `null` = inconnu (échec de lecture) → le serveur tranche.
  const [enCours, setEnCours] = useState<UtilisationCreditDto[] | null>(null);
  const certificatId = certificat?.id ?? avenant.certificatCreditId;

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setForm(initialAvenantRecap(certificat, { exterieur: correction?.creditExterieur, interieur: correction?.creditInterieur }, avenant));
  }, [open, certificat, correction, avenant]);

  useEffect(() => {
    if (!open || !certificatId) { setEnCours(null); return; }
    let cancelled = false;
    utilisationCreditApi.getByCertificat(certificatId)
      .then((list) => { if (!cancelled) setEnCours(utilisationsEnCours(list)); })
      .catch(() => { if (!cancelled) setEnCours(null); });
    return () => { cancelled = true; };
  }, [open, certificatId]);

  const check = useMemo(() => checkAvenantRecap(form), [form]);
  const preview = useMemo(() => previewSoldesApresAvenant(certificat, form), [certificat, form]);
  const set = (k: keyof AvenantRecapForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const blockedByUtilisation = !!enCours && enCours.length > 0;
  const canSubmit = !busy && !blockedByUtilisation && (!financier || check.errors.length === 0);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setServerError(null);
    try {
      const res = await avenantApi.application(avenant.id, financier ? buildApplicationRequest(form) : undefined);
      toast({ title: t("common:success", { defaultValue: "Succès" }), description: t("modifications:toast.application_ok") });
      onOpenChange(false);
      onApplied(res);
    } catch (e) {
      // 409 (utilisation en cours) et 400 (montant inférieur au consommé) : message serveur tel quel, dans la fenêtre.
      const msg = formatApiErrorMessage(e);
      setServerError(msg);
      toast({ title: t("common:error", { defaultValue: "Erreur" }), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof AvenantRecapForm, labelKey: string, strong = false) => (
    <div className="space-y-1">
      <Label htmlFor={`apply-${k}`} className={strong ? "text-xs font-semibold" : "text-xs text-muted-foreground"}>{t(`modifications:apply.${labelKey}`)}</Label>
      <Input id={`apply-${k}`} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={form[k]} onChange={(e) => set(k, e.target.value)} className={strong ? "font-medium" : ""} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className={financier ? "sm:max-w-2xl max-h-[90vh] overflow-y-auto" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{t("modifications:apply.title")}</DialogTitle>
          <DialogDescription>{financier ? t("modifications:apply.desc_financier") : t("modifications:apply.desc_simple")}</DialogDescription>
        </DialogHeader>

        {financier && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{t("modifications:apply.prefill_hint")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                {field("montantCordon", "cordon", true)}
                {check.errors.includes("cordon_mismatch") && check.ecartCordon != null && (
                  <p className="text-xs text-destructive">{t("modifications:apply.cordon_mismatch", { attendu: formatAmount(check.cordonAttendu), ecart: fmtSigned(check.ecartCordon) })}</p>
                )}
              </div>
              <div className="space-y-1">
                {field("montantTVAInterieure", "tva", true)}
                {check.errors.includes("tva_mismatch") && check.ecartTva != null && (
                  <p className="text-xs text-destructive">{t("modifications:apply.tva_mismatch", { attendu: formatAmount(check.tvaAttendue), ecart: fmtSigned(check.ecartTva) })}</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-sm font-semibold">{t("modifications:apply.recap_title")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {field("a", "a")}
                {field("b", "b")}
                {field("c", "c")}
                {field("d", "d")}
                {field("f", "f")}
                {field("g", "g")}
              </div>
              {check.errors.includes("bd_required") && <p className="text-xs text-destructive">{t("modifications:apply.bd_required")}</p>}
              {check.errors.includes("negative") && <p className="text-xs text-destructive">{t("modifications:apply.negative")}</p>}
              {(check.errors.includes("cordon_required") || check.errors.includes("tva_required")) && (
                <p className="text-xs text-destructive">{t("modifications:apply.enveloppes_required")}</p>
              )}
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm font-semibold">{t("modifications:apply.preview_title")}</p>
              <p className="text-[11px] text-muted-foreground">{t("modifications:apply.preview_hint")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-start font-medium py-1">{t("modifications:apply.preview.libelle")}</th>
                      <th className="text-end font-medium py-1">{t("modifications:apply.preview.consomme")}</th>
                      <th className="text-end font-medium py-1">{t("modifications:apply.preview.solde_avant")}</th>
                      <th className="text-end font-medium py-1">{t("modifications:apply.preview.solde_apres")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((l) => (
                      <tr key={l.key} className="border-t border-border">
                        <td className="py-1">{t(`modifications:apply.preview.rows.${l.key}`)}</td>
                        <td className="py-1 text-end">{l.consomme == null ? t("modifications:na") : formatAmount(l.consomme)}</td>
                        <td className="py-1 text-end">{l.soldeAvant == null ? t("modifications:na") : formatAmount(l.soldeAvant)}</td>
                        <td className={`py-1 text-end font-medium ${l.insuffisant ? "text-destructive" : ""}`}>{l.soldeApres == null ? t("modifications:na") : formatAmount(l.soldeApres)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.some((l) => l.insuffisant) && <p className="text-xs text-destructive">{t("modifications:apply.insuffisant")}</p>}
            </div>
          </div>
        )}

        {blockedByUtilisation && (
          <div className="rounded-md border border-accent bg-accent/15 p-3 text-xs space-y-1">
            <p className="flex items-start gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {t("modifications:apply.utilisation_en_cours", { count: enCours!.length })}
            </p>
            <ul className="ps-5 list-disc text-muted-foreground">
              {enCours!.slice(0, 5).map((u) => (
                <li key={u.id}>#{u.id} — {tStatutUtilisation(u.statut)}</li>
              ))}
            </ul>
          </div>
        )}
        {serverError && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive whitespace-pre-wrap break-words">
            {serverError}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("modifications:dialogs.cancel")}</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("modifications:apply.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
