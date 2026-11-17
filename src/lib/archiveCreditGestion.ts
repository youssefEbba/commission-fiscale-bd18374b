// Crédit repris de l'archive : correction du rattachement et suppression définitive.
// Règles d'écran seulement — le serveur vérifie la référence (409), la convention de l'autorité (400) et le marché (409).
import type {
  ArchiveCreditSuppressionDto,
  AutoriteContractanteDto,
  ConventionDto,
  EntrepriseDto,
  MarcheDto,
} from "./api";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import { conventionAutorites, marcheConventionIds } from "./conventionEditability";

export const ARCHIVE_REFERENCE_PREFIX = "ARCHIVE-";
export const ARCHIVE_CREDIT_PERMISSION = "archive.import";
/** Valeur du choix « Aucun marché » (le marché est facultatif). */
export const AUCUN_MARCHE = "__aucun__";

export const isArchiveReference = (reference: string | null | undefined) =>
  !!reference && reference.trim().startsWith(ARCHIVE_REFERENCE_PREFIX);

/** Les gestes s'affichent pour un crédit « ARCHIVE- … » et un compte doté de archive.import. */
export const canManageArchiveCredit = (
  hasPermission: (permission: string) => boolean,
  reference: string | null | undefined,
) => isArchiveReference(reference) && hasPermission(ARCHIVE_CREDIT_PERMISSION);

export interface RattachementForm {
  entrepriseId: string;
  autoriteContractanteId: string;
  conventionId: string;
  /** `AUCUN_MARCHE` ou vide = sans marché. */
  marcheId: string;
  motif: string;
}

export type RattachementFormError = "entreprise" | "autorite" | "convention" | "motif";

/** Premier champ manquant, ou `null` si le formulaire peut être envoyé. */
export function rattachementFormError(f: RattachementForm): RattachementFormError | null {
  if (!f.entrepriseId) return "entreprise";
  if (!f.autoriteContractanteId) return "autorite";
  if (!f.conventionId) return "convention";
  if (!f.motif.trim()) return "motif";
  return null;
}

export function buildRattachementBody(f: RattachementForm) {
  return {
    entrepriseId: Number(f.entrepriseId),
    autoriteContractanteId: Number(f.autoriteContractanteId),
    conventionId: Number(f.conventionId),
    marcheId: f.marcheId && f.marcheId !== AUCUN_MARCHE ? Number(f.marcheId) : null,
    motif: f.motif.trim(),
  };
}

/** La suppression exige un motif et la référence du crédit saisie à l'identique. */
export const canConfirmSuppression = (motif: string, saisie: string, reference: string | null | undefined) =>
  !!reference && !!motif.trim() && saisie.trim() === reference.trim();

/** Ordre d'affichage de l'aperçu chiffré. */
export const SUPPRESSION_KEYS = [
  "utilisationsArchive",
  "utilisationsApplication",
  "transferts",
  "avenants",
  "sousTraitances",
  "clotures",
  "pieces",
  "lignesStockTva",
  "echanges",
  "creditsDeLot",
] as const satisfies readonly (keyof ArchiveCreditSuppressionDto)[];

/** Lignes non nulles de l'aperçu (une valeur absente n'est pas affichée comme 0). */
export function suppressionLignes(s: ArchiveCreditSuppressionDto | null | undefined) {
  if (!s) return [];
  return SUPPRESSION_KEYS.map((key) => ({ key, count: s[key] })).filter((l) => typeof l.count === "number" && l.count > 0);
}

// ---- Options des listes de rattachement (reprise d'archive : lot et crédit repris) ----

const byLabel = (a: SearchableSelectOption, b: SearchableSelectOption) => a.label.localeCompare(b.label, "fr");

export const entrepriseOptions = (entreprises: EntrepriseDto[]): SearchableSelectOption[] =>
  entreprises
    .map((e) => ({ value: String(e.id), label: e.raisonSociale || `#${e.id}`, description: e.nif ? `NIF ${e.nif}` : undefined, keywords: e.nif || undefined }))
    .sort(byLabel);

export const autoriteOptions = (autorites: AutoriteContractanteDto[]): SearchableSelectOption[] =>
  autorites
    .map((a) => ({ value: String(a.id), label: a.nom || `#${a.id}`, description: a.sigle || undefined }))
    .sort(byLabel);

/** Conventions de l'autorité (toutes ses autorités, principale ou liée) ; aucune connue → toute la liste. */
export function conventionOptions(conventions: ConventionDto[], autoriteId: string): SearchableSelectOption[] {
  const scoped = autoriteId
    ? conventions.filter((c) => conventionAutorites(c).some((a) => String(a.id) === autoriteId))
    : conventions;
  return (scoped.length ? scoped : conventions)
    .map((c) => ({ value: String(c.id), label: c.reference || `#${c.id}`, description: c.intitule || undefined }))
    .sort(byLabel);
}

/** Marchés de la convention (toutes ses conventions) ; aucun connu → toute la liste. */
export function marcheOptions(marches: MarcheDto[], conventionId: string): SearchableSelectOption[] {
  const scoped = conventionId
    ? marches.filter((m) => marcheConventionIds(m).map(String).includes(conventionId))
    : marches;
  return (scoped.length ? scoped : marches)
    .map((m) => ({ value: String(m.id), label: m.numeroMarche || `#${m.id}`, description: m.intitule || undefined }))
    .sort(byLabel);
}
