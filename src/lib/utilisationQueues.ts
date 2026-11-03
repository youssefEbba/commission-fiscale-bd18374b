/**
 * Files rapides de la liste des utilisations — mêmes dossiers que la main courante.
 * « Dossiers à contrôler » (DGTCP) : TVA « Demandée » ou « À recontrôler », douane « Chèque saisi ».
 */
export interface UtilisationQueueItem {
  type?: string | null;
  statut?: string | null;
}

export const isUtilisationAControler = (u: UtilisationQueueItem): boolean =>
  (u.type === "TVA_INTERIEURE" && (u.statut === "DEMANDEE" || u.statut === "A_RECONTROLER")) ||
  (u.type === "DOUANIER" && u.statut === "CHEQUE_SAISI");
