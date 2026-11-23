import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DecimalInput } from "@/components/ui/decimal-input";
import { formatAmount } from "@/i18n/format";
import { formatApiErrorMessage, utilisationCreditApi, type MontantsPresidentRequest, type UtilisationCreditDto } from "@/lib/api";
import { buildMontantsPresidentBody, montantsPresidentActuels, type MontantsPresidentForm } from "@/lib/utilisationCircuit";

const fmt = (v: number | null) => (v == null ? "—" : formatAmount(v, { currency: "MRU", maximumFractionDigits: 2 }));

/**
 * Président (ou ADMIN_SI) : corrige les montants d'une utilisation débitée avant d'émettre le certificat.
 * Douane : droits imputés et TVA imputée, à la baisse seulement ; TVA : montant de TVA et TVA déductible utilisée.
 * Le serveur réajuste les soldes et décide (400 / 403 / 409 affichés tels quels).
 */
export function MontantsPresidentDialog({ utilisation: u, onClose, onDone }: {
  utilisation: UtilisationCreditDto;
  onClose: () => void;
  onDone: (next: UtilisationCreditDto) => void;
}) {
  const { t } = useTranslation(["utilisations", "common"]);
  const douane = u.type === "DOUANIER";
  const actuels = useMemo(() => montantsPresidentActuels(u), [u]);
  const [form, setForm] = useState<MontantsPresidentForm>({ a: actuels.a, b: actuels.b, motif: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { body, erreur } = buildMontantsPresidentBody(u.type, actuels, form);
  const k = douane ? "douane" : "tva";

  const submit = async () => {
    if (!body || saving) return;
    setSaving(true);
    setError(null);
    try {
      onDone(await utilisationCreditApi.modifierMontantsPresident(u.id, body as unknown as MontantsPresidentRequest));
    } catch (e) {
      setError(formatApiErrorMessage(e, t("utilisations:montants_president.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("utilisations:montants_president.title")}</DialogTitle>
          <DialogDescription>{t(`utilisations:montants_president.desc_${k}`)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mp-a">{t(`utilisations:montants_president.${k}_a`)}</Label>
            <DecimalInput id="mp-a" value={form.a} onValueChange={(a) => setForm((f) => ({ ...f, a }))} disabled={saving} />
            <p className="text-xs text-muted-foreground">{t("utilisations:montants_president.actuel", { montant: fmt(actuels.a) })}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-b">{t(`utilisations:montants_president.${k}_b`)}</Label>
            <DecimalInput id="mp-b" value={form.b} onValueChange={(b) => setForm((f) => ({ ...f, b }))} disabled={saving} />
            <p className="text-xs text-muted-foreground">{t("utilisations:montants_president.actuel", { montant: fmt(actuels.b) })}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-motif">{t("utilisations:montants_president.motif")} *</Label>
            <Textarea id="mp-motif" rows={3} value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))} disabled={saving} />
          </div>
          {erreur && erreur !== "motif" && erreur !== "inchange" && (
            <p role="alert" className="text-sm text-destructive">{t(`utilisations:montants_president.erreur_${erreur}`)}</p>
          )}
          {error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common:actions.cancel")}</Button>
          <Button onClick={() => void submit()} disabled={!body || saving}>
            {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t("utilisations:montants_president.valider")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
