import { pdfSafe, pdfFmtNombre, numberToFrenchWords } from "@/lib/pdfText";
import jsPDF from "jspdf";
import { PDF_FONT, applyOfficialFont } from "@/lib/pdfFonts";
import { drawOfficialHeader } from "@/lib/pdfOfficialHeader";
import { drawVerificationQr } from "@/lib/verificationQr";
import { getActiveSignatureDataUrl, resolveApposition, type PdfOutputOptions } from "@/lib/signatures";
import autoTable from "jspdf-autotable";
import { entrepriseApi, marcheApi, type UtilisationCreditDto, type CertificatCreditDto, type EntrepriseDto, type MarcheDto } from "@/lib/api";
import { montantCiADeduire } from "@/lib/utilisationCloture";

const fmt = (v: unknown) => pdfFmtNombre(v, 2) || "—";
const dt = (v?: string) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");


// ---------- Helpers de dessin ----------
function drawDottedLine(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setLineDashPattern([1, 1.5], 0);
  doc.setDrawColor(120);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(0);
}
function labelDottedValue(doc: jsPDF, x: number, y: number, label: string, value: string, valueMaxW: number) {
  doc.setFont(PDF_FONT, "bold").setFontSize(9);
  doc.text(label, x, y);
  const labelW = doc.getTextWidth(label);
  doc.setFont(PDF_FONT, "normal");
  const vx = x + labelW + 4;
  drawDottedLine(doc, vx, y + 1, vx + valueMaxW);
  doc.text(value || "", vx + 2, y - 1);
}

/**
 * Entreprise et marché du crédit, pour remplir le NIF, l'adresse, le marché et son délai.
 * Sans eux, ces champs restaient vides. Un échec de lecture ne bloque jamais le PDF.
 */
export async function chargerContexte(cert: CertificatCreditDto | null): Promise<{ ent: EntrepriseDto | null; marche: MarcheDto | null }> {
  const [ent, marche] = await Promise.all([
    cert?.entrepriseId ? entrepriseApi.getById(cert.entrepriseId).catch(() => null) : Promise.resolve(null),
    cert?.marcheId ? marcheApi.getById(cert.marcheId).catch(() => null) : Promise.resolve(null),
  ]);
  return { ent, marche };
}

export async function generateLiquidationPdf(u: UtilisationCreditDto, cert: CertificatCreditDto | null, opts: PdfOutputOptions = {}): Promise<Blob> {
  const { ent, marche } = await chargerContexte(cert);
  const numeroMarche = marche?.numeroMarche || cert?.marcheNumero || "";
  const dateCredit = cert?.dateMiseEnPlace || cert?.dateEmission;
  const doc = await applyOfficialFont(new jsPDF({ unit: "pt", format: "a4" }));
  const W = doc.internal.pageSize.getWidth();
  const M = 32;
  let y = 36;

  // ====== EN-TÊTE institutionnel (identique au certificat) ======
  y = drawOfficialHeader(doc, "pt");
  doc.setDrawColor(0).setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 16;

  doc.setFont(PDF_FONT, "bold");
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
  doc.setFont(PDF_FONT, "italic").setFontSize(10);
  doc.text("EFI2", W - M, y - 14, { align: "right" });
  doc.setFont(PDF_FONT, "bold").setFontSize(10);
  const annee = u.dateLiquidation ? new Date(u.dateLiquidation).getFullYear() : new Date().getFullYear();
  doc.text(u.numeroCertificatUtilisation ? `N° ${u.numeroCertificatUtilisation}` : `N° ${u.id}/${annee}`, W - M, y + 4, { align: "right" });
  const cadreTop = y + 8;
  y += 24;

  // ====== I. IDENTIFICATION DE L'ENTREPRISE ======
  doc.setFont(PDF_FONT, "bold").setFontSize(10);
  doc.text("I. IDENTIFICATION DE L'ENTREPRISE", M, y);
  y += 14;
  doc.setFontSize(9);
  labelDottedValue(doc, M, y, "NIF :", ent?.nifAffiche || ent?.nif || "", 200); y += 14;
  labelDottedValue(doc, M, y, "NOM ET PRÉNOM OU NOM DE L'ENTREPRISE :", u.entrepriseNom || "", 260); y += 14;
  labelDottedValue(doc, M, y, "AUTRES DÉNOMINATION/ ENSEIGNE COMMERCIALE :", "", 200); y += 14;
  labelDottedValue(doc, M, y, "ADRESSE/SIÈGE :", ent?.adresse || "", 320); y += 14;
  labelDottedValue(doc, M, y, "BP :", "", 80);
  labelDottedValue(doc, M + 120, y, "Tél.", ent?.telephone || "", 110);
  labelDottedValue(doc, M + 290, y, "EMAIL :", ent?.email || "", 180);
  y += 18;

  // ====== II. UTILISATION DU CRÉDIT D'IMPOT ======
  doc.setFont(PDF_FONT, "bold").setFontSize(10);
  doc.text("II. UTILISATION DU CRÉDIT D'IMPOT  ( Crédit douanier )", M, y);
  y += 14;
  doc.setFontSize(9);
  labelDottedValue(doc, M, y, "Bureau :", "", 280); y += 13;
  labelDottedValue(doc, M, y, "Bulletin de liquidation :", `N° ${u.numeroBulletin || ""}${u.dateLiquidation ? "  DU " + dt(u.dateLiquidation) : ""}`, 320); y += 13;
  labelDottedValue(doc, M, y, "C", `${u.numeroDeclaration || ""}${u.dateDeclaration ? "  DU " + dt(u.dateDeclaration) : ""}`, 320); y += 13;
  labelDottedValue(doc, M, y, "Crédit :", u.certificatReference || "", 280); y += 13;
  labelDottedValue(doc, M, y, "DAON° :", "", 280); y += 13;
  labelDottedValue(doc, M, y, "Marché N° :", numeroMarche, 320); y += 13;
  labelDottedValue(doc, M, y, "Délai d'exécution :", marche?.dureeExecution || "", 280); y += 13;
  const montantTotal = (u.lignes || []).reduce((s, l) => s + (Number(l.valeur) || 0), 0) || Number(u.montant) || 0;
  labelDottedValue(doc, M, y, "Montant :", `${fmt(montantTotal)} MRU`, 280);
  y += 20;

  // Bloc déduction
  doc.setFontSize(9).setFont(PDF_FONT, "normal");
  const phraseY = y;
  doc.text("Veuillez déduire du crédit d'impots N° :", M, phraseY);
  let cx = M + doc.getTextWidth("Veuillez déduire du crédit d'impots N° :") + 4;
  drawDottedLine(doc, cx, phraseY + 1, cx + 80);
  doc.text(u.certificatReference || "", cx + 2, phraseY - 1);
  cx += 88;
  doc.text("du", cx, phraseY); cx += doc.getTextWidth("du") + 4;
  drawDottedLine(doc, cx, phraseY + 1, cx + 80);
  // Date du crédit (sa mise en place), et non celle de la demande d'utilisation.
  doc.text(dt(dateCredit), cx + 2, phraseY - 1);
  cx += 88;
  doc.text("ouvert à mon profit dans le cadre", cx, phraseY);
  y += 13;
  doc.text("du Marché Public N° :", M, y);
  cx = M + doc.getTextWidth("du Marché Public N° :") + 4;
  drawDottedLine(doc, cx, y + 1, cx + 200);
  doc.text(numeroMarche, cx + 2, y - 1);
  cx += 208;
  doc.text("DU", cx, y); cx += doc.getTextWidth("DU") + 4;
  drawDottedLine(doc, cx, y + 1, cx + 70);
  if (marche?.dateSignature) doc.text(dt(marche.dateSignature), cx + 2, y - 1);
  cx += 78;
  doc.text("relatif au", cx, y);
  y += 16;

  labelDottedValue(doc, M, y, "MAITRE D'OUVRAGE :", cert?.autoriteContractanteNom || "", 360); y += 14;
  labelDottedValue(doc, M, y, "MINISTÈRE DE TUTELLE :", cert?.autoriteContractanteMinistereTutelleNom || "", 360); y += 14;
  // Somme à déduire = montant CI (part prise en charge), en chiffres et en lettres, centimes compris.
  const montantCi = montantCiADeduire(u, montantTotal);
  const entier = Math.floor(montantCi);
  const centimes = Math.round((montantCi - entier) * 100);
  const lettres = numberToFrenchWords(entier) + (centimes > 0 ? ` Ouguiya et ${numberToFrenchWords(centimes)} centimes` : "");
  doc.setFont(PDF_FONT, "bold").setFontSize(9);
  doc.text("LA SOMME DE :", M, y);
  doc.setFont(PDF_FONT, "italic");
  const lettresW = W - M - (M + doc.getTextWidth("LA SOMME DE :") + 4);
  const lettresLines = doc.splitTextToSize(`${fmt(montantCi)} MRU — ` + lettres + (centimes > 0 ? " (MRU)" : " Ouguiya (MRU)"), lettresW);
  doc.text(lettresLines, M + doc.getTextWidth("LA SOMME DE :") + 6, y);
  y += 12 * lettresLines.length + 2;
  doc.setFont(PDF_FONT, "normal");

  labelDottedValue(doc, M, y, "Déclarant :", "", 280); y += 13;
  labelDottedValue(doc, M, y, "référence :", "", 280); y += 13;
  labelDottedValue(doc, M, y, "Au profit de la perception du Trésor de :", "DGTCP", 200); y += 13;
  labelDottedValue(doc, M, y, "A", "", 180);
  labelDottedValue(doc, M + 220, y, "Le", dt(u.dateLiquidation || u.dateDemande || u.dateCreation), 140);
  y += 18;

  doc.setFont(PDF_FONT, "italic").setFontSize(9);
  doc.text("Signature et Cachet de l'Entreprise", M, y);
  y += 18;

  // ====== III. VALIDITÉ DU CRÉDIT D'IMPOT ======
  doc.setFont(PDF_FONT, "bold").setFontSize(10);
  doc.text("III. VALIDITE DU CRÉDIT D'IMPOT", M, y);
  y += 14;

  doc.setFont(PDF_FONT, "normal").setFontSize(9);
  const para =
    `Le président de la Commission Fiscale auprès du Ministre des Finances Certifie que l'entreprise dispose du crédit d'impot N° ${u.certificatReference || "—"} du ${dt(dateCredit)} dont le solde permet l'imputation du montant sollicité.`;
  const paraLines = doc.splitTextToSize(para, W - 2 * M);
  doc.text(paraLines, M, y);
  y += 11 * paraLines.length + 8;

  const soldeDouanier = cert?.soldeCordon ?? 0;
  const soldeInterieur = cert?.soldeTVA ?? 0;
  const totalRestant = soldeDouanier + soldeInterieur;

  doc.setFont(PDF_FONT, "bold");
  doc.text(`Solde crédit Douanier : ${fmt(soldeDouanier)} MRU`, M, y); y += 12;
  doc.text(`Solde crédit Intérieur : ${fmt(soldeInterieur)} MRU`, M, y); y += 12;
  doc.text(`Total solde restant : ${fmt(totalRestant)} MRU`, M, y);
  y += 26;

  // ====== Signatures ======
  doc.setFont(PDF_FONT, "bold").setFontSize(10);
  doc.text("VISA du trésor public", M, y);
  doc.text(`Date : ${dt(u.dateLiquidation || u.dateDemande || u.dateCreation)}`, W / 2, y, { align: "center" });
  doc.text("Le Président de la Commission", W - M, y, { align: "right" });
  y += 12;
  doc.text("Fiscale", W - M, y, { align: "right" });

  // Signatures serveur : DGTCP (visa du trésor) et Président. Absentes = espace vide.
  const [sigDgtcp, pres] = await Promise.all([
    getActiveSignatureDataUrl("DGTCP"),
    resolveApposition(opts.apposition),
  ]);
  const sigPresident = pres.sig;
  const sigW = 110;
  const sigH = 44;
  const sigY = y + 6;
  if (sigDgtcp) {
    try { doc.addImage(sigDgtcp, "PNG", M, sigY, sigW, sigH); } catch { /* ignore */ }
  }
  if (pres.cachet) {
    try { doc.addImage(pres.cachet, "PNG", W - M - sigW - 60, sigY - 4, 56, 56); } catch { /* ignore */ }
  }
  if (sigPresident) {
    try { doc.addImage(sigPresident, "PNG", W - M - sigW, sigY, sigW, sigH); } catch { /* ignore */ }
  }
  if (sigDgtcp || sigPresident) y = sigY + sigH - 12;

  // Encadré général
  doc.setDrawColor(0).setLineWidth(0.6);
  doc.rect(M - 6, cadreTop, W - 2 * (M - 6), y + 60 - cadreTop);

  // ====== Détail bulletin sur page 2 (annexe) ======
  doc.addPage();
  doc.setFont(PDF_FONT, "bold").setFontSize(12);
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
    styles: { fontSize: 9, font: PDF_FONT },
    columnStyles: { 3: { halign: "right" } },
  });

  // QR de vérification en bas à droite de la page 1 (uniquement si le certificat est émis)
  if (u.numeroCertificatUtilisation) {
    doc.setPage(1);
    const H = doc.internal.pageSize.getHeight();
    const q = 71; // ~25 mm
    await drawVerificationQr(doc, u.numeroCertificatUtilisation, W - M - q, H - q - 40, q, 7);
  }
  if (opts.save !== false) doc.save(`utilisation-credit-impot-${u.certificatReference || u.id}.pdf`);
  return doc.output("blob");
}
