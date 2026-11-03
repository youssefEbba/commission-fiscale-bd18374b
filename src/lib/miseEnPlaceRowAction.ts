/**
 * Bouton principal d'une ligne de la liste des mises en place.
 * « Traiter » seulement quand la demande attend une action de la direction connectée
 * (information du serveur : main courante) ; une demande annulée n'offre que « Voir ».
 */
export const DIRECTION_ROLES = ["DGD", "DGI", "DGTCP", "DGB", "PRESIDENT"] as const;

/** Statuts où plus aucune direction n'a de geste à faire. */
const STATUTS_SANS_ACTION = ["ANNULE", "ANNULEE", "CLOTURE", "CLOTUREE", "OUVERT", "BROUILLON"];

export interface MiseEnPlaceRowContext {
  role?: string | null;
  statut?: string | null;
  /** Ids des demandes attendant l'action du compte (main courante), `null` si inconnu. */
  attendues: ReadonlySet<number> | null;
  id: number;
  /** La direction connectée a déjà posé son visa. */
  dejaVise?: boolean;
}

export function miseEnPlaceRowAction(ctx: MiseEnPlaceRowContext): "process" | "view" {
  if (ctx.statut && STATUTS_SANS_ACTION.includes(ctx.statut)) return "view";
  const role = ctx.role ?? "";
  if (role === "AUTORITE_CONTRACTANTE" || role === "ENTREPRISE") return "view";
  if (!(DIRECTION_ROLES as readonly string[]).includes(role)) return "process";
  if (ctx.attendues) return ctx.attendues.has(ctx.id) ? "process" : "view";
  // Main courante indisponible : repli prudent, rien à faire si le visa est déjà posé.
  return ctx.dejaVise ? "view" : "process";
}
