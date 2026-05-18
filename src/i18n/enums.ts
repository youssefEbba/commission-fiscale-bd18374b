import i18n from "./index";

/**
 * Helpers de traduction des enums métier.
 * Les clés vivent dans `enums.json`, sous `enums.<groupe>.<VALEUR>`.
 * Fallback : valeur brute si la clé est manquante.
 */
function tEnum(group: string, value: string | null | undefined, fallback?: string): string {
  if (!value) return fallback ?? "—";
  const key = `enums:${group}.${value}`;
  const translated = i18n.t(key, { defaultValue: "" });
  if (translated) return translated as string;
  return fallback ?? value;
}

export const tStatutCertificat = (v?: string | null) => tEnum("statut_certificat", v ?? undefined);
export const tStatutTransfert = (v?: string | null) => tEnum("statut_transfert", v ?? undefined);
export const tStatutUtilisation = (v?: string | null) => tEnum("statut_utilisation", v ?? undefined);
export const tStatutDemande = (v?: string | null) => tEnum("statut_demande", v ?? undefined);
export const tStatutConvention = (v?: string | null) => tEnum("statut_convention", v ?? undefined);
export const tStatutMarche = (v?: string | null) => tEnum("statut_marche", v ?? undefined);
export const tStatutModification = (v?: string | null) => tEnum("statut_modification", v ?? undefined);
export const tRole = (v?: string | null) => tEnum("role", v ?? undefined);
export const tTypeDocument = (v?: string | null) => tEnum("type_document", v ?? undefined);
export const tTypeUtilisation = (v?: string | null) => tEnum("type_utilisation", v ?? undefined);
export const tTypeOperation = (v?: string | null) => tEnum("type_operation", v ?? undefined);
export const tDecisionType = (v?: string | null) => tEnum("decision_type", v ?? undefined);
export const tTvaStockSource = (v?: string | null) => tEnum("tva_stock_source", v ?? undefined);
