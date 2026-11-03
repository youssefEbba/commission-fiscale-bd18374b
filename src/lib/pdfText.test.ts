import { describe, expect, it } from "vitest";
import { montantOuguiyaEnLettres, numberToFrenchWords, pdfFmtNombre, pdfSafe } from "./pdfText";

describe("pdfText", () => {
  it("assainit les espaces Unicode", () => {
    expect(pdfSafe("1\u202F000")).toBe("1 000");
  });

  it("formate un nombre", () => {
    expect(pdfFmtNombre(12)).toMatch(/12/);
  });

  it("écrit un montant en lettres", () => {
    expect(numberToFrenchWords(21)).toContain("vingt");
    expect(montantOuguiyaEnLettres(0)).toBe("zéro Ouguiya");
  });
});
