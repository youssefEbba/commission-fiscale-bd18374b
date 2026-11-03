// Règles d'écran des enquêtes de satisfaction (le serveur contrôle à nouveau et décide).
import type { EnqueteQuestionDto, EnqueteQuestionRequest, EnqueteRequest, ReponseEnqueteRequest } from "./api";
import { invalidateList } from "./listCache";

/** Clé de cache des enquêtes ouvertes à l'utilisateur (bandeau). */
export const enquetesEnCoursKey = (userId?: number) => `feedback:enquetes-en-cours:${userId ?? "anon"}`;

/** Après une réponse : la prochaine page relit la liste. */
export const invalidateEnquetesEnCours = (userId?: number) => invalidateList(enquetesEnCoursKey(userId));

export type EnqueteFormError =
  | "titre"
  | "dates"
  | "profils"
  | "questions"
  | { question: number; error: "libelle" | "options" };

/** Première erreur bloquante d'une enquête saisie, ou `null`. */
export function enqueteFormError(e: EnqueteRequest): EnqueteFormError | null {
  if (!e.titre.trim()) return "titre";
  if (!e.dateDebut || !e.dateFin || e.dateFin < e.dateDebut) return "dates";
  if (!e.profilsCibles.length) return "profils";
  if (!e.questions.length) return "questions";
  for (let i = 0; i < e.questions.length; i++) {
    const q = e.questions[i];
    if (!q.libelle.trim()) return { question: i, error: "libelle" };
    if (q.type === "CHOIX" && cleanOptions(q.options).length < 2) return { question: i, error: "options" };
  }
  return null;
}

/** Options non vides et sans doublon (casse ignorée), dans l'ordre saisi. */
export function cleanOptions(options?: string[] | null): string[] {
  const seen = new Set<string>();
  return (options || []).map((o) => o.trim()).filter((o) => {
    const k = o.toLocaleLowerCase();
    if (!o || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Corps envoyé : textes nettoyés, options seulement pour CHOIX. */
export function buildEnqueteRequest(e: EnqueteRequest): EnqueteRequest {
  return {
    titre: e.titre.trim(),
    description: e.description?.trim() || null,
    dateDebut: e.dateDebut,
    dateFin: e.dateFin,
    profilsCibles: [...e.profilsCibles],
    questions: e.questions.map((q): EnqueteQuestionRequest => ({
      libelle: q.libelle.trim(),
      type: q.type,
      categorie: q.categorie?.trim() || null,
      options: q.type === "CHOIX" ? cleanOptions(q.options) : null,
      obligatoire: !!q.obligatoire,
    })),
  };
}

export type ReponseSaisie = { note?: number | null; texte?: string | null };

/** Questions obligatoires sans réponse (identifiants). */
export function questionsSansReponse(questions: EnqueteQuestionDto[], reponses: Record<number, ReponseSaisie>): number[] {
  return questions
    .filter((q) => q.obligatoire)
    .filter((q) => {
      const r = reponses[q.id];
      return q.type === "NOTE" ? r?.note == null : !r?.texte?.trim();
    })
    .map((q) => q.id);
}

/** Corps de réponse : NOTE → note, TEXTE / CHOIX → texte ; questions sans réponse omises. */
export function buildReponseRequest(questions: EnqueteQuestionDto[], reponses: Record<number, ReponseSaisie>): ReponseEnqueteRequest {
  return {
    reponses: questions.flatMap((q): ReponseEnqueteRequest["reponses"] => {
      const r = reponses[q.id];
      if (q.type === "NOTE") return r?.note != null ? [{ questionId: q.id, note: r.note }] : [];
      const texte = r?.texte?.trim();
      return texte ? [{ questionId: q.id, texte }] : [];
    }),
  };
}
