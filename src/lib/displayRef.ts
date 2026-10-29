/**
 * Helper d'affichage des références lisibles (`PREFIXE-NNNN-MM-AAAA`, ex. `DC-0010-10-2026` ;
 * `CU-NNNN-AAAA` pour le certificat d'utilisation).
 * Priorité `reference` sinon fallback `numero` sinon fallback `#id`.
 *
 * Utilisation :
 *   displayRef(demande)               // "DC-0010-10-2026" ou "1234" ou "#42"
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
