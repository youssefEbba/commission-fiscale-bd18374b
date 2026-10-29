import type jsPDF from "jspdf";
import frRegular from "@/assets/fonts/LouguiyaFR-Regular.ttf?inline";
import frBold from "@/assets/fonts/LouguiyaFR-Bold.ttf?inline";
import arRegular from "@/assets/fonts/Louguiya-Regular.ttf?inline";
import arBold from "@/assets/fonts/Louguiya-Bold.ttf?inline";

/**
 * Police officielle de l'État (charte graphique gouvernementale, plateforme Kennach) :
 * LouguiyaFR pour le texte latin, Louguiya pour l'arabe. Utilisée par tous les documents générés.
 * La police n'a pas d'italique : les styles « italic » sont rendus en romain.
 */
export const PDF_FONT = "Ouguiya";

const base64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);

/** Enregistre la police officielle dans le document jsPDF et l'active. À appeler juste après `new jsPDF(...)`. */
export function applyOfficialFont(doc: jsPDF): jsPDF {
  if (!doc.getFontList()[PDF_FONT]) {
    doc.addFileToVFS("LouguiyaFR-Regular.ttf", base64(frRegular));
    doc.addFileToVFS("LouguiyaFR-Bold.ttf", base64(frBold));
    doc.addFont("LouguiyaFR-Regular.ttf", PDF_FONT, "normal");
    doc.addFont("LouguiyaFR-Bold.ttf", PDF_FONT, "bold");
    doc.addFont("LouguiyaFR-Regular.ttf", PDF_FONT, "italic");
    doc.addFont("LouguiyaFR-Bold.ttf", PDF_FONT, "bolditalic");
  }
  doc.setFont(PDF_FONT, "normal");
  return doc;
}

/** Familles CSS pour les documents dessinés via canvas (texte arabe notamment). */
export const CANVAS_FONT_FR = "LouguiyaFR";
export const CANVAS_FONT_AR = "Louguiya";

let webFontsReady: Promise<void> | null = null;

/** Charge la police officielle dans le navigateur (FR + AR) pour le rendu canvas ; sans effet si indisponible. */
export function loadOfficialWebFonts(): Promise<void> {
  if (webFontsReady) return webFontsReady;
  if (typeof document === "undefined" || typeof FontFace === "undefined" || !document.fonts) {
    return Promise.resolve();
  }
  const faces = [
    new FontFace(CANVAS_FONT_FR, `url(${frRegular})`, { weight: "400" }),
    new FontFace(CANVAS_FONT_FR, `url(${frBold})`, { weight: "700" }),
    new FontFace(CANVAS_FONT_AR, `url(${arRegular})`, { weight: "400" }),
    new FontFace(CANVAS_FONT_AR, `url(${arBold})`, { weight: "700" }),
  ];
  webFontsReady = Promise.all(
    faces.map((f) => f.load().then((loaded) => { document.fonts.add(loaded); }).catch(() => undefined)),
  ).then(() => undefined);
  return webFontsReady;
}
