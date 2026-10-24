import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAmount } from "@/i18n/format";
import { montantsError, type CorrectionMontantsDraft } from "@/lib/correctionMontants";

interface Props {
  draft: CorrectionMontantsDraft;
  onChange: (draft: CorrectionMontantsDraft) => void;
  /** Déclaration d'origine de l'autorité (rappel sous chaque champ). */
  declared: { creditExterieur: number | string | null; creditInterieur: number | string | null };
  disabled?: boolean;
}

/** Crédits extérieur / intérieur retenus par la correction — saisis avec le visa. */
const CorrectionMontantsFields = ({ draft, onChange, declared, disabled }: Props) => {
  const { t } = useTranslation();
  const error = montantsError(draft);
  const declaredText = (v: number | string | null) => (v == null || v === "" ? "—" : formatAmount(v));

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div>
        <p className="text-sm font-semibold">{t("correction_douaniere:montants.title")}</p>
        <p className="text-xs text-muted-foreground">{t("correction_douaniere:montants.hint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="credit-ext-retenu" className="text-xs">
            {t("correction_douaniere:montants.ext_label")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="credit-ext-retenu"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={draft.creditExterieur}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, creditExterieur: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            {t("correction_douaniere:montants.declared", { value: declaredText(declared.creditExterieur) })}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="credit-int-retenu" className="text-xs">
            {t("correction_douaniere:montants.int_label")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="credit-int-retenu"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={draft.creditInterieur}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, creditInterieur: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            {t("correction_douaniere:montants.declared", { value: declaredText(declared.creditInterieur) })}
          </p>
        </div>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {t(`correction_douaniere:montants.err_${error}`)}
        </p>
      )}
    </div>
  );
};

export default CorrectionMontantsFields;
