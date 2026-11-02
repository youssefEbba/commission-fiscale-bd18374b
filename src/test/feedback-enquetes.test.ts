import { describe, it, expect } from "vitest";
import { buildEnqueteRequest, buildReponseRequest, cleanOptions, enqueteFormError, questionsSansReponse } from "@/lib/enquetes";
import type { EnqueteQuestionDto, EnqueteRequest } from "@/lib/api";

const base: EnqueteRequest = {
  titre: "Satisfaction 2026",
  description: "",
  dateDebut: "2026-11-01",
  dateFin: "2026-11-30",
  profilsCibles: ["ENTREPRISE"],
  questions: [{ libelle: "Note globale", type: "NOTE", obligatoire: true }],
};

describe("Enquêtes — saisie", () => {
  it("accepte une enquête complète", () => {
    expect(enqueteFormError(base)).toBeNull();
  });
  it("refuse période inversée, profil absent, choix à une option", () => {
    expect(enqueteFormError({ ...base, dateFin: "2026-10-01" })).toBe("dates");
    expect(enqueteFormError({ ...base, profilsCibles: [] })).toBe("profils");
    expect(enqueteFormError({ ...base, questions: [{ libelle: "Canal", type: "CHOIX", options: ["Web", " web ", "Web"] }] }))
      .toEqual({ question: 0, error: "options" });
  });
  it("nettoie les options et ne les envoie que pour CHOIX", () => {
    expect(cleanOptions([" A ", "", "B", "A"])).toEqual(["A", "B"]);
    const body = buildEnqueteRequest({ ...base, description: "  ", questions: [{ libelle: " Q ", type: "NOTE", options: ["x"] }] });
    expect(body.description).toBeNull();
    expect(body.questions[0]).toEqual({ libelle: "Q", type: "NOTE", categorie: null, options: null, obligatoire: false });
  });
});

describe("Enquêtes — réponse", () => {
  const questions: EnqueteQuestionDto[] = [
    { id: 1, ordre: 1, libelle: "Note", type: "NOTE", obligatoire: true },
    { id: 2, ordre: 2, libelle: "Canal", type: "CHOIX", options: ["Web", "Guichet"], obligatoire: true },
    { id: 3, ordre: 3, libelle: "Remarque", type: "TEXTE", obligatoire: false },
  ];
  it("signale les questions obligatoires sans réponse", () => {
    expect(questionsSansReponse(questions, { 1: { note: 4 } })).toEqual([2]);
    expect(questionsSansReponse(questions, { 1: { note: 4 }, 2: { texte: "Web" } })).toEqual([]);
  });
  it("NOTE → note, CHOIX/TEXTE → texte, vides omises", () => {
    expect(buildReponseRequest(questions, { 1: { note: 5 }, 2: { texte: "Guichet" }, 3: { texte: "  " } })).toEqual({
      reponses: [{ questionId: 1, note: 5 }, { questionId: 2, texte: "Guichet" }],
    });
  });
});
