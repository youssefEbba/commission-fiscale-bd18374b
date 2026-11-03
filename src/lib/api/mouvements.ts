import { apiFetch, normalizeDocs } from "./client";
import type { DecisionCorrectionDto } from "./demandes";
import { API_BASE } from "../apiConfig";
import { parseApiErrorBody } from "../apiErrorText";
import { endSession } from "../session";
import { ApiRequestError } from "./client";
import type { DecisionType, DemandeStatut, RejetTempResponseDto } from "./demandes";
import type { CreateTransfertCreditRequest, DocumentTransfertCreditDto, TransfertCreditDto, TransfertVisaEtatDto } from "./referentiels";
export const transfertCreditApi = {
  getAll: () => apiFetch<TransfertCreditDto[]>("/transferts-credit"),
  getById: (id: number) => apiFetch<TransfertCreditDto>(`/transferts-credit/${id}`),
  getByCertificat: (certificatCreditId: number) =>
    apiFetch<TransfertCreditDto>(`/transferts-credit/by-certificat/${certificatCreditId}`),
  create: (data: CreateTransfertCreditRequest) =>
    apiFetch<TransfertCreditDto>("/transferts-credit", { method: "POST", body: data }),
  /** Approbation du Président (4e visa + exécution de l'écriture). 403 pour tout autre rôle. */
  valider: (id: number) =>
    apiFetch<TransfertCreditDto>(`/transferts-credit/${id}/valider`, { method: "POST" }),
  /** Circuit P7 : état des 4 visas (DGD → DGI → DGTCP → PRESIDENT). */
  getVisas: (id: number) =>
    apiFetch<TransfertVisaEtatDto[]>(`/transferts-credit/${id}/visas`),
  /** Visa d'une direction (DGD, DGI, DGTCP). */
  viser: (id: number) =>
    apiFetch<TransfertCreditDto>(`/transferts-credit/${id}/visa`, { method: "POST" }),
  rejeter: (id: number) =>
    apiFetch<TransfertCreditDto>(`/transferts-credit/${id}/rejeter`, { method: "POST" }),
  /** Annulation par l'entreprise titulaire (avant exécution). */
  annuler: (id: number) =>
    apiFetch<TransfertCreditDto>(`/transferts-credit/${id}/annuler`, { method: "POST" }),
  getDocuments: (id: number) =>
    apiFetch<DocumentTransfertCreditDto[]>(`/transferts-credit/${id}/documents`).then(normalizeDocs),
  /**
   * Upload d'une pièce. `message` est obligatoire si la pièce est exigée
   * par un rejet temporaire OUVERT (traçabilité côté décisions).
   */
  uploadDocument: (id: number, type: string, file: File, message?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (message) formData.append("message", message);
    return apiFetch<DocumentTransfertCreditDto>(
      `/transferts-credit/${id}/documents?codeDocument=${encodeURIComponent(type)}`,
      { method: "POST", rawBody: formData }
    );
  },
  // Décisions (REJET_TEMP uniquement pour ce module — la validation reste POST .../valider)
  getDecisions: (id: number) =>
    apiFetch<DecisionCorrectionDto[]>(`/transferts-credit/${id}/decisions`),
  postDecision: (id: number, decision: DecisionType, motifRejet?: string, documentsDemandes?: string[]) =>
    apiFetch<DecisionCorrectionDto>(`/transferts-credit/${id}/decisions`, {
      method: "POST",
      body: {
        decision,
        ...(motifRejet ? { motifRejet } : {}),
        ...(documentsDemandes && documentsDemandes.length > 0 ? { documentsDemandes } : {}),
      },
    }),
  postRejetTempResponse: (decisionId: number, message: string, file?: File, typeDocument?: string) => {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("message", message);
      if (typeDocument) formData.append("codeDocument", typeDocument);
      return apiFetch<RejetTempResponseDto>(`/transferts-credit/decisions/${decisionId}/rejet-temp/reponses`, {
        method: "POST",
        rawBody: formData,
      });
    }
    return apiFetch<RejetTempResponseDto>(`/transferts-credit/decisions/${decisionId}/rejet-temp/reponses`, {
      method: "POST",
      body: { message },
    });
  },
  /** Résoudre un rejet temporaire — même rôle que celui qui l'a posé (DGTCP ou Président). */
  resolveRejetTemp: (decisionId: number) =>
    apiFetch<DecisionCorrectionDto>(`/transferts-credit/decisions/${decisionId}/resolve`, {
      method: "PUT",
    }),
};

// Sous-traitance (P8)
export type StatutSousTraitance = "DEMANDE" | "EN_COURS" | "AUTORISEE" | "REFUSEE";

export interface SousTraitanceDto {
  id: number;
  certificatCreditId: number;
  certificatNumero?: string;
  entrepriseSourceId?: number;
  sousTraitantEntrepriseId?: number;
  sousTraitantEntrepriseRaisonSociale?: string;
  sousTraitantEntrepriseNif?: string;
  contratEnregistre?: boolean;
  volumes?: number;
  quantites?: number;
  dateAutorisation?: string;
  statut: StatutSousTraitance;
}

export interface CreateSousTraitanceRequest {
  certificatCreditId: number;
  sousTraitantEntrepriseId: number;
  contratEnregistre?: boolean;
  volumes?: number;
  quantites?: number;
}

export interface SousTraitanceOnboardingRequest {
  certificatCreditId: number;
  sousTraitantEntrepriseRaisonSociale: string;
  sousTraitantEntrepriseNif: string;
  sousTraitantEntrepriseAdresse?: string;
  sousTraitantEntrepriseSituationFiscale?: string;
  sousTraitantEntrepriseNomCommercial?: string;
  sousTraitantEntrepriseActivite?: string;
  sousTraitantEntrepriseAutre?: string;
  contratEnregistre?: boolean;
  volumes?: number;
  quantites?: number;
}

export interface SousTraitanceOnboardingResult {
  sousTraitantEntrepriseId: number;
  sousTraitance: SousTraitanceDto;
}

export interface DocumentSousTraitanceDto {
  id: number;
  type: string;
  nomFichier: string;
  chemin?: string;
  dateUpload?: string;
  taille?: number;
  version?: number;
  actif?: boolean;
}

export type TypeDocumentSousTraitance = "CONTRAT_SOUS_TRAITANCE_ENREGISTRE" | "LETTRE_SOUS_TRAITANCE";

// Removed SOUS_TRAITANCE_DOCUMENT_TYPES and SOUS_TRAITANCE_STATUT_LABELS (G2 migration).
// Use tTypeDocument / tStatutSousTraitance from "@/i18n/enums" instead.


export const sousTraitanceApi = {
  getAll: () => apiFetch<SousTraitanceDto[]>("/sous-traitances"),
  getById: (id: number) => apiFetch<SousTraitanceDto>(`/sous-traitances/${id}`),
  create: (data: CreateSousTraitanceRequest) =>
    apiFetch<SousTraitanceDto>("/sous-traitances", { method: "POST", body: data }),
  onboard: (data: SousTraitanceOnboardingRequest) =>
    apiFetch<SousTraitanceOnboardingResult>("/sous-traitances/onboarding", { method: "POST", body: data }),
  autoriser: (id: number) =>
    apiFetch<SousTraitanceDto>(`/sous-traitances/${id}/autoriser`, { method: "POST" }),
  refuser: (id: number) =>
    apiFetch<SousTraitanceDto>(`/sous-traitances/${id}/refuser`, { method: "POST" }),
  getDocuments: (id: number) =>
    apiFetch<DocumentSousTraitanceDto[]>(`/sous-traitances/${id}/documents`).then(normalizeDocs),
  uploadDocument: (id: number, type: TypeDocumentSousTraitance, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentSousTraitanceDto>(
      `/sous-traitances/${id}/documents?codeDocument=${encodeURIComponent(type)}`,
      { method: "POST", rawBody: formData }
    );
  },
};
// Clôture / Annulation (P9)
export type MotifCloture = "RECEPTION_DEFINITIVE" | "SOLDE_ZERO" | "EXPIRATION_VALIDITE" | "RENONCIATION";
export type TypeOperationCloture = "CLOTURE" | "ANNULATION";

export interface ClotureCreditDto {
  /** Dérivé de la demande de correction d'origine. null = non. */
  equipementsPresents?: boolean | null;
  id: number;
  dateProposition?: string;
  dateCloture?: string;
  motif: MotifCloture;
  typeOperation: TypeOperationCloture;
  soldeRestant?: number;
  approuvee?: boolean | null;
  certificatCreditId: number;
  certificatNumero?: string;
}

export interface CreateClotureCreditRequest {
  certificatCreditId: number;
  motif: MotifCloture;
  typeOperation: TypeOperationCloture;
}

export const MOTIF_CLOTURE_LABELS: Record<MotifCloture, string> = {
  RECEPTION_DEFINITIVE: "Réception définitive",
  SOLDE_ZERO: "Solde à zéro",
  EXPIRATION_VALIDITE: "Expiration de validité",
  RENONCIATION: "Renonciation",
};

export const TYPE_OPERATION_LABELS: Record<TypeOperationCloture, string> = {
  CLOTURE: "Clôture",
  ANNULATION: "Annulation",
};

/** Élément de la file de clôture (GET /clotures-credit/queue). */
export interface ClotureQueueItemDto {
  certificatCreditId: number;
  /** Référence lisible du crédit (CR-…). */
  reference?: string | null;
  numero?: string | null;
  entrepriseRaisonSociale?: string | null;
  statut?: string | null;
  /** Crédit ouvert sans opération en cours — proposable, même avec un solde. */
  eligiblePourCloture: boolean;
  /** Soldes épuisés ou validité dépassée. */
  detecteAutomatiquement: boolean;
  soldesEpuises: boolean;
  validiteDepassee: boolean;
  /** Soldes restants, en texte lisible. */
  soldesRestants?: string[];
  dateValidite?: string | null;
}

export const clotureCreditApi = {
  getEligible: () => apiFetch<number[]>("/clotures-credit/eligible"),
  getQueue: () => apiFetch<ClotureQueueItemDto[]>("/clotures-credit/queue"),
  proposer: (data: CreateClotureCreditRequest) =>
    apiFetch<ClotureCreditDto>("/clotures-credit", { method: "POST", body: data }),
  getPropositions: () => apiFetch<ClotureCreditDto[]>("/clotures-credit/propositions"),
  valider: (id: number) =>
    apiFetch<ClotureCreditDto>(`/clotures-credit/${id}/valider`, { method: "POST" }),
  rejeter: (id: number) =>
    apiFetch<ClotureCreditDto>(`/clotures-credit/${id}/rejeter`, { method: "POST" }),
  finaliser: (id: number) =>
    apiFetch<ClotureCreditDto>(`/clotures-credit/${id}/finaliser`, { method: "POST" }),
  getDocuments: (id: number) => apiFetch<any[]>(`/clotures-credit/${id}/documents`).then(normalizeDocs),
  uploadDocument: (id: number, type: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<any>(
      `/clotures-credit/${id}/documents?codeDocument=${encodeURIComponent(type)}`,
      { method: "POST", rawBody: formData }
    );
  },
};

// Avenants / Modifications (P8)
/** Déposé → En cours de traitement → Adopté → Appliqué, ou Rejeté. */
export type StatutAvenant = "DEPOSE" | "EN_COURS_TRAITEMENT" | "ADOPTE" | "APPLIQUE" | "REJETE";
export type TypeAvenant = "JURIDIQUE" | "CONTRAT" | "FINANCIER";

export interface AvenantDto {
  id: number;
  numero?: string | null;
  type: TypeAvenant;
  statut: StatutAvenant;
  motif?: string | null;
  dateSignature?: string | null;
  certificatCreditId: number;
  certificatNumero?: string | null;
  certificatReference?: string | null;
  entrepriseId?: number | null;
  entrepriseNom?: string | null;
  autoriteContractanteId?: number | null;
  autoriteContractanteNom?: string | null;
  /** Marché du crédit (via la demande de correction) ; null pour un crédit sans marché rattaché. */
  marcheId?: number | null;
  marcheNumero?: string | null;
  marcheIntitule?: string | null;
  deposeParUtilisateurId?: number | null;
  dateDepot?: string | null;
  creditExterieurPropose?: number | null;
  creditInterieurPropose?: number | null;
  /** Avenant financier : demande de correction créée en brouillon à la validation du Président. */
  demandeCorrectionId?: number | null;
  demandeCorrectionReference?: string | null;
  demandeCorrectionStatut?: DemandeStatut | null;
  dateExamen?: string | null;
  dateValidation?: string | null;
  dateApplication?: string | null;
  motifRejet?: string | null;
  // Instantané pris à l'application (APPLIQUE).
  montantCordonAvant?: number | null;
  montantCordonApres?: number | null;
  montantTVAInterieureAvant?: number | null;
  montantTVAInterieureApres?: number | null;
  soldeCordonAvant?: number | null;
  soldeCordonApres?: number | null;
  soldeTVAAvant?: number | null;
  soldeTVAApres?: number | null;
  tvaImportationRestanteAvant?: number | null;
  tvaImportationRestanteApres?: number | null;
}

export interface CreateAvenantRequest {
  certificatCreditId: number;
  /** Marché choisi au dépôt ; 400 si le crédit n'appartient pas à ce marché. Absent = aucun contrôle. */
  marcheId?: number;
  type: TypeAvenant;
  motif: string | null;
  /** Instant ISO-8601 (`YYYY-MM-DDT00:00:00Z`). */
  dateSignature: string | null;
  /** Obligatoires pour un avenant FINANCIER, null sinon. */
  creditExterieurPropose: number | null;
  creditInterieurPropose: number | null;
}

/** Nouveau récapitulatif saisi par la DGTCP à l'application d'un avenant financier. */
export interface ApplicationAvenantRequest {
  valeurDouaneFournitures: number | null;
  droitsEtTaxesDouaneHorsTva: number | null;
  taxesConsommation: number | null;
  tvaImportationDouaneAccordee: number | null;
  montantCordon: number;
  montantMarcheHt: number | null;
  tvaCollecteeTravaux: number | null;
  montantTVAInterieure: number;
}

export interface DocumentAvenantDto {
  id: number;
  codeDocument: string;
  nomFichier: string;
  chemin?: string;
  dateUpload?: string;
  taille?: number;
  version?: number;
  actif?: boolean;
}

const avenantMotifQuery = (motif?: string | null) =>
  motif && motif.trim() ? `?motif=${encodeURIComponent(motif.trim())}` : "";

export const avenantApi = {
  /** Liste dans le périmètre de l'utilisateur (ordre serveur). */
  getAll: () => apiFetch<AvenantDto[]>("/avenants"),
  getById: (id: number) => apiFetch<AvenantDto>(`/avenants/${id}`),
  getByCertificat: (certificatId: number) => apiFetch<AvenantDto[]>(`/avenants/by-certificat/${certificatId}`),
  create: (data: CreateAvenantRequest) => apiFetch<AvenantDto>("/avenants", { method: "POST", body: data }),
  /** DGTCP ; motif seulement quand l'administrateur se substitue. */
  priseEnCharge: (id: number, motif?: string | null) =>
    apiFetch<AvenantDto>(`/avenants/${id}/prise-en-charge${avenantMotifQuery(motif)}`, { method: "POST" }),
  /** Président ; motif seulement quand l'administrateur se substitue. */
  validation: (id: number, motif?: string | null) =>
    apiFetch<AvenantDto>(`/avenants/${id}/validation${avenantMotifQuery(motif)}`, { method: "POST" }),
  /** DGTCP à l'examen, Président à la validation ; motif obligatoire. */
  rejet: (id: number, motif: string) =>
    apiFetch<AvenantDto>(`/avenants/${id}/rejet${avenantMotifQuery(motif)}`, { method: "POST" }),
  /** DGTCP. Corps uniquement pour un avenant FINANCIER. */
  application: (id: number, body?: ApplicationAvenantRequest) =>
    apiFetch<AvenantDto>(`/avenants/${id}/application`, body ? { method: "POST", body } : { method: "POST" }),
  getDocuments: (id: number) => apiFetch<DocumentAvenantDto[]>(`/avenants/${id}/documents`).then(normalizeDocs),
  /** Dépôt possible seulement tant que l'avenant est DEPOSE. */
  uploadDocument: (id: number, codeDocument: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentAvenantDto>(
      `/avenants/${id}/documents?codeDocument=${encodeURIComponent(codeDocument)}`,
      { method: "POST", rawBody: formData }
    );
  },
};

// ── Reporting API ──

export interface KeyCount { key: string; count: number; }

export interface ReportingDemandeStatsDto {
  byStatut: KeyCount[];
  total: number;
  tauxAdoptionPct: number | null;
  tauxRejetPct: number | null;
}

export interface ReportingAuditStatsDto {
  byAction: KeyCount[];
  topEntityTypes: KeyCount[];
  totalActions: number;
}

export interface CertificatFinancialTotalsDto {
  sumMontantCordon: number;
  sumMontantTvaInterieure: number;
  sumSoldeCordon: number;
  sumSoldeTva: number;
  certificatCount: number;
}

export interface ReportingSummaryDto {
  demandes: ReportingDemandeStatsDto;
  certificatsByStatut: KeyCount[];
  certificatsTotal: number;
  certificatsEnValidationPresident: number;
  utilisationsByStatut: KeyCount[];
  utilisationsByType: KeyCount[];
  utilisationsTotal: number;
  conventionsByStatut: KeyCount[];
  referentielsByStatut: KeyCount[];
  marchesByStatut: KeyCount[];
  transfertsTotal: number;
  sousTraitancesTotal: number;
  audit: ReportingAuditStatsDto;
  certificatFinancials: CertificatFinancialTotalsDto;
  filtersApplied: boolean;
}

export interface TimeSeriesPointDto { period: string; count: number; }

export interface ReportingParams {
  from?: string;
  to?: string;
  autoriteContractanteId?: number;
  entrepriseId?: number;
}

export function buildReportingQuery(params?: ReportingParams): string {
  if (!params) return "";
  const parts: string[] = [];
  if (params.from) parts.push(`from=${encodeURIComponent(params.from)}`);
  if (params.to) parts.push(`to=${encodeURIComponent(params.to)}`);
  if (params.autoriteContractanteId) parts.push(`autoriteContractanteId=${params.autoriteContractanteId}`);
  if (params.entrepriseId) parts.push(`entrepriseId=${params.entrepriseId}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export type EngagementAxe = "AUTORITE_CONTRACTANTE" | "BAILLEUR" | "CONVENTION" | "ENTREPRISE";
export type EngagementFiabilite = "CONFORME" | "EXPLIQUE" | "A_VERIFIER";

type Num = number | null;

/** Ligne d'engagement (le `total` a exactement la même forme, `cle = "TOTAL"`). Aucun recalcul à l'écran. */
export interface EngagementLigneDto {
  /** Peut valoir `HORS_RATTACHEMENT` ou `NON_RENSEIGNE`. */
  cle: string;
  libelle?: string | null;
  nbCertificats?: Num;
  accordeCordonHorsTva?: Num; restantCordonHorsTva?: Num; consommeCordonHorsTva?: Num;
  accordeTvaImport?: Num; restantTvaImport?: Num; consommeTvaImport?: Num;
  accordeTvaInterieure?: Num; restantTvaInterieure?: Num; consommeTvaInterieure?: Num;
  accordeTotal?: Num; restantTotal?: Num;
  /** Le consommé de référence. */
  consommeSoldes?: Num;
  /** Recalcul de contrôle — ne pas présenter comme un second consommé. */
  consommeMouvements?: Num;
  ecartMouvements?: Num;
  nbDossiersRepriseOuCorriges?: Num;
  fiabilite?: EngagementFiabilite | null;
}

export interface EngagementReportDto {
  axe?: EngagementAxe;
  lignes: EngagementLigneDto[];
  total: EngagementLigneDto;
  ecartVentilation?: Num;
  nbEcartVentilation?: Num;
  ecartMouvements?: Num;
  nbRestantSuperieurAccorde?: Num;
  filtersApplied?: unknown;
}

export interface DossierImmobileDto {
  type?: string | null; id?: number | null; reference?: string | null; statut?: string | null;
  dateReference?: string | null;
  /** Vrai : aucune décision, la durée part du dépôt. */
  dateDeRepli?: boolean | null;
  joursDepuisDerniereDecision?: Num;
  entrepriseRaisonSociale?: string | null;
}
export interface DelaiDirectionDto {
  role: string;
  circuit: "CORRECTION" | "CERTIFICAT" | (string & {});
  nbVisas?: Num; delaiMoyenJours?: Num; delaiMaxJours?: Num; nbVisasParAdmin?: Num;
  definitionDelai?: string | null;
}
export interface RejetTempOuvertDto {
  type?: string | null; dossierId?: number | null; reference?: string | null;
  role?: string | null; agentUsername?: string | null; dateDecision?: string | null;
  joursOuvert?: Num; motifRejet?: string | null;
}
export interface BlocagesReportDto {
  seuilImmobiliteJours?: Num;
  definitionAge?: string | null;
  dossiersImmobiles?: DossierImmobileDto[];
  nbDossiersImmobiles?: Num;
  dossiersImmobilesTronques?: boolean;
  rejetsTempOuverts?: RejetTempOuvertDto[];
  nbRejetsTempOuverts?: Num;
  rejetsTempOuvertsTronques?: boolean;
  anciennetePlusVieuxRejetJours?: Num;
  delaisParDirection?: DelaiDirectionDto[];
  filtersApplied?: unknown;
}

export interface AFermerLigneDto {
  type?: "CertificatCredit" | "Convention" | (string & {}) | null;
  id?: number | null; reference?: string | null; statut?: string | null; entrepriseRaisonSociale?: string | null;
  /** Instant ISO (certificats). */
  dateValidite?: string | null;
  /** Date civile « AAAA-MM-JJ » (conventions) — jamais de conversion de fuseau. */
  dateFin?: string | null;
  joursAvantEcheance?: Num;
  restantTotal?: Num;
  joursSansActivite?: Num;
}
export interface AFermerReportDto {
  horizonEcheanceJours?: Num; seuilDormanceJours?: Num; definitionDormance?: string | null;
  equipementsNonRenseignes?: Num;
  montantImmobiliseExpires?: Num;
  filtersApplied?: unknown;
  certificatsExpiresAvecSolde?: AFermerLigneDto[]; nbCertificatsExpiresAvecSolde?: Num; certificatsExpiresTronques?: boolean;
  certificatsExpirantProchainement?: AFermerLigneDto[]; nbCertificatsExpirantProchainement?: Num;
  certificatsSansDateValidite?: AFermerLigneDto[]; nbCertificatsSansDateValidite?: Num;
  conventionsAEcheance?: AFermerLigneDto[]; nbConventionsAEcheance?: Num;
  equipementsSurCreditOuvert?: AFermerLigneDto[]; nbEquipementsSurCreditOuvert?: Num;
  creditsDormants?: AFermerLigneDto[]; nbCreditsDormants?: Num; creditsDormantsTronques?: boolean;
}

export const withExtra = (params: ReportingParams | undefined, extra: Record<string, string | number | undefined>) => {
  const base = buildReportingQuery(params);
  const parts = Object.entries(extra).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  if (!parts.length) return base;
  return base ? `${base}&${parts.join("&")}` : `?${parts.join("&")}`;
};

export type ProductionGranularite = "MOIS" | "TRIMESTRE";
export interface ProductionPointDto {
  periode: string;
  nbDemandes: number | null;
  nbCertificats: number | null;
  nbUtilisations: number | null;
  masseAccordee: number | null;
  consommeMouvementsPeriode: number | null;
}
export interface ProductionReportDto {
  granularite: ProductionGranularite;
  points: ProductionPointDto[];
  cleDatation: string | null;
  totalDemandes: number | null;
  totalCertificats: number | null;
  totalUtilisations: number | null;
  totalMasseAccordee: number | null;
  totalConsommeMouvements: number | null;
  precedentDemandes: number | null;
  precedentCertificats: number | null;
  precedentMasseAccordee: number | null;
  variationDemandesPct: number | null;
  variationCertificatsPct: number | null;
  variationMassePct: number | null;
  filtersApplied?: boolean;
}
export type ReportingExportFormat = "xlsx" | "csv" | "pdf";
/** IMPACT / BENEFICIAIRES / SATISFACTION : exports par onglet seulement (SATISFACTION : feedback.dashboard.view). */
export type ReportingBloc = "ENGAGEMENT" | "BLOCAGES" | "A_FERMER" | "PRODUCTION" | "IMPACT" | "BENEFICIAIRES" | "SATISFACTION";
export const REPORTING_BLOCS: ReportingBloc[] = ["ENGAGEMENT", "BLOCAGES", "A_FERMER", "PRODUCTION"];

/** Télécharge un export serveur tel quel (fichier, jamais lu comme JSON). */
export async function downloadReportingExport(format: ReportingExportFormat, params?: ReportingParams, blocs?: ReportingBloc[]) {
  const query = withExtra(params, { blocs: blocs && blocs.length ? blocs.join(",") : undefined });
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/reporting/export.${format}${query}`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 && token) endSession({ redirect: true });
    throw new ApiRequestError(parseApiErrorBody(res.status, text));
  }
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const d = new Date();
  const fallback = `reporting-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.${format}`;
  const filename = m ? decodeURIComponent(m[1]) : fallback;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===================== FEEDBACK & SATISFACTION =====================
export type FeedbackCategorie = "ERGONOMIE" | "PERFORMANCE" | "PROCEDURE" | "ASSISTANCE" | "AUTRE";
export const FEEDBACK_CATEGORIES: FeedbackCategorie[] = ["ERGONOMIE", "PERFORMANCE", "PROCEDURE", "ASSISTANCE", "AUTRE"];
export type ProfilCible = "ENTREPRISE" | "COMMISSION_FISCALE" | "AUTORITE_CONTRACTANTE" | "DOUANES" | "TRESOR";
export const PROFILS_CIBLES: ProfilCible[] = ["ENTREPRISE", "COMMISSION_FISCALE", "AUTORITE_CONTRACTANTE", "DOUANES", "TRESOR"];
export type QuestionEnqueteType = "NOTE" | "TEXTE" | "CHOIX";
export type EnqueteStatut = "BROUILLON" | "PUBLIEE" | "CLOTUREE";

/** POST /feedback/retours — permission feedback.submit. */
export interface RetourFeedbackRequest {
  note: number;
  categorie: FeedbackCategorie;
  processus?: string | null;
  page?: string | null;
  commentaire?: string | null;
}
export interface EnqueteQuestionDto {
  id: number;
  ordre: number;
  libelle: string;
  type: QuestionEnqueteType;
  categorie?: string | null;
  options?: string[] | null;
  obligatoire?: boolean | null;
}
export interface EnqueteDto {
  id: number;
  titre: string;
  description?: string | null;
  dateDebut: string;
  dateFin: string;
  profilsCibles: ProfilCible[];
  statut: EnqueteStatut;
  ouverte?: boolean;
  datePublication?: string | null;
  enqueteOrigineId?: number | null;
  questions: EnqueteQuestionDto[];
  nbReponses?: number | null;
}
export interface EnqueteQuestionRequest {
  libelle: string;
  type: QuestionEnqueteType;
  categorie?: string | null;
  /** Au moins deux options pour CHOIX. */
  options?: string[] | null;
  obligatoire?: boolean;
}
export interface EnqueteRequest {
  titre: string;
  description?: string | null;
  dateDebut: string;
  dateFin: string;
  profilsCibles: ProfilCible[];
  questions: EnqueteQuestionRequest[];
}
export interface ReponseEnqueteRequest {
  reponses: { questionId: number; note?: number | null; texte?: string | null }[];
}
export interface SatisfactionLigneDto {
  cle: string;
  libelle: string;
  nbNotes: number | null;
  noteMoyenne: number | null;
  /** Nombre de notes 1 à 5. */
  distribution: number[] | null;
  satisfaitsPct: number | null;
}
export interface SatisfactionEnqueteDto {
  enqueteId: number;
  titre: string;
  dateDebut: string;
  dateFin: string;
  statut: EnqueteStatut;
  nbReponses: number | null;
  nbCibles: number | null;
  tauxReponsePct: number | null;
  noteMoyenne: number | null;
  parQuestion?: SatisfactionLigneDto[] | null;
  parProfil?: SatisfactionLigneDto[] | null;
}
export interface SatisfactionCommentaireDto {
  profil: string | null;
  categorie: string | null;
  note: number | null;
  texte: string;
  source: string | null;
  date: string | null;
}
export interface FeedbackTableauDeBordDto {
  nbAvis: number | null;
  noteMoyenne: number | null;
  satisfaitsPct: number | null;
  parProfil: SatisfactionLigneDto[];
  parCategorie: SatisfactionLigneDto[];
  parProcessus: SatisfactionLigneDto[];
  pointsForts: SatisfactionLigneDto[];
  difficultes: SatisfactionLigneDto[];
  evolution: { periode: string; nbNotes: number | null; noteMoyenne: number | null }[];
  enquetes: SatisfactionEnqueteDto[];
  /** Sans nom d'auteur. */
  commentaires: SatisfactionCommentaireDto[];
}

export const dateRangeQuery = (from?: string, to?: string) => {
  const parts = [from ? `from=${encodeURIComponent(from)}` : "", to ? `to=${encodeURIComponent(to)}` : ""].filter(Boolean);
  return parts.length ? `?${parts.join("&")}` : "";
};

