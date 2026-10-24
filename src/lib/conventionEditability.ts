import type { ConventionDto, UpdateConventionRequest } from "@/lib/api";

/** Closing remains allowed even when a convention has been cancelled. */
export function canSetConventionActivation(statut: string, actif: boolean) {
  return !actif || statut !== "ANNULEE";
}

/**
 * Modification d'une convention (PUT /api/conventions/{id}) : les trois conditions ensemble.
 * - permission `convention.update` ;
 * - convention encore en attente de validation DGB ;
 * - autorité du compte (ou autorité représentée en relais) titulaire OU créatrice.
 * La permission seule ne suffit pas : le Président la détient aussi.
 */
export function canEditConvention(
  conv: Pick<ConventionDto, "statut" | "autoriteContractanteId" | "creeParAutoriteContractanteId">,
  userAutoriteContractanteId: number | null | undefined,
  hasUpdatePermission: boolean,
): boolean {
  if (!hasUpdatePermission) return false;
  if (conv.statut !== "EN_ATTENTE") return false;
  if (userAutoriteContractanteId == null) return false;
  return (
    conv.autoriteContractanteId === userAutoriteContractanteId ||
    conv.creeParAutoriteContractanteId === userAutoriteContractanteId
  );
}

export interface ConventionEditForm {
  reference: string;
  intitule: string;
  projectReference: string;
  bailleurId?: number | null;
  dateSignature: string;
  dateFin: string;
  deviseOrigine: string;
  montantDevise?: number | null;
  tauxChange?: number | null;
  montantMru?: number | null;
}

const textOrNull = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s ? s : null;
};
const numOrNull = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? null : v);

/** Prérempli depuis la lecture ; les dates sont des dates civiles (AAAA-MM-JJ). */
export function conventionToEditForm(conv: ConventionDto): ConventionEditForm {
  return {
    reference: conv.reference ?? "",
    intitule: conv.intitule ?? "",
    projectReference: conv.projectReference ?? "",
    bailleurId: conv.bailleurId ?? null,
    dateSignature: conv.dateSignature ? conv.dateSignature.slice(0, 10) : "",
    dateFin: conv.dateFin ? conv.dateFin.slice(0, 10) : "",
    deviseOrigine: conv.deviseOrigine ?? "",
    montantDevise: conv.montantDevise ?? null,
    tauxChange: conv.tauxChange ?? null,
    montantMru: conv.montantMru ?? null,
  };
}

/**
 * Remplacement complet : tout le formulaire est envoyé, un champ vide part à `null` (il sera effacé).
 * Jamais d'autorité contractante : elle ne se change pas.
 */
export function buildUpdateConventionRequest(form: ConventionEditForm): UpdateConventionRequest {
  return {
    reference: form.reference.trim(),
    intitule: form.intitule.trim(),
    projectReference: textOrNull(form.projectReference),
    bailleurId: form.bailleurId ?? null,
    dateSignature: textOrNull(form.dateSignature),
    dateFin: textOrNull(form.dateFin),
    deviseOrigine: textOrNull(form.deviseOrigine),
    montantDevise: numOrNull(form.montantDevise),
    tauxChange: numOrNull(form.tauxChange),
    montantMru: numOrNull(form.montantMru),
  };
}
