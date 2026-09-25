import jsPDF from "jspdf";
import { getActiveSignatureDataUrl } from "@/lib/signatures";
import type { UtilisationCreditDto, CertificatCreditDto } from "@/lib/api";

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

const UNITES = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
function below100(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10); const u = n % 10;
  if (d === 7 || d === 9) return DIZAINES[d] + "-" + UNITES[10 + u];
  if (d === 8 && u === 0) return "quatre-vingts";
  return DIZAINES[d] + (u === 1 && d !== 8 ? " et un" : u ? "-" + UNITES[u] : "");
}
function below1000(n: number): string {
  if (n < 100) return below100(n);
  const c = Math.floor(n / 100); const r = n % 100;
  const cs = c === 1 ? "cent" : UNITES[c] + " cent" + (r === 0 ? "s" : "");
  return r === 0 ? cs : cs + " " + below100(r);
}
function toWords(n: number): string {
  const e = Math.floor(Math.abs(n));
  if (e === 0) return "zéro";
  const mds = Math.floor(e / 1e9), mil = Math.floor((e % 1e9) / 1e6), k = Math.floor((e % 1e6) / 1000), r = e % 1000;
  const parts: string[] = [];
  if (mds) parts.push(mds === 1 ? "un milliard" : below1000(mds) + " milliards");
  if (mil) parts.push(mil === 1 ? "un million" : below1000(mil) + " millions");
  if (k) parts.push(k === 1 ? "mille" : below1000(k) + " mille");
  if (r) parts.push(below1000(r));
  return parts.join(" ");
}

function dotted(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setLineDashPattern([1, 1.5], 0).setDrawColor(120);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0).setDrawColor(0);
}
/** Libellé + ligne pointillée jusqu'à xEnd, valeur écrite au-dessus. */
function field(doc: jsPDF, x: number, y: number, label: string, value: string, xEnd: number, bold = false) {
  doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9);
  doc.text(label, x, y);
  const vx = x + doc.getTextWidth(label) + 4;
  dotted(doc, vx, y + 1.5, xEnd);
  if (value) {
    doc.setFont("helvetica", "bold");
    const maxW = xEnd - vx - 4;
    const v = doc.splitTextToSize(value, maxW)[0] as string;
    doc.text(v, vx + 2, y - 1);
  }
  doc.setFont("helvetica", "normal");
}

export async function generateUtilisationTvaPdf(u: UtilisationCreditDto, cert: CertificatCreditDto | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const R = W - M;
  let y = 50;

  // ===== En-tête =====
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text("MARCHES PUBLICS A FINANCEMENT EXTERIEUR", W / 2, y, { align: "center" });
  y += 15;
  doc.text("UTILISATION DU CREDIT D'IMPOTS", W / 2, y, { align: "center" });
  y += 22;
  const annee = new Date(u.dateCertificatUtilisation || u.dateCreation || Date.now()).getFullYear();
  const numero = u.numeroCertificatUtilisation || `${u.id}/${annee}`;
  doc.setFontSize(10);
  doc.text(`N° ${numero}`, R, y, { align: "right" });
  y += 14;

  const boxTop = y;

  // ===== I. Identification =====
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(9.5);
  doc.text("I - IDENTIFICATION DE L'ENTREPRISE", M + 6, y);
  y += 16;
  field(doc, M + 6, y, "N° DE COMPTE CONTRIBUABLE", "", R - 6); y += 16;
  field(doc, M + 6, y, "NOM et PRENOMS OU RAISON SOCIALE", u.entrepriseNom || cert?.entrepriseRaisonSociale || cert?.entrepriseNom || "", R - 6); y += 16;
  field(doc, M + 6, y, "AUTRES DENOMINATION/ ENSEIGNE COMMERCIALE", "", R - 6); y += 16;
  field(doc, M + 6, y, "ADRESSE SIEGE", "", R - 6); y += 16;
  field(doc, M + 6, y, "BP", "", M + 170);
  field(doc, M + 180, y, "TEL", "", M + 340);
  field(doc, M + 350, y, "FAX", "", R - 6);
  y += 10;
  doc.setLineWidth(0.5).line(M, y, R, y);

  // ===== II. Utilisation =====
  y += 16;
  doc.setFont("helvetica", "bold").setFontSize(9.5);
  doc.text("II - UTILISATION DU CREDIT D'IMPOTS (Crédit intérieur) - TVA DEDUCTIBLE", M + 6, y);
  y += 16;
  field(doc, M + 6, y, "Facture N° :", u.numeroFacture || "", M + 300);
  field(doc, M + 310, y, "du", dt(u.dateFacture), R - 6); y += 16;
  field(doc, M + 6, y, "Financement du Crédit N° :", u.certificatReference || cert?.reference || u.certificatNumero || "", R - 6); y += 16;
  const montant = Number(u.creditInterieurUtilise ?? u.montantTVAInterieure ?? u.montant ?? 0);
  field(doc, M + 6, y, "Montant :", `${fmt(montant)} MRU`, R - 6); y += 16;
  field(doc, M + 6, y, "Veuillez déduire du crédit d'impôts N°", u.certificatReference || cert?.reference || "", M + 330);
  doc.setFontSize(9).text("ouvert à mon profit", R - 6, y, { align: "right" }); y += 16;
  field(doc, M + 6, y, "Dans le cadre du marché public N°", cert?.marcheIntitule || "", M + 330);
  field(doc, M + 340, y, "du", "", R - 40);
  doc.text("relatif", R - 6, y, { align: "right" }); y += 16;
  const words = toWords(Math.round(montant));
  field(doc, M + 6, y, "A la somme de", `${words.charAt(0).toUpperCase()}${words.slice(1)} Ouguiya (MRU)`, R - 6); y += 18;
  field(doc, M + 6, y, "Au profit de :", "DGTCP — Trésor public", R - 6); y += 16;
  field(doc, M + 6, y, "Fournisseur sous-traitant :", u.demandeurEstSousTraitant ? (u.entrepriseNom || "") : "", R - 6); y += 16;
  field(doc, M + 6, y, "De", u.certificatTitulaireRaisonSociale || "", R - 6); y += 20;
  field(doc, M + 40, y, "A", "NOUAKCHOTT", M + 240);
  field(doc, M + 250, y, "Le", dt(u.dateCertificatUtilisation || u.dateCreation), R - 40); y += 16;
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("Signature et cachet de l'entreprise", W / 2, y, { align: "center" }); y += 16;
  field(doc, M + 6, y, "Délai d'exécution :", "", R - 6, true); y += 10;
  doc.line(M, y, R, y);

  // Récapitulatif d'apurement (traçabilité)
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("Récapitulatif de l'apurement TVA", M + 6, y); y += 13;
  doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text("III - Validité du Crédit d'Impôts", M + 6, y); y += 16;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text("Le président de Commission fiscale auprès du Ministre des Finances certifie que l'entreprise dispose d'un crédit", M + 6, y); y += 12;
  doc.text("d'impôt", M + 6, y); y += 14;
  field(doc, M + 6, y, "N°", u.certificatReference || cert?.reference || "", M + 220);
  field(doc, M + 230, y, "du", dt(cert?.dateEmission), R - 40);
  doc.text("dont", R - 6, y, { align: "right" }); y += 16;
  doc.text("Le solde permet l'imputation du montant sollicité", M + 6, y);
  if (u.soldeTVAApres != null) {
    doc.setFont("helvetica", "bold");
    doc.text(`Solde crédit intérieur restant : ${fmt(u.soldeTVAApres)} MRU`, R - 6, y, { align: "right" });
    doc.setFont("helvetica", "normal");
  }
  y += 24;
  field(doc, W / 2 - 60, y, "A NOUAKCHOTT, LE", dt(u.dateCertificatUtilisation || new Date().toISOString()), W / 2 + 140); y += 14;
  doc.setFont("helvetica", "bold");
  doc.text("Le Président de la Commission Fiscale", W / 2 + 40, y, { align: "center" }); y += 11;
  doc.text("auprès du Ministre des Finances", W / 2 + 40, y, { align: "center" }); y += 11;
  doc.text("NOM et SIGNATURE", W / 2 + 40, y, { align: "center" });

  const sig = await getActiveSignatureDataUrl("PRESIDENT");
  if (sig) {
    try { doc.addImage(sig, "PNG", W / 2 - 15, y + 4, 110, 44); } catch { /* ignore */ }
  }
  y += 56;

  doc.setLineWidth(0.6).rect(M, boxTop, R - M, y - boxTop);

  doc.save(`certificat-utilisation-tva-${u.certificatReference || u.certificatCreditId || ""}-${u.id}.pdf`);
}
