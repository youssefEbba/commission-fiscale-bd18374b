import type { CertificatStatut } from "@/lib/api";

export type UtilisationPresence = "unknown" | "none" | "present";

const LOCKED_AMOUNT_STATUSES: readonly CertificatStatut[] = ["OUVERT", "MODIFIE", "CLOTURE", "ANNULE"];
const INSTRUCTION_STATUSES: readonly CertificatStatut[] = ["EN_CONTROLE", "INCOMPLETE", "A_RECONTROLER", "EN_VALIDATION_PRESIDENT", "VALIDE_PRESIDENT", "EN_OUVERTURE_DGTCP"];

/** Only announced server restrictions; permissions remain the caller's responsibility. */
export function certificatAmountRestriction(statut: CertificatStatut, presence: UtilisationPresence) {
  if (LOCKED_AMOUNT_STATUSES.includes(statut)) return "amounts_locked" as const;
  if (INSTRUCTION_STATUSES.includes(statut)) {
    if (presence === "present") return "amounts_used" as const;
    if (presence === "unknown") return "usage_unknown" as const;
  }
  return null;
}

export function canManuallySetCertificatStatus(statut: CertificatStatut) {
  return statut !== "MODIFIE" && statut !== "CLOTURE";
}

/** Certificat signé : déposé par le Président (ou l'administrateur) seulement — 403 pour l'AC et la commission relais. */
export const CERTIFICAT_SIGNE_CODE = "CERTIFICAT_CREDIT_IMPOTS";

/** Pièces proposées au dépôt de la mise en place (AC / relais) : sans le certificat signé. */
export function miseEnPlaceDepotRequirements<T extends { codeDocument?: string | null; typeDocument?: string | null }>(reqs: T[]): T[] {
  return reqs.filter((r) => (r.codeDocument || r.typeDocument) !== CERTIFICAT_SIGNE_CODE);
}

/** Admin correction is NOT the initial amount-entry endpoint, even on closed credits. */
export function canCorrectCertificatField(key: string, presence: UtilisationPresence) {
  return !["tvaImportationDouane", "montantCordon", "montantTVAInterieure"].includes(key) || presence === "none";
}