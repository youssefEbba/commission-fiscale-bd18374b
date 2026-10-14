import { describe, it, expect } from "vitest";
import { orNA, arrangeLines, formatCivilDate } from "@/lib/reportingValues";

const fmt = (n: number) => `${n} j`;

describe("reporting — valeurs nulles", () => {
  it("un nombre nul s'affiche n/a, jamais 0", () => {
    expect(orNA(null, fmt, "n/a")).toBe("n/a");
    expect(orNA(undefined, fmt, "n/a")).toBe("n/a");
  });
  it("un vrai zéro reste 0", () => {
    expect(orNA(0, fmt, "n/a")).toBe("0 j");
  });
});

describe("reporting — lignes de qualité des données", () => {
  const lignes = [
    { cle: "NON_RENSEIGNE", libelle: "zzz", v: 1 },
    { cle: "A", libelle: "Alpha", v: 5 },
    { cle: "HORS_RATTACHEMENT", libelle: "aaa", v: 9 },
    { cle: "B", libelle: "Beta", v: 2 },
  ];
  it("survivent à un filtre qui les exclurait", () => {
    const out = arrangeLines(lignes, { filter: (l) => l.libelle === "Beta" });
    expect(out.map((l) => l.cle)).toEqual(["B", "HORS_RATTACHEMENT", "NON_RENSEIGNE"]);
  });
  it("survivent à un tri et restent en fin", () => {
    const out = arrangeLines(lignes, { compare: (a, b) => b.v - a.v });
    expect(out.map((l) => l.cle)).toEqual(["A", "B", "HORS_RATTACHEMENT", "NON_RENSEIGNE"]);
  });
});

describe("reporting — date civile", () => {
  it("dateFin n'est pas décalée par le fuseau", () => {
    expect(formatCivilDate("2026-11-30", "fr-FR", "n/a")).toBe("30/11/2026");
  });
});
