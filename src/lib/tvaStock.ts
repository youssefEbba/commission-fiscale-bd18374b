/** Une ligne du stock de TVA déductible est épuisée seulement quand son montant restant vaut 0. */
export const isStockTvaEpuise = (x: { montantRestant?: number | string | null }): boolean => {
  const n = Number(x.montantRestant);
  return Number.isFinite(n) && Math.abs(n) < 0.005;
};
