import jsPDF from "jspdf";
import type {
  DemandeCorrectionDto,
  EntrepriseDto,
  MarcheDto,
  ConventionDto,
  AutoriteContractanteDto,
} from "@/lib/api";
import emblem from "@/assets/logo-official.png";
import { hasCreditInterieur, hasCreditExterieur } from "@/lib/visas";

const CURRENCY = "Ouguiya";

const safe = (s: string) =>
  s
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/[\u2013\u2014]/g, "-");

const fmt = (v: any) =>
  v != null && !isNaN(Number(v))
    ? safe(Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }))
    : "";

const fmtMontant = (v: any) => {
  const s = fmt(v);
  return s ? `${s} ${CURRENCY}` : "";
};

const fmtDate = (v?: string) => {
  if (!v) return "";
  try {
    return new Date(v).toLocaleDateString("fr-FR");
  } catch {
    return "";
  }
};

const inlineField = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  endX: number,
): number => {
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  const lw = doc.getTextWidth(label);
  doc.setFont("helvetica", "normal");
  const valueX = x + lw + 2;
  const available = Math.max(10, endX - valueX);
  const v = value ? safe(String(value)) : "";
  const lines: string[] = v ? (doc.splitTextToSize(v, available) as string[]) : [""];
  if (v) doc.text(lines[0], valueX, y);
  doc.setLineWidth(0.2);
  doc.line(valueX, y + 0.8, endX, y + 0.8);
  let cy = y;
  for (let i = 1; i < lines.length; i++) {
    cy += 5;
    doc.text(lines[i], x, cy);
    doc.line(x, cy + 0.8, endX, cy + 0.8);
  }
  return cy - y;
};

const section = (
  doc: jsPDF,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  doc.setDrawColor(0, 102, 51);
  doc.setLineWidth(0.6);
  doc.rect(x, y, w, h);
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.2);
  doc.rect(x + 1, y + 1, w - 2, h - 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x + 3, y - 2.5, doc.getTextWidth(title) + 4, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 102, 51);
  doc.text(title, x + 5, y + 1.2);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
};

export interface AdoptionLetterContext {
  entreprise?: EntrepriseDto | null;
  marche?: MarcheDto | null;
  convention?: ConventionDto | null;
  autorite?: AutoriteContractanteDto | null;
}

function creditNature(d: DemandeCorrectionDto): string {
  const int = hasCreditInterieur(d);
  const ext = hasCreditExterieur(d);
  if (int && ext) return "Crédit mixte (intérieur et extérieur)";
  if (int) return "Crédit intérieur (TVA)";
  if (ext) return "Crédit extérieur (douane)";
  return "Crédit non précisé";
}

/**
 * Génère une lettre d'adoption pré-remplie au format institutionnel.
 * Le document est destiné à être imprimé, signé par le Président, puis uploadé.
 */
export async function generateAdoptionLetterPdf(
  d: DemandeCorrectionDto,
  ctx: AdoptionLetterContext = {},
): Promise<Blob> {
  const { entreprise, marche, convention, autorite } = ctx;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 12;
  const W = pageW - M * 2;

  // ---------- Emblème officiel ----------
  try {
    doc.addImage(emblem, "PNG", M, 8, 24, 24);
  } catch {
    // ignore si l'asset n'est pas chargé
  }

  // ---------- En-tête ----------
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 102, 51);
  doc.setFontSize(10);
  doc.text("République Islamique de Mauritanie", pageW / 2, 12, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text("Honneur — Fraternité — Justice", pageW / 2, 17, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("MINISTÈRE DES FINANCES", pageW / 2, 24, { align: "center" });
  doc.setFontSize(10);
  doc.text("Commission Fiscale auprès du Ministre des Finances", pageW / 2, 29, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(0, 102, 51);
  doc.text("MARCHÉS PUBLICS À FINANCEMENT EXTÉRIEUR", pageW / 2, 38, { align: "center" });
  doc.setFontSize(13);
  doc.text("LETTRE D'ADOPTION", pageW / 2, 45, { align: "center" });
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  const t2 = doc.getTextWidth("LETTRE D'ADOPTION");
  doc.line(pageW / 2 - t2 / 2, 47, pageW / 2 + t2 / 2, 47);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // ---------- N° ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const refLabel = "Réf. demande :";
  const refLabelX = pageW - M - 80;
  doc.text(refLabel, refLabelX, 54);
  doc.setFont("helvetica", "normal");
  const refLisible = d.reference || d.numero || "";
  const refValueX = refLabelX + doc.getTextWidth(refLabel) + 3;
  doc.text(safe(refLisible), refValueX, 54);
  doc.setLineWidth(0.2);
  doc.line(refValueX, 55, pageW - M - 4, 55);

  let y = 64;

  // ---------- I - Identification demande ----------
  const h1 = 30;
  section(doc, "I – IDENTIFICATION DE LA DEMANDE", M, y, W, h1);
  doc.setFontSize(9);
  let yy = y + 8;

  yy += inlineField(doc, "RÉFÉRENCE", refLisible, M + 4, yy, M + W - 4);
  yy += 7;
  yy += inlineField(doc, "DATE DE DÉPÔT", fmtDate(d.dateDepot), M + 4, yy, M + W - 4);
  yy += 7;
  yy += inlineField(doc, "NATURE DU CRÉDIT", creditNature(d), M + 4, yy, M + W - 4);

  y += h1 + 6;

  // ---------- II - Identification entreprise ----------
  const h2 = 38;
  section(doc, "II – IDENTIFICATION DE L'ENTREPRISE / GROUPEMENT", M, y, W, h2);
  yy = y + 8;

  const nifRaw = entreprise?.nifAffiche || entreprise?.nif || d.entrepriseNif || "";
  const nifChars = String(nifRaw).padEnd(10, " ").slice(0, 10);
  doc.setFont("helvetica", "bold");
  doc.text("NIF", M + 4, yy);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < 10; i++) {
    const bx = M + 12 + i * 8;
    doc.line(bx, yy + 1, bx + 6, yy + 1);
    const ch = nifChars[i] && nifChars[i] !== " " ? nifChars[i] : "";
    if (ch) doc.text(ch, bx + 3, yy, { align: "center" });
    doc.text("/", bx + 7, yy);
  }
  yy += 7;

  const raisonSociale = d.groupementRaisonSociale
    ? `${d.groupementRaisonSociale} (groupement, chef de file)`
    : entreprise?.raisonSociale || d.entrepriseRaisonSociale || "";
  yy += inlineField(doc, "NOM et PRÉNOM OU RAISON SOCIALE", raisonSociale, M + 4, yy, M + W - 4);
  yy += 7;
  yy += inlineField(doc, "ADRESSE : SIÈGE", entreprise?.adresse || "", M + 4, yy, M + W - 4);

  y += h2 + 6;

  // ---------- III - Identification marché / convention ----------
  const h3 = 44;
  section(doc, "III – IDENTIFICATION DU MARCHÉ / CONVENTION", M, y, W, h3);
  yy = y + 8;

  const objet = [d.marcheNumero || marche?.numeroMarche, d.marcheIntitule || marche?.intitule]
    .filter(Boolean)
    .join(" - ");
  yy += inlineField(doc, "OBJET DU MARCHÉ", objet, M + 4, yy, M + W - 4);
  yy += 7;

  const convRef = d.conventionReference || convention?.reference || "";
  const convIntitule = d.conventionIntitule || convention?.intitule || "";
  yy += inlineField(doc, "CONVENTION", [convRef, convIntitule].filter(Boolean).join(" - "), M + 4, yy, M + W - 4);
  yy += 7;

  const autoriteLabel = autorite?.nom || d.autoriteContractanteNom || "";
  const ministere = autorite?.ministereTutelleNom || "";
  yy += inlineField(
    doc,
    "AUTORITÉ CONTRACTANTE",
    ministere ? `${autoriteLabel} — ${ministere}` : autoriteLabel,
    M + 4,
    yy,
    M + W - 4,
  );

  y += h3 + 6;

  // ---------- IV - Crédits demandés ----------
  const h4 = 36;
  section(doc, "IV – CRÉDITS DEMANDÉS", M, y, W, h4);
  yy = y + 8;

  const creditExt = d.creditExterieur || 0;
  const creditInt = d.creditInterieur || 0;
  const total = creditExt + creditInt;

  yy += inlineField(doc, "CRÉDIT EXTÉRIEUR (douane)", fmtMontant(creditExt), M + 4, yy, M + W / 2 - 4);
  yy += 7;
  yy += inlineField(doc, "CRÉDIT INTÉRIEUR (TVA)", fmtMontant(creditInt), M + 4, yy, M + W / 2 - 4);
  yy += 7;
  yy += inlineField(doc, "TOTAL", fmtMontant(total), M + 4, yy, M + W / 2 - 4);

  y += h4 + 6;

  // ---------- V - Décision ----------
  const h5 = 62;
  section(doc, "V – DÉCISION DE LA COMMISSION", M, y, W, h5);
  yy = y + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const decisionText = [
    `La Commission Fiscale, réunie en session, a examiné la demande de correction référencée ${refLisible || "—"},`,
    `déposée par ${raisonSociale || "l'entreprise"} pour le marché « ${objet || "non précisé"} »`,
    `relatif à la convention « ${convIntitule || convRef || "non précisée"} ».`,
    "",
    `Après examen des pièces du dossier et des avis des membres concernés, la Commission décide d'ADOPTER`,
    `la présente demande pour un montant total de crédit d'impôt de ${fmtMontant(total) || "—"}.`,
    "",
    "La présente lettre d'adoption est établie pour servir et valoir ce que de droit.",
  ];

  for (const line of decisionText) {
    if (!line) {
      yy += 4;
      continue;
    }
    const lines = doc.splitTextToSize(line, W - 8) as string[];
    doc.text(lines, M + 4, yy);
    yy += 5 * lines.length + 1;
  }

  // Signature
  yy += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Le Président de la Commission Fiscale", M + W - 4, yy, { align: "right" });
  yy += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("(Signature et cachet)", M + W - 4, yy, { align: "right" });
  yy += 10;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(M + W - 70, yy, M + W - 4, yy);

  y += h5 + 6;

  // ---------- Pied de page ----------
  doc.setFontSize(8);
  doc.setTextColor(100);
  const now = new Date().toLocaleDateString("fr-FR");
  doc.text(`Document généré le ${now} — Réf. technique : ${d.id}`, M, 285);
  doc.text("Commission Fiscale — Ministère des Finances", pageW - M, 285, { align: "right" });

  return doc.output("blob");
}

/**
 * Déclenche le téléchargement d'un Blob sous forme de fichier PDF.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
