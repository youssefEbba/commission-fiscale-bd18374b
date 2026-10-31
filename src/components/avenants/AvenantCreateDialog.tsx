import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { avenantApi, AvenantDto, certificatCreditApi, CertificatCreditDto, TypeAvenant } from "@/lib/api";
import {
  AvenantDepotForm, avenantDepotErrors, buildCreateAvenantRequest,
  CERTIFICAT_STATUTS_AVENANT, TYPES_AVENANT,
} from "@/lib/avenants";
import { displayRef } from "@/lib/displayRef";
import { tTypeAvenant } from "@/i18n/enums";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Crédit imposé (dépôt depuis la fiche crédit). */
  certificat?: Pick<CertificatCreditDto, "id" | "reference" | "numero" | "entrepriseRaisonSociale" | "entrepriseNom"> | null;
  onCreated: (avenant: AvenantDto) => void;
}

const EMPTY: AvenantDepotForm = {
  certificatCreditId: "", type: "", motif: "", dateSignature: "",
  creditExterieurPropose: "", creditInterieurPropose: "",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

/** Dépôt d'un avenant par l'entreprise ou l'autorité contractante, sur un crédit ouvert ou modifié. */
export default function AvenantCreateDialog({ open, onOpenChange, certificat, onCreated }: Props) {
  const { t } = useTranslation(["modifications", "common"]);
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<AvenantDepotForm>(EMPTY);
  const [certs, setCerts] = useState<CertificatCreditDto[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);
  const [certsError, setCertsError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, certificatCreditId: certificat ? String(certificat.id) : "" });
    setSubmitted(false);
    if (certificat) return;
    setCertsLoading(true);
    setCertsError(null);
    const load = user?.role === "ENTREPRISE" && user.entrepriseId
      ? certificatCreditApi.getByEntreprise(user.entrepriseId)
      : certificatCreditApi.getAll();
    load
      .then((list) => setCerts(list.filter((c) => CERTIFICAT_STATUTS_AVENANT.includes(c.statut))))
      .catch((e: any) => { setCerts([]); setCertsError(e?.message || t("modifications:depot.certificats_error")); })
      .finally(() => setCertsLoading(false));
  }, [open, certificat, user?.role, user?.entrepriseId, t]);

  const today = todayStr();
  const errors = useMemo(() => avenantDepotErrors(form, today), [form, today]);
  const set = <K extends keyof AvenantDepotForm>(k: K, v: AvenantDepotForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const show = (e: (typeof errors)[number]) => submitted && errors.includes(e);
  const financier = form.type === "FINANCIER";

  const submit = async () => {
    setSubmitted(true);
    if (errors.length > 0) return;
    setBusy(true);
    try {
      const created = await avenantApi.create(buildCreateAvenantRequest(form));
      toast({ title: t("common:success", { defaultValue: "Succès" }), description: t("modifications:toast.depot_ok") });
      onOpenChange(false);
      onCreated(created);
    } catch (e: any) {
      toast({ title: t("common:error", { defaultValue: "Erreur" }), description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const errText = (key: string) => <p className="text-xs text-destructive">{t(`modifications:depot.errors.${key}`)}</p>;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("modifications:depot.title")}</DialogTitle>
          <DialogDescription>{t("modifications:depot.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("modifications:depot.certificat")} *</Label>
            {certificat ? (
              <p className="text-sm font-medium rounded-md border border-border bg-muted/30 px-3 py-2">
                {displayRef(certificat)}{(certificat.entrepriseRaisonSociale || certificat.entrepriseNom) ? ` — ${certificat.entrepriseRaisonSociale || certificat.entrepriseNom}` : ""}
              </p>
            ) : (
              <>
                <Select value={form.certificatCreditId} onValueChange={(v) => set("certificatCreditId", v)} disabled={certsLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={certsLoading ? t("modifications:depot.certificats_loading") : t("modifications:depot.certificat_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {certs.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {displayRef(c)}{(c.entrepriseRaisonSociale || c.entrepriseNom) ? ` — ${c.entrepriseRaisonSociale || c.entrepriseNom}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {certsError && <p className="text-xs text-destructive">{certsError}</p>}
                {!certsLoading && !certsError && certs.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("modifications:depot.no_certificat")}</p>
                )}
              </>
            )}
            {show("certificat_required") && errText("certificat_required")}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("modifications:depot.type")} *</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as TypeAvenant)}>
                <SelectTrigger><SelectValue placeholder={t("modifications:depot.type_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {TYPES_AVENANT.map((ty) => <SelectItem key={ty} value={ty}>{tTypeAvenant(ty)}</SelectItem>)}
                </SelectContent>
              </Select>
              {show("type_required") && errText("type_required")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av-date">{t("modifications:depot.date_signature")}</Label>
              <Input id="av-date" type="date" max={today} value={form.dateSignature} onChange={(e) => set("dateSignature", e.target.value)} />
              {errors.includes("date_signature_future") && errText("date_signature_future")}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="av-motif">{t("modifications:depot.motif")} *</Label>
            <Textarea id="av-motif" rows={3} placeholder={t("modifications:depot.motif_placeholder")} value={form.motif} onChange={(e) => set("motif", e.target.value)} />
            {show("motif_required") && errText("motif_required")}
          </div>

          {financier && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs text-muted-foreground">{t("modifications:depot.financier_hint")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="av-ext">{t("modifications:depot.credit_exterieur")} *</Label>
                  <Input id="av-ext" type="number" min="0" step="0.01" inputMode="decimal" value={form.creditExterieurPropose} onChange={(e) => set("creditExterieurPropose", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="av-int">{t("modifications:depot.credit_interieur")} *</Label>
                  <Input id="av-int" type="number" min="0" step="0.01" inputMode="decimal" value={form.creditInterieurPropose} onChange={(e) => set("creditInterieurPropose", e.target.value)} />
                </div>
              </div>
              {show("credits_required") && errText("credits_required")}
              {errors.includes("credits_negative") && errText("credits_negative")}
            </div>
          )}

          <p className="text-xs text-muted-foreground">{t("modifications:depot.pieces_next")}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("modifications:dialogs.cancel")}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("modifications:depot.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
