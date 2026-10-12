/**
 * Alerte d'échéance des conventions, calculée depuis `dateFin`.
 * Seuils proposés en recette — ajuster ici si la Commission les fait évoluer.
 */
export const ECHEANCE_AVERTISSEMENT_JOURS = 90;
export const ECHEANCE_CRITIQUE_JOURS = 30;

export type NiveauEcheance = "depassee" | "critique" | "avertissement";

export interface EcheanceConvention {
  niveau: NiveauEcheance;
  /** Jours restants (négatif quand la date est dépassée). */
  jours: number;
}

/** Renvoie null quand pas de dateFin ou échéance au-delà du seuil d'avertissement. */
export function echeanceConvention(dateFin?: string | null): EcheanceConvention | null {
  if (!dateFin) return null;
  const fin = new Date(dateFin);
  if (isNaN(fin.getTime())) return null;
  const jours = Math.ceil((fin.getTime() - Date.now()) / 86_400_000);
  if (jours < 0) return { niveau: "depassee", jours };
  if (jours <= ECHEANCE_CRITIQUE_JOURS) return { niveau: "critique", jours };
  if (jours <= ECHEANCE_AVERTISSEMENT_JOURS) return { niveau: "avertissement", jours };
  return null;
}
