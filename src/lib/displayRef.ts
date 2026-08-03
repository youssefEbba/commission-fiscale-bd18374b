/**
 * Helper d'affichage des références lisibles (`PREFIXE-NN/AAAA`) livrées en Phase B.
 * Priorité `reference` sinon fallback `numero` sinon fallback `#id`.
 *
 * Utilisation :
 *   displayRef(demande)               // "DC-01/2025" ou "1234" ou "#42"
 *   displayRef(marche, "SM")          // avec préfixe par défaut si aucun code
 */
export function displayRef(
  entity: { reference?: string | null; numero?: string | null; id?: number | string | null } | null | undefined,
  fallbackPrefix?: string
): string {
  if (!entity) return "—";
  if (entity.reference) return entity.reference;
  if (entity.numero) return entity.numero;
  if (entity.id != null) return fallbackPrefix ? `${fallbackPrefix}-#${entity.id}` : `#${entity.id}`;
  return "—";
}
