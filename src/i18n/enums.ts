import i18n from "./index";

/**
 * Helpers de traduction des enums métier.
 * Les clés vivent dans `enums.json`, sous `enums.<groupe>.<VALEUR>`.
 * Fallback : valeur brute si la clé est manquante.
 */
/**
 * Traduction d'une clé, ou "" si elle n'existe pas. `defaultValue: ""` ne suffit pas : i18next
 * renvoie alors la clé elle-même (« types.RATTACHEMENT_DEMANDE »), affichée telle quelle.
 */
function traduire(key: string): string {
  if (!i18n.exists(key)) return "";
  return (i18n.t(key) as string) || "";
}

function tEnum(group: string, value: string | null | undefined, fallback?: string): string {
  if (!value) return fallback ?? "—";
  const translated = traduire(`enums:${group}.${value}`);
  if (translated) return translated;
  return fallback ?? value;
}

export const tStatutCertificat = (v?: string | null) => tEnum("statut_certificat", v ?? undefined);
export const tStatutTransfert = (v?: string | null) => tEnum("statut_transfert", v ?? undefined);
export const tStatutUtilisation = (v?: string | null) => tEnum("statut_utilisation", v ?? undefined);
/**
 * Libellé du statut d'une utilisation : CLOTUREE → « Clôturée ».
 * La mention « (transfert) » n'apparaît que pour une clôture explicitement liée à un transfert
 * (`parTransfert`), jamais déduite du seul type douanier.
 */
export const tUtilisationStatutContextualise = (statut?: string | null, opts?: { parTransfert?: boolean | null }): string => {
  if (statut === "CLOTUREE" && opts?.parTransfert === true) {
    const k = "utilisations:statut.cloturee_transfert";
    const r = traduire(k);
    if (r) return r;
  }
  return tStatutUtilisation(statut);
};
export const tStatutDemande = (v?: string | null) => tEnum("statut_demande", v ?? undefined);
export const tStatutConvention = (v?: string | null) => tEnum("statut_convention", v ?? undefined);
export const tStatutMarche = (v?: string | null) => tEnum("statut_marche", v ?? undefined);
export const tStatutReferentiel = (v?: string | null) => tEnum("statut_referentiel", v ?? undefined);
export const tStatutAvenant = (v?: string | null) => tEnum("statut_avenant", v ?? undefined);
export const tTypeAvenant = (v?: string | null) => tEnum("type_avenant", v ?? undefined);
export const tStatutSousTraitance = (v?: string | null) => tEnum("statut_sous_traitance", v ?? undefined);
export const tStatutModification = (v?: string | null) => tEnum("statut_modification", v ?? undefined);
/** Groupes de statuts parcourus pour un statut dont l'objet n'est pas connu. */
const STATUT_GROUPS = [
  "statut_demande", "statut_certificat", "statut_utilisation", "statut_transfert",
  "statut_avenant", "statut_convention", "statut_marche", "statut_sous_traitance",
  "statut_modification", "statut_referentiel", "reclamation_statut",
] as const;
/**
 * Libellé d'un statut quel que soit l'objet : groupe préféré d'abord,
 * puis les autres groupes de statuts ; repli sur le code brut.
 */
export const tStatutAny = (v?: string | null, preferred?: string | null): string => {
  if (!v) return "—";
  const groups = preferred ? [preferred, ...STATUT_GROUPS.filter((g) => g !== preferred)] : [...STATUT_GROUPS];
  for (const g of groups) {
    const r = traduire(`enums:${g}.${v}`);
    if (r) return r;
  }
  return v;
};
/** Groupe de statuts d'une ligne de main courante (type d'objet, puis processus). */
export const statutGroupForLigne = (type?: string | null, processus?: string | null): string | undefined => {
  if (processus === "AVENANT" || type === "Avenant" || type === "AvenantCertificat") return "statut_avenant";
  switch (type) {
    case "DemandeCorrection": return "statut_demande";
    case "CertificatCredit": return "statut_certificat";
    case "UtilisationCredit": return "statut_utilisation";
    case "TransfertCredit": return "statut_transfert";
    case "SousTraitance": return "statut_sous_traitance";
    case "Convention": return "statut_convention";
    case "ClotureCredit": return "statut_certificat";
    default: return undefined;
  }
};
export const tRole = (v?: string | null) => tEnum("role", v ?? undefined);
export const tTypeDocument = (v?: string | null) => tEnum("type_document", v ?? undefined);
/**
 * Libellé robuste d'une exigence documentaire (DocumentRequirementDto / variantes) :
 * priorité `libelle` saisi → `typeDocument` traduit → `codeDocument` brut → "—".
 * À utiliser partout où l'on affiche le nom d'un document requis pour éviter les "—" vides.
 */
export const tDocRequirementLabel = (req?: {
  libelle?: string | null;
  typeDocument?: string | null;
  codeDocument?: string | null;
  documentType?: string | null;
  description?: string | null;
} | null): string => {
  if (!req) return "—";
  if (req.libelle && req.libelle.trim()) return req.libelle.trim();
  const code = req.typeDocument || req.documentType || req.codeDocument;
  if (code) {
    const tr = tEnum("type_document", code, code);
    if (tr && tr !== "—") return tr;
  }
  if (req.description && req.description.trim()) return req.description.trim();
  return "—";
};
export const tTypeUtilisation = (v?: string | null) => tEnum("type_utilisation", v ?? undefined);
export const tTypeOperation = (v?: string | null) => tEnum("type_operation", v ?? undefined);
export const tDecisionType = (v?: string | null) => tEnum("decision_type", v ?? undefined);
/** Type d'une décision d'historique (VISA, REJET_TEMP, REJET…) en libellé métier. */
export const tTypeDecision = (v?: string | null) => tEnum("type_decision", v ?? undefined);
export const tDecisionCorrectionType = (v?: string | null) => tEnum("decision_correction_type", v ?? undefined);
export const tRejetTempStatus = (v?: string | null) => tEnum("rejet_temp_status", v ?? undefined);
export const tTvaStockSource = (v?: string | null) => tEnum("tva_stock_source", v ?? undefined);
export const tAffectationTaxe = (v?: string | null) => tEnum("affectation_taxe", v ?? undefined);
export const tTypeLigneTaxe = (v?: string | null) => tEnum("type_ligne_taxe", v ?? undefined);
export const tMotifCloture = (v?: string | null) => tEnum("motif_cloture", v ?? undefined);
export const tTypeOperationCloture = (v?: string | null) => tEnum("type_operation_cloture", v ?? undefined);
export const tReclamationStatut = (v?: string | null) => tEnum("reclamation_statut", v ?? undefined);
export const tTypeProjet = (v?: string | null) => tEnum("type_projet", v ?? undefined);

/** Libellé traduit d'une notification (namespace `notifications.types.<TYPE>`). */
export const tNotificationType = (v?: string | null) => {
  if (!v) return "";
  return traduire(`notifications:types.${v}`) || v;
};
