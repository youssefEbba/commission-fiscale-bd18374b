import jsPDF from "jspdf";
import { PDF_FONT, applyOfficialFont } from "@/lib/pdfFonts";
import { drawOfficialHeader } from "@/lib/pdfOfficialHeader";
import { drawVerificationQr } from "@/lib/verificationQr";
import { resolveApposition, type PdfOutputOptions } from "@/lib/signatures";
import type { UtilisationCreditDto, CertificatCreditDto } from "@/lib/api";
import { numberToFrenchWords } from "@/lib/pdfText";
import { chargerContexte } from "@/lib/liquidationPdf";

/**
 * Certificat d'utilisation du crédit d'impôt — Crédit intérieur (TVA déductible).
 * Généré par la DGTCP après apurement, sur le modèle du formulaire officiel
 * « MARCHES PUBLICS A FINANCEMENT EXTERIEUR — UTILISATION DU CREDIT D'IMPOTS ».
 */

const fmt = (v: any) =>
  v != null && !isNaN(Number(v))
    ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f|\u00a0/g, " ")
    : "";
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "");

// Montant en lettres : la conversion commune (accords « cent »/« vingt » devant « mille », milliards).
const toWords = (n: number) => numberToFrenchWords(n);

function dotted(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setLineDashPattern([1, 1.5], 0).setDrawColor(120);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0).setDrawColor(0);
}
/** Libellé + ligne pointillée jusqu'à xEnd, valeur écrite au-dessus. */
function field(doc: jsPDF, x: number, y: number, label: string, value: string, xEnd: number, bold = false) {
  doc.setFont(PDF_FONT, bold ? "bold" : "normal").setFontSize(9);
  doc.text(label, x, y);
  const vx = x + doc.getTextWidth(label) + 4;
  dotted(doc, vx, y + 1.5, xEnd);
  if (value) {
    doc.setFont(PDF_FONT, "bold");
    const maxW = xEnd - vx - 4;
    const v = doc.splitTextToSize(value, maxW)[0] as string;
    doc.text(v, vx + 2, y - 1);
  }
  doc.setFont(PDF_FONT, "normal");
}

export async function generateUtilisationTvaPdf(u: UtilisationCreditDto, cert: CertificatCreditDto | null, opts: PdfOutputOptions = {}): Promise<Blob> {
  // Entreprise et marché du crédit : NIF, adresse, n° et date du marché, délai (vides jusqu'ici).
  const { ent, marche } = await chargerContexte(cert);
  const doc = await applyOfficialFont(new jsPDF({ unit: "pt", format: "a4" }));
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const R = W - M;
  // ===== En-tête institutionnel (identique au certificat) =====
  let y = drawOfficialHeader(doc, "pt") + 14;

  doc.setFont(PDF_FONT, "bold").setFontSize(12);
  doc.text("MARCHES PUBLICS A FINANCEMENT EXTERIEUR", W / 2, y, { align: "center" });
  y += 15;
  doc.text("UTILISATION DU CREDIT D'IMPOTS", W / 2, y, { align: "center" });
  y += 22;
  const annee = new Date(u.dateCertificatUtilisation || u.dateDemande || u.dateCreation || Date.now()).getFullYear();
  const numero = u.numeroCertificatUtilisation || `${u.id}/${annee}`;
  doc.setFontSize(10);
  doc.text(`N° ${numero}`, R, y, { align: "right" });
  y += 14;

  const boxTop = y;

  // ===== I. Identification =====
  y += 14;
  doc.setFont(PDF_FONT, "bold").setFontSize(9.5);
  doc.text("I - IDENTIFICATION DE L'ENTREPRISE", M + 6, y);
  y += 16;
  field(doc, M + 6, y, "N° DE COMPTE CONTRIBUABLE", ent?.nifAffiche || ent?.nif || "", R - 6); y += 16;
  field(doc, M + 6, y, "NOM et PRENOMS OU NOM DE L'ENTREPRISE", u.entrepriseNom || cert?.entrepriseRaisonSociale || cert?.entrepriseNom || "", R - 6); y += 16;
  field(doc, M + 6, y, "AUTRES DENOMINATION/ ENSEIGNE COMMERCIALE", "", R - 6); y += 16;
  field(doc, M + 6, y, "ADRESSE SIEGE", ent?.adresse || "", R - 6); y += 16;
  field(doc, M + 6, y, "BP", "", M + 170);
  field(doc, M + 180, y, "TEL", ent?.telephone || "", M + 340);
  field(doc, M + 350, y, "FAX", "", R - 6);
  y += 10;
  doc.setLineWidth(0.5).line(M, y, R, y);

  // ===== II. Utilisation =====
  y += 16;
  doc.setFont(PDF_FONT, "bold").setFontSize(9.5);
  doc.text("II - UTILISATION DU CREDIT D'IMPOTS (Crédit intérieur) - TVA DEDUCTIBLE", M + 6, y);
  y += 16;
  field(doc, M + 6, y, "Facture N° :", u.numeroFacture || "", M + 300);
  field(doc, M + 310, y, "du", dt(u.dateFacture), R - 6); y += 16;
  field(doc, M + 6, y, "Financement du Crédit N° :", u.certificatReference || cert?.reference || u.certificatNumero || "", R - 6); y += 16;
  const montant = Number(u.creditInterieurUtilise ?? u.montantTVAInterieure ?? u.montant ?? 0);
  field(doc, M + 6, y, "Montant :", `${fmt(montant)} MRU`, R - 6); y += 16;
  field(doc, M + 6, y, "Veuillez déduire du crédit d'impôts N°", u.certificatReference || cert?.reference || "", M + 330);
  doc.setFontSize(9).text("ouvert à mon profit", R - 6, y, { align: "right" }); y += 16;
  field(doc, M + 6, y, "Dans le cadre du marché public N°", marche?.numeroMarche || cert?.marcheNumero || cert?.marcheIntitule || "", M + 330);
  field(doc, M + 340, y, "du", dt(marche?.dateSignature), R - 40);
  doc.text("relatif", R - 6, y, { align: "right" }); y += 16;
  const words = toWords(Math.round(montant));
  field(doc, M + 6, y, "A la somme de", `${words} Ouguiya (MRU)`, R - 6); y += 18;
  field(doc, M + 6, y, "Au profit de :", "DGTCP — Trésor public", R - 6); y += 16;
  field(doc, M + 6, y, "Fournisseur sous-traitant :", u.demandeurEstSousTraitant ? (u.entrepriseNom || "") : "", R - 6); y += 16;
  field(doc, M + 6, y, "De", u.certificatTitulaireRaisonSociale || "", R - 6); y += 20;
  field(doc, M + 40, y, "A", "NOUAKCHOTT", M + 240);
  field(doc, M + 250, y, "Le", dt(u.dateCertificatUtilisation || u.dateDemande || u.dateCreation), R - 40); y += 16;
  doc.setFont(PDF_FONT, "bold").setFontSize(9);
  doc.text("Signature et cachet de l'entreprise", W / 2, y, { align: "center" }); y += 16;
  field(doc, M + 6, y, "Délai d'exécution :", marche?.dureeExecution || "", R - 6, true); y += 10;
  doc.line(M, y, R, y);

  // Récapitulatif d'apurement (traçabilité)
  y += 14;
  doc.setFont(PDF_FONT, "bold").setFontSize(9);
  doc.text("Récapitulatif de l'apurement TVA", M + 6, y); y += 13;
  doc.setFont(PDF_FONT, "normal");
  const recap: [string, string][] = [
    ["TVA collectée", fmt(u.montantTVAInterieure)],
    ["TVA déductible imputée", fmt(u.tvaDeductibleUtilisee)],
    ["TVA nette", fmt(u.tvaNette)],
    ["Imputé sur le crédit intérieur", fmt(u.creditInterieurUtilise)],
    ["Paiement entreprise", fmt(u.paiementEntreprise)],
    ["Report à nouveau", fmt(u.reportANouveau)],
  ];
  const colW = (R - M - 12) / 3;
  recap.forEach(([l, v], i) => {
    const cx = M + 6 + (i % 3) * colW;
    const cy = y + Math.floor(i / 3) * 12;
    doc.text(`${l} : ${v || "0,00"} MRU`, cx, cy);
  });
  y += 26;
  if (u.quittanceDgi) {
    doc.text(
      `Quittance DGI N° ${u.quittanceDgi.numeroQuittance} du ${dt(u.quittanceDgi.dateQuittance)} — ${fmt(u.quittanceDgi.montant)} MRU`,
      M + 6, y,
    );
    y += 12;
  }
  doc.line(M, y, R, y);

  // ===== III. Validité =====
  y += 18;
  doc.setFont(PDF_FONT, "bold").setFontSize(12);
  doc.text("III - Validité du Crédit d'Impôts", M + 6, y); y += 16;
  doc.setFont(PDF_FONT, "normal").setFontSize(9);
  doc.text("Le président de Commission fiscale auprès du Ministre des Finances certifie que l'entreprise dispose d'un crédit", M + 6, y); y += 12;
  doc.text("d'impôt", M + 6, y); y += 14;
  field(doc, M + 6, y, "N°", u.certificatReference || cert?.reference || "", M + 220);
  field(doc, M + 230, y, "du", dt(cert?.dateMiseEnPlace || cert?.dateEmission), R - 40);
  doc.text("dont", R - 6, y, { align: "right" }); y += 16;
  doc.text("le solde permet l'imputation du montant sollicité", M + 6, y);
  if (u.soldeTVAApres != null) {
    doc.setFont(PDF_FONT, "bold");
    doc.text(`Solde crédit intérieur restant : ${fmt(u.soldeTVAApres)} MRU`, R - 6, y, { align: "right" });
    doc.setFont(PDF_FONT, "normal");
  }
  y += 24;
  field(doc, W / 2 - 60, y, "A NOUAKCHOTT, LE", dt(u.dateCertificatUtilisation || new Date().toISOString()), W / 2 + 140); y += 14;
  doc.setFont(PDF_FONT, "bold");
  doc.text("Le Président de la Commission Fiscale", W / 2 + 40, y, { align: "center" }); y += 11;
  doc.text("auprès du Ministre des Finances", W / 2 + 40, y, { align: "center" }); y += 11;
  doc.text("NOM et SIGNATURE", W / 2 + 40, y, { align: "center" });

  const { sig, cachet } = await resolveApposition(opts.apposition);
  if (cachet) {
    try { doc.addImage(cachet, "PNG", W / 2 - 75, y + 2, 56, 56); } catch { /* ignore */ }
  }
  if (sig) {
    try { doc.addImage(sig, "PNG", W / 2 - 15, y + 4, 110, 44); } catch { /* ignore */ }
  }
  y += 56;

  doc.setLineWidth(0.6).rect(M, boxTop, R - M, y - boxTop);

  // QR de vérification en bas à droite (uniquement si le certificat est émis)
  if (u.numeroCertificatUtilisation) {
    const H = doc.internal.pageSize.getHeight();
    const q = 71; // ~25 mm
    if (y + q + 30 > H - 20) doc.addPage();
    await drawVerificationQr(doc, u.numeroCertificatUtilisation, R - q, H - q - 40, q, 7);
  }

  if (opts.save !== false) doc.save(`certificat-utilisation-tva-${u.certificatReference || u.certificatCreditId || ""}-${u.id}.pdf`);
  return doc.output("blob");
}
