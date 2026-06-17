import jsPDF from "jspdf";
import type { CertificatCreditDto, EntrepriseDto, MarcheDto, ConventionDto } from "@/lib/api";

const fmt = (v: any) =>
  v != null && !isNaN(Number(v))
    ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : "";

const fmtDate = (v?: string) => {
  if (!v) return "";
  try {
    return new Date(v).toLocaleDateString("fr-FR");
  } catch {
    return "";
  }
};

const line = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) => {
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  const lw = doc.getTextWidth(label);
  doc.setFont("helvetica", "normal");
  if (value) doc.text(value, x + lw + 2, y);
  doc.setLineWidth(0.2);
  doc.line(x + lw + 2, y + 0.8, x + width, y + 0.8);
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
  if (value) doc.text(value, x + lw + 2, y);
  doc.setLineWidth(0.2);
  doc.line(x + lw + 2, y + 0.8, endX, y + 0.8);
};

const section = (
  doc: jsPDF,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h);
  doc.setFillColor(255, 255, 255);
  doc.rect(x + 2, y - 2.5, doc.getTextWidth(title) + 4, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, x + 4, y + 1.2);
};

export interface CertificatPdfContext {
  entreprise?: EntrepriseDto | null;
  marche?: MarcheDto | null;
  convention?: ConventionDto | null;
}

/**
 * Génère un PDF "Certificat de Crédit d'Impôts" pré-rempli, à signer par le Président.
 * Reproduit la trame officielle: identification entreprise / marché / avenant / certificat.
 */
export function generateCertificatToSignPdf(
  c: CertificatCreditDto,
  ctx: CertificatPdfContext = {},
) {
  const { entreprise, marche, convention } = ctx;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 12;
  const W = pageW - M * 2;

  // En-tête
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("MINISTERE DES FINANCES", pageW / 2, 15, { align: "center" });
  doc.text("COMMISSIONS FISCALE AUPRES DU MINISTRE DES FINANCES", pageW / 2, 21, {
    align: "center",
  });

  doc.setFontSize(11);
  doc.text("MARCHES PUBLICS A FINANCEMENT EXTERIEUR", pageW / 2, 32, { align: "center" });
  doc.text("CERTIFICAT DE CREDIT D'IMPÔTS", pageW / 2, 38, { align: "center" });
  doc.setLineWidth(0.3);
  const t1 = doc.getTextWidth("MARCHES PUBLICS A FINANCEMENT EXTERIEUR");
  doc.line(pageW / 2 - t1 / 2, 33, pageW / 2 + t1 / 2, 33);
  const t2 = doc.getTextWidth("CERTIFICAT DE CREDIT D'IMPÔTS");
  doc.line(pageW / 2 - t2 / 2, 39, pageW / 2 + t2 / 2, 39);

  // N°
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("N°", pageW - M - 60, 46);
  doc.setFont("helvetica", "normal");
  const numero = c.numero || c.reference || "";
  doc.text(numero, pageW - M - 50, 46);
  doc.line(pageW - M - 50, 47, pageW - M - 10, 47);
  doc.text("/", pageW - M - 8, 46);

  let y = 56;

  // ---------- I - Identification entreprise ----------
  const h1 = 38;
  section(doc, "I – IDENTIFICATION  DE L'ENTREPRISE", M, y, W, h1);
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
    "NOM et PRENOM  OU RAISON SOCIALE",
    entreprise?.raisonSociale || c.entrepriseRaisonSociale || c.entrepriseNom || "",
    M + 4,
    yy,
    M + W - 4,
  );
  yy += 7;
  inlineField(doc, "ADRESSE : SIEGE", entreprise?.adresse || "", M + 4, yy, M + W - 4);
  yy += 7;
  doc.setFont("helvetica", "bold");
  doc.text("BP", M + 4, yy);
  doc.line(M + 10, yy + 0.8, M + 40, yy + 0.8);
  doc.text("TEL", M + 44, yy);
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

  y += h1 + 4;

  // ---------- II - Identification marché ----------
  const h2 = 58;
  section(doc, "II – IDENTIFICATION  DU MARCHE", M, y, W, h2);
  yy = y + 8;
  const objet = [marche?.numeroMarche, marche?.intitule || c.marcheIntitule]
    .filter(Boolean)
    .join(" - ");
  inlineField(doc, "OBJET DU MARCHE", objet, M + 4, yy, M + W - 4);
  yy += 7;
  inlineField(
    doc,
    "MONTANT DU MARCHE (HT)",
    marche?.montantContratHt != null ? `${fmt(marche.montantContratHt)} MRU` : "",
    M + 4,
    yy,
    M + W - 4,
  );
  yy += 7;
  inlineField(
    doc,
    "DATE DE SIGNATURE",
    fmtDate(marche?.dateSignature),
    M + 4,
    yy,
    M + W - 4,
  );
  yy += 7;
  inlineField(
    doc,
    "COLLECTIVITE BENEFICIAIRE  DU MARCHE",
    convention?.autoriteContractanteNom || "",
    M + 4,
    yy,
    M + W - 4,
  );
  yy += 7;
  doc.setFont("helvetica", "bold");
  doc.text("ORGANISME DE FINANCEMENT (NOM, ADRESSE ET TELEPHONE)", M + 4, yy);
  yy += 7;
  inlineField(
    doc,
    "NOM",
    convention?.bailleurNom || convention?.bailleur || "",
    M + 4,
    yy,
    M + W - 4,
  );
  yy += 7;
  inlineField(
    doc,
    "REFERENCE CONVENTION",
    convention?.reference || convention?.projectReference || "",
    M + 4,
    yy,
    M + W - 4,
  );

  y += h2 + 4;

  // ---------- III - Avenant ----------
  const h3 = 30;
  section(doc, "III- AVENANT N°", M, y, W, h3);
  yy = y + 8;
  doc.setFontSize(9);
  inlineField(doc, "Objet :", "", M + 4, yy, M + W - 4);
  yy += 7;
  inlineField(doc, "Crédit Douanier  Supplémentaire  =", "", M + 4, yy, M + W - 4);
  yy += 7;
  inlineField(doc, "Crédit Intérieur  Supplémentaire  =", "", M + 4, yy, M + W - 4);

  y += h3 + 4;

  // ---------- IV - Certificat ----------
  const h4 = 70;
  section(doc, "IV – CERTIFICAT", M, y, W, h4);
  yy = y + 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Dans le cadre de l'exonération du présent marché, l'entreprise désignée ci-dessus dispose :",
    M + 4,
    yy,
  );
  yy += 6;
  const douane = fmt(c.montantDouane ?? c.montantCordon);
  const interieur = fmt(c.montantInterieur ?? c.montantTVAInterieure);
  const total = fmt(
    c.montantTotal ??
      ((Number(c.montantDouane ?? c.montantCordon) || 0) +
        (Number(c.montantInterieur ?? c.montantTVAInterieure) || 0)),
  );
  doc.text("-", M + 4, yy);
  inlineField(doc, "d'un crédit d'impôt douanier de", douane ? `${douane} MRU` : "", M + 8, yy, M + W - 4);
  yy += 7;
  doc.text("-", M + 4, yy);
  inlineField(doc, "d'un crédit d'impôt intérieur de", interieur ? `${interieur} MRU` : "", M + 8, yy, M + W - 4);
  yy += 7;
  doc.text("-", M + 4, yy);
  inlineField(doc, "TOTAL du Crédit d'impôt (III + Crédit initial)", total ? `${total} MRU` : "", M + 8, yy, M + W - 4);
  yy += 8;
  doc.setFont("helvetica", "normal");
  doc.text("Ces crédits sont disponibles à compter du", M + 4, yy);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(c.dateEmission) || fmtDate(c.dateCreation) || "", M + 62, yy);
  doc.line(M + 62, yy + 0.8, M + W - 4, yy + 0.8);
  yy += 6;
  doc.text("Date de validité :", M + 4, yy);
  doc.text(fmtDate(c.dateValidite) || "", M + 35, yy);
  doc.line(M + 35, yy + 0.8, M + W - 4, yy + 0.8);
  yy += 10;
  const today = new Date().toLocaleDateString("fr-FR");
  doc.setFont("helvetica", "bold");
  doc.text(`A NOUAKCHOTT, LE ${today}`, pageW / 2, yy, { align: "center" });
  yy += 6;
  doc.text("Le Président de la Commission Fiscale", pageW / 2, yy, { align: "center" });
  yy += 5;
  doc.text("NOM et SIGNATURE", pageW / 2, yy, { align: "center" });

  const filename = `certificat-a-signer-${(c.reference || c.numero || c.id).toString().replace(/[^a-z0-9_-]/gi, "_")}.pdf`;
  doc.save(filename);
}
