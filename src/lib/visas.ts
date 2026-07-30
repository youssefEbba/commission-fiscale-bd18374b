/**
 * Routing dynamique des visas selon les enveloppes de crédit.
 *
 * Règles métier (source de vérité back-end) :
 *  - `creditInterieur` = 0  → DGI hors workflow (pas de visa, pas d'onglet, pas de file)
 *  - `creditExterieur` = 0  → DGD hors workflow
 *  - Correction    : DGTCP + DGB toujours requis (+ DGD / DGI selon crédits)
 *  - Mise en place : DGTCP toujours requis (+ DGI / DGD selon crédits) puis Président
 *  - Ancien dossier sans crédits renseignés → rétrocompat : tous les organismes requis.
 */

export type VisaOrg = "DGD" | "DGTCP" | "DGI" | "DGB" | "PRESIDENT";

export interface CreditsSource {
  creditInterieur?: number | string | null;
  creditExterieur?: number | string | null;
}

export function isPositive(v: number | string | null | undefined): boolean {
  return v != null && v !== "" && Number(v) > 0;
}

/**
 * Résout les crédits d'un dossier : le back n'expose pas toujours
 * `creditInterieur` / `creditExterieur` à la racine (cas des demandes de
 * correction), ils se trouvent alors dans `modeleFiscal.recapitulatif`.
 */
export function resolveCredits(d?: any): CreditsSource {
  const recap = d?.modeleFiscal?.recapitulatif;
  const fiscInt = d?.modeleFiscal?.fiscaliteInterieure;
  const creditInterieur = isPositive(d?.creditInterieur)
    ? d.creditInterieur
    : isPositive(recap?.creditInterieur)
      ? recap.creditInterieur
      : fiscInt?.creditInterieur ?? d?.creditInterieur ?? null;
  const creditExterieur = isPositive(d?.creditExterieur)
    ? d.creditExterieur
    : recap?.creditExterieur ?? d?.creditExterieur ?? null;
  return { creditInterieur, creditExterieur };
}


export function hasCreditInterieur(d?: CreditsSource | null): boolean {
  return isPositive(d?.creditInterieur);
}

export function hasCreditExterieur(d?: CreditsSource | null): boolean {
  return isPositive(d?.creditExterieur);
}

/** Rétrocompat : aucun crédit renseigné → on ne masque rien. */
function isLegacy(d?: CreditsSource | null): boolean {
  return !hasCreditInterieur(d) && !hasCreditExterieur(d);
}

/**
 * Organismes dont le visa est requis pour la CORRECTION.
 * Nouvelle règle métier : les 4 acteurs visent TOUJOURS, quels que soient les montants.
 */
export function requiredVisasCorrection(_d?: CreditsSource | null): VisaOrg[] {
  return ["DGD", "DGTCP", "DGI", "DGB"];
}

/**
 * Document à uploader avant de pouvoir viser (correction), conditionné par les montants :
 *  - DGD : « Offre fiscale corrigée » si creditExterieur > 0
 *  - DGI : « Crédit intérieur » si creditExterieur == 0 ET creditInterieur > 0
 *  - DGTCP / DGB : aucun
 */
export function requiredPreVisaDocCorrection(
  role: string | null | undefined,
  d: CreditsSource | null | undefined,
): string | null {
  const ext = hasCreditExterieur(d);
  const int = hasCreditInterieur(d);
  if (role === "DGD") return ext ? "OFFRE_FISCALE_CORRIGEE" : null;
  if (role === "DGI") return !ext && int ? "CREDIT_INTERIEUR" : null;
  return null;
}


/** Organismes dont le visa est requis pour la MISE EN PLACE du certificat. */
export function requiredVisasCertificat(d?: CreditsSource | null): VisaOrg[] {
  if (isLegacy(d)) return ["DGI", "DGD", "DGTCP"];
  const hasInt = hasCreditInterieur(d);
  const hasExt = hasCreditExterieur(d);
  const roles: VisaOrg[] = ["DGTCP"];
  if (hasInt) roles.unshift("DGI");
  if (hasExt) roles.splice(hasInt ? 1 : 0, 0, "DGD");
  return roles;
}

export function isVisaRequired(
  role: string | null | undefined,
  d: CreditsSource | null | undefined,
  process: "correction" | "certificat",
): boolean {
  if (!role) return false;
  const list = process === "correction" ? requiredVisasCorrection(d) : requiredVisasCertificat(d);
  return list.includes(role as VisaOrg);
}

/** Un rôle non-visa (AC, entreprise, président, admin…) n'est jamais « exclu ». */
export function isRoleExcluded(role: string | null | undefined, d: CreditsSource | null | undefined): boolean {
  if (role === "DGD") return !isLegacy(d) && !hasCreditExterieur(d);
  if (role === "DGI") return !isLegacy(d) && !hasCreditInterieur(d);
  return false;
}

/** `true` si tous les visas requis sont posés. */
export function allRequiredVisasPosed(
  d: CreditsSource | null | undefined,
  decisions: Array<{ role?: string | null; decision?: string | null }>,
  process: "correction" | "certificat",
): boolean {
  const required = process === "correction" ? requiredVisasCorrection(d) : requiredVisasCertificat(d);
  return required.every((role) => decisions.some((dec) => dec.role === role && dec.decision === "VISA"));
}
