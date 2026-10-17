/** Closing remains allowed even when a convention has been cancelled. */
export function canSetConventionActivation(statut: string, actif: boolean) {
  return !actif || statut !== "ANNULEE";
}