import type jsPDF from "jspdf";
import QRCode from "qrcode";

/** URL absolue de l'écran public de vérification pour un code de document. */
export const verificationUrl = (code: string) =>
  `${typeof window !== "undefined" ? window.location.origin : ""}/verification?code=${encodeURIComponent(code)}`;

/**
 * Dessine le QR de vérification (coin supérieur gauche x,y ; côté `size` dans l'unité du doc)
 * avec sa légende. Ne dessine rien si le code est absent.
 * Le QR atteste que le numéro est enregistré — il ne certifie pas l'exemplaire papier.
 */
export async function drawVerificationQr(
  doc: jsPDF,
  code: string | null | undefined,
  x: number,
  y: number,
  size: number,
  fontSize = 7,
): Promise<void> {
  if (!code) return;
  try {
    const dataUrl = await QRCode.toDataURL(verificationUrl(code), {
      margin: 0,
      width: 300,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    doc.addImage(dataUrl, "PNG", x, y, size, size);
    const cx = x + size / 2;
    const lh = fontSize * (doc.getLineHeightFactor?.() ?? 1.15) * (size > 40 ? 1 : 0.3528);
    doc.setFont("helvetica", "italic").setFontSize(fontSize).setTextColor(60, 60, 60);
    doc.text("Vérifiez l'authenticité de ce document", cx, y + size + lh * 1.1, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(code, cx, y + size + lh * 2.2, { align: "center" });
    doc.setTextColor(0, 0, 0).setFont("helvetica", "normal");
  } catch {
    /* QR non bloquant */
  }
}
