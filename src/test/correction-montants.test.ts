import { describe, expect, it } from "vitest";
import {
  buildCorrectionDecisionBody, declaredMontants, initialMontantsDraft, montantsError, parseMontants,
} from "@/lib/correctionMontants";
import { resolveCredits, requiredPreVisaDocCorrection } from "@/lib/visas";

describe("crédits retenus par la correction", () => {
  it("préremplit avec les montants actuels de la demande", () => {
    expect(initialMontantsDraft({ creditExterieur: 1000, creditInterieur: 500 }))
      .toEqual({ creditExterieur: "1000", creditInterieur: "500" });
  });

  it("rappelle la déclaration d'origine si elle est renseignée, sinon les montants actuels", () => {
    expect(declaredMontants({ creditExterieur: 900, creditInterieur: 450, creditExterieurDeclare: 1000, creditInterieurDeclare: 500 }))
      .toEqual({ creditExterieur: 1000, creditInterieur: 500 });
    expect(declaredMontants({ creditExterieur: 1000, creditInterieur: 500, creditExterieurDeclare: null, creditInterieurDeclare: null }))
      .toEqual({ creditExterieur: 1000, creditInterieur: 500 });
  });

  it("exige les deux montants", () => {
    expect(montantsError({ creditExterieur: "", creditInterieur: "450" })).toBe("required");
  });

  it("refuse un montant négatif", () => {
    expect(montantsError({ creditExterieur: "-1", creditInterieur: "450" })).toBe("negative");
  });

  it("refuse deux montants nuls", () => {
    expect(montantsError({ creditExterieur: "0", creditInterieur: "0" })).toBe("none_positive");
  });

  it("accepte un seul crédit strictement positif", () => {
    expect(parseMontants({ creditExterieur: "0", creditInterieur: "450" })).toEqual({ creditExterieur: 0, creditInterieur: 450 });
  });
});

describe("corps de la décision", () => {
  it("envoie les crédits avec le visa qui les exige", () => {
    expect(buildCorrectionDecisionBody("VISA", undefined, undefined, { creditExterieur: 900, creditInterieur: 450 }))
      .toEqual({ decision: "VISA", creditExterieur: 900, creditInterieur: 450 });
  });

  it("n'envoie aucun crédit pour un visa sans saisie", () => {
    expect(buildCorrectionDecisionBody("VISA")).toEqual({ decision: "VISA" });
  });

  it("n'envoie jamais de crédit avec une demande de pièce", () => {
    const body = buildCorrectionDecisionBody("REJET_TEMP", "motif", ["DQE"], { creditExterieur: 900, creditInterieur: 450 });
    expect(body).not.toHaveProperty("creditExterieur");
    expect(body).not.toHaveProperty("creditInterieur");
  });
});

describe("crédits retenus et suite du circuit", () => {
  it("un crédit extérieur ramené à zéro fait passer le document pré-visa à la DGI", () => {
    const demande = {
      creditExterieur: 0, creditInterieur: 450, creditExterieurDeclare: 1000, creditInterieurDeclare: 500,
      modeleFiscal: { recapitulatif: { creditExterieur: 1000, creditInterieur: 500 } },
    };
    expect(resolveCredits(demande)).toEqual({ creditExterieur: 0, creditInterieur: 450 });
    expect(requiredPreVisaDocCorrection("DGI", resolveCredits(demande))).toBe("CREDIT_INTERIEUR");
    expect(requiredPreVisaDocCorrection("DGD", resolveCredits(demande))).toBeNull();
  });
});
