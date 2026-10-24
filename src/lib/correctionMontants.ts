/**
 * Crédits retenus par la correction (visa de la direction qui dépose l'offre corrigée).
 *
 * Qui saisit : le serveur le dit via `saisieMontantsExigee` sur la ligne du rôle dans
 * `GET /demandes-correction/{id}/visas` — ne jamais le déduire des montants côté écran.
 * Contrôles écran = contrôles serveur : montants ≥ 0, au moins un strictement positif.
 */

export interface CorrectionMontants {
  creditExterieur: number;
  creditInterieur: number;
}

/** Saisie en cours (valeurs des champs, chaînes brutes). */
export interface CorrectionMontantsDraft {
  creditExterieur: string;
  creditInterieur: string;
}

export type CorrectionMontantsError = "required" | "negative" | "none_positive";

interface CreditsLike {
  creditExterieur?: number | string | null;
  creditInterieur?: number | string | null;
  creditExterieurDeclare?: number | string | null;
  creditInterieurDeclare?: number | string | null;
}

const toDraftValue = (v: number | string | null | undefined): string =>
  v == null || v === "" || Number.isNaN(Number(v)) ? "" : String(v);

/** Préremplissage : montants actuels de la demande (`demande.creditExterieur` / `creditInterieur`). */
export function initialMontantsDraft(d: CreditsLike | null | undefined): CorrectionMontantsDraft {
  return {
    creditExterieur: toDraftValue(d?.creditExterieur),
    creditInterieur: toDraftValue(d?.creditInterieur),
  };
}

/** Déclaration d'origine de l'autorité : champs `*Declare` s'ils sont renseignés, sinon montants actuels. */
export function declaredMontants(d: CreditsLike | null | undefined): {
  creditExterieur: number | string | null;
  creditInterieur: number | string | null;
} {
  return {
    creditExterieur: d?.creditExterieurDeclare ?? d?.creditExterieur ?? null,
    creditInterieur: d?.creditInterieurDeclare ?? d?.creditInterieur ?? null,
  };
}

/** `true` quand le serveur a enregistré une correction (déclaration d'origine conservée à part). */
export function hasDeclaredMontants(d: CreditsLike | null | undefined): boolean {
  return d?.creditExterieurDeclare != null || d?.creditInterieurDeclare != null;
}

function parse(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function montantsError(draft: CorrectionMontantsDraft): CorrectionMontantsError | null {
  const ext = parse(draft.creditExterieur);
  const int = parse(draft.creditInterieur);
  if (ext == null || int == null) return "required";
  if (ext < 0 || int < 0) return "negative";
  if (ext <= 0 && int <= 0) return "none_positive";
  return null;
}

/** Montants à envoyer, ou `null` si la saisie est invalide. */
export function parseMontants(draft: CorrectionMontantsDraft): CorrectionMontants | null {
  if (montantsError(draft)) return null;
  return { creditExterieur: parse(draft.creditExterieur)!, creditInterieur: parse(draft.creditInterieur)! };
}

/**
 * Corps de `POST /demandes-correction/{id}/decisions`.
 * Les crédits ne partent qu'avec un VISA pour lequel le serveur exige la saisie ;
 * jamais avec une demande de pièce ni avec les autres visas (le serveur les refuse).
 */
export function buildCorrectionDecisionBody(
  decision: string,
  motifRejet?: string,
  documentsDemandes?: string[],
  montants?: CorrectionMontants | null,
): Record<string, unknown> {
  return {
    decision,
    ...(motifRejet ? { motifRejet } : {}),
    ...(documentsDemandes && documentsDemandes.length > 0 ? { documentsDemandes } : {}),
    ...(decision === "VISA" && montants
      ? { creditExterieur: montants.creditExterieur, creditInterieur: montants.creditInterieur }
      : {}),
  };
}
