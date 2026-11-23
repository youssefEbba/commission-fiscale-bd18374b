// Circuit d'une utilisation : le crédit est débité AVANT le certificat d'utilisation.
//   Douane : DEMANDEE → VISE → CHEQUE_SAISI → ENVOYEE_AU_TRESOR → QUITTANCES_ENREGISTREES → LIQUIDEE (débit)
//            → TRANSMISE_AU_PRESIDENT (correction éventuelle des montants) → CERTIFICAT_EMIS → CLOTUREE.
//   TVA    : DEMANDEE → VALIDEE → QUITTANCE_DGI_ENREGISTREE → APUREE (débit)
//            → TRANSMISE_AU_PRESIDENT → CERTIFICAT_EMIS → CLOTUREE.
// Dossiers déjà engagés dans l'ancien ordre (certificat avant débit) : `creditDebite` faux à
// TRANSMISE_AU_PRESIDENT / CERTIFICAT_EMIS — ils terminent émission → Trésor/DGI → débit.
// Règles d'écran seulement : le serveur reste l'autorité (403 / 400 / 409).
import type { UtilisationCreditDto } from "@/lib/api";

export type CircuitUtilisation = Pick<
  UtilisationCreditDto,
  "type" | "statut" | "creditDebite" | "numeroCertificatUtilisation" | "dateCertificatUtilisation"
>;

const isDouane = (u: CircuitUtilisation) => u.type === "DOUANIER";
const isTVA = (u: CircuitUtilisation) => u.type === "TVA_INTERIEURE";

/** Le crédit a été débité (liquidation douane ou apurement TVA). */
export const isCreditDebite = (u: Pick<UtilisationCreditDto, "creditDebite">) => u.creditDebite === true;

/** Certificat déjà émis (dossier de l'ancien ordre arrivé au débit après l'émission). */
const certificatDejaEmis = (u: CircuitUtilisation) => !!(u.numeroCertificatUtilisation || u.dateCertificatUtilisation);

/** Dossier de l'ancien ordre : certificat émis (ou en cours d'émission) avant le débit. */
export const isAncienOrdre = (u: CircuitUtilisation) =>
  !isCreditDebite(u) &&
  ((isDouane(u) && (u.statut === "TRANSMISE_AU_PRESIDENT" || u.statut === "CERTIFICAT_EMIS")) ||
    (isTVA(u) && u.statut === "CERTIFICAT_EMIS"));

/** DGTCP « Envoyer au Trésor » : après le chèque, ou certificat émis de l'ancien ordre. */
export const peutEnvoyerTresor = (u: CircuitUtilisation) =>
  isDouane(u) && (u.statut === "CHEQUE_SAISI" || (u.statut === "CERTIFICAT_EMIS" && !isCreditDebite(u)));

/** DGI « Quittance » : après validation (ou modification avant l'apurement), ou certificat émis de l'ancien ordre. */
export const peutDeposerQuittanceDgi = (u: CircuitUtilisation) =>
  isTVA(u) &&
  (u.statut === "VALIDEE" || u.statut === "QUITTANCE_DGI_ENREGISTREE" || (u.statut === "CERTIFICAT_EMIS" && !isCreditDebite(u)));

/** DGTCP « Transmettre au Président » : une fois le crédit débité, si le certificat n'est pas déjà émis. */
export const peutTransmettrePresident = (u: CircuitUtilisation) =>
  ((isDouane(u) && u.statut === "LIQUIDEE") || (isTVA(u) && u.statut === "APUREE")) && !certificatDejaEmis(u);

/** Président (ou ADMIN_SI) : correction des montants avant l'émission, dossier débité seulement. */
export const peutModifierMontantsPresident = (u: CircuitUtilisation) =>
  u.statut === "TRANSMISE_AU_PRESIDENT" && isCreditDebite(u);

/** Clôture : certificat émis sur un dossier débité, ou ancien ordre arrivé au débit après l'émission. */
export const isUtilisationCloturable = (u: CircuitUtilisation) =>
  (u.statut === "CERTIFICAT_EMIS" && isCreditDebite(u)) ||
  (((isDouane(u) && u.statut === "LIQUIDEE") || (isTVA(u) && u.statut === "APUREE")) && certificatDejaEmis(u));

/** Un dossier débité ne reçoit plus de rejet temporaire ni définitif (409 serveur). */
export const peutEtreRejete = (u: Pick<UtilisationCreditDto, "creditDebite">) => !isCreditDebite(u);

/** File « Certificats à émettre » du Président : TRANSMISE_AU_PRESIDENT, pour les deux types. */
export const isAEmettre = (u: Pick<UtilisationCreditDto, "statut">) => u.statut === "TRANSMISE_AU_PRESIDENT";

/** Résultat du débit (liquidation / apurement) affichable dès LIQUIDEE / APUREE. */
export const resultatDebitVisible = (u: CircuitUtilisation) =>
  isCreditDebite(u) || ["LIQUIDEE", "APUREE", "CLOTUREE"].includes(u.statut);

/** Statuts où la carte du certificat d'utilisation s'affiche (ou un numéro déjà émis). */
export const CU_CARD_STATUTS: readonly string[] = ["TRANSMISE_AU_PRESIDENT", "CERTIFICAT_EMIS", "CLOTUREE"];
export const carteCertificatVisible = (u: CircuitUtilisation) =>
  CU_CARD_STATUTS.includes(u.statut) || !!u.numeroCertificatUtilisation;

/** Clé du message « Prochaine étape » (`utilisations:next_step.*`), ou `null`. */
export function etapeSuivante(u: CircuitUtilisation): string | null {
  const s = u.statut;
  if (s === "TRANSMISE_AU_PRESIDENT") return isCreditDebite(u) ? "attente_certificat_president_debite" : "attente_certificat_president";
  if (s === "CERTIFICAT_EMIS") {
    if (isCreditDebite(u)) return "attente_cloture";
    return isDouane(u) ? "attente_envoi_tresor" : "attente_quittance_dgi";
  }
  if ((isDouane(u) && s === "LIQUIDEE") || (isTVA(u) && s === "APUREE")) {
    return certificatDejaEmis(u) ? "attente_reception" : "attente_transmission_president";
  }
  if (isTVA(u)) {
    if (s === "VALIDEE") return "attente_quittance_dgi_validee";
    if (s === "QUITTANCE_DGI_ENREGISTREE") return "attente_apurement";
    return null;
  }
  if (s === "EN_CONTROLE_DGD" || s === "VISE") return "attente_cheque";
  if (s === "CHEQUE_SAISI") return "attente_envoi_tresor_cheque";
  if (s === "ENVOYEE_AU_TRESOR") return "attente_quittances";
  if (s === "QUITTANCES_ENREGISTREES") return "attente_liquidation";
  return null;
}

// ---- Correction des montants par le Président (PATCH /montants-president) ----

export interface MontantsPresidentForm {
  /** Douane : droits imputés, à la baisse seulement. TVA : montant de TVA. `null` = champ vidé (valeur gardée). */
  a: number | null;
  /** Douane : TVA imputée, à la baisse seulement. TVA : TVA déductible utilisée. */
  b: number | null;
  motif: string;
}

/** Valeurs actuelles préremplies : douane = (totalPrisEnCharge − montantTVADouane, montantTVADouane). */
export function montantsPresidentActuels(
  u: Pick<UtilisationCreditDto, "type" | "totalPrisEnCharge" | "montantTVADouane" | "montantTVAInterieure" | "tvaDeductibleUtilisee">,
): { a: number | null; b: number | null } {
  if (u.type === "DOUANIER") {
    const tva = u.montantTVADouane ?? null;
    const total = u.totalPrisEnCharge ?? null;
    return { a: total != null ? Number(total) - Number(tva ?? 0) : null, b: tva != null ? Number(tva) : null };
  }
  return {
    a: u.montantTVAInterieure != null ? Number(u.montantTVAInterieure) : null,
    b: u.tvaDeductibleUtilisee != null ? Number(u.tvaDeductibleUtilisee) : null,
  };
}

export type MontantsPresidentErreur = "motif" | "inchange" | "invalide" | "hausse_douane";

/**
 * Corps du PATCH : seuls les champs modifiés sont envoyés (un champ absent garde sa valeur).
 * En douane, les deux montants ne peuvent que baisser (le serveur refuse aussi en 400).
 */
export function buildMontantsPresidentBody(
  type: string | null | undefined,
  actuels: { a: number | null; b: number | null },
  f: MontantsPresidentForm,
): { body: Record<string, number | string> | null; erreur: MontantsPresidentErreur | null } {
  const a = f.a;
  const b = f.b;
  if ((a != null && (!Number.isFinite(a) || a < 0)) || (b != null && (!Number.isFinite(b) || b < 0))) {
    return { body: null, erreur: "invalide" };
  }
  const changeA = a != null && a !== actuels.a;
  const changeB = b != null && b !== actuels.b;
  if (!changeA && !changeB) return { body: null, erreur: "inchange" };
  const douane = type === "DOUANIER";
  if (douane && ((changeA && actuels.a != null && a! > actuels.a) || (changeB && actuels.b != null && b! > actuels.b))) {
    return { body: null, erreur: "hausse_douane" };
  }
  if (!f.motif.trim()) return { body: null, erreur: "motif" };
  const body: Record<string, number | string> = { motif: f.motif.trim() };
  if (douane) {
    if (changeA) body.droitsImputes = a!;
    if (changeB) body.tvaImputee = b!;
  } else {
    if (changeA) body.montantTVA = a!;
    if (changeB) body.tvaDeductibleUtilisee = b!;
  }
  return { body, erreur: null };
}

/** Mention des PDF quand le Président a corrigé le montant imputé (`montantImputeAvantModification`). */
export function mentionModificationPresident(
  u: Pick<UtilisationCreditDto, "montantImputeAvantModification" | "motifModificationPresident">,
  montantApres: number,
  fmt: (n: number) => string,
): string | null {
  if (u.montantImputeAvantModification == null) return null;
  const avant = Number(u.montantImputeAvantModification);
  const verbe = montantApres > avant ? "porté" : "ramené";
  const base = `Montant ${verbe} par le Président de ${fmt(avant)} à ${fmt(montantApres)} MRU`;
  return u.motifModificationPresident?.trim() ? `${base} — motif : ${u.motifModificationPresident.trim()}` : base;
}
