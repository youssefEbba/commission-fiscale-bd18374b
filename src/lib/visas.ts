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

/** Organismes dont le visa est requis pour la CORRECTION. */
export function requiredVisasCorrection(d?: CreditsSource | null): VisaOrg[] {
  if (isLegacy(d)) return ["DGD", "DGTCP", "DGI", "DGB"];
  const roles: VisaOrg[] = ["DGTCP", "DGB"];
  if (hasCreditExterieur(d)) roles.unshift("DGD");
  if (hasCreditInterieur(d)) roles.push("DGI");
  return roles;
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

/** Document à uploader obligatoirement avant le visa, selon le rôle et le circuit dynamique.
 *  - DGD upload l'Offre Fiscale Corrigée quand il est requis.
 *  - DGI upload l'Offre Fiscale Corrigée quand il est requis ET que le DGD est exclu ;
 *    sinon il upload le Crédit Intérieur.
 */
export function getPreVisaDocument(role: string | null | undefined, d: CreditsSource | null | undefined): { docType: string } | undefined {
  if (!role) return undefined;
  const required = requiredVisasCorrection(d);
  const dgdRequired = required.includes("DGD");
  const dgiRequired = required.includes("DGI");
  if (role === "DGD" && dgdRequired) return { docType: "OFFRE_FISCALE_CORRIGEE" };
  if (role === "DGI" && dgiRequired) return { docType: dgdRequired ? "CREDIT_INTERIEUR" : "OFFRE_FISCALE_CORRIGEE" };
  return undefined;
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
