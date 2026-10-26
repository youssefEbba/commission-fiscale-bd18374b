import jsPDF from "jspdf";
import type {
  DemandeCorrectionDto,
  EntrepriseDto,
  MarcheDto,
  ConventionDto,
  AutoriteContractanteDto,
} from "@/lib/api";
import emblem from "@/assets/logo-official.png";
import signaturePresident from "@/assets/signature-president.png";
import { resolveApposition, type AppositionOptions } from "@/lib/signatures";
import { hasCreditInterieur, hasCreditExterieur } from "@/lib/visas";

const CURRENCY = "MRU";

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
  // Mesure du titre dans sa police réelle (le cadre est désormais dessiné après son contenu).
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.rect(x + 3, y - 2.5, doc.getTextWidth(title) + 4, 5, "F");
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
  apposition?: AppositionOptions,
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

  // Mise en page compacte : chaque cadre suit son contenu réel pour tenir sur une page A4.
  const SEC_TOP = 6.5; // du bord haut du cadre à la 1re ligne
  const ROW = 5.5; // interligne entre champs
  const SEC_BOTTOM = 3.5; // de la dernière ligne au bord bas
  const SEC_GAP = 5; // entre deux cadres (place pour le titre posé sur le bord)

  let y = 61;

  // ---------- I - Identification demande ----------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let yy = y + SEC_TOP;

  yy += inlineField(doc, "RÉFÉRENCE", refLisible, M + 4, yy, M + W - 4);
  yy += ROW;
  yy += inlineField(doc, "DATE DE DÉPÔT", fmtDate(d.dateDepot), M + 4, yy, M + W - 4);
  yy += ROW;
  yy += inlineField(doc, "NATURE DU CRÉDIT", creditNature(d), M + 4, yy, M + W - 4);

  const h1 = yy - y + SEC_BOTTOM;
  section(doc, "I – IDENTIFICATION DE LA DEMANDE", M, y, W, h1);
  y += h1 + SEC_GAP;

  // ---------- II - Identification entreprise ----------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  yy = y + SEC_TOP;

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
  yy += ROW;

  const raisonSociale = d.groupementRaisonSociale
    ? `${d.groupementRaisonSociale} (groupement, chef de file)`
    : entreprise?.raisonSociale || d.entrepriseRaisonSociale || "";
  yy += inlineField(doc, "NOM et PRÉNOM OU RAISON SOCIALE", raisonSociale, M + 4, yy, M + W - 4);
  yy += ROW;
  yy += inlineField(doc, "ADRESSE : SIÈGE", entreprise?.adresse || "", M + 4, yy, M + W - 4);

  const h2 = yy - y + SEC_BOTTOM;
  section(doc, "II – IDENTIFICATION DE L'ENTREPRISE / GROUPEMENT", M, y, W, h2);
  y += h2 + SEC_GAP;

  // ---------- III - Identification marché / convention ----------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  yy = y + SEC_TOP;

  const marcheRef = d.marcheNumero || marche?.numeroMarche || (d.marcheId ? `#${d.marcheId}` : "");
  const marcheIntitule =
    d.marcheIntitule ||
    (d as any).intituleMarche ||
    marche?.intitule ||
    (marche as any)?.intituleMarche ||
    (marche as any)?.objet ||
    "";
  yy += inlineField(doc, "INTITULÉ DU MARCHÉ", marcheIntitule, M + 4, yy, M + W - 4);
  yy += ROW;

  const objet = [marcheRef, marcheIntitule].filter(Boolean).join(" - ");

  const convRef = d.conventionReference || convention?.reference || "";
  const convIntitule = d.conventionIntitule || convention?.intitule || "";
  yy += inlineField(doc, "CONVENTION", [convRef, convIntitule].filter(Boolean).join(" - "), M + 4, yy, M + W - 4);
  yy += ROW;

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

  const h3 = yy - y + SEC_BOTTOM;
  section(doc, "III – IDENTIFICATION DU MARCHÉ / CONVENTION", M, y, W, h3);
  y += h3 + SEC_GAP;

  // ---------- IV - Crédits demandés ----------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  yy = y + SEC_TOP;

  const creditExt = d.creditExterieur || 0;
  const creditInt = d.creditInterieur || 0;
  const total = creditExt + creditInt;

  yy += inlineField(doc, "CRÉDIT EXTÉRIEUR (douane)", fmtMontant(creditExt), M + 4, yy, M + W / 2 - 4);
  yy += ROW;
  yy += inlineField(doc, "CRÉDIT INTÉRIEUR (TVA)", fmtMontant(creditInt), M + 4, yy, M + W / 2 - 4);
  yy += ROW;
  yy += inlineField(doc, "TOTAL", fmtMontant(total), M + 4, yy, M + W / 2 - 4);

  const h4 = yy - y + SEC_BOTTOM;
  section(doc, "IV – CRÉDITS DEMANDÉS", M, y, W, h4);
  y += h4 + SEC_GAP;

  // ---------- V - Décision ----------
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

  // Pré-calcul de la hauteur réelle du bloc V (texte + signature)
  const LINE = 4.8;
  const PARA_GAP = 0.8;
  const BLANK = 3;
  const wrapped = decisionText.map((line) =>
    line ? (doc.splitTextToSize(line, W - 8) as string[]) : null,
  );
  let textH = 0;
  for (const lines of wrapped) textH += lines ? LINE * lines.length + PARA_GAP : BLANK;
  // titre signataire + emblème/cachet (24 mm) + trait
  const signatureH = 4 + 3 + 24 + 2;
  const h5 = SEC_TOP + textH + signatureH;

  const FOOTER_Y = 287;
  const BOTTOM_LIMIT = FOOTER_Y - 5;
  const drawFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    const now = new Date().toLocaleDateString("fr-FR");
    doc.text(`Document généré le ${now} — Réf. technique : ${d.id}`, M, FOOTER_Y);
    doc.text("Commission Fiscale — Ministère des Finances", pageW - M, FOOTER_Y, { align: "right" });
    doc.setTextColor(0);
  };

  // Saut de page en ultime recours (contenu exceptionnellement long)
  if (y + h5 > BOTTOM_LIMIT) {
    drawFooter();
    doc.addPage();
    y = 20;
  }

  section(doc, "V – DÉCISION DE LA COMMISSION", M, y, W, h5);
  yy = y + SEC_TOP;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  for (const lines of wrapped) {
    if (!lines) {
      yy += BLANK;
      continue;
    }
    doc.text(lines, M + 4, yy, { lineHeightFactor: LINE / (10 * 0.3528) });
    yy += LINE * lines.length + PARA_GAP;
  }

  // Signature
  yy += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Le Président de la Commission Fiscale", M + W - 4, yy, { align: "right" });
  yy += 3;
  const { sig: presidentSig, cachet } = await resolveApposition(apposition, signaturePresident);
  if (cachet) {
    try { doc.addImage(cachet, "PNG", M + W - 80, yy - 2, 26, 26); } catch { /* ignore */ }
  }
  try {
    if (presidentSig) doc.addImage(presidentSig, "PNG", M + W - 52, yy, 48, 22);
  } catch {
    // ignore si l'asset n'est pas chargé
  }
  yy += 23;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(M + W - 70, yy, M + W - 4, yy);

  // ---------- Pied de page ----------
  drawFooter();

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
