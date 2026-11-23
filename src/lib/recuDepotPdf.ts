import jsPDF from "jspdf";
import { drawOfficialHeader } from "@/lib/pdfOfficialHeader";
import { PDF_FONT, applyOfficialFont, loadOfficialWebFonts, CANVAS_FONT_AR, CANVAS_FONT_FR } from "@/lib/pdfFonts";
import i18n from "@/i18n";
import { formatAmount, formatDate, formatDateTime } from "@/i18n/format";
import {
  tStatutAvenant, tStatutCertificat, tStatutDemande, tStatutSousTraitance, tStatutTransfert, tStatutUtilisation,
  tTypeAvenant, tTypeDocument,
} from "@/i18n/enums";
import type {
  AvenantDto, CertificatCreditDto, DemandeCorrectionDto, DocumentDto, SousTraitanceDto, TransfertCreditDto, UtilisationCreditDto,
} from "@/lib/api";
import { joinNumeros, numerosDeclaration, numerosFacture } from "@/lib/utilisationNumeros";

/**
 * Reçu de dépôt (code document RECU_DEPOT), commun à tous les processus de demande.
 * Un adaptateur par DTO produit un `RecuModele` ; `generateRecuPdf` le met en page.
 * Rédigé dans la langue courante, avec la police officielle Ouguiya (LouguiyaFR / Louguiya).
 * En français, le texte est écrit comme du vrai texte PDF (sélectionnable, police visible dans les propriétés).
 * En arabe, il reste dessiné via canvas : jsPDF ne sait ni lier les lettres arabes ni gérer le sens d'écriture.
 */

export type RecuProcessus =
  | "CORRECTION"
  | "MISE_EN_PLACE"
  | "UTILISATION_DOUANE"
  | "UTILISATION_TVA"
  | "TRANSFERT"
  | "AVENANT"
  | "SOUS_TRAITANCE";

export interface RecuLigne {
  label: string;
  value?: string | null;
  /** Ligne omise si la valeur est vide (sinon « — »). */
  optional?: boolean;
}

export interface RecuModele {
  processus: RecuProcessus;
  /** Référence affichée (et nom de fichier). */
  reference: string;
  /** Date de soumission renvoyée par le serveur. */
  dateDepot?: string | null;
  /** Libellé du statut à l'issue du dépôt (omis pour un reçu reconstitué). */
  statut?: string | null;
  deposant: RecuLigne[];
  titulaire: RecuLigne[];
  objet: RecuLigne[];
  montants: RecuLigne[];
}

export interface RecuAdapterOptions {
  deposantNom?: string | null;
  /** Reçu reconstitué après coup : le statut actuel n'est pas celui du dépôt, il est omis. */
  regenerated?: boolean;
}

export interface RecuRenderOptions {
  documents?: DocumentDto[];
  /** Libellés paramétrés par code document (sinon traduction de l'enum). */
  libelles?: Record<string, string>;
  regenerated?: boolean;
  /** Date d'édition (tests). */
  now?: Date;
}

const t = (k: string, o?: Record<string, unknown>) => i18n.t(`demandes:recu.${k}`, o) as string;
const money = (n?: number | string | null) => (n == null || n === "" ? null : formatAmount(Number(n), { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dateOnly = (d?: string | null) => (d ? formatDate(d) : null);
const join = (...parts: (string | null | undefined)[]) => parts.filter((p) => p && String(p).trim()).join(" — ") || null;
const deposantLigne = (o: RecuAdapterOptions): RecuLigne[] =>
  o.deposantNom || !o.regenerated ? [{ label: t("deposant_nom"), value: o.deposantNom }] : [];

// ---------------------------------------------------------------------------
// Adaptateurs par DTO
// ---------------------------------------------------------------------------

export function recuCorrection(d: DemandeCorrectionDto, o: RecuAdapterOptions = {}): RecuModele {
  const groupement = !!(d.groupementId || d.groupementRaisonSociale);
  return {
    processus: "CORRECTION",
    reference: d.reference || d.numero || "—",
    dateDepot: d.dateDepot,
    statut: d.statut ? tStatutDemande(d.statut) : null,
    deposant: [
      { label: t("autorite"), value: d.autoriteContractanteNom },
      { label: t("ministere_tutelle"), value: d.autoriteContractanteMinistereTutelleNom },
      ...deposantLigne(o),
    ],
    titulaire: groupement
      ? [{ label: t("groupement"), value: d.groupementRaisonSociale }, { label: t("nif_chef_file"), value: d.groupementNifAffiche }]
      : [{ label: t("raison_sociale"), value: d.entrepriseRaisonSociale }, { label: t("nif"), value: d.entrepriseNif }],
    objet: [
      { label: t("convention"), value: d.conventionReference },
      { label: t("convention_intitule"), value: d.conventionIntitule },
      { label: t("intitule_marche"), value: d.intituleMarche },
      { label: t("reference_appel_offre"), value: d.referenceAppelOffre, optional: true },
      { label: t("marche"), value: join(d.marche?.numeroMarche, d.marche?.intitule), optional: true },
    ],
    montants: [
      { label: t("credit_interieur"), value: money(d.creditInterieur ?? 0) },
      { label: t("credit_exterieur"), value: money(d.creditExterieur ?? 0) },
    ],
  };
}

export function recuMiseEnPlace(c: CertificatCreditDto, o: RecuAdapterOptions = {}): RecuModele {
  return {
    processus: "MISE_EN_PLACE",
    reference: c.reference || c.numero || "—",
    dateDepot: c.dateEmission,
    statut: c.statut ? tStatutCertificat(c.statut) : null,
    deposant: [
      { label: t("autorite"), value: c.autoriteContractanteNom },
      { label: t("ministere_tutelle"), value: c.autoriteContractanteMinistereTutelleNom, optional: true },
      ...deposantLigne(o),
    ],
    titulaire: [{ label: t("raison_sociale"), value: c.entrepriseRaisonSociale || c.entrepriseNom }],
    objet: [
      { label: t("demande_correction"), value: c.demandeCorrectionReference || c.demandeCorrectionNumero },
      { label: t("marche"), value: join(c.marcheNumero || c.marcheReference, c.marcheIntitule), optional: true },
    ],
    montants: [
      { label: t("montant_cordon"), value: money(c.montantCordon ?? c.montantDouane) },
      { label: t("montant_tva_interieure"), value: money(c.montantTVAInterieure ?? c.montantInterieur) },
    ],
  };
}

export function recuUtilisation(u: UtilisationCreditDto, o: RecuAdapterOptions = {}): RecuModele {
  const douane = u.type !== "TVA_INTERIEURE";
  const titulaire = u.demandeurEstSousTraitant
    ? [
      { label: t("titulaire_credit"), value: u.certificatTitulaireRaisonSociale },
      { label: t("sous_traitant"), value: u.entrepriseNom },
    ]
    : [{ label: t("raison_sociale"), value: u.entrepriseNom || u.certificatTitulaireRaisonSociale }];
  return {
    processus: douane ? "UTILISATION_DOUANE" : "UTILISATION_TVA",
    reference: u.reference || "—",
    dateDepot: u.dateDemande,
    statut: u.statut ? tStatutUtilisation(u.statut) : null,
    deposant: deposantLigne(o),
    titulaire,
    objet: douane
      ? [
        { label: t("certificat"), value: u.certificatReference || u.certificatNumero },
        { label: t("numero_declaration"), value: joinNumeros(numerosDeclaration(u)), optional: true },
        { label: t("numero_bulletin"), value: u.numeroBulletin, optional: true },
        { label: t("date_declaration"), value: dateOnly(u.dateDeclaration), optional: true },
      ]
      : [
        { label: t("certificat"), value: u.certificatReference || u.certificatNumero },
        { label: t("numero_facture"), value: joinNumeros(numerosFacture(u)), optional: true },
        { label: t("date_facture"), value: dateOnly(u.dateFacture), optional: true },
        { label: t("numero_decompte"), value: u.numeroDecompte, optional: true },
      ],
    montants: douane
      ? [
        { label: t("montant_droits"), value: money(u.montantDroits), optional: true },
        { label: t("montant_tva_douane"), value: money(u.montantTVADouane), optional: true },
        { label: t("montant_demande"), value: money(u.montant) },
      ]
      : [{ label: t("montant_tva_interieure"), value: money(u.montantTVAInterieure ?? u.montant) }],
  };
}

export function recuTransfert(tr: TransfertCreditDto, o: RecuAdapterOptions = {}): RecuModele {
  return {
    processus: "TRANSFERT",
    reference: tr.reference || "—",
    dateDepot: tr.dateDemande,
    statut: tr.statut ? tStatutTransfert(tr.statut) : null,
    deposant: deposantLigne(o),
    titulaire: [],
    objet: [{ label: t("certificat"), value: tr.certificatReference || tr.certificatNumero }],
    montants: [{ label: t("montant_transfert"), value: money(tr.montant) }],
  };
}

export function recuAvenant(a: AvenantDto, o: RecuAdapterOptions = {}): RecuModele {
  return {
    processus: "AVENANT",
    reference: a.numero || "—",
    dateDepot: a.dateDepot,
    statut: a.statut ? tStatutAvenant(a.statut) : null,
    deposant: [
      { label: t("autorite"), value: a.autoriteContractanteNom, optional: true },
      ...deposantLigne(o),
    ],
    titulaire: [{ label: t("raison_sociale"), value: a.entrepriseNom }],
    objet: [
      { label: t("type_avenant"), value: a.type ? tTypeAvenant(a.type) : null },
      { label: t("certificat"), value: a.certificatReference || a.certificatNumero },
      { label: t("marche"), value: join(a.marcheNumero, a.marcheIntitule), optional: true },
      { label: t("demande_correction"), value: a.demandeCorrectionReference, optional: true },
      { label: t("date_signature"), value: dateOnly(a.dateSignature), optional: true },
      { label: t("motif"), value: a.motif, optional: true },
    ],
    montants: [
      { label: t("credit_exterieur_propose"), value: money(a.creditExterieurPropose), optional: true },
      { label: t("credit_interieur_propose"), value: money(a.creditInterieurPropose), optional: true },
    ],
  };
}

export function recuSousTraitance(s: SousTraitanceDto, o: RecuAdapterOptions = {}): RecuModele {
  return {
    processus: "SOUS_TRAITANCE",
    reference: s.reference || "—",
    dateDepot: s.dateDemande,
    statut: s.statut ? tStatutSousTraitance(s.statut) : null,
    deposant: deposantLigne(o),
    titulaire: [
      { label: t("sous_traitant"), value: s.sousTraitantEntrepriseRaisonSociale },
      { label: t("nif"), value: s.sousTraitantEntrepriseNif, optional: true },
    ],
    objet: [
      { label: t("certificat"), value: s.certificatReference || s.certificatNumero },
      { label: t("volumes"), value: s.volumes != null ? String(s.volumes) : null, optional: true },
      { label: t("quantites"), value: s.quantites != null ? String(s.quantites) : null, optional: true },
    ],
    montants: [],
  };
}

/** Sections non vides, dans l'ordre du reçu (lignes facultatives vides retirées). */
export function recuSections(m: RecuModele, regenerated = false, now: Date = new Date()) {
  const keep = (rows: RecuLigne[]) => rows.filter((r) => !r.optional || (r.value != null && String(r.value).trim() !== ""));
  // Sans date renvoyée par le serveur, la date du dépôt est celle de l'édition (reçu émis à la soumission).
  const date = m.dateDepot ? formatDateTime(m.dateDepot) : regenerated ? null : formatDateTime(now);
  const depot: RecuLigne[] = [
    { label: t("reference"), value: m.reference },
    { label: t("date_depot"), value: date },
    ...(!regenerated ? [{ label: t("statut"), value: m.statut }] : []),
  ];
  return [
    { key: "section_depot", rows: depot },
    { key: "section_deposant", rows: keep(m.deposant) },
    { key: "section_titulaire", rows: keep(m.titulaire) },
    { key: "section_objet", rows: keep(m.objet) },
    { key: "section_montants", rows: keep(m.montants) },
  ].filter((s) => s.rows.length > 0);
}

/** Pièces listées sur le reçu : actives, hors reçu lui-même. */
export const recuPieces = (documents: DocumentDto[]) =>
  documents.filter((p) => (p.codeDocument || p.type) !== "RECU_DEPOT" && p.actif !== false);

export function recuFileName(m: Pick<RecuModele, "processus" | "reference">): string {
  const ref = m.reference === "—" ? "" : m.reference.replace(/[^\w-]+/g, "_");
  const processus = m.processus === "CORRECTION" ? "" : m.processus.toLowerCase().replace(/_/g, "-");
  return `recu-depot-${[processus, ref].filter(Boolean).join("-") || "demande"}.pdf`;
}

// ---------------------------------------------------------------------------
// Mise en page
// ---------------------------------------------------------------------------

export async function generateRecuPdf(m: RecuModele, { documents = [], libelles = {}, regenerated = false, now = new Date() }: RecuRenderOptions = {}): Promise<Blob> {
  await loadOfficialWebFonts();
  const rtl = i18n.language?.startsWith("ar");
  const doc = await applyOfficialFont(new jsPDF({ unit: "pt", format: "a4" }));
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const scale = 4;
  let y = 44;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontOf = (size: number, bold: boolean) =>
    `${bold ? "bold " : ""}${size * scale}px ${rtl ? `"${CANVAS_FONT_AR}", "${CANVAS_FONT_FR}", "Noto Sans Arabic", Arial` : `"${CANVAS_FONT_FR}", Arial`}, sans-serif`;

  /** Espaces fines (séparateurs de milliers) absentes de LouguiyaFR : remplacées par une espace insécable. */
  const pdfSafe = (text: string) => text.replace(/[\u202F\u2009\u2007]/g, "\u00A0");
  const hex6 = (c: string) => (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c);
  const setPdfText = (size: number, bold: boolean, color = "#000") => {
    doc.setFont(PDF_FONT, bold ? "bold" : "normal").setFontSize(size).setTextColor(hex6(color));
  };
  const widthOf = (text: string, size: number, bold: boolean) => {
    if (!rtl) { setPdfText(size, bold); return doc.getTextWidth(pdfSafe(text)); }
    ctx.font = fontOf(size, bold);
    return ctx.measureText(text).width / scale;
  };

  const wrap = (text: string, size: number, bold: boolean, maxW: number): string[] => {
    const words = text.split(/[ \t\n\r]+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (widthOf(test, size, bold) > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };

  /** Dessine une ligne ; align "start" respecte le sens (gauche en FR, droite en AR). */
  const draw = (text: string, x: number, size = 10, bold = false, align: "start" | "center" | "end" = "start", color = "#000") => {
    if (!text) return;
    if (!rtl) {
      // Français : vrai texte PDF, ligne de base à y (même position que le rendu canvas).
      setPdfText(size, bold, color);
      doc.text(pdfSafe(text), x, y, { align: align === "center" ? "center" : align === "end" ? "right" : "left" });
      return;
    }
    ctx.font = fontOf(size, bold);
    const w = Math.ceil(ctx.measureText(text).width) + 6;
    const h = Math.ceil(size * scale * 1.6);
    canvas.width = w; canvas.height = h;
    ctx.font = fontOf(size, bold);
    ctx.direction = "rtl";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;
    ctx.clearRect(0, 0, w, h);
    // Avec direction rtl, textAlign "left" reste un bord physique : on dessine depuis la droite du canvas.
    ctx.textAlign = "right";
    ctx.fillText(text, w - 3, size * scale * 1.15);
    const wPt = w / scale, hPt = h / scale;
    const physical = align === "center" ? "center" : align === "start" ? "right" : "left";
    const left = physical === "center" ? x - wPt / 2 : physical === "left" ? x : x - wPt;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", left, y - size * 1.15, wPt, hPt);
  };
  const startX = rtl ? W - M : M;
  const endX = rtl ? M : W - M;

  const ensure = (need: number) => {
    if (y + need > H - 90) { doc.addPage(); y = 50; }
  };

  // ===== En-tête institutionnel (identique au certificat) =====
  y = drawOfficialHeader(doc, "pt");
  doc.setDrawColor(0).setLineWidth(0.8).line(M, y, W - M, y); y += 28;
  draw(t("title").toUpperCase(), W / 2, 16, true, "center"); y += 18;
  draw(t(`subtitle_processus.${m.processus}`), W / 2, 10, false, "center", "#444"); y += 24;

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

  for (const s of recuSections(m, regenerated, now)) {
    section(t(s.key));
    s.rows.forEach((r) => row(r.label, r.value));
    y += 6;
  }

  section(t("section_pieces"));
  const pieces = recuPieces(documents);
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
  const editedOn = t("generated_on", { date: formatDateTime(now) });
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

// ---------------------------------------------------------------------------
// Compatibilité : reçu de la demande de correction
// ---------------------------------------------------------------------------

export interface RecuDepotInput {
  demande: DemandeCorrectionDto;
  documents: DocumentDto[];
  deposantNom?: string;
  libelles?: Record<string, string>;
  regenerated?: boolean;
}

export function generateRecuDepotPdf({ demande, documents, deposantNom, libelles, regenerated = false }: RecuDepotInput): Promise<Blob> {
  return generateRecuPdf(recuCorrection(demande, { deposantNom, regenerated }), { documents, libelles, regenerated });
}

export function recuDepotFileName(d: DemandeCorrectionDto): string {
  return recuFileName(recuCorrection(d));
}
