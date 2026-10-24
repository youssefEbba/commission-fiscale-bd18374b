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

/**
 * Chemin d'annulation d'une convention, selon qui annule.
 * - "autorite" : POST /api/conventions/{id}/annuler — mêmes trois conditions que la modification,
 *   avec la permission `convention.annuler` (AC, UPM, UEP, relais en autorité).
 * - "statut" : PATCH /statut?statut=ANNULEE — administration / Président, inchangé
 *   (le serveur y refuse seulement une convention validée).
 * Le Président détient `convention.annuler` mais n'a pas d'autorité : il reste sur la route de statut.
 */
export type ConventionCancelMode = "autorite" | "statut" | null;

export function conventionCancelMode(
  conv: Pick<ConventionDto, "statut" | "autoriteContractanteId" | "creeParAutoriteContractanteId">,
  userAutoriteContractanteId: number | null | undefined,
  hasAnnulerPermission: boolean,
  isAdministration: boolean,
): ConventionCancelMode {
  if (canEditConvention(conv, userAutoriteContractanteId, hasAnnulerPermission)) return "autorite";
  if (isAdministration && conv.statut !== "VALIDE" && conv.statut !== "ANNULEE") return "statut";
  return null;
}

/**
 * Contrôle des dates côté interface (le serveur ne les contrôle pas).
 * En modification (`initial` fourni), une date n'est contrôlée que si elle a changé :
 * une convention dont la date de fin est déjà passée reste enregistrable pour corriger un autre champ.
 */
export type ConventionDateError = "date_signature_future" | "date_fin_past";

export function conventionDateError(
  dates: { dateSignature?: string | null; dateFin?: string | null },
  today: string,
  initial?: { dateSignature?: string | null; dateFin?: string | null },
): ConventionDateError | null {
  const changed = (k: "dateSignature" | "dateFin") => !initial || (dates[k] || "") !== (initial[k] || "");
  if (dates.dateSignature && changed("dateSignature") && dates.dateSignature > today) return "date_signature_future";
  if (dates.dateFin && changed("dateFin") && dates.dateFin < today) return "date_fin_past";
  return null;
}
