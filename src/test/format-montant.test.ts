import { describe, it, expect, beforeAll } from "vitest";
import i18n from "@/i18n";
import { formatAmount } from "@/i18n/format";

const sansEspaces = (s: string) => s.replace(/[   ]/g, "");

describe("montants affichés", () => {
  beforeAll(async () => { await i18n.changeLanguage("fr"); });

  it("un montant avec centimes garde deux décimales (427,20 et non 427,2)", () => {
    expect(sansEspaces(formatAmount(358756427.2))).toBe("358756427,20MRU");
  });

  it("un montant rond reste sans décimales", () => {
    expect(sansEspaces(formatAmount(1500))).toBe("1500MRU");
  });

  it("les décimales demandées explicitement sont respectées", () => {
    expect(sansEspaces(formatAmount(12, { minimumFractionDigits: 2 }))).toBe("12,00MRU");
    expect(sansEspaces(formatAmount(0.12345, { minimumFractionDigits: 2, maximumFractionDigits: 4 }))).toBe("0,1235MRU");
  });
});

describe("pourcentages affichés", () => {
  it("utilisent la virgule et une décimale au plus (12,5 % et non 12.5%)", async () => {
    const { formatPercent } = await import("@/i18n/format");
    await i18n.changeLanguage("fr");
    expect(sansEspaces(formatPercent(12.54))).toBe("12,5%");
    expect(sansEspaces(formatPercent(100))).toBe("100%");
  });
});
