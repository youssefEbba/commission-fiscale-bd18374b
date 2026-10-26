import type jsPDF from "jspdf";
import emblem from "@/assets/logo-official.png";

/**
 * En-tête institutionnel commun à tous les documents générés (modèle : certificat de crédit d'impôts).
 * Emblème 24 mm à gauche, quatre lignes centrées. Fonctionne en unité "mm" ou "pt".
 * Retourne l'ordonnée (dans l'unité du document) juste sous l'en-tête.
 */
export function drawOfficialHeader(doc: jsPDF, unit: "mm" | "pt"): number {
  const k = unit === "pt" ? 72 / 25.4 : 1;
  const pageW = doc.internal.pageSize.getWidth();
  const cx = pageW / 2;

  try {
    doc.addImage(emblem, "PNG", 12 * k, 8 * k, 24 * k, 24 * k);
  } catch {
    // ignore si l'asset n'est pas chargé
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 102, 51);
  doc.setFontSize(10);
  doc.text("République Islamique de Mauritanie", cx, 12 * k, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Honneur — Fraternité — Justice", cx, 17 * k, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("MINISTÈRE DES FINANCES", cx, 24 * k, { align: "center" });
  doc.setFontSize(10);
  doc.text("Commission Fiscale auprès du Ministre des Finances", cx, 29 * k, { align: "center" });

  doc.setFont("helvetica", "normal");
  return 34 * k;
}
