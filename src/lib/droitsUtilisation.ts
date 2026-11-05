/**
 * Créer, modifier ou soumettre une demande d'utilisation : le serveur l'accorde aux comptes qui ont le
 * droit de soumettre (Entreprise, Sous-traitant, et un relais qui agit pour eux). L'administrateur ne
 * l'a pas : le bouton ne doit pas lui être proposé.
 */
export const DROITS_SOUMISSION_UTILISATION = ["utilisation.douane.submit", "utilisation.interieur.submit"] as const;

export const peutSoumettreUtilisation = (hasPermission: (p: string) => boolean): boolean =>
  DROITS_SOUMISSION_UTILISATION.some((p) => hasPermission(p));
