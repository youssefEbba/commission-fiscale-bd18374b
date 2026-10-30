import type {
  AvenantDto, ApplicationAvenantRequest, CertificatCreditDto, CertificatStatut,
  CreateAvenantRequest, StatutAvenant, TypeAvenant,
} from "@/lib/api";

/**
 * Règles d'écran du cycle de vie des avenants (P8).
 * Le serveur reste juge : ces fonctions décident seulement quels gestes proposer
 * et quels contrôles de saisie appliquer avant l'envoi.
 */

export const STATUTS_AVENANT: StatutAvenant[] = ["DEPOSE", "EN_COURS_TRAITEMENT", "ADOPTE", "APPLIQUE", "REJETE"];
export const TYPES_AVENANT: TypeAvenant[] = ["JURIDIQUE", "CONTRAT", "FINANCIER"];

/** Un avenant ne se dépose que sur un crédit ouvert ou déjà modifié. */
export const CERTIFICAT_STATUTS_AVENANT: CertificatStatut[] = ["OUVERT", "MODIFIE"];

/** Permissions donnant accès en lecture aux avenants. */
export const AVENANT_VIEW_PERMS = [
  "modification.view",
  "modification.dgtcp.queue.view",
  "modification.president.queue.view",
  "modification.admin_override",
];

/** Tolérance des contrôles de ventilation, identique à la mise en place (1 MRU). */
export const AVENANT_RECAP_TOLERANCE = 1;

export const canDeposerAvenant = (certStatut: CertificatStatut | undefined | null, has: (p: string) => boolean) =>
  !!certStatut && CERTIFICAT_STATUTS_AVENANT.includes(certStatut) && has("modification.submit");

export const canUploadAvenantPieces = (a: Pick<AvenantDto, "statut">, has: (p: string) => boolean) =>
  a.statut === "DEPOSE" && has("modification.document.upload");

/** `direct` : geste propre au rôle ; `admin` : substitution par l'administrateur (motif obligatoire). */
export type AvenantGesteMode = "direct" | "admin" | null;

export interface AvenantActions {
  priseEnCharge: AvenantGesteMode;
  /** Rejet à l'examen (DGTCP) ou à la validation (Président / administrateur). */
  rejet: AvenantGesteMode;
  validation: AvenantGesteMode;
  application: boolean;
}

export function avenantActions(a: Pick<AvenantDto, "statut" | "demandeCorrectionId">, has: (p: string) => boolean): AvenantActions {
  const admin = has("modification.admin_override");
  const none: AvenantActions = { priseEnCharge: null, rejet: null, validation: null, application: false };
  if (a.statut === "DEPOSE") {
    return {
      ...none,
      priseEnCharge: has("modification.dgtcp.analyze") ? "direct" : admin ? "admin" : null,
      rejet: has("modification.dgtcp.analyze") ? "direct" : null,
    };
  }
  // Une fois la demande de correction créée (avenant financier), c'est elle qui décide de la suite.
  if (a.statut === "EN_COURS_TRAITEMENT" && a.demandeCorrectionId == null) {
    return {
      ...none,
      validation: has("modification.president.validate") ? "direct" : admin ? "admin" : null,
      rejet: has("modification.president.reject") ? "direct" : admin ? "admin" : null,
    };
  }
  if (a.statut === "ADOPTE") return { ...none, application: has("modification.dgtcp.propose") };
  return none;
}

const toNumber = (v: string): number | null => {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Date du jour (YYYY-MM-DD) → Instant ISO-8601 attendu par le serveur. */
export const toInstant = (date: string | null | undefined) => (date && date.trim() ? `${date.trim()}T00:00:00Z` : null);

export interface AvenantDepotForm {
  certificatCreditId: string;
  type: TypeAvenant | "";
  motif: string;
  dateSignature: string;
  creditExterieurPropose: string;
  creditInterieurPropose: string;
}

export type AvenantDepotError =
  | "certificat_required" | "type_required" | "motif_required"
  | "date_signature_future" | "credits_required" | "credits_negative";

export function avenantDepotErrors(f: AvenantDepotForm, today: string): AvenantDepotError[] {
  const errors: AvenantDepotError[] = [];
  if (!f.certificatCreditId) errors.push("certificat_required");
  if (!f.type) errors.push("type_required");
  if (!f.motif.trim()) errors.push("motif_required");
  if (f.dateSignature && f.dateSignature > today) errors.push("date_signature_future");
  if (f.type === "FINANCIER") {
    const ext = toNumber(f.creditExterieurPropose);
    const int = toNumber(f.creditInterieurPropose);
    if (ext == null || int == null) errors.push("credits_required");
    else if (ext < 0 || int < 0) errors.push("credits_negative");
  }
  return errors;
}

export function buildCreateAvenantRequest(f: AvenantDepotForm): CreateAvenantRequest {
  const financier = f.type === "FINANCIER";
  return {
    certificatCreditId: Number(f.certificatCreditId),
    type: f.type as TypeAvenant,
    motif: f.motif.trim() || null,
    dateSignature: toInstant(f.dateSignature),
    creditExterieurPropose: financier ? toNumber(f.creditExterieurPropose) : null,
    creditInterieurPropose: financier ? toNumber(f.creditInterieurPropose) : null,
  };
}

/** Saisie du nouveau récapitulatif : (a) (b) (c) (d) (f) (g), crédit extérieur (e) et TVA nette (h). */
export interface AvenantRecapForm {
  a: string; b: string; c: string; d: string; f: string; g: string;
  montantCordon: string;
  montantTVAInterieure: string;
}

export interface AvenantRecapCheck {
  /** b + c + d quand b et d sont saisis. */
  cordonAttendu: number | null;
  /** g − d quand g et d sont saisis. */
  tvaAttendue: number | null;
  /** Écart signé saisi − attendu (null si non calculable). */
  ecartCordon: number | null;
  ecartTva: number | null;
  errors: Array<"cordon_required" | "tva_required" | "negative" | "bd_required" | "cordon_mismatch" | "tva_mismatch">;
}

/** Mêmes règles de cohérence qu'à la mise en place : e = b + c + d ; h = g − d ; tolérance 1 MRU ; c facultatif. */
export function checkAvenantRecap(r: AvenantRecapForm): AvenantRecapCheck {
  const errors: AvenantRecapCheck["errors"] = [];
  const cordon = toNumber(r.montantCordon);
  const tva = toNumber(r.montantTVAInterieure);
  const b = toNumber(r.b), c = toNumber(r.c), d = toNumber(r.d), g = toNumber(r.g);
  if (cordon == null) errors.push("cordon_required");
  if (tva == null) errors.push("tva_required");
  const all = [cordon, tva, toNumber(r.a), b, c, d, toNumber(r.f), g];
  if (all.some((v) => v != null && v < 0)) errors.push("negative");
  if (cordon != null && cordon > 0 && (b == null || d == null)) errors.push("bd_required");
  const cordonAttendu = b != null && d != null ? b + (c ?? 0) + d : null;
  const tvaAttendue = g != null && d != null ? g - d : null;
  const ecartCordon = cordonAttendu != null && cordon != null ? cordon - cordonAttendu : null;
  const ecartTva = tvaAttendue != null && tva != null ? tva - tvaAttendue : null;
  if (ecartCordon != null && Math.abs(ecartCordon) > AVENANT_RECAP_TOLERANCE) errors.push("cordon_mismatch");
  if (ecartTva != null && Math.abs(ecartTva) > AVENANT_RECAP_TOLERANCE) errors.push("tva_mismatch");
  return { cordonAttendu, tvaAttendue, ecartCordon, ecartTva, errors };
}

export function buildApplicationRequest(r: AvenantRecapForm): ApplicationAvenantRequest {
  return {
    valeurDouaneFournitures: toNumber(r.a),
    droitsEtTaxesDouaneHorsTva: toNumber(r.b),
    taxesConsommation: toNumber(r.c),
    tvaImportationDouaneAccordee: toNumber(r.d),
    montantCordon: toNumber(r.montantCordon) ?? 0,
    montantMarcheHt: toNumber(r.f),
    tvaCollecteeTravaux: toNumber(r.g),
    montantTVAInterieure: toNumber(r.montantTVAInterieure) ?? 0,
  };
}

const str = (v: number | null | undefined) => (v == null ? "" : String(v));

/**
 * Pré-remplissage : enveloppes = crédits retenus par la correction adoptée (repli : crédits proposés),
 * lignes du récapitulatif = valeurs actuelles du crédit.
 */
export function initialAvenantRecap(
  cert: Partial<CertificatCreditDto> | null | undefined,
  retenus: { exterieur?: number | null; interieur?: number | null },
  avenant: Pick<AvenantDto, "creditExterieurPropose" | "creditInterieurPropose">,
): AvenantRecapForm {
  return {
    a: str(cert?.valeurDouaneFournitures),
    b: str(cert?.droitsEtTaxesDouaneHorsTva),
    c: str(cert?.taxesConsommation),
    d: str(cert?.tvaImportationDouaneAccordee ?? cert?.tvaImportationDouane),
    f: str(cert?.montantMarcheHt),
    g: str(cert?.tvaCollecteeTravaux),
    montantCordon: str(retenus.exterieur ?? avenant.creditExterieurPropose),
    montantTVAInterieure: str(retenus.interieur ?? avenant.creditInterieurPropose),
  };
}

export interface SoldePreviewLine {
  key: "cordon" | "tva" | "tva_import";
  consomme: number | null;
  soldeAvant: number | null;
  soldeApres: number | null;
  /** Nouveau montant inférieur au consommé : le serveur refusera (400). */
  insuffisant: boolean;
}

/** Aperçu indicatif : consommé conservé, restant = nouveau montant − consommé. Le serveur fait foi. */
export function previewSoldesApresAvenant(
  cert: Partial<CertificatCreditDto> | null | undefined,
  r: AvenantRecapForm,
): SoldePreviewLine[] {
  const line = (key: SoldePreviewLine["key"], montantAvant?: number | null, soldeAvant?: number | null, nouveau?: number | null): SoldePreviewLine => {
    const consomme = montantAvant != null && soldeAvant != null ? montantAvant - soldeAvant : null;
    const soldeApres = consomme != null && nouveau != null ? nouveau - consomme : null;
    return { key, consomme, soldeAvant: soldeAvant ?? null, soldeApres, insuffisant: soldeApres != null && soldeApres < -0.005 };
  };
  return [
    line("cordon", cert?.montantCordon, cert?.soldeCordon, toNumber(r.montantCordon)),
    line("tva", cert?.montantTVAInterieure, cert?.soldeTVA, toNumber(r.montantTVAInterieure)),
    line("tva_import", cert?.tvaImportationDouaneAccordee, cert?.tvaImportationDouane, toNumber(r.d)),
  ];
}
