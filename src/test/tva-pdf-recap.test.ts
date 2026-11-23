import { describe, it, expect } from "vitest";
import jsPDF from "jspdf";
import { drawRecapGrid, RECAP_LINE_H } from "@/lib/utilisationTvaPdf";

type Box = { x0: number; x1: number; y: number };

/** Boîtes réellement posées par la grille (largeur mesurée par jsPDF). */
function boxes(cells: [string, string][]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(9);
  const placed: Box[] = [];
  const orig = doc.text.bind(doc);
  (doc as unknown as { text: unknown }).text = (txt: string, x: number, y: number, opts?: { align?: string }) => {
    const w = doc.getTextWidth(txt);
    placed.push(opts?.align === "right" ? { x0: x - w, x1: x, y } : { x0: x, x1: x + w, y });
    return orig(txt, x, y, opts as never);
  };
  const M = 40, R = doc.internal.pageSize.getWidth() - 40;
  const end = drawRecapGrid(doc, cells, M + 6, R - 6, 100);
  return { placed, end, left: M + 6, right: R - 6 };
}

const overlap = (a: Box, b: Box) => a.y === b.y && a.x0 < b.x1 && b.x0 < a.x1;

const cells = (montant: string): [string, string][] => [
  ["TVA collectée :", `${montant} MRU`],
  ["TVA déductible imputée :", `${montant} MRU`],
  ["TVA nette :", `${montant} MRU`],
  ["Imputé sur le crédit intérieur :", `${montant} MRU`],
  ["Paiement entreprise :", `${montant} MRU`],
  ["Report à nouveau :", `${montant} MRU`],
];

describe("PDF TVA : récapitulatif de l'apurement", () => {
  it.each(["7 000,00", "999 999 999 999,99"])("aucun chevauchement avec %s MRU, sur 2 colonnes", (m) => {
    const { placed, left, right } = boxes(cells(m));
    expect(placed).toHaveLength(12);
    for (let i = 0; i < placed.length; i++) {
      expect(placed[i].x0).toBeGreaterThanOrEqual(left - 0.01);
      expect(placed[i].x1).toBeLessThanOrEqual(right + 0.01);
      for (let j = i + 1; j < placed.length; j++) expect(overlap(placed[i], placed[j])).toBe(false);
    }
  });

  it("3 lignes pour des montants courts : la suite du PDF commence sous la grille", () => {
    const { end, placed } = boxes(cells("7 000,00"));
    expect(new Set(placed.map((b) => b.y)).size).toBe(3);
    expect(end).toBe(100 + 3 * RECAP_LINE_H + 2);
  });
});
