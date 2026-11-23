/**
 * Référence lisible d'un dossier (`PREFIXE-NNNN-MM-AAAA`, ex. `DC-0010-10-2026`, `DU-…`, `TR-…`, `ST-…`, `CL-…` ;
 * `CU-NNNN-AAAA` pour le certificat d'utilisation) : `reference`, sinon `numero`, sinon « — ».
 * L'id technique n'est JAMAIS affiché (il reste dans les URL et les clés React).
 *
 *   displayRef(demande)   // "DC-0010-10-2026", "1234" ou "—"
 */
export const NO_REF = "—";

export function displayRef(
  entity: { reference?: string | null; numero?: string | null } | null | undefined,
): string {
  if (!entity) return NO_REF;
  return entity.reference?.trim() || entity.numero?.trim() || NO_REF;
}
