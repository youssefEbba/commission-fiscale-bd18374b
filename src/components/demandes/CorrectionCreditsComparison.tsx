import { useTranslation } from "react-i18next";
import { formatAmount } from "@/i18n/format";
import { hasDeclaredMontants } from "@/lib/correctionMontants";
import type { DemandeCorrectionDto, DecisionCorrectionDto } from "@/lib/api";

const amount = (v: number | string | null | undefined) => (v == null || v === "" ? "—" : formatAmount(v));

/** « Déclaré par l'autorité contractante » / « Retenu après correction » — seulement si la correction est saisie. */
export const CorrectionCreditsComparison = ({ demande }: { demande: DemandeCorrectionDto }) => {
  const { t } = useTranslation();
  if (!hasDeclaredMontants(demande)) return null;
  const rows = [
    {
      key: "declared",
      label: t("correction_douaniere:montants.card_declared"),
      ext: demande.creditExterieurDeclare,
      int: demande.creditInterieurDeclare,
    },
    {
      key: "retained",
      label: t("correction_douaniere:montants.card_retained"),
      ext: demande.creditExterieur,
      int: demande.creditInterieur,
    },
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="p-2 text-start font-medium" />
            <th className="p-2 text-end font-medium">{t("correction_douaniere:montants.col_ext")}</th>
            <th className="p-2 text-end font-medium">{t("correction_douaniere:montants.col_int")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="p-2 text-xs text-muted-foreground">{r.label}</td>
              <td className={`p-2 text-end ${r.key === "retained" ? "font-semibold" : ""}`}>{amount(r.ext)}</td>
              <td className={`p-2 text-end ${r.key === "retained" ? "font-semibold" : ""}`}>{amount(r.int)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Ligne d'historique : montants fixés par ce visa (non nuls seulement pour le visa qui les a saisis). */
export const DecisionMontantsRetenus = ({ decision, className = "" }: { decision: DecisionCorrectionDto; className?: string }) => {
  const { t } = useTranslation();
  if (decision.creditExterieurRetenu == null && decision.creditInterieurRetenu == null) return null;
  return (
    <p className={`text-[11px] text-muted-foreground ${className}`}>
      {t("correction_douaniere:montants.retenu_line", {
        ext: amount(decision.creditExterieurRetenu),
        int: amount(decision.creditInterieurRetenu),
      })}
    </p>
  );
};
