import jsPDF from "jspdf";
import i18n from "@/i18n";
import { formatAmount, formatDateTime } from "@/i18n/format";
import { tStatutDemande, tTypeDocument } from "@/i18n/enums";
import type { DemandeCorrectionDto, DocumentDto } from "@/lib/api";

/**
 * Reçu de dépôt d'une demande de correction (code document RECU_DEPOT).
 * Tout le texte est rendu via canvas (Helvetica de jsPDF ne gère ni l'arabe ni tous les accents),
 * dans la langue courante, avec le sens d'écriture adapté.
 */
export interface RecuDepotInput {
  demande: DemandeCorrectionDto;
  documents: DocumentDto[];
  deposantNom?: string;
  /** Libellés paramétrés par code document (sinon traduction de l'enum). */
  libelles?: Record<string, string>;
}

const t = (k: string, o?: Record<string, unknown>) => i18n.t(`demandes:recu.${k}`, o) as string;

export function generateRecuDepotPdf({ demande: d, documents, deposantNom, libelles = {} }: RecuDepotInput): Blob {
  const rtl = i18n.language?.startsWith("ar");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const scale = 4;
  let y = 44;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontOf = (size: number, bold: boolean) =>
    `${bold ? "bold " : ""}${size * scale}px ${rtl ? '"Noto Sans Arabic", "Noto Naskh Arabic", Arial' : "Helvetica, Arial"}, sans-serif`;

  const wrap = (text: string, size: number, bold: boolean, maxW: number): string[] => {
    ctx.font = fontOf(size, bold);
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width / scale > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };

  /** Dessine une ligne ; align "start" respecte le sens (gauche en FR, droite en AR). */
  const draw = (text: string, x: number, size = 10, bold = false, align: "start" | "center" | "end" = "start", color = "#000") => {
    if (!text) return;
    ctx.font = fontOf(size, bold);
    const w = Math.ceil(ctx.measureText(text).width) + 6;
    const h = Math.ceil(size * scale * 1.6);
    canvas.width = w; canvas.height = h;
    ctx.font = fontOf(size, bold);
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;
    ctx.clearRect(0, 0, w, h);
    // Avec direction rtl, textAlign "left" reste un bord physique : on dessine depuis la gauche du canvas.
    if (rtl) { ctx.textAlign = "right"; ctx.fillText(text, w - 3, size * scale * 1.15); }
    else ctx.fillText(text, 3, size * scale * 1.15);
    const wPt = w / scale, hPt = h / scale;
    let left: number;
    const physical = align === "center" ? "center" : (align === "start") !== !!rtl ? "left" : "right";
    if (physical === "center") left = x - wPt / 2;
    else if (physical === "left") left = x;
    else left = x - wPt;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", left, y - size * 1.15, wPt, hPt);
  };
  const startX = rtl ? W - M : M;
  const endX = rtl ? M : W - M;

  const ensure = (need: number) => {
    if (y + need > H - 90) { doc.addPage(); y = 50; }
  };

  // ===== En-tête =====
  draw(t("republique"), W / 2, 10, true, "center"); y += 14;
  draw(t("ministere"), W / 2, 10, false, "center"); y += 14;
  draw(t("commission").toUpperCase(), W / 2, 12, true, "center"); y += 10;
  doc.setDrawColor(0).setLineWidth(0.8).line(M, y, W - M, y); y += 28;
  draw(t("title").toUpperCase(), W / 2, 16, true, "center"); y += 18;
  draw(t("subtitle"), W / 2, 10, false, "center", "#444"); y += 24;

  const section = (title: string) => {
    ensure(40);
    doc.setFillColor(235, 240, 235).rect(M, y - 13, W - 2 * M, 19, "F");
    draw(title, startX + (rtl ? -6 : 6), 11, true); y += 20;
  };
  const LABEL_W = 170;
  const row = (label: string, value?: string | null) => {
    const v = value && String(value).trim() ? String(value) : "—";
    const lines = wrap(v, 10, false, W - 2 * M - LABEL_W - 10);
    ensure(14 * lines.length + 4);
    draw(label, startX, 10, true, "start", "#333");
    const vx = rtl ? W - M - LABEL_W : M + LABEL_W;
    lines.forEach((l, i) => { draw(l, vx, 10, false); if (i < lines.length - 1) y += 13; });
    y += 16;
  };

  section(t("section_depot"));
  row(t("numero"), d.numero);
  row(t("reference"), d.reference);
  row(t("date_depot"), d.dateDepot ? formatDateTime(d.dateDepot) : null);
  row(t("statut"), d.statut ? tStatutDemande(d.statut) : null);
  y += 6;

  section(t("section_deposant"));
  row(t("autorite"), d.autoriteContractanteNom);
  row(t("ministere_tutelle"), d.autoriteContractanteMinistereTutelleNom);
  row(t("deposant_nom"), deposantNom);
  y += 6;

  section(t("section_titulaire"));
  if (d.groupementId || d.groupementRaisonSociale) {
    row(t("groupement"), d.groupementRaisonSociale);
    row(t("nif_chef_file"), d.groupementNifAffiche);
  } else {
    row(t("raison_sociale"), d.entrepriseRaisonSociale);
    row(t("nif"), d.entrepriseNif);
  }
  y += 6;

  section(t("section_objet"));
  row(t("convention"), d.conventionReference);
  row(t("convention_intitule"), d.conventionIntitule);
  row(t("intitule_marche"), d.intituleMarche);
  if (d.marcheId || d.marcheNumero) row(t("marche"), [d.marcheNumero, d.marcheIntitule].filter(Boolean).join(" — "));
  y += 6;

  const money = (n?: number) => formatAmount(n ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  section(t("section_montants"));
  row(t("credit_interieur"), money(d.creditInterieur));
  row(t("credit_exterieur"), money(d.creditExterieur));
  y += 6;

  section(t("section_pieces"));
  const pieces = documents.filter((p) => (p.codeDocument || p.type) !== "RECU_DEPOT" && p.actif !== false);
  if (pieces.length === 0) {
    draw(t("no_pieces"), startX, 10, false, "start", "#555"); y += 16;
  } else {
    pieces.forEach((p, i) => {
      const code = p.codeDocument || p.type;
      const label = libelles[code] || tTypeDocument(code as never) || code;
      row(`${i + 1}. ${label}`, p.nomFichier);
    });
  }

  // ===== Pied de page (toutes les pages) =====
  const total = doc.getNumberOfPages();
  const editedOn = t("generated_on", { date: formatDateTime(new Date()) });
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    y = H - 70;
    doc.setDrawColor(0).setLineWidth(0.5).line(M, y - 14, W - M, y - 14);
    for (const l of wrap(t("footer"), 8.5, false, W - 2 * M)) { draw(l, startX, 8.5, false, "start", "#333"); y += 11; }
    y = H - 24;
    draw(editedOn, startX, 8, false, "start", "#666");
    draw(t("page", { page: p, total }), endX, 8, false, "end", "#666");
  }

  return doc.output("blob");
}

export function recuDepotFileName(d: DemandeCorrectionDto): string {
  const ref = (d.reference || d.numero || String(d.id)).replace(/[^\w-]+/g, "_");
  return `recu-depot-${ref}.pdf`;
}
