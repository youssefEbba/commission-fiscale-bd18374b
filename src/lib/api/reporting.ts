import { apiFetch } from "./client";
import {
  buildReportingQuery,
  dateRangeQuery,
  downloadReportingExport,
  withExtra,
  type AFermerReportDto,
  type BlocagesReportDto,
  type EngagementAxe,
  type EngagementReportDto,
  type FeedbackTableauDeBordDto,
  type ProductionGranularite,
  type ProductionReportDto,
  type ReportingBloc,
  type ReportingExportFormat,
  type ReportingParams,
  type ReportingSummaryDto,
  type TimeSeriesPointDto,
} from "./mouvements";
import { API_BASE } from "../apiConfig";
import type { EnqueteDto, EnqueteRequest, ReponseEnqueteRequest, RetourFeedbackRequest } from "./mouvements";
export const feedbackApi = {
  envoyerRetour: (body: RetourFeedbackRequest) => apiFetch<unknown>("/feedback/retours", { method: "POST", body }),
  /** Enquêtes ouvertes à mon profil, non encore répondues (feedback.submit). */
  enquetesEnCours: () => apiFetch<EnqueteDto[]>("/feedback/enquetes/en-cours", { skipAuthRedirect: true }),
  /** 409 = déjà répondu ; 403 = profil non ciblé. */
  repondre: (id: number, body: ReponseEnqueteRequest) => apiFetch<unknown>(`/feedback/enquetes/${id}/reponses`, { method: "POST", body }),
  // Gestion (feedback.enquete.manage)
  list: () => apiFetch<EnqueteDto[]>("/feedback/enquetes"),
  get: (id: number) => apiFetch<EnqueteDto>(`/feedback/enquetes/${id}`),
  create: (body: EnqueteRequest) => apiFetch<EnqueteDto>("/feedback/enquetes", { method: "POST", body }),
  /** Seulement en BROUILLON. */
  update: (id: number, body: EnqueteRequest) => apiFetch<EnqueteDto>(`/feedback/enquetes/${id}`, { method: "PUT", body }),
  /** Seulement en BROUILLON. */
  delete: (id: number) => apiFetch<void>(`/feedback/enquetes/${id}`, { method: "DELETE" }),
  publier: (id: number) => apiFetch<EnqueteDto>(`/feedback/enquetes/${id}/publier`, { method: "POST" }),
  cloturer: (id: number) => apiFetch<EnqueteDto>(`/feedback/enquetes/${id}/cloturer`, { method: "POST" }),
  relancer: (id: number, body: { dateDebut: string; dateFin: string }) => apiFetch<EnqueteDto>(`/feedback/enquetes/${id}/relancer`, { method: "POST", body }),
  /** feedback.dashboard.view */
  tableauDeBord: (from?: string, to?: string) => apiFetch<FeedbackTableauDeBordDto>(`/feedback/tableau-de-bord${dateRangeQuery(from, to)}`, { skipAuthRedirect: true }),
};

// ===================== MAIN COURANTE =====================
export type MainCouranteProcessus = "CORRECTION" | "MISE_EN_PLACE" | "TRANSFERT" | "CLOTURE" | "REJET_TEMPORAIRE" | string;
export interface MainCouranteLigneDto {
  processus: MainCouranteProcessus;
  type: string;
  id: number;
  reference?: string | null;
  statut?: string | null;
  entrepriseRaisonSociale?: string | null;
  action: string;
  dateReference?: string | null;
  joursDAttente?: number | null;
}
/** Forme exacte non figée : chaîne ou objet { processus, raison }. */
export type MainCouranteNonCouvert = string | { processus?: string; raison?: string; message?: string };
export interface MainCouranteDto {
  lignes: MainCouranteLigneDto[];
  total: number;
  parProcessus: Record<string, number>;
  processusCouverts: string[];
  processusNonCouverts: MainCouranteNonCouvert[];
  definitionAttente: string;
  tronquee: boolean;
}
export const mainCouranteApi = {
  get: () => apiFetch<MainCouranteDto>("/main-courante"),
};

// ── Indicateurs d'impact (GET /reporting/impact) — valeurs nulles = « n/d », jamais 0 ──
export type ImpactProcessusCode = "CORRECTION" | "MISE_EN_PLACE" | "UTILISATION_TVA" | "UTILISATION_DOUANE" | "TRANSFERT" | "AVENANT";
export interface ImpactProcessusDto {
  code: ImpactProcessusCode | string;
  libelle: string;
  deposes: number | null;
  traites: number | null;
  valides: number | null;
  rejetes: number | null;
  avecComplements: number | null;
  tauxValidationPct: number | null;
  tauxRejetPct: number | null;
  tauxComplementsPct: number | null;
  delaiReponseComplementsJours: number | null;
}
export interface ImpactPhaseDto {
  processus: string;
  phase: string;
  nbDossiers: number | null;
  moyenneJours: number | null;
  medianeJours: number | null;
}
export interface ImpactMontantsDto {
  demandes: number | null;
  retenus: number | null;
  valides: number | null;
  consommes: number | null;
  ajustes: number | null;
  annules: number | null;
  clotures: number | null;
}
export interface ImpactTauxUtilisationDto {
  accordeTvaInterieure: number | null;
  consommeTvaInterieure: number | null;
  tvaInterieurePct: number | null;
  accordeDouane: number | null;
  consommeDouane: number | null;
  douanePct: number | null;
  globalPct: number | null;
}
export interface ImpactAvantApresDto {
  code: string;
  libelle: string;
  unite: string | null;
  avant: number | null;
  apres: number | null;
  variationPct: number | null;
  sourceAvant: string | null;
  periodeAvant: string | null;
}
export interface ImpactReportDto {
  from: string | null;
  to: string | null;
  /** Réglage `digitalisation.date_bascule` (AAAA-MM-JJ) ; null si non renseigné. */
  dateBascule: string | null;
  definitions: string[];
  processus: ImpactProcessusDto[];
  phases: ImpactPhaseDto[];
  montants: ImpactMontantsDto | null;
  tauxUtilisation: ImpactTauxUtilisationDto | null;
  avantApres: ImpactAvantApresDto[];
}
/** Valeur de référence « avant digitalisation » (tous les indicateurs, saisis ou non). */
export interface ReportingReferenceDto {
  id: number | null;
  code: string;
  libelle: string;
  unite: string | null;
  valeur: number | null;
  periodeSource: string | null;
  commentaire: string | null;
  dateSaisie: string | null;
}
export interface SaveReportingReferenceRequest {
  code: string;
  valeur: number;
  periodeSource?: string | null;
  commentaire?: string | null;
}

// ── Bénéficiaires (GET /reporting/beneficiaires) ──
export interface BeneficiairesLigneDto {
  cle: string;
  libelle: string;
  nbBeneficiaires: number | null;
  nbCredits: number | null;
  montantAccorde: number | null;
  montantConsomme: number | null;
}
export interface BeneficiairesAnneeDto {
  annee: number;
  nouveauxBeneficiaires: number | null;
  beneficiaires: number | null;
  nbCredits: number | null;
  montantAccorde: number | null;
  montantConsomme: number | null;
}
export interface BeneficiairesReportDto {
  from: string | null;
  to: string | null;
  totalBeneficiaires: number | null;
  totalCredits: number | null;
  montantAccorde: number | null;
  montantConsomme: number | null;
  definitions: string[];
  parNature: BeneficiairesLigneDto[];
  parCategorie: BeneficiairesLigneDto[];
  parSecteur: BeneficiairesLigneDto[];
  parFinancement: BeneficiairesLigneDto[];
  parAnnee: BeneficiairesAnneeDto[];
}

export const reportingApi = {
  getImpact: (params?: ReportingParams) => apiFetch<ImpactReportDto>(`/reporting/impact${buildReportingQuery(params)}`, { skipAuthRedirect: true }),
  getBeneficiaires: (params?: ReportingParams) => apiFetch<BeneficiairesReportDto>(`/reporting/beneficiaires${buildReportingQuery(params)}`, { skipAuthRedirect: true }),
  getReferences: () => apiFetch<ReportingReferenceDto[]>("/reporting/references"),
  /** reporting.reference.manage — crée ou remplace la valeur du code. */
  saveReference: (body: SaveReportingReferenceRequest) => apiFetch<ReportingReferenceDto>("/reporting/references", { method: "PUT", body }),
  deleteReference: (code: string) => apiFetch<void>(`/reporting/references/${encodeURIComponent(code)}`, { method: "DELETE" }),
  getProduction: (params?: ReportingParams, granularite?: ProductionGranularite) => apiFetch<ProductionReportDto>(`/reporting/production${withExtra(params, { granularite })}`, { skipAuthRedirect: true }),
  downloadExport: downloadReportingExport,
  getEngagement: (params?: ReportingParams, axe?: EngagementAxe) => apiFetch<EngagementReportDto>(`/reporting/engagement${withExtra(params, { axe })}`, { skipAuthRedirect: true }),
  getBlocages: (params?: ReportingParams, seuilJours?: number) => apiFetch<BlocagesReportDto>(`/reporting/blocages${withExtra(params, { seuilJours })}`, { skipAuthRedirect: true }),
  getAFermer: (params?: ReportingParams, horizonJours?: number, dormanceJours?: number) => apiFetch<AFermerReportDto>(`/reporting/a-fermer${withExtra(params, { horizonJours, dormanceJours })}`, { skipAuthRedirect: true }),
  getSummary: (params?: ReportingParams) => apiFetch<ReportingSummaryDto>(`/reporting/summary${buildReportingQuery(params)}`, { skipAuthRedirect: true }),
  getDemandesTimeseries: (params?: ReportingParams) => apiFetch<TimeSeriesPointDto[]>(`/reporting/timeseries/demandes${buildReportingQuery(params)}`, { skipAuthRedirect: true }),
};

export { WS_BASE } from "../apiConfig";

// ── Référentiel des Taxes (admin: ADMIN_SI) ──
export interface ReferentielTaxeDto {
  id: number;
  codeTaxe: string;
  denominationTaxe: string;
  valeurTaxe?: number | null;
  ordreAffichage?: number | null;
  active: boolean;
  dateCreation?: string;
  dateModification?: string | null;
}

export interface ReferentielTaxeRequest {
  codeTaxe: string;
  denominationTaxe: string;
  valeurTaxe?: number | null;
  ordreAffichage?: number | null;
  active?: boolean;
}

export const referentielTaxeApi = {
  /** Taxes actives — pour remplir le formulaire du bulletin */
  getActives: () => apiFetch<ReferentielTaxeDto[]>("/referentiel-taxes"),
  getById: (id: number) => apiFetch<ReferentielTaxeDto>(`/referentiel-taxes/${id}`),
  /** Toutes les taxes (actives + inactives) — admin */
  getAll: () => apiFetch<ReferentielTaxeDto[]>("/referentiel-taxes/all"),
  create: (data: ReferentielTaxeRequest) =>
    apiFetch<ReferentielTaxeDto>("/referentiel-taxes", { method: "POST", body: data }),
  update: (id: number, data: ReferentielTaxeRequest) =>
    apiFetch<ReferentielTaxeDto>(`/referentiel-taxes/${id}`, { method: "PUT", body: data }),
  desactiver: (id: number) =>
    apiFetch<ReferentielTaxeDto>(`/referentiel-taxes/${id}/desactiver`, { method: "POST" }),
  activer: (id: number) =>
    apiFetch<ReferentielTaxeDto>(`/referentiel-taxes/${id}/activer`, { method: "POST" }),
  remove: (id: number) =>
    apiFetch<void>(`/referentiel-taxes/${id}`, { method: "DELETE" }),
};

// ── Dossiers GED ──

export interface DossierDocumentGed {
  id: number;
  nom: string;
  type: string;
  codeDocument?: string;
  dateUpload?: string;
  taille?: number;
  url?: string;
  version?: number;
  actif?: boolean;
  versionCourante?: boolean;
  injectionPresident?: boolean;
}

export interface DossierEtapeGed {
  etape: string;
  label: string;
  documents: DossierDocumentGed[];
}

export interface DossierGedDto {
  id: number;
  reference: string;
  entrepriseId: number;
  entrepriseRaisonSociale?: string;
  demandeCorrectionId: number;
  demandeCorrectionNumero?: string;
  autoriteContractanteId?: number;
  autoriteContractanteNom?: string;
  marcheId?: number;
  marcheNumero?: string;
  marcheIntitule?: string;
  certificatId?: number;
  dateCreation: string;
  etapes: DossierEtapeGed[];
}

// NOTE: l'endpoint POST /api/dossiers/{id}/documents (injection GED Président)
// a été supprimé côté backend. Le Président dépose désormais ses pièces via les
// fiches métier (correction → LETTRE_ADOPTION, certificat → signature, etc.).
// L'écran dossier GED est en lecture seule.

export const dossierGedApi = {
  getAll: () => apiFetch<DossierGedDto[]>("/dossiers"),
  getById: (id: number) => apiFetch<DossierGedDto>(`/dossiers/${id}`),
};

// ============================================================
// Signatures (images PNG des signataires)
// ============================================================

export type SignatureType = "SIGNATURE" | "CACHET";
export type ModeApposition = "MANUSCRIT_SCANNE" | "APPOSE_SYSTEME";

export interface MesEmpreintesDto {
  signature: SignatureDto | null;
  cachet: SignatureDto | null;
  signatureDataUrl: string | null;
  cachetDataUrl: string | null;
  cachetGeneriqueDuRole?: boolean;
  /** Vrai = empreinte enregistrée mais image illisible (stockage des documents indisponible). */
  contenuIndisponible?: boolean;
}

export interface SignatureDto {
  id: number;
  type?: SignatureType;
  utilisateurId?: number | null;
  utilisateurNom?: string | null;
  role: string;
  nomAffiche?: string | null;
  contentType?: string;
  taille?: number;
  largeurPx?: number;
  hauteurPx?: number;
  checksumSha256?: string;
  active: boolean;
  version?: number;
  dateCreation?: string;
  creePar?: string;
  dateDesactivation?: string | null;
}

export interface SignatureListFilters {
  type?: SignatureType;
  role?: string;
  utilisateurId?: number;
  activeOnly?: boolean;
}

/** Contraintes de validation alignées sur le backend. */
export const SIGNATURE_CONSTRAINTS = {
  maxBytes: 1024 * 1024,
  maxWidth: 2000,
  maxHeight: 1000,
  mimeType: "image/png",
} as const;

export const signatureApi = {
  list: (filters: SignatureListFilters = {}) => {
    const p = new URLSearchParams();
    if (filters.type) p.set("type", filters.type);
    if (filters.role) p.set("role", filters.role);
    if (filters.utilisateurId != null) p.set("utilisateurId", String(filters.utilisateurId));
    if (filters.activeOnly != null) p.set("activeOnly", String(filters.activeOnly));
    const qs = p.toString();
    return apiFetch<SignatureDto[]>(`/signatures${qs ? `?${qs}` : ""}`);
  },
  getActive: (role: string, utilisateurId?: number, type?: SignatureType) => {
    const p = new URLSearchParams({ role });
    if (utilisateurId != null) p.set("utilisateurId", String(utilisateurId));
    if (type) p.set("type", type);
    return apiFetch<SignatureDto>(`/signatures/active?${p.toString()}`, { skipAuthRedirect: true });
  },
  getBase64: (id: number) =>
    apiFetch<{ dataUrl: string }>(`/signatures/${id}/base64`, { skipAuthRedirect: true }),
  contentUrl: (id: number) => `${API_BASE}/signatures/${id}/content`,
  /** Empreintes (signature + cachet) de l'utilisateur connecté, avec repli sur l'empreinte générique du rôle. */
  me: (withContent = false) =>
    apiFetch<MesEmpreintesDto>(`/signatures/me?withContent=${withContent}`, { skipAuthRedirect: true }),
  /** Dépôt depuis le profil : rôle et utilisateur déduits du jeton. */
  createMe: (params: { file: File; type?: SignatureType; nomAffiche?: string }) => {
    const fd = new FormData();
    fd.append("file", params.file);
    if (params.type) fd.append("type", params.type);
    if (params.nomAffiche) fd.append("nomAffiche", params.nomAffiche);
    return apiFetch<SignatureDto>("/signatures/me", { method: "POST", rawBody: fd });
  },
  create: (params: { file: File; role: string; utilisateurId?: number; nomAffiche?: string; activer?: boolean; type?: SignatureType }) => {
    const fd = new FormData();
    fd.append("file", params.file);
    if (params.type) fd.append("type", params.type);
    fd.append("role", params.role);
    if (params.utilisateurId != null) fd.append("utilisateurId", String(params.utilisateurId));
    if (params.nomAffiche) fd.append("nomAffiche", params.nomAffiche);
    if (params.activer != null) fd.append("activer", String(params.activer));
    return apiFetch<SignatureDto>("/signatures", { method: "POST", rawBody: fd });
  },
  update: (id: number, data: { nomAffiche?: string; active?: boolean }) =>
    apiFetch<SignatureDto>(`/signatures/${id}`, { method: "PUT", body: data }),
  remplacer: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch<SignatureDto>(`/signatures/${id}/remplacer`, { method: "POST", rawBody: fd });
  },
  desactiver: (id: number) => apiFetch<void>(`/signatures/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Reprise d'archive — relevés de crédit d'impôt de l'ancienne application
// ---------------------------------------------------------------------------
export type AffectationTaxeArchive = "AU_CI" | "A_PAYER";

export interface ArchiveLigneTaxeDto {
  codeTaxe: string;
  denominationTaxe: string | null;
  valeur: number;
  affectation: AffectationTaxeArchive;
}

export interface ArchiveUtilisationDto {
  libelle: string;
  numeroQuittance: string | null;
  date: string | null;
  douaniere: boolean;
  montant: number;
  totalPrisEnCharge: number | null;
  totalAPayer: number | null;
  lignesTaxe: ArchiveLigneTaxeDto[];
}

export interface ArchiveCreditPreviewDto {
  nomFichier: string;
  nif: string;
  referenceMarche: string;
  numeroCredit: string;
  dateCredit: string;
  montantMarche: number;
  creditDouanier: number;
  creditInterieur: number;
  montantCreditImpot: number;
  transfertCredit: number;
  soldeDouanierDeclare: number;
  soldeInterieurDeclare: number;
  soldeDouanierCalcule: number;
  soldeInterieurCalcule: number;
  totalUtilisationsDouane: number;
  totalUtilisationsInterieur: number;
  totalTransfertSortant: number | null;
  utilisations: ArchiveUtilisationDto[];
  anomalies: string[];
  entrepriseRapprocheeId: number | null;
  entrepriseRapprocheeRaisonSociale: string | null;
  entrepriseRapprocheeSource: "NIF" | null;
  marcheRapprocheId: number | null;
  marcheRapprocheNumero: string | null;
  marcheRapprocheIntitule: string | null;
  autoriteRapprocheeId: number | null;
  autoriteRapprocheeNom: string | null;
  certificatDejaImporteId: number | null;
  certificatDejaImporteReference: string | null;
}

export interface ArchiveCreditImportResultDto {
  certificatId: number;
  certificatNumero: string;
  certificatStatut: string;
  entrepriseId: number;
  entrepriseRaisonSociale: string;
  utilisationsDouanieres: number;
  utilisationsInterieures: number;
  lignesTaxeCreees: number;
  soldeCordon: number;
  soldeTVA: number;
  anomalies: string[];
  /** true quand le relevé a complété un certificat existant au lieu d'en créer un. */
  certificatDejaExistant?: boolean;
  /** Lignes du relevé déjà présentes en base, non réinsérées. */
  utilisationsIgnorees?: number;
  /** Dossier d'archive créé (demande de correction NOTIFIEE, visas acquis). */
  demandeCorrectionId?: number | null;
  demandeCorrectionNumero?: string | null;
  autoriteContractanteId?: number | null;
  conventionId?: number | null;
  marcheId?: number | null;
  /** Transfert de crédit enregistré comme exécuté lors de l'import. */
  transfertCreditId?: number | null;
  transfertCreditMontant?: number | null;
}

export const archiveCreditApi = {
  previsualiser: (fichier: File) => {
    const fd = new FormData();
    fd.append("fichier", fichier);
    return apiFetch<ArchiveCreditPreviewDto>("/archive/credits/previsualiser", { method: "POST", rawBody: fd });
  },
  importer: (params: {
    fichier: File;
    entrepriseId: number;
    autoriteContractanteId: number;
    conventionId: number;
    marcheId?: number | null;
    confirmerMalgreAnomalies?: boolean;
  }) => {
    const fd = new FormData();
    fd.append("fichier", params.fichier);
    fd.append("entrepriseId", String(params.entrepriseId));
    fd.append("autoriteContractanteId", String(params.autoriteContractanteId));
    fd.append("conventionId", String(params.conventionId));
    if (params.marcheId != null) fd.append("marcheId", String(params.marcheId));
    fd.append("confirmerMalgreAnomalies", String(!!params.confirmerMalgreAnomalies));
    return apiFetch<ArchiveCreditImportResultDto>("/archive/credits/importer", { method: "POST", rawBody: fd });
  },
  codesTaxe: () => apiFetch<string[]>("/archive/credits/codes-taxe"),
};

export type ArchiveLotCreditStatut = "A_COMPLETER" | "PRET" | "IMPORTE" | "ERREUR" | "IGNORE";
/** Ce qui manque à un crédit de lot pour être prêt (le N° et la date quand le fichier ne les donne pas). */
export type ArchiveLotManquant = "ENTREPRISE" | "AUTORITE" | "CONVENTION" | "MARCHE" | "ANOMALIES" | "NUMERO" | "DATE";
export const ARCHIVE_LOT_STATUTS: readonly ArchiveLotCreditStatut[] = [
  "A_COMPLETER", "PRET", "IMPORTE", "ERREUR", "IGNORE",
];
export type ArchiveLotSource = "NIF" | "CREE" | "MANUEL" | string;

export interface ArchiveLotCreditDto {
  id: number;
  ordre: number;
  ligneDebut: number | null;
  ligneFin: number | null;
  numeroCredit: string | null;
  nif: string | null;
  referenceMarche: string | null;
  numeroMarche: string | null;
  dateMarche: string | null;
  dureeMarche: string | null;
  dateCredit: string | null;
  montantMarche: number | null;
  montantCreditImpot: number | null;
  creditDouanier: number | null;
  creditInterieur: number | null;
  transfertCredit: number | null;
  totalUtilisationsDouane?: number | null;
  totalUtilisationsInterieur?: number | null;
  sortieTransfert?: number | null;
  soldeDouanierCalcule: number | null;
  soldeInterieurCalcule: number | null;
  soldeDouanierDeclare: number | null;
  soldeInterieurDeclare: number | null;
  nbUtilisations: number;
  anomalies: string[];
  entrepriseId: number | null;
  entrepriseRaisonSociale: string | null;
  sourceEntreprise: ArchiveLotSource | null;
  autoriteContractanteId: number | null;
  autoriteContractanteNom: string | null;
  sourceAutorite: ArchiveLotSource | null;
  conventionId: number | null;
  conventionIntitule: string | null;
  sourceConvention: ArchiveLotSource | null;
  marcheId: number | null;
  marcheNumero: string | null;
  sourceMarche: ArchiveLotSource | null;
  creerMarche: boolean;
  confirmerMalgreAnomalies: boolean;
  raisonSocialeDgi: string | null;
  nomCommercialDgi: string | null;
  etatDgi: string | null;
  inconnuDgi: boolean;
  dejaRepris: boolean;
  statut: ArchiveLotCreditStatut;
  manquants: ArchiveLotManquant[];
  certificatId: number | null;
  certificatReference: string | null;
  messageErreur: string | null;
  dateImport: string | null;
}

export interface ArchiveLotDto {
  id: number;
  nomFichier: string;
  dateAnalyse?: string;
  analyseParNom?: string | null;
  nbCredits: number;
  parStatut?: Partial<Record<ArchiveLotCreditStatut, number>>;
  nifsSansEntreprise: number;
  nifsAInterrogerDgi: number;
  dejaAnalyse?: boolean;
  credits?: ArchiveLotCreditDto[];
}

export interface ArchiveLotAffectationRequest {
  creditIds?: number[];
  nif?: string;
  entrepriseId?: number | null;
  autoriteContractanteId?: number | null;
  conventionId?: number | null;
  marcheId?: number | null;
  creerMarche?: boolean;
  confirmerMalgreAnomalies?: boolean;
  ignorer?: boolean;
  numeroCredit?: string;
  dateCredit?: string;
}

export interface ArchiveLotImportResultatDto {
  importes: number;
  erreurs: number;
  nonPrets: number;
  credits?: ArchiveLotCreditDto[];
}

export const archiveLotApi = {
  analyser: (fichier: File) => {
    const fd = new FormData();
    fd.append("fichier", fichier);
    return apiFetch<ArchiveLotDto>("/archive/lots", { method: "POST", rawBody: fd });
  },
  getAll: () => apiFetch<ArchiveLotDto[]>("/archive/lots"),
  getById: (id: number) => apiFetch<ArchiveLotDto>(`/archive/lots/${id}`),
  getCredit: (lotId: number, creditId: number) =>
    apiFetch<{ credit: ArchiveLotCreditDto; releve: ArchiveCreditPreviewDto }>(
      `/archive/lots/${lotId}/credits/${creditId}`,
    ),
  affecter: (lotId: number, body: ArchiveLotAffectationRequest) =>
    apiFetch<ArchiveLotDto>(`/archive/lots/${lotId}/credits`, { method: "PATCH", body }),
  rapprocher: (id: number) => apiFetch<ArchiveLotDto>(`/archive/lots/${id}/rapprocher`, { method: "POST" }),
  interrogerDgi: (id: number) => apiFetch<ArchiveLotDto>(`/archive/lots/${id}/dgi`, { method: "POST" }),
  importer: (id: number, creditIds: number[]) =>
    apiFetch<ArchiveLotImportResultatDto>(`/archive/lots/${id}/importer`, { method: "POST", body: { creditIds } }),
  delete: (id: number) => apiFetch<void>(`/archive/lots/${id}`, { method: "DELETE" }),
};


// ============= Paramètres applicatifs =============
/** Réponse plate de `GET /api/public/parametres` : uniquement les clés de la liste blanche serveur. */
export type ParametresPublics = Record<string, string>;

export interface ParametreDto {
  cle: string;
  valeur: string | null;
  /** Libellé à afficher (jamais la clé). */
  description?: string | null;
  dateModification?: string | null;
  publique: boolean;
}

export const PARAMETRE_VALEUR_MAX = 512;

