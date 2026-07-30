import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { UtilisationCreditDto, CertificatCreditDto } from "@/lib/api";

const fmt = (v: any) =>
  v != null && !isNaN(Number(v))
    ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
const dt = (v?: string) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

// ---------- Nombre en lettres (FR) ----------
const UNITES = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
function below100(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10); const u = n % 10;
  if (d === 7 || d === 9) return DIZAINES[d] + (d === 7 ? "-" : "-") + UNITES[10 + u];
  if (d === 8 && u === 0) return "quatre-vingts";
  return DIZAINES[d] + (u === 1 && d !== 8 ? " et un" : u ? "-" + UNITES[u] : "");
}
function below1000(n: number): string {
  if (n < 100) return below100(n);
  const c = Math.floor(n / 100); const r = n % 100;
  const cs = c === 1 ? "cent" : UNITES[c] + " cent" + (r === 0 ? "s" : "");
  return r === 0 ? cs : cs + " " + below100(r);
}
function numberToFrenchWords(n: number): string {
  if (!isFinite(n)) return "";
  const entier = Math.floor(Math.abs(n));
  if (entier === 0) return "zéro";
  const millions = Math.floor(entier / 1000000);
  const milliers = Math.floor((entier % 1000000) / 1000);
  const reste = entier % 1000;
  let s = "";
  if (millions > 0) s += (millions === 1 ? "un million" : below1000(millions) + " millions");
  if (milliers > 0) { if (s) s += " "; s += (milliers === 1 ? "mille" : below1000(milliers) + " mille"); }
  if (reste > 0) { if (s) s += " "; s += below1000(reste); }
  return s;
}

// ---------- Helpers de dessin ----------
function drawDottedLine(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setLineDashPattern([1, 1.5], 0);
  doc.setDrawColor(120);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(0);
}
function labelDottedValue(doc: jsPDF, x: number, y: number, label: string, value: string, valueMaxW: number) {
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(label, x, y);
  const labelW = doc.getTextWidth(label);
  doc.setFont("helvetica", "normal");
  const vx = x + labelW + 4;
  drawDottedLine(doc, vx, y + 1, vx + valueMaxW);
  doc.text(value || "", vx + 2, y - 1);
}

export function generateLiquidationPdf(u: UtilisationCreditDto, cert: CertificatCreditDto | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 32;
  let y = 36;

  // ====== EN-TÊTE ======
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("République Islamique de Mauritanie", M, y);
  doc.text("الجمهورية الإسلامية الموريتانية", W - M, y, { align: "right" });
  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text("Ministère des Finances", M, y);
  doc.text("وزارة المالية", W - M, y, { align: "right" });
  y += 11;
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("COMMISSION FISCALE", M, y);
  doc.text("اللجنة الجبائية", W - M, y, { align: "right" });
  y += 6;
  doc.setDrawColor(0).setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 18;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("COMMISSION FISCALE", W / 2, y, { align: "center" });
  y += 16;
  doc.setFontSize(12);
  doc.text("MARCHES PUBLICS A FINANCEMENT EXTERIEUR", W / 2, y, { align: "center" });
  // souligné
  const t1W = doc.getTextWidth("MARCHES PUBLICS A FINANCEMENT EXTERIEUR");
  doc.setLineWidth(0.4);
  doc.line(W / 2 - t1W / 2, y + 2, W / 2 + t1W / 2, y + 2);
  y += 16;
  doc.setFontSize(12);
  doc.text("UTILISATION DU CRÉDIT D'IMPOT", W / 2, y, { align: "center" });
  const t2W = doc.getTextWidth("UTILISATION DU CRÉDIT D'IMPOT");
  doc.line(W / 2 - t2W / 2, y + 2, W / 2 + t2W / 2, y + 2);

  // Référence EFI2 / N°
  doc.setFont("helvetica", "italic").setFontSize(10);
  doc.text("EFI2", W - M, y - 14, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(10);
  const annee = u.dateLiquidation ? new Date(u.dateLiquidation).getFullYear() : new Date().getFullYear();
  doc.text(`N° ${u.id}/${annee}`, W - M, y + 4, { align: "right" });
  y += 24;

  // ====== I. IDENTIFICATION DE L'ENTREPRISE ======
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("I. IDENTIFICATION DE L'ENTREPRISE", M, y);
  y += 14;
  doc.setFontSize(9);
  labelDottedValue(doc, M, y, "NIF :", "", 200); y += 14;
  labelDottedValue(doc, M, y, "NOM ET PRÉNOM OU RAISON SOCIALE :", u.entrepriseNom || "", 260); y += 14;
  labelDottedValue(doc, M, y, "AUTRES DÉNOMINATION/ ENSEIGNE COMMERCIALE :", "", 200); y += 14;
  labelDottedValue(doc, M, y, "ADRESSE/SIÈGE :", "", 320); y += 14;
  labelDottedValue(doc, M, y, "BP :", "", 80);
  labelDottedValue(doc, M + 120, y, "Tél.", "", 110);
  labelDottedValue(doc, M + 290, y, "EMAIL :", "", 180);
  y += 18;

  // ====== II. UTILISATION DU CRÉDIT D'IMPOT ======
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("II. UTILISATION DU CRÉDIT D'IMPOT  ( Crédit douanier )", M, y);
  y += 14;
  doc.setFontSize(9);
  labelDottedValue(doc, M, y, "Bureau :", "", 280); y += 13;
  labelDottedValue(doc, M, y, "Bulletin de liquidation :", `N° ${u.numeroBulletin || ""}${u.dateLiquidation ? "  DU " + dt(u.dateLiquidation) : ""}`, 320); y += 13;
  labelDottedValue(doc, M, y, "C", `${u.numeroDeclaration || ""}${u.dateDeclaration ? "  DU " + dt(u.dateDeclaration) : ""}`, 320); y += 13;
  labelDottedValue(doc, M, y, "Crédit :", u.certificatReference || "", 280); y += 13;
  labelDottedValue(doc, M, y, "DAON° :", "", 280); y += 13;
  labelDottedValue(doc, M, y, "Marché N° :", "", 320); y += 13;
  labelDottedValue(doc, M, y, "Délai d'exécution :", "", 280); y += 13;
  const montantTotal = (u.lignes || []).reduce((s, l) => s + (Number(l.valeur) || 0), 0) || Number(u.montant) || 0;
  labelDottedValue(doc, M, y, "Montant :", `${fmt(montantTotal)} MRU`, 280);
  y += 20;

  // Bloc déduction
  doc.setFontSize(9).setFont("helvetica", "normal");
  const phraseY = y;
  doc.text("Veuillez déduire du crédit d'impots N° :", M, phraseY);
  let cx = M + doc.getTextWidth("Veuillez déduire du crédit d'impots N° :") + 4;
  drawDottedLine(doc, cx, phraseY + 1, cx + 80);
  doc.text(u.certificatReference || "", cx + 2, phraseY - 1);
  cx += 88;
  doc.text("du", cx, phraseY); cx += doc.getTextWidth("du") + 4;
  drawDottedLine(doc, cx, phraseY + 1, cx + 80);
  doc.text(dt(u.dateCreation), cx + 2, phraseY - 1);
  cx += 88;
  doc.text("ouvert à mon profit dans le cadre", cx, phraseY);
  y += 13;
  doc.text("du Marché Public N° :", M, y);
  cx = M + doc.getTextWidth("du Marché Public N° :") + 4;
  drawDottedLine(doc, cx, y + 1, cx + 200);
  cx += 208;
  doc.text("DU", cx, y); cx += doc.getTextWidth("DU") + 4;
  drawDottedLine(doc, cx, y + 1, cx + 70);
  cx += 78;
  doc.text("relatif au", cx, y);
  y += 16;

  labelDottedValue(doc, M, y, "MAITRE D'OUVRAGE :", cert?.autoriteContractanteNom || "", 360); y += 14;
  labelDottedValue(doc, M, y, "MINISTÈRE DE TUTELLE :", cert?.autoriteContractanteMinistereTutelleNom || "", 360); y += 14;
  const lettres = numberToFrenchWords(Math.round(montantTotal));
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("LA SOMME DE :", M, y);
  doc.setFont("helvetica", "italic");
  const lettresW = W - M - (M + doc.getTextWidth("LA SOMME DE :") + 4);
  const lettresLines = doc.splitTextToSize(lettres + " Ouguiya (MRU)", lettresW);
  doc.text(lettresLines, M + doc.getTextWidth("LA SOMME DE :") + 6, y);
  y += 12 * lettresLines.length + 2;
  doc.setFont("helvetica", "normal");

  labelDottedValue(doc, M, y, "Déclarant :", "", 280); y += 13;
  labelDottedValue(doc, M, y, "référence :", "", 280); y += 13;
  labelDottedValue(doc, M, y, "Au profit de la perception du Trésor de :", "DGTCP", 200); y += 13;
  labelDottedValue(doc, M, y, "A", "", 180);
  labelDottedValue(doc, M + 220, y, "Le", dt(u.dateLiquidation || u.dateCreation), 140);
  y += 18;

  doc.setFont("helvetica", "italic").setFontSize(9);
  doc.text("Signature et Cachet de l'Entreprise", M, y);
  y += 18;

  // ====== III. VALIDITÉ DU CRÉDIT D'IMPOT ======
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("III. VALIDITE DU CRÉDIT D'IMPOT", M, y);
  y += 14;

  doc.setFont("helvetica", "normal").setFontSize(9);
  const para =
    `Le président de la Commission Fiscale auprès du Ministre des Finances Certifie que l'entreprise dispose du crédit d'impot N° ${u.certificatReference || "—"} du ${dt(u.dateCreation)} dont le solde permet l'imputation du montant sollicité.`;
  const paraLines = doc.splitTextToSize(para, W - 2 * M);
  doc.text(paraLines, M, y);
  y += 11 * paraLines.length + 8;

  const soldeDouanier = cert?.soldeCordon ?? 0;
  const soldeInterieur = cert?.soldeTVA ?? 0;
  const totalRestant = soldeDouanier + soldeInterieur;

  doc.setFont("helvetica", "bold");
  doc.text(`Solde crédit Douanier : ${fmt(soldeDouanier)} MRU`, M, y); y += 12;
  doc.text(`Solde crédit Intérieur : ${fmt(soldeInterieur)} MRU`, M, y); y += 12;
  doc.text(`Total solde restant : ${fmt(totalRestant)} MRU`, M, y);
  y += 26;

  // ====== Signatures ======
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("VISA du trésor public", M, y);
  doc.text(`Date : ${dt(u.dateLiquidation || u.dateCreation)}`, W / 2, y, { align: "center" });
  doc.text("Le Président de la Commission", W - M, y, { align: "right" });
  y += 12;
  doc.text("Fiscale", W - M, y, { align: "right" });

  // Encadré général
  doc.setDrawColor(0).setLineWidth(0.6);
  doc.rect(M - 6, 116, W - 2 * (M - 6), y + 60 - 116);

  // ====== Détail bulletin sur page 2 (annexe) ======
  doc.addPage();
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text("Annexe — Détail du bulletin de liquidation", W / 2, 50, { align: "center" });
  const lignes = u.lignes || [];
  autoTable(doc, {
    startY: 70,
    head: [["Code", "Libellé", "Type", "Valeur (MRU)", "Affectation"]],
    body: lignes.map((l) => [
      l.code,
      l.libelle,
      l.type ?? "",
      fmt(l.valeur),
      (Number(l.valeur) || 0) === 0
        ? "Non requis"
        : l.affectation === "AU_CI" ? "AU CI" : l.affectation === "A_PAYER" ? "À PAYER" : "—",
    ]),
    foot: [[
      { content: "Totaux", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
      { content: fmt(lignes.reduce((s, l) => s + (Number(l.valeur) || 0), 0)), styles: { halign: "right", fontStyle: "bold" } },
      { content: `CI: ${fmt(u.totalPrisEnCharge)}  |  À payer: ${fmt(u.totalAPayer)}`, styles: { fontStyle: "bold" } },
    ]],
    headStyles: { fillColor: [22, 101, 52] },
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    styles: { fontSize: 9 },
    columnStyles: { 3: { halign: "right" } },
  });

  doc.save(`utilisation-credit-impot-${u.certificatReference || u.id}.pdf`);
}
