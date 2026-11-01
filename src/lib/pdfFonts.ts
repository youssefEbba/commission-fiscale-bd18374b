import type jsPDF from "jspdf";
import frRegularUrl from "@/assets/fonts/LouguiyaFR-Regular.ttf?url";
import frBoldUrl from "@/assets/fonts/LouguiyaFR-Bold.ttf?url";
import arRegularUrl from "@/assets/fonts/Louguiya-Regular.ttf?url";
import arBoldUrl from "@/assets/fonts/Louguiya-Bold.ttf?url";

/**
 * Police officielle de l'État (charte graphique gouvernementale, plateforme Kennach) :
 * LouguiyaFR pour le texte latin, Louguiya pour l'arabe. Utilisée par tous les documents générés.
 * La police n'a pas d'italique : les styles « italic » sont rendus en romain.
 *
 * Les fichiers sont lus par leur adresse (`?url`) puis convertis en base64 au moment de la génération :
 * `?inline` ne renvoie pas toujours le contenu (en développement, Vite renvoie l'adresse), ce qui cassait jsPDF.
 */
export const PDF_FONT = "Ouguiya";

const FILES = {
  "LouguiyaFR-Regular.ttf": frRegularUrl,
  "LouguiyaFR-Bold.ttf": frBoldUrl,
} as const;

let pdfFontsReady: Promise<Record<string, string>> | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

/** Lit une fois les fichiers de la police (base64) ; un échec n'est pas mémorisé, il sera retenté. */
function loadPdfFontFiles(): Promise<Record<string, string>> {
  if (pdfFontsReady) return pdfFontsReady;
  pdfFontsReady = Promise.all(
    Object.entries(FILES).map(async ([name, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Police officielle indisponible (${name}, HTTP ${res.status})`);
      return [name, toBase64(await res.arrayBuffer())] as const;
    }),
  ).then(Object.fromEntries);
  pdfFontsReady.catch(() => { pdfFontsReady = null; });
  return pdfFontsReady;
}

/** Enregistre la police officielle dans le document jsPDF et l'active. À attendre juste après `new jsPDF(...)`. */
export async function applyOfficialFont(doc: jsPDF): Promise<jsPDF> {
  if (!doc.getFontList()[PDF_FONT]) {
    const files = await loadPdfFontFiles();
    for (const [name, data] of Object.entries(files)) doc.addFileToVFS(name, data);
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
    new FontFace(CANVAS_FONT_FR, `url(${frRegularUrl})`, { weight: "400" }),
    new FontFace(CANVAS_FONT_FR, `url(${frBoldUrl})`, { weight: "700" }),
    new FontFace(CANVAS_FONT_AR, `url(${arRegularUrl})`, { weight: "400" }),
    new FontFace(CANVAS_FONT_AR, `url(${arBoldUrl})`, { weight: "700" }),
  ];
  webFontsReady = Promise.all(
    faces.map((f) => f.load().then((loaded) => { document.fonts.add(loaded); }).catch(() => undefined)),
  ).then(() => undefined);
  return webFontsReady;
}
