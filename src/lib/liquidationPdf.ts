import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { UtilisationCreditDto, CertificatCreditDto } from "@/lib/api";

const fmt = (v: any) => (v != null && !isNaN(Number(v)) ? Number(v).toLocaleString("fr-FR") : "—");
const dt = (v?: string) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

export function generateLiquidationPdf(u: UtilisationCreditDto, cert: CertificatCreditDto | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header
  doc.setFontSize(16).setFont("helvetica", "bold");
  doc.text("Bulletin de liquidation - DGTCP", pageW / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text(`Référence : ${u.certificatReference ? `${u.certificatReference} - #${u.id}` : `#${u.id}`}`, pageW / 2, y, { align: "center" });
  y += 12;
  doc.text(`Date de liquidation : ${dt(u.dateLiquidation)}`, pageW / 2, y, { align: "center" });
  y += 20;

  // Infos générales
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    body: [
      ["Entreprise", u.entrepriseNom || "—", "Type", u.type || "—"],
      ["Certificat", u.certificatReference || "—", "Statut", u.statut],
      ["N° Déclaration", u.numeroDeclaration || "—", "N° Bulletin", u.numeroBulletin || "—"],
      ["Date déclaration", dt(u.dateDeclaration), "SYDONIA", u.enregistreeSYDONIA ? "Oui" : "Non"],
      ["Montant total", `${fmt(u.montant)} MRU`, "Date création", dt(u.dateCreation)],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 100 },
      2: { fontStyle: "bold", cellWidth: 100 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // Bulletin lignes
  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text("Détail du bulletin", 40, y);
  y += 6;

  const lignes = u.lignes || [];
  autoTable(doc, {
    startY: y,
    head: [["Code", "Libellé", "Type", "Valeur (MRU)", "Affectation"]],
    body: lignes.map((l) => [
      l.code,
      l.libelle,
      l.type,
      fmt(l.valeur),
      l.affectation === "AU_CI" ? "AU CI" : l.affectation === "A_PAYER" ? "À PAYER" : "—",
    ]),
    foot: [[
      { content: "Totaux", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
      { content: fmt(lignes.reduce((s, l) => s + (Number(l.valeur) || 0), 0)), styles: { halign: "right", fontStyle: "bold" } },
      { content: `CI: ${fmt(u.totalPrisEnCharge)}\nÀ payer: ${fmt(u.totalAPayer)}`, styles: { fontStyle: "bold" } },
    ]],
    headStyles: { fillColor: [22, 101, 52] },
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    styles: { fontSize: 9 },
    columnStyles: { 3: { halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // Synthèse liquidation
  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text("Synthèse de la liquidation", 40, y);
  y += 6;

  const horsTva = (u.totalPrisEnCharge ?? 0) - (u.montantTVADouane ?? 0);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9 },
    head: [["Élément", "Montant (MRU)"]],
    body: [
      ["Total pris en charge (AU CI)", fmt(u.totalPrisEnCharge)],
      ["  dont droits hors TVA (imputés sur Solde Cordon)", fmt(horsTva)],
      ["  dont TVA importation (imputée sur quota TVA)", fmt(u.montantTVADouane)],
      ["Total à payer par l'entreprise", fmt(u.totalAPayer)],
      ["TVA déductible alimentée (stock)", fmt(u.montantTVADouane)],
    ],
    headStyles: { fillColor: [22, 101, 52] },
    columnStyles: { 1: { halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // État du certificat
  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text("État du certificat après liquidation", 40, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9 },
    head: [["Indicateur", "Avant", "Mouvement", "Après"]],
    body: [
      [
        "Solde Cordon (droits hors TVA)",
        fmt(u.soldeCordonAvant),
        `- ${fmt(horsTva)}`,
        fmt(u.soldeCordonApres),
      ],
      [
        "TVA importation restante",
        fmt(cert ? (cert.tvaImportationDouane ?? 0) + (u.montantTVADouane ?? 0) : null),
        `- ${fmt(u.montantTVADouane)}`,
        fmt(cert?.tvaImportationDouane),
      ],
      [
        "Total restant (Cordon + TVA imp.)",
        "—",
        "—",
        fmt(cert ? (cert.soldeCordon ?? 0) + (cert.tvaImportationDouane ?? 0) : null),
      ],
      [
        "Solde TVA intérieure",
        "—",
        "—",
        fmt(cert?.soldeTVA),
      ],
    ],
    headStyles: { fillColor: [22, 101, 52] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 30;

  // Signature
  doc.setFontSize(9).setFont("helvetica", "italic");
  doc.text("Document généré automatiquement - DGTCP", 40, y);
  doc.text(`Édité le ${new Date().toLocaleString("fr-FR")}`, pageW - 40, y, { align: "right" });

  doc.save(`liquidation-${u.certificatReference || u.id}.pdf`);
}
