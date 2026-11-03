// ================================
// Soumission après dépôt des pièces (A42 / A16 / A31)
// ================================
// Flux commun aux demandes de correction, mises en place et utilisations :
//   créer (brouillon=false) → déposer les pièces → si le serveur a laissé la
//   demande en BROUILLON (pièces GED obligatoires absentes à la création),
//   appeler `/soumettre`. Ne jamais appeler `/soumettre` sur une demande déjà
//   envoyée (le serveur répond 409).

/** Erreur structurée minimale (ApiRequestError ou équivalent). */
interface ErrorLike {
  status?: number;
  code?: string;
  details?: unknown;
  message?: string;
}

function asErrorLike(err: unknown): ErrorLike | null {
  return err && typeof err === "object" ? (err as ErrorLike) : null;
}

/**
 * Codes des pièces manquantes d'un refus 400 « Documents obligatoires manquants: [CODES] ».
 * Lit `details` (liste de codes) en priorité, puis la liste entre crochets du message.
 * `null` si l'erreur n'est pas ce refus.
 */
export function missingDocumentCodes(err: unknown): string[] | null {
  const e = asErrorLike(err);
  if (!e || e.status !== 400) return null;
  const message = typeof e.message === "string" ? e.message : "";
  const isMissingDocs = /documents?\s+obligatoires?\s+manquant/i.test(message);
  if (Array.isArray(e.details)) {
    const codes = e.details
      .map((d) => (typeof d === "string" ? d : d && typeof d === "object" ? (d as { codeDocument?: unknown; code?: unknown }).codeDocument ?? (d as { code?: unknown }).code : null))
      .filter((c): c is string => typeof c === "string" && c.trim() !== "")
      .map((c) => c.trim());
    if (codes.length && (isMissingDocs || codes.every((c) => /^[A-Z0-9_]+$/.test(c)))) return codes;
  }
  if (!isMissingDocs) return null;
  const m = /\[([^\]]*)\]/.exec(message);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Route absente du serveur (pas encore déployée) : 405, ou 404 sans code métier.
 * Un 404 « RESOURCE_NOT_FOUND » (dossier introuvable) n'en est pas un.
 */
export function isRouteUnavailable(err: unknown): boolean {
  const e = asErrorLike(err);
  if (!e) return false;
  if (e.status === 405) return true;
  return e.status === 404 && e.code !== "RESOURCE_NOT_FOUND";
}

export type SubmitOutcome<T> =
  /** Le serveur avait déjà envoyé la demande à la création : rien à faire. */
  | { kind: "already_sent"; result: T }
  /** La demande était en brouillon et `/soumettre` a réussi. */
  | { kind: "submitted"; result: T }
  /** `/soumettre` a refusé faute de pièces : la demande reste en brouillon. */
  | { kind: "missing_documents"; result: T; codes: string[] }
  /** `/soumettre` absent du serveur (pas encore déployé) : la demande reste en brouillon. */
  | { kind: "route_unavailable"; result: T };

/**
 * À appeler après le dépôt des pièces d'une création « directe ».
 * Soumet seulement si le statut renvoyé est BROUILLON ; transforme le refus
 * « pièces manquantes » en résultat (les autres erreurs sont relancées).
 */
export async function submitIfDraft<T extends { statut?: string | null }>(
  current: T,
  soumettre: () => Promise<T>,
): Promise<SubmitOutcome<T>> {
  if (current.statut !== "BROUILLON") return { kind: "already_sent", result: current };
  try {
    const result = await soumettre();
    return { kind: "submitted", result: result ?? current };
  } catch (e) {
    const codes = missingDocumentCodes(e);
    if (codes) return { kind: "missing_documents", result: current, codes };
    if (isRouteUnavailable(e)) return { kind: "route_unavailable", result: current };
    throw e;
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Message (toast) d'une soumission restée en brouillon, ou `null` si la demande est partie.
 * `docLabel` traduit un code de pièce (tTypeDocument).
 */
export function draftOutcomeMessage<T>(
  outcome: SubmitOutcome<T>,
  t: Translate,
  docLabel: (code: string) => string,
): { title: string; description: string } | null {
  if (outcome.kind === "missing_documents") {
    return {
      title: t("common:submission.missing_docs_title"),
      description: t("common:submission.missing_docs_desc", { list: outcome.codes.map(docLabel).join(", ") || "—" }),
    };
  }
  if (outcome.kind === "route_unavailable") {
    return {
      title: t("common:submission.unavailable_title"),
      description: t("common:submission.unavailable_desc"),
    };
  }
  return null;
}

/** Pièces obligatoires (codes) encore absentes parmi celles jointes, dans l'ordre demandé. */
export function missingRequired(required: readonly string[], joined: Iterable<string>): string[] {
  const have = new Set(joined);
  return required.filter((code) => !have.has(code));
}

/**
 * Pièces exigées pour une utilisation TVA intérieure selon le type d'achat :
 * achat local → facture + déclaration TVA ; décompte → décompte.
 */
export function utilisationTvaRequiredDocs(typeAchat: string | null | undefined): string[] {
  if (typeAchat === "ACHAT_LOCAL") return ["FACTURE", "DECLARATION_TVA"];
  if (typeAchat === "DECOMPTE") return ["DECOMPTE"];
  return [];
}
