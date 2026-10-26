import type { UtilisationCreditDto } from "@/lib/api";

/**
 * Règles d'affichage du certificat d'utilisation et de la clôture d'une utilisation.
 * Le serveur reste l'autorité (403 / 400 / 409) ; ces fonctions n'évitent que des gestes inutiles.
 */

/** Rôles « directions » : le certificat leur est toujours communicable. */
const DIRECTION_ROLES = ["DGD", "DGTCP", "DGI", "DGB", "PRESIDENT", "ADMIN_SI"];

/** Déposant = tout rôle hors directions (entreprise, sous-traitant, commission relais, autorité contractante…). */
export const isDeposantUtilisation = (role?: string | null) => !role || !DIRECTION_ROLES.includes(role);

/**
 * Le certificat d'utilisation (carte, traçabilité, PDF) est visible pour les directions,
 * et pour le déposant seulement quand le serveur l'a rendu communicable.
 */
export const certificatUtilisationVisible = (
  role: string | null | undefined,
  u: Pick<UtilisationCreditDto, "certificatUtilisationCommunicable">,
) => !isDeposantUtilisation(role) || u.certificatUtilisationCommunicable === true;

/** La clôture n'est permise qu'une fois le crédit débité. */
export const isUtilisationCloturable = (u: Pick<UtilisationCreditDto, "type" | "statut">) =>
  (u.type === "DOUANIER" && u.statut === "LIQUIDEE") || (u.type === "TVA_INTERIEURE" && u.statut === "APUREE");

export const UTILISATION_CLOTURE_PERMISSION = "utilisation.dgtcp.cloturer";

/**
 * Chemin de clôture proposé : DGTCP (confirmation simple) ou ADMIN_SI (motif obligatoire).
 * `null` = pas de bouton.
 */
export const utilisationClotureMode = (
  role: string | null | undefined,
  hasPermission: (p: string) => boolean,
  u: Pick<UtilisationCreditDto, "type" | "statut">,
): "DGTCP" | "ADMIN" | null => {
  if (!isUtilisationCloturable(u)) return null;
  if (role === "DGTCP" && hasPermission(UTILISATION_CLOTURE_PERMISSION)) return "DGTCP";
  if (role === "ADMIN_SI") return "ADMIN";
  return null;
};

/** Somme à déduire du crédit d'impôt : le montant CI, repli sur le total du bulletin s'il est absent. */
export const montantCiADeduire = (
  u: Pick<UtilisationCreditDto, "totalPrisEnCharge">,
  montantTotal: number,
) => (u.totalPrisEnCharge != null && !isNaN(Number(u.totalPrisEnCharge)) ? Number(u.totalPrisEnCharge) : montantTotal);
