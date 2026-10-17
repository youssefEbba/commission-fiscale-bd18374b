/** Read access and scope are decided exclusively by the server. */
export function canEditMarche(statut: string | undefined) {
  return !!statut && statut !== "CLOTURE" && statut !== "ANNULE";
}