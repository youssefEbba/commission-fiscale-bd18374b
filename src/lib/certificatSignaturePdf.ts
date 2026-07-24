import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { CertificatCreditDto, EntrepriseDto, MarcheDto, ConventionDto } from "@/lib/api";
import emblem from "@/assets/logo-official.png";

const CURRENCY = "Ouguiya";

// Sanitize a string for jsPDF's built-in (Helvetica) fonts, which don't ship
// some Unicode whitespace/dashes. In particular the narrow no-break space
// (U+202F / U+00A0) produced by fr-FR locale formatting renders as "/".
const safe = (s: string) =>
  s
    .replace(/[\u00A0\u202F\u2007]/g, " ") // narrow/no-break spaces -> normal space
    .replace(/[\u2013\u2014]/g, "-");       // en/em dash -> hyphen

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
) => {
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  const lw = doc.getTextWidth(label);
  doc.setFont("helvetica", "normal");
  const valueX = x + lw + 2;
  const available = Math.max(0, endX - valueX);
  if (value) {
    let v = safe(String(value));
    // shrink long values to fit the underline
    while (v.length > 3 && doc.getTextWidth(v) > available) {
      v = v.slice(0, -2);
    }
    if (v !== safe(String(value))) v = v.replace(/.$/, "…");
    doc.text(v, valueX, y);
  }
  doc.setLineWidth(0.2);
  doc.line(valueX, y + 0.8, endX, y + 0.8);
};

const section = (
  doc: jsPDF,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  // Cadre bicolore : trait extérieur vert, intérieur or
  doc.setDrawColor(0, 102, 51); // vert Mauritanie
  doc.setLineWidth(0.6);
  doc.rect(x, y, w, h);
  doc.setDrawColor(212, 175, 55); // or
  doc.setLineWidth(0.2);
  doc.rect(x + 1, y + 1, w - 2, h - 2);
  // Étiquette
  doc.setFillColor(255, 255, 255);
  doc.rect(x + 3, y - 2.5, doc.getTextWidth(title) + 4, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 102, 51);
  doc.text(title, x + 5, y + 1.2);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
};

export interface CertificatPdfContext {
  entreprise?: EntrepriseDto | null;
  marche?: MarcheDto | null;
  convention?: ConventionDto | null;
}

/**
 * Génère un PDF "Certificat de Crédit d'Impôts" pré-rempli, à signer par le Président.
 * - En-tête institutionnel avec emblème officiel de la République Islamique de Mauritanie.
 * - Montants exprimés en Ouguiya.
 * - QR code de vérification (scan pour contrôler l'authenticité du certificat).
 */
export async function generateCertificatToSignPdf(
  c: CertificatCreditDto,
  ctx: CertificatPdfContext = {},
) {
  const { entreprise, marche, convention } = ctx;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 12;
  const W = pageW - M * 2;

  // ---------- Emblème officiel ----------
  try {
    doc.addImage(emblem, "PNG", M, 8, 24, 24);
  } catch {
    // ignore si format non chargé
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
  doc.text("CERTIFICAT DE CRÉDIT D'IMPÔTS", pageW / 2, 45, { align: "center" });
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  const t2 = doc.getTextWidth("CERTIFICAT DE CRÉDIT D'IMPÔTS");
  doc.line(pageW / 2 - t2 / 2, 47, pageW / 2 + t2 / 2, 47);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // ---------- N° ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("N°", pageW - M - 60, 54);
  doc.setFont("helvetica", "normal");
  const numero = c.numero || c.reference || "";
  doc.text(numero, pageW - M - 50, 54);
  doc.setLineWidth(0.2);
  doc.line(pageW - M - 50, 55, pageW - M - 4, 55);

  let y = 64;

  // ---------- I - Identification entreprise ----------
  const h1 = 38;
  section(doc, "I – IDENTIFICATION DE L'ENTREPRISE", M, y, W, h1);
  doc.setFontSize(9);
  let yy = y + 8;

  const nifRaw = entreprise?.nif || (c as any).entrepriseNif || "";
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
  inlineField(
    doc,
    "NOM et PRÉNOM OU RAISON SOCIALE",
    entreprise?.raisonSociale || c.entrepriseRaisonSociale || c.entrepriseNom || "",
    M + 4,
    yy,
    M + W - 4,
  );
  yy += 7;
  inlineField(doc, "ADRESSE : SIÈGE", entreprise?.adresse || "", M + 4, yy, M + W - 4);
  yy += 7;
  doc.setFont("helvetica", "bold");
  doc.text("BP", M + 4, yy);
  doc.line(M + 10, yy + 0.8, M + 40, yy + 0.8);
  doc.text("TÉL", M + 44, yy);
  doc.setFont("helvetica", "normal");
  if (entreprise?.telephone) doc.text(String(entreprise.telephone), M + 53, yy);
  doc.line(M + 52, yy + 0.8, M + 100, yy + 0.8);
  doc.setFont("helvetica", "bold");
  doc.text("FAX", M + 104, yy);
  doc.line(M + 112, yy + 0.8, M + 140, yy + 0.8);
  doc.text("E-mail", M + 144, yy);
  doc.setFont("helvetica", "normal");
  if (entreprise?.email) doc.text(String(entreprise.email), M + 159, yy);
  doc.line(M + 158, yy + 0.8, M + W - 4, yy + 0.8);

  y += h1 + 6;

  // ---------- II - Identification marché ----------
  const h2 = 58;
  section(doc, "II – IDENTIFICATION DU MARCHÉ", M, y, W, h2);
  yy = y + 8;
  const objet = [marche?.numeroMarche, marche?.intitule || c.marcheIntitule]
    .filter(Boolean)
    .join(" - ");
  inlineField(doc, "OBJET DU MARCHÉ", objet, M + 4, yy, M + W - 4);
  yy += 7;
  inlineField(
    doc,
    "MONTANT DU MARCHÉ (HT)",
    fmtMontant(marche?.montantContratHt),
    M + 4,
    yy,
    M + W - 4,
  );
  yy += 7;
  inlineField(doc, "DATE DE SIGNATURE", fmtDate(marche?.dateSignature), M + 4, yy, M + W - 4);
  yy += 7;
  inlineField(
    doc,
    "COLLECTIVITÉ BÉNÉFICIAIRE DU MARCHÉ",
    convention?.autoriteContractanteNom || "",
    M + 4,
    yy,
    M + W - 4,
  );
  yy += 7;
  doc.setFont("helvetica", "bold");
  doc.text("ORGANISME DE FINANCEMENT (NOM, ADRESSE ET TÉLÉPHONE)", M + 4, yy);
  yy += 7;
  inlineField(doc, "NOM", convention?.bailleurNom || convention?.bailleur || "", M + 4, yy, M + W - 4);
  yy += 7;
  inlineField(
    doc,
    "RÉFÉRENCE CONVENTION",
    convention?.reference || convention?.projectReference || "",
    M + 4,
    yy,
    M + W - 4,
  );

  y += h2 + 6;

  // ---------- III - Certificat ----------
  const h3 = 72;
  section(doc, "III – CERTIFICAT", M, y, W, h3);
  yy = y + 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Dans le cadre de l'exonération du présent marché, l'entreprise désignée ci-dessus dispose :",
    M + 4,
    yy,
  );
  yy += 7;
  const douane = c.montantDouane ?? c.montantCordon;
  const interieur = c.montantInterieur ?? c.montantTVAInterieure;
  const totalNum =
    c.montantTotal ??
    ((Number(douane) || 0) + (Number(interieur) || 0));
  doc.text("•", M + 4, yy);
  inlineField(doc, "d'un crédit d'impôt douanier de", fmtMontant(douane), M + 8, yy, M + W - 4);
  yy += 7;
  doc.text("•", M + 4, yy);
  inlineField(doc, "d'un crédit d'impôt intérieur de", fmtMontant(interieur), M + 8, yy, M + W - 4);
  yy += 7;
  doc.text("•", M + 4, yy);
  inlineField(doc, "TOTAL du crédit d'impôt", fmtMontant(totalNum), M + 8, yy, M + W - 4);
  yy += 9;
  doc.setFont("helvetica", "normal");
  doc.text("Ces crédits sont disponibles à compter du", M + 4, yy);
  doc.text(fmtDate(c.dateEmission) || fmtDate(c.dateCreation) || "", M + 62, yy);
  doc.line(M + 62, yy + 0.8, M + W - 60, yy + 0.8);
  yy += 7;
  doc.text("Date de validité :", M + 4, yy);
  doc.text(fmtDate(c.dateValidite) || "", M + 35, yy);
  doc.line(M + 35, yy + 0.8, M + W - 60, yy + 0.8);

  // ---------- QR code de vérification ----------
  const verifyBase =
    typeof window !== "undefined" ? window.location.origin : "";
  const verifyUrl = `${verifyBase}/verifier-certificat?numero=${encodeURIComponent(numero)}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 0,
      width: 256,
      color: { dark: "#006633", light: "#ffffff" },
    });
    const qrSize = 30;
    const qrX = M + W - qrSize - 4;
    const qrY = y + h3 - qrSize - 6;
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80, 80, 80);
    doc.text("Scannez pour vérifier", qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });
    doc.text("l'authenticité du certificat", qrX + qrSize / 2, qrY + qrSize + 6, { align: "center" });
    doc.setTextColor(0, 0, 0);
  } catch {
    // ignore QR errors
  }

  y += h3 + 8;

  // ---------- Signature ----------
  const today = new Date().toLocaleDateString("fr-FR");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`À Nouakchott, le ${today}`, pageW / 2, y, { align: "center" });
  y += 6;
  doc.text("Le Président de la Commission Fiscale", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("(Nom et signature)", pageW / 2, y, { align: "center" });

  const filename = `certificat-a-signer-${(c.reference || c.numero || c.id)
    .toString()
    .replace(/[^a-z0-9_-]/gi, "_")}.pdf`;
  doc.save(filename);
}
