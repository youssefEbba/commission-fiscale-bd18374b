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

describe("montants en lettres : accords et grands nombres", () => {
  it("laisse « cent » et « vingt » invariables devant « mille »", () => {
    expect(numberToFrenchWords(800_000)).toBe("huit cent mille");
    expect(numberToFrenchWords(80_000)).toBe("quatre-vingt mille");
    expect(numberToFrenchWords(200_000)).toBe("deux cent mille");
  });
  it("les accorde devant « millions » et en fin de nombre", () => {
    expect(numberToFrenchWords(800_000_000)).toBe("huit cents millions");
    expect(numberToFrenchWords(800)).toBe("huit cents");
    expect(numberToFrenchWords(80)).toBe("quatre-vingts");
  });
  it("écrit les milliards", () => {
    expect(numberToFrenchWords(1_524_276_366)).toBe(
      "un milliard cinq cent vingt-quatre millions deux cent soixante-seize mille trois cent soixante-six");
    expect(numberToFrenchWords(2_000_000_000)).toBe("deux milliards");
    expect(montantOuguiyaEnLettres(800_000)).toBe("huit cent mille Ouguiya");
  });
});
