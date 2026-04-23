import { API_BASE } from "./apiConfig";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  rawBody?: FormData;
  skipAuthRedirect?: boolean;
}

// Structured error from the backend (GlobalExceptionHandler)
export interface ApiError {
  timestamp?: string;
  status: number;
  code: string;
  message: string;
  error?: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(apiError: ApiError) {
    super(apiError.message || apiError.error || `Erreur ${apiError.status}`);
    this.name = "ApiRequestError";
    this.status = apiError.status;
    this.code = apiError.code;
    this.details = apiError.details;
  }
}

// Known backend error codes
export const ApiErrorCode = {
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  ACCESS_DENIED: "ACCESS_DENIED",
  ROLE_FORBIDDEN: "ROLE_FORBIDDEN",
  CONFLICT: "CONFLICT",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  WORKFLOW_TRANSITION_INVALID: "WORKFLOW_TRANSITION_INVALID",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  STORAGE_UPLOAD_FAILED: "STORAGE_UPLOAD_FAILED",
  OBJECT_STORAGE_UNAVAILABLE: "OBJECT_STORAGE_UNAVAILABLE",
  EXTERNAL_EXCHANGE_SERVICE_UNAVAILABLE: "EXTERNAL_EXCHANGE_SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  // Codes métier marché / correction
  MARCHE_HORS_PERIMETRE_AC: "MARCHE_HORS_PERIMETRE_AC",
  MARCHE_DEJA_LIE_CORRECTION: "MARCHE_DEJA_LIE_CORRECTION",
  MARCHE_DEMANDE_ACTIVE: "MARCHE_DEMANDE_ACTIVE",
  // Brouillon / édition
  DEMANDE_NON_EDITABLE: "DEMANDE_NON_EDITABLE",
} as const;

/** Extrait un code métier depuis details.code (fallback sur err.code). */
export function getApiErrorBusinessCode(err: unknown): string | undefined {
  if (!isApiError(err)) return undefined;
  const detailsCode = (err.details && typeof err.details === "object" && (err.details as any).code) || undefined;
  return detailsCode || err.code;
}

/** Construit un message utilisateur lisible à partir d'une erreur API. */
export function formatApiErrorMessage(err: unknown, fallback = "Une erreur est survenue"): string {
  if (!isApiError(err)) return (err as Error)?.message || fallback;
  const code = getApiErrorBusinessCode(err);
  switch (code) {
    case "MARCHE_HORS_PERIMETRE_AC":
      return "Ce marché n'appartient pas à votre Autorité Contractante.";
    case "MARCHE_DEJA_LIE_CORRECTION":
    case "MARCHE_DEMANDE_ACTIVE":
      return "Ce marché est déjà associé à une demande de correction active.";
    default:
      return err.message || fallback;
  }
}

export function isApiError(err: unknown): err is ApiRequestError {
  return err instanceof ApiRequestError;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem("auth_token");

  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
    ...options.headers,
  };

  if (!options.rawBody) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.rawBody ? options.rawBody : options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    // Try to parse structured error response
    const text = await res.text().catch(() => "");
    let apiError: ApiError | null = null;
    if (text) {
      try {
        const json = JSON.parse(text);
        if (json.code && json.message) {
          apiError = json as ApiError;
        } else {
          // Legacy format: build a pseudo ApiError
          const msg = json.message || json.error || `Erreur ${res.status}`;
          apiError = { status: res.status, code: "UNKNOWN", message: msg };
        }
      } catch {
        if (text.length < 200 && !text.startsWith("<")) {
          apiError = { status: res.status, code: "UNKNOWN", message: text };
        }
      }
    }
    if (!apiError) {
      apiError = { status: res.status, code: "UNKNOWN", message: `Erreur ${res.status}` };
    }

    // Auth redirect on 401
    if (res.status === 401 && !options.skipAuthRedirect) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      window.location.href = "/login";
      throw new ApiRequestError(apiError);
    }

    throw new ApiRequestError(apiError);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export interface LoginRequest { username: string; password: string; }
export interface RegisterRequest { username: string; password: string; role: string; nomComplet?: string; email?: string; entrepriseId?: number; entrepriseRaisonSociale?: string; entrepriseNif?: string; entrepriseAdresse?: string; entrepriseSituationFiscale?: string; autoriteContractanteId?: number; }
export interface LoginResponse { token: string; type: string; userId: number; username: string; role: string; nomComplet: string; autoriteContractanteId?: number; entrepriseId?: number; permissions?: string[]; impersonating?: boolean; actingEntrepriseId?: number; actingAutoriteContractanteId?: number; }

// Commission Relais (impersonation)
export interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; number: number; size: number; }
export interface RelaisEntrepriseDto { id: number; raisonSociale: string; nif?: string; actif?: boolean; }
export interface RelaisAutoriteDto { id: number; nom: string; sigle?: string; actif?: boolean; }

export const commissionRelaisApi = {
  listEntreprises: (page = 0, size = 20, q = "") =>
    apiFetch<PageResponse<RelaisEntrepriseDto> | RelaisEntrepriseDto[]>(
      `/commission-relais/entreprises?page=${page}&size=${size}${q ? `&q=${encodeURIComponent(q)}` : ""}`
    ),
  listAutorites: (page = 0, size = 20, q = "") =>
    apiFetch<PageResponse<RelaisAutoriteDto> | RelaisAutoriteDto[]>(
      `/commission-relais/autorites-contractantes?page=${page}&size=${size}${q ? `&q=${encodeURIComponent(q)}` : ""}`
    ),
  impersonateEntreprise: (entrepriseId: number) =>
    apiFetch<LoginResponse>("/commission-relais/impersonate/entreprise", { method: "POST", body: { entrepriseId } }),
  impersonateAutorite: (autoriteContractanteId: number) =>
    apiFetch<LoginResponse>("/commission-relais/impersonate/autorite-contractante", { method: "POST", body: { autoriteContractanteId } }),
  release: () => apiFetch<LoginResponse>("/commission-relais/release", { method: "POST" }),
};

export interface UtilisateurDto { id: number; username: string; role: string; nomComplet: string; email: string; actif: boolean; entrepriseId?: number; }

export const ROLE_OPTIONS = [
  { value: "ENTREPRISE", label: "Entreprise" },
  { value: "AUTORITE_CONTRACTANTE", label: "Autorité Contractante" },
  { value: "AUTORITE_UPM", label: "Autorité UPM (Délégué)" },
  { value: "AUTORITE_UEP", label: "Autorité UEP (Délégué)" },
  { value: "DGD", label: "DGD – Douanes" },
  { value: "DGI", label: "DGI – Impôts" },
  { value: "DGTCP", label: "DGTCP – Trésor Public" },
  { value: "DGB", label: "DGB – Budget" },
  { value: "PRESIDENT", label: "Président" },
  { value: "ADMIN_SI", label: "Admin SI" },
] as const;

export const ROLE_LABELS: Record<string, string> = {
  PRESIDENT: "Président",
  DGD: "DGD – Douanes",
  DGTCP: "DGTCP – Trésor Public",
  DGI: "DGI – Impôts",
  DGB: "DGB – Budget",
  ADMIN_SI: "Admin SI",
  AUTORITE_CONTRACTANTE: "Autorité Contractante",
  AUTORITE_UPM: "Autorité UPM",
  AUTORITE_UEP: "Autorité UEP",
  ENTREPRISE: "Entreprise",
  COMMISSION_RELAIS: "Commission relais",
};

export const authApi = {
  login: (data: LoginRequest) => apiFetch<LoginResponse>("/auth/login", { method: "POST", body: data }),
  register: (data: RegisterRequest) => apiFetch<LoginResponse>("/auth/register", { method: "POST", body: data }),
  me: () => apiFetch<Record<string, unknown>>("/auth/me"),
};

export interface UpdateUtilisateurRequest { username?: string; nomComplet?: string; email?: string; role?: string; }


export const utilisateurApi = {
  getAll: () => apiFetch<UtilisateurDto[]>("/utilisateurs"),
  getByEntreprise: (entrepriseId: number) => apiFetch<UtilisateurDto[]>(`/utilisateurs?entrepriseId=${entrepriseId}`),
  getSousTraitants: () => apiFetch<EntrepriseDto[]>("/utilisateurs/sous-traitants"),
  getEntreprisesSousTraitantes: () => apiFetch<EntrepriseDto[]>("/sous-traitances/entreprises-sous-traitantes"),
  getPending: () => apiFetch<UtilisateurDto[]>("/utilisateurs/pending"),
  setActif: (id: number, actif: boolean) => apiFetch<void>(`/utilisateurs/${id}/actif?actif=${actif}`, { method: "PATCH" }),
  create: (data: RegisterRequest) => apiFetch<LoginResponse>("/auth/register", { method: "POST", body: data }),
  // NOT SUPPORTED BY BACKEND — kept for future use
  update: (id: number, data: UpdateUtilisateurRequest) => apiFetch<UtilisateurDto>(`/utilisateurs/${id}`, { method: "PUT", body: data }),
  delete: (id: number) => apiFetch<void>(`/utilisateurs/${id}`, { method: "DELETE" }),
  resetPassword: (id: number, newPassword: string) => apiFetch<void>(`/utilisateurs/${id}/reset-password`, { method: "PATCH", body: { password: newPassword } }),
};

// Permissions
export interface PermissionDto { id: number; code: string; description: string; processus?: string; }

export const permissionApi = {
  listAll: () => apiFetch<PermissionDto[]>("/admin/permissions"),
  listRoles: () => apiFetch<string[]>("/admin/permissions/roles"),
  getByRole: (role: string) => apiFetch<PermissionDto[]>(`/admin/permissions/roles/${role}`),
  assign: (role: string, permissionCode: string) => apiFetch<void>(`/admin/permissions/roles/${role}?permissionCode=${encodeURIComponent(permissionCode)}`, { method: "POST" }),
  revoke: (role: string, permissionCode: string) => apiFetch<void>(`/admin/permissions/roles/${role}?permissionCode=${encodeURIComponent(permissionCode)}`, { method: "DELETE" }),
};

// Entreprises
export interface EntrepriseDto { id?: number; raisonSociale: string; nif: string; adresse?: string; telephone?: string; email?: string; situationFiscale?: string; }

export const entrepriseApi = {
  getAll: () => apiFetch<EntrepriseDto[]>("/entreprises"),
  getById: (id: number) => apiFetch<EntrepriseDto>(`/entreprises/${id}`),
  create: (data: EntrepriseDto) => apiFetch<EntrepriseDto>("/entreprises", { method: "POST", body: data }),
  update: (id: number, data: EntrepriseDto) => apiFetch<EntrepriseDto>(`/entreprises/${id}`, { method: "PUT", body: data }),
  delete: (id: number) => apiFetch<void>(`/entreprises/${id}`, { method: "DELETE" }),
};

// Autorités Contractantes
export interface AutoriteContractanteDto { id?: number; nom: string; sigle?: string; adresse?: string; telephone?: string; email?: string; }

export const autoriteContractanteApi = {
  getAll: () => apiFetch<AutoriteContractanteDto[]>("/autorites-contractantes"),
  getById: (id: number) => apiFetch<AutoriteContractanteDto>(`/autorites-contractantes/${id}`),
  create: (data: AutoriteContractanteDto) => apiFetch<AutoriteContractanteDto>("/autorites-contractantes", { method: "POST", body: data }),
  update: (id: number, data: AutoriteContractanteDto) => apiFetch<AutoriteContractanteDto>(`/autorites-contractantes/${id}`, { method: "PUT", body: data }),
  delete: (id: number) => apiFetch<void>(`/autorites-contractantes/${id}`, { method: "DELETE" }),
};

// Référentiel Projet (P1)
export type ReferentielStatut = "EN_ATTENTE" | "VALIDE" | "REJETE" | "ANNULE";

export interface ReferentielProjetDto {
  id: number;
  numero?: string;
  reference?: string;
  intitule?: string;
  autoriteContractanteId?: number;
  autoriteContractanteNom?: string;
  bailleurFonds?: string;
  dateSignature?: string;
  dateDebut?: string;
  dateFinPrevue?: string;
  montantTotal?: number;
  deviseOrigine?: string;
  equivalentMRU?: number;
  tauxChange?: number;
  statut: ReferentielStatut;
  nomProjet?: string;
  administrateurProjet?: string;
  referenceBciSecteur?: string;
  dateCreation?: string;
  dateDepot?: string;
  dateMiseAJour?: string;
  description?: string;
  conventionId?: number;
  conventionReference?: string;
  conventionIntitule?: string;
  conventionBailleur?: string;
  conventionBailleurDetails?: string;
  conventionDateSignature?: string;
  conventionDateDebut?: string;
  conventionDateFin?: string;
  conventionMontantDevise?: number;
  conventionMontantMru?: number;
  conventionDeviseOrigine?: string;
  conventionTauxChange?: number;
  valideParUserId?: number;
  dateValidation?: string;
  motifRejet?: string;
}

export interface CreateReferentielProjetRequest {
  autoriteContractanteId?: number | null;
  conventionId?: number;
  nomProjet?: string;
  administrateurProjet?: string;
  referenceBciSecteur?: string;
}

export const REFERENTIEL_STATUT_LABELS: Record<ReferentielStatut, string> = {
  EN_ATTENTE: "En attente",
  VALIDE: "Validé",
  REJETE: "Rejeté",
  ANNULE: "Annulé",
};

export type TypeDocumentProjet =
  | "CONVENTION_CONTRAT"
  | "BAILLEUR_INFOS"
  | "DATES_CLES"
  | "AUTORITE_RESPONSABLE"
  | "MONTANT_TOTAL_DEVISE"
  | "MONTANT_MRU_TAUX_CHANGE";

export const REFERENTIEL_DOCUMENT_TYPES: { value: TypeDocumentProjet; label: string }[] = [
  { value: "CONVENTION_CONTRAT", label: "Convention / Contrat de financement" },
  { value: "BAILLEUR_INFOS", label: "Informations bailleur de fonds" },
  { value: "DATES_CLES", label: "Dates clés (signature, début, fin)" },
  { value: "AUTORITE_RESPONSABLE", label: "Autorité contractante responsable" },
  { value: "MONTANT_TOTAL_DEVISE", label: "Montant total et devise d'origine" },
  { value: "MONTANT_MRU_TAUX_CHANGE", label: "Équivalent MRU + taux de change" },
];

export const referentielProjetApi = {
  getAll: () => apiFetch<ReferentielProjetDto[]>("/referentiels-projet"),
  getById: (id: number) => apiFetch<ReferentielProjetDto>(`/referentiels-projet/${id}`),
  getByStatut: (statut: ReferentielStatut) => apiFetch<ReferentielProjetDto[]>(`/referentiels-projet/by-statut?statut=${statut}`),
  getByAutorite: (autoriteId: number) => apiFetch<ReferentielProjetDto[]>(`/referentiels-projet/by-autorite/${autoriteId}`),
  create: (data: CreateReferentielProjetRequest) => apiFetch<ReferentielProjetDto>("/referentiels-projet", { method: "POST", body: data }),
  updateStatut: (id: number, statut: "VALIDE" | "REJETE" | "ANNULE", motifRejet?: string) => apiFetch<ReferentielProjetDto>(`/referentiels-projet/${id}/statut?statut=${statut}${motifRejet ? `&motifRejet=${encodeURIComponent(motifRejet)}` : ""}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/referentiels-projet/${id}/documents`),
  uploadDocument: (id: number, type: TypeDocumentProjet, file: File) => {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/referentiels-projet/${id}/documents`, {
      method: "POST",
      rawBody: formData,
    });
  },
  deleteDocument: (projetId: number, docId: number) => apiFetch<void>(`/referentiels-projet/${projetId}/documents/${docId}`, { method: "DELETE" }),
  replaceDocument: (projetId: number, docId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/referentiels-projet/${projetId}/documents/${docId}`, {
      method: "PUT",
      rawBody: formData,
    });
  },
};

// Conventions
export type ConventionStatut = "EN_ATTENTE" | "VALIDE" | "REJETE" | "ANNULEE";

export interface ConventionDto {
  id: number;
  reference?: string;
  /** Référence projet (distincte de `reference`). */
  projectReference?: string;
  intitule?: string;
  /** ID du bailleur lié (relation @ManyToOne). */
  bailleurId?: number;
  /** Nom du bailleur lié (lecture seule, fourni par le back). */
  bailleurNom?: string;
  /** @deprecated remplacé par `bailleurId` + `bailleurNom`. Conservé pour compat ascendante. */
  bailleur?: string;
  bailleurDetails?: string;
  dateSignature?: string;
  dateDebut?: string;
  dateFin?: string;
  montantDevise?: number;
  deviseOrigine?: string;
  montantMru?: number;
  tauxChange?: number;
  statut: ConventionStatut;
  dateCreation?: string;
  autoriteContractanteId?: number;
  autoriteContractanteNom?: string;
  creeParAutoriteContractanteId?: number;
  creeParAutoriteContractanteNom?: string;
  valideParUserId?: number;
  dateValidation?: string;
  motifRejet?: string;
}

export interface CreateConventionRequest {
  reference?: string;
  projectReference?: string;
  intitule?: string;
  /** ID du bailleur (issu de GET /api/bailleurs). Le descriptif provient désormais du bailleur lui-même. */
  bailleurId?: number | null;
  dateSignature?: string;
  dateFin?: string;
  montantDevise?: number;
  deviseOrigine?: string;
  montantMru?: number;
  tauxChange?: number;
  statut?: ConventionStatut;
  autoriteContractanteId?: number;
}

export const CONVENTION_STATUT_LABELS: Record<ConventionStatut, string> = {
  EN_ATTENTE: "En attente",
  VALIDE: "Validée",
  REJETE: "Rejetée",
  ANNULEE: "Annulée",
};

export type TypeDocumentConvention =
  | "CONVENTION_CONTRAT"
  | "AVENANT"
  | "ACCORD_FINANCEMENT"
  | "AUTRE";

export const CONVENTION_DOCUMENT_TYPES: { value: TypeDocumentConvention; label: string }[] = [
  { value: "CONVENTION_CONTRAT", label: "Convention / Contrat" },
  { value: "AVENANT", label: "Avenant" },
  { value: "ACCORD_FINANCEMENT", label: "Accord de financement" },
  { value: "AUTRE", label: "Autre document" },
];

export const conventionApi = {
  /** Liste avec recherche optionnelle. `q` = recherche sur référence / intitulé / projectReference. */
  getAll: (q?: string) => apiFetch<ConventionDto[]>(`/conventions${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getById: (id: number) => apiFetch<ConventionDto>(`/conventions/${id}`),
  getByStatut: (statut: ConventionStatut) => apiFetch<ConventionDto[]>(`/conventions/by-statut?statut=${statut}`),
  create: (data: CreateConventionRequest) => apiFetch<ConventionDto>("/conventions", { method: "POST", body: data }),
  // NOT SUPPORTED BY BACKEND — kept for future use
  update: (id: number, data: CreateConventionRequest) => apiFetch<ConventionDto>(`/conventions/${id}`, { method: "PUT", body: data }),
  updateStatut: (id: number, statut: ConventionStatut | "ANNULEE", motifRejet?: string) => apiFetch<ConventionDto>(`/conventions/${id}/statut?statut=${statut}${motifRejet ? `&motifRejet=${encodeURIComponent(motifRejet)}` : ""}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/conventions/${id}/documents`),
  deleteDocument: (conventionId: number, docId: number) => apiFetch<void>(`/conventions/${conventionId}/documents/${docId}`, { method: "DELETE" }),
  replaceDocument: (conventionId: number, docId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/conventions/${conventionId}/documents/${docId}`, {
      method: "PUT",
      rawBody: formData,
    });
  },
  uploadDocument: (id: number, type: TypeDocumentConvention, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/conventions/${id}/documents?type=${encodeURIComponent(type)}`, {
      method: "POST",
      rawBody: formData,
    });
  },
};

// Demandes de correction (P2)
export type DemandeStatut = "BROUILLON" | "RECUE" | "INCOMPLETE" | "RECEVABLE" | "EN_EVALUATION" | "EN_VALIDATION" | "ADOPTEE" | "REJETEE" | "NOTIFIEE" | "ANNULEE";

export interface DemandeCorrectionDto {
  id: number;
  numero?: string;
  statut: DemandeStatut;
  dateDepot?: string;
  autoriteContractanteId?: number;
  autoriteContractanteNom?: string;
  entrepriseId?: number;
  entrepriseRaisonSociale?: string;
  conventionId?: number;
  conventionReference?: string;
  conventionIntitule?: string;
  marcheId?: number;
  marcheNumero?: string;
  marcheIntitule?: string;
  /** Trace : id du marché original conservé après une annulation (détachement). */
  marcheIdTrace?: number;
  /**
   * Indique si la demande ANNULEE peut être réactivée :
   * - null : statut non concerné (différent de ANNULEE)
   * - true : marché tracé libre, réactivation autorisée
   * - false : marché tracé déjà rattaché à une autre demande active → réactivation bloquée
   */
  marcheReactivable?: boolean | null;
  modeleFiscal?: ModeleFiscal;
  dqe?: Dqe;
  documents?: DocumentDto[];
  // Validation parallèle
  validationDgd?: boolean;
  validationDgtcp?: boolean;
  validationDgi?: boolean;
  validationDgdUserId?: number;
  validationDgdDate?: string;
  validationDgtcpUserId?: number;
  validationDgtcpDate?: string;
  validationDgiUserId?: number;
  validationDgiDate?: string;
  motifRejet?: string;
  rejets?: RejetDto[];
  decisions?: DecisionCorrectionDto[];
}

export interface RejetDto {
  id: number;
  motifRejet: string;
  dateRejet?: string;
  utilisateurId?: number;
  utilisateurNom?: string;
}

export interface ImportationLigne {
  designation: string;
  unite: string;
  quantite: number;
  prixUnitaire: number;
  nomenclature?: string;
  tauxDD: number;
  tauxRS: number;
  tauxPSC: number;
  tauxTVA: number;
  valeurDouane: number;
  dd: number;
  rs: number;
  psc: number;
  baseTVA: number;
  tvaDouane: number;
  totalTaxes: number;
}

export interface FiscaliteInterieure {
  montantHT: number;
  tauxTVA: number;
  autresTaxes: number;
  tvaCollectee: number;
  tvaDeductible: number;
  tvaNette: number;
  creditInterieur: number;
}

export interface RecapitulatifFiscal {
  creditExterieur: number;
  creditInterieur: number;
  creditTotal: number;
}

export interface ModeleFiscal {
  referenceDossier?: string;
  typeProjet?: string;
  afficherNomenclature?: boolean;
  importations: ImportationLigne[];
  fiscaliteInterieure: FiscaliteInterieure;
  recapitulatif: RecapitulatifFiscal;
}

export interface DqeLigne {
  designation: string;
  unite: string;
  quantite: number;
  prixUnitaireHT: number;
  montantHT: number;
}

export interface Dqe {
  numeroAAOI?: string;
  projet?: string;
  lot?: string;
  tauxTVA: number;
  totalHT: number;
  montantTVA: number;
  totalTTC: number;
  lignes: DqeLigne[];
}

export interface CreateDemandeCorrectionRequest {
  autoriteContractanteId?: number;
  entrepriseId: number;
  conventionId?: number;
  marcheId?: number;
  modeleFiscal?: ModeleFiscal;
  dqe?: Dqe;
  /** Si true, la demande reste au statut BROUILLON sans notifier les services. */
  brouillon?: boolean;
}

export interface DocumentDto {
  id: number;
  type: string;
  nomFichier: string;
  chemin?: string;
  dateUpload?: string;
  taille?: number;
  version?: number;
  actif?: boolean;
}

// Décisions temporaires par acteur
export type DecisionType = "VISA" | "REJET_TEMP";

export interface RejetTempResponseDto {
  id: number;
  message: string;
  documentUrl?: string;
  documentType?: string;
  documentVersion?: number;
  createdAt?: string;
  auteurNom?: string;
  utilisateurId?: number;
  utilisateurNom?: string;
}

export interface DecisionCorrectionDto {
  id: number;
  role: string;
  decision: DecisionType;
  motifRejet?: string;
  documentsDemandes?: string[];
  dateDecision?: string;
  utilisateurId?: number;
  utilisateurNom?: string;
  rejetTempStatus?: "OUVERT" | "RESOLU";
  rejetTempResolvedAt?: string;
  rejetTempResponses?: RejetTempResponseDto[];
}

// Réclamation DTO
export type ReclamationStatut = "SOUMISE" | "ACCEPTEE" | "REJETEE" | "ANNULEE";

export interface ReclamationDemandeCorrectionDto {
  id: number;
  demandeCorrectionId: number;
  statut: ReclamationStatut;
  texte: string;
  pieceJointeNomFichier?: string;
  pieceJointeChemin?: string;
  pieceJointeTaille?: number;
  pieceJointeDateUpload?: string;
  dateCreation?: string;
  dateTraitement?: string;
  auteurUserId?: number;
  auteurNom?: string;
  traiteParUserId?: number;
  motifReponse?: string;
  reponseRejetChemin?: string;
  reponseRejetNomFichier?: string;
  reponseRejetTaille?: number;
  reponseRejetDateUpload?: string;
}

export const RECLAMATION_STATUT_LABELS: Record<ReclamationStatut, string> = {
  SOUMISE: "Soumise",
  ACCEPTEE: "Acceptée",
  REJETEE: "Rejetée",
  ANNULEE: "Annulée",
};

export const DOCUMENT_TYPES_REQUIS: { value: string; label: string }[] = [
  { value: "LETTRE_SAISINE", label: "Lettre de saisine" },
  { value: "OFFRE_FINANCIERE", label: "Offre financière (table de calcul)" },
  { value: "TABLEAU_MODELE", label: "Tableau modèle" },
];

// All 7 document types from P1
export const ALL_DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: "LETTRE_SAISINE", label: "Lettre de saisine" },
  { value: "PV_OUVERTURE", label: "PV ouverture offres financières" },
  { value: "ATTESTATION_FISCALE", label: "Attestation fiscale entreprise" },
  { value: "OFFRE_FINANCIERE", label: "Offre financière" },
  { value: "TABLEAU_MODELE", label: "Tableau modèle (nature, valeur, classification)" },
  { value: "DAO_DQE", label: "DAO + DQE" },
  { value: "LISTE_ITEMS_EXCEL", label: "Liste items Excel (FR/AR)" },
];

export const DOCUMENT_TYPES = DOCUMENT_TYPES_REQUIS.map((t) => t.value);

export const demandeCorrectionApi = {
  getAll: () => apiFetch<DemandeCorrectionDto[]>("/demandes-correction"),
  getById: (id: number) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}`),
  getByStatut: (statut: DemandeStatut) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-statut?statut=${statut}`),
  getByAutorite: (autoriteId: number) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-autorite/${autoriteId}`),
  getByEntreprise: (entrepriseId: number) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-entreprise/${entrepriseId}`),
  getByDelegue: (userId: number) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-delegue/${userId}`),
  create: (data: CreateDemandeCorrectionRequest) => apiFetch<DemandeCorrectionDto>("/demandes-correction", { method: "POST", body: data }),
  /** Édition d'une demande (autorisée si BROUILLON / RECUE / INCOMPLETE et aucun visa). */
  update: (id: number, data: CreateDemandeCorrectionRequest) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}`, { method: "PUT", body: data }),
  /** Soumission d'un brouillon : passe en RECUE et notifie les services. */
  soumettre: (id: number) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}/soumettre`, { method: "POST" }),
  /** Suppression définitive — réservée au statut BROUILLON. */
  remove: (id: number) => apiFetch<void>(`/demandes-correction/${id}`, { method: "DELETE" }),
  updateStatut: (id: number, statut: DemandeStatut, motifRejet?: string, decisionFinale?: boolean) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}/statut?statut=${statut}${motifRejet ? `&motifRejet=${encodeURIComponent(motifRejet)}` : ""}${decisionFinale ? `&decisionFinale=true` : ""}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/demandes-correction/${id}/documents`),
  uploadDocument: (id: number, type: string, file: File, message?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (message) formData.append("message", message);
    return apiFetch<DocumentDto>(`/demandes-correction/${id}/documents?type=${encodeURIComponent(type)}`, {
      method: "POST",
      rawBody: formData,
    });
  },
  // Décisions temporaires
  getDecisions: (id: number) => apiFetch<DecisionCorrectionDto[]>(`/demandes-correction/${id}/decisions`),
  postDecision: (id: number, decision: DecisionType, motifRejet?: string, documentsDemandes?: string[]) =>
    apiFetch<DecisionCorrectionDto>(`/demandes-correction/${id}/decisions`, {
      method: "POST",
      body: {
        decision,
        ...(motifRejet ? { motifRejet } : {}),
        ...(documentsDemandes && documentsDemandes.length > 0 ? { documentsDemandes } : {}),
      },
    }),
  // Réponse message seul à un rejet temporaire
  postRejetTempResponse: (decisionId: number, message: string) =>
    apiFetch<RejetTempResponseDto>(`/demandes-correction/decisions/${decisionId}/rejet-temp/reponses`, {
      method: "POST",
      body: { message },
    }),
  // Résoudre manuellement un rejet temporaire
  resolveRejetTemp: (decisionId: number) =>
    apiFetch<DecisionCorrectionDto>(`/demandes-correction/decisions/${decisionId}/resolve`, {
      method: "PUT",
    }),
  // Réclamations
  getReclamations: (demandeId: number) =>
    apiFetch<ReclamationDemandeCorrectionDto[]>(`/demandes-correction/${demandeId}/reclamations`),
  createReclamation: (demandeId: number, texte: string, file: File) => {
    const formData = new FormData();
    formData.append("texte", texte);
    formData.append("file", file);
    return apiFetch<ReclamationDemandeCorrectionDto>(`/demandes-correction/${demandeId}/reclamations`, {
      method: "POST",
      rawBody: formData,
    });
  },
  traiterReclamation: (demandeId: number, reclamationId: number, acceptee: boolean, motifReponse?: string, file?: File) => {
    const formData = new FormData();
    formData.append("acceptee", acceptee ? "true" : "false");
    if (motifReponse) formData.append("motifReponse", motifReponse);
    if (file) formData.append("file", file);
    return apiFetch<ReclamationDemandeCorrectionDto>(`/demandes-correction/${demandeId}/reclamations/${reclamationId}`, {
      method: "PATCH",
      rawBody: formData,
    });
  },
  annulerReclamation: (demandeId: number, reclamationId: number) =>
    apiFetch<ReclamationDemandeCorrectionDto>(`/demandes-correction/${demandeId}/reclamations/${reclamationId}/annuler`, {
      method: "POST",
    }),
};

// Marchés
export type StatutMarche = "EN_COURS" | "AVENANT" | "CLOTURE" | "ANNULE";

export interface MarcheDto {
  id: number;
  conventionId?: number;
  demandeCorrectionId?: number;
  numeroMarche?: string;
  intitule?: string;
  dateSignature?: string;
  /** Montant HT (nom canonique côté back). */
  montantContratHt?: number;
  /** Alias rétro-compatible (entrée acceptée par le back). */
  montantContratTtc?: number;
  statut: StatutMarche;
  delegueIds?: number[];
}

export interface CreateMarcheRequest {
  conventionId?: number;
  demandeCorrectionId?: number;
  numeroMarche?: string;
  intitule?: string;
  dateSignature?: string;
  /** Préférer montantContratHt en envoi ; montantContratTtc reste accepté en alias. */
  montantContratHt?: number;
  montantContratTtc?: number;
  statut?: StatutMarche;
}

export const MARCHE_STATUT_LABELS: Record<StatutMarche, string> = {
  EN_COURS: "En cours",
  AVENANT: "Avenant",
  CLOTURE: "Clôturé",
  ANNULE: "Annulé",
};

export type TypeDocumentMarche =
  | "PV_ADJUDICATION"
  | "AVIS_ATTRIBUTION"
  | "CONTRAT_SIGNE"
  | "AUTRE";

export const MARCHE_DOCUMENT_TYPES: { value: TypeDocumentMarche; label: string }[] = [
  { value: "PV_ADJUDICATION", label: "PV d'adjudication" },
  { value: "AVIS_ATTRIBUTION", label: "Avis d'attribution" },
  { value: "CONTRAT_SIGNE", label: "Contrat signé" },
  { value: "AUTRE", label: "Autre document" },
];

export const marcheApi = {
  /** Liste paginée. `q` = recherche sur numéro de marché et intitulé. */
  getAll: (q?: string) => apiFetch<MarcheDto[]>(`/marches${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getById: (id: number) => apiFetch<MarcheDto>(`/marches/${id}`),
  getByCorrection: (demandeCorrectionId: number) => apiFetch<MarcheDto>(`/marches/by-correction/${demandeCorrectionId}`),
  /** Vérifie si un marché a déjà une demande de correction active (non ANNULEE). */
  getDemandeCorrectionActive: (id: number) => apiFetch<{
    marcheId: number;
    hasActiveDemandeCorrection: boolean;
    demandeCorrectionId: number | null;
    demandeCorrectionStatut: string | null;
  }>(`/marches/${id}/demande-correction-active`),
  create: (data: CreateMarcheRequest) => apiFetch<MarcheDto>("/marches", { method: "POST", body: data }),
  update: (id: number, data: Partial<CreateMarcheRequest>) => apiFetch<MarcheDto>(`/marches/${id}`, { method: "PUT", body: data }),
  assign: (id: number, delegueId: number) => apiFetch<MarcheDto>(`/marches/${id}/assign`, { method: "PATCH", body: { delegueId } }),
  addDelegue: (id: number, delegueId: number) => apiFetch<void>(`/marches/${id}/delegues`, { method: "POST", body: { delegueId } }),
  removeDelegue: (id: number, delegueId: number) => apiFetch<void>(`/marches/${id}/delegues/${delegueId}`, { method: "DELETE" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/marches/${id}/documents`),
  uploadDocument: (id: number, type: TypeDocumentMarche, file: File) => {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/marches/${id}/documents`, {
      method: "POST",
      rawBody: formData,
    });
  },
  deleteDocument: (marcheId: number, docId: number) => apiFetch<void>(`/marches/${marcheId}/documents/${docId}`, { method: "DELETE" }),
  replaceDocument: (marcheId: number, docId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/marches/${marcheId}/documents/${docId}`, {
      method: "PUT",
      rawBody: formData,
    });
  },
  updateStatut: (id: number, statut: StatutMarche) => apiFetch<MarcheDto>(`/marches/${id}`, { method: "PUT", body: { statut } }),
};

// Délégués (AC -> UPM/UEP)
export interface DelegueDto {
  id: number;
  username: string;
  role: string;
  nomComplet: string;
  email?: string;
  actif: boolean;
}

export interface CreateDelegueRequest {
  username: string;
  password: string;
  role: "AUTORITE_UPM" | "AUTORITE_UEP";
  nomComplet: string;
  email?: string;
}

export interface UpdateDelegueRequest {
  nomComplet?: string;
  email?: string;
  newPassword?: string;
}

export interface DelegueMarcheDto {
  id: number;
  objet?: string;
  reference?: string;
  statut?: string;
}

export const delegueApi = {
  getAll: () => apiFetch<DelegueDto[]>("/delegues"),
  getById: (id: number) => apiFetch<DelegueDto>(`/delegues/${id}`),
  create: (data: CreateDelegueRequest) => apiFetch<DelegueDto>("/delegues", { method: "POST", body: data }),
  update: (id: number, data: UpdateDelegueRequest) => apiFetch<DelegueDto>(`/delegues/${id}`, { method: "PATCH", body: data }),
  setActif: (id: number, actif: boolean) => apiFetch<DelegueDto>(`/delegues/${id}/actif?actif=${actif}`, { method: "PATCH" }),
  getMarches: (id: number) => apiFetch<DelegueMarcheDto[]>(`/delegues/${id}/marches`),
  syncMarches: (id: number, marcheIds: number[]) => apiFetch<void>(`/delegues/${id}/marches`, { method: "PUT", body: { marcheIds } }),
};

// Certificats de crédit (P3)
export type CertificatStatut = "BROUILLON" | "ENVOYEE" | "DEMANDE" | "EN_CONTROLE" | "INCOMPLETE" | "A_RECONTROLER" | "EN_VERIFICATION_DGI" | "EN_VALIDATION_PRESIDENT" | "VALIDE_PRESIDENT" | "EN_OUVERTURE_DGTCP" | "OUVERT" | "MODIFIE" | "CLOTURE" | "ANNULE";

/** Récapitulatif fiscal optionnel d'un certificat de crédit (pour saisie ou lecture). */
export interface CertificatRecapFiscal {
  /** (a) Valeur en douane des fournitures importées */
  valeurDouaneFournitures?: number;
  /** (b) Droits et taxes à l'importation hors TVA */
  droitsEtTaxesDouaneHorsTva?: number;
  /** (d) TVA d'importation à la douane — restant (diminue à chaque liquidation douanière). */
  tvaImportationDouane?: number;
  /** (d) TVA d'importation à la douane — accord initial (figé, sert aux formules récap). Lecture seule côté DTO. */
  tvaImportationDouaneAccordee?: number;
  /** (f) Montant du marché HT */
  montantMarcheHt?: number;
  /** (g) TVA collectée sur les travaux */
  tvaCollecteeTravaux?: number;
}

export interface CertificatCreditDto extends CertificatRecapFiscal {
  id: number;
  reference?: string;
  numero?: string;
  entrepriseId?: number;
  entrepriseNom?: string;
  entrepriseRaisonSociale?: string;
  statut: CertificatStatut;
  montantDouane?: number;
  montantInterieur?: number;
  montantTotal?: number;
  montantCordon?: number;
  montantTVAInterieure?: number;
  soldeCordon?: number;
  soldeTVA?: number;
  dateCreation?: string;
  dateEmission?: string;
  dateMiseAJour?: string;
  dateValidite?: string;
  lettreCorrectionId?: number;
  demandeCorrectionId?: number;
  demandeCorrectionNumero?: string;
  marcheId?: number;
  marcheIntitule?: string;
  /** (e) = b + d, calculé côté back si b et d présents */
  creditExterieurRecap?: number;
  /** (h) = g − d, calculé côté back si g et d présents */
  creditInterieurNetRecap?: number;
  /** Total = e + h, calculé côté back si les deux sont calculables */
  totalCreditImpotRecap?: number;
}

export interface CreateCertificatCreditRequest extends CertificatRecapFiscal {
  entrepriseId: number;
  lettreCorrectionId?: number;
  demandeCorrectionId?: number;
  dateValidite?: string;
  montantCordon?: number;
  montantTVAInterieure?: number;
  soldeCordon?: number;
  soldeTVA?: number;
  montantDouane?: number;
  montantInterieur?: number;
  /** Si true, le certificat reste au statut BROUILLON sans contrôles ni notifications. */
  brouillon?: boolean;
}

/** Corps de PATCH /certificats-credit/{id}/montants. Récap fiscal optionnel. */
export interface UpdateCertificatCreditMontantsRequest extends CertificatRecapFiscal {
  montantCordon: number;
  montantTVAInterieure: number;
}

export const certificatCreditApi = {
  getAll: () => apiFetch<CertificatCreditDto[]>("/certificats-credit"),
  getById: (id: number) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}`),
  getByStatut: (statut: CertificatStatut) => apiFetch<CertificatCreditDto[]>(`/certificats-credit/by-statut?statut=${statut}`),
  getByEntreprise: (entrepriseId: number) => apiFetch<CertificatCreditDto[]>(`/certificats-credit/by-entreprise/${entrepriseId}`),
  create: (data: CreateCertificatCreditRequest) => apiFetch<CertificatCreditDto>("/certificats-credit", { method: "POST", body: data }),
  /** Édition d'un certificat — uniquement au statut BROUILLON. */
  update: (id: number, data: CreateCertificatCreditRequest) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}`, { method: "PUT", body: data }),
  /** Soumission d'un brouillon : passe en ENVOYEE (puis prise en charge → EN_CONTROLE). */
  soumettre: (id: number) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/soumettre`, { method: "POST" }),
  /** Prise en charge par un acteur (DGI/DGD/DGTCP) : passe ENVOYEE → EN_CONTROLE. */
  prendreEnCharge: (id: number) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/prendre-en-charge`, { method: "POST" }),
  /** Suppression définitive — réservée au statut BROUILLON. */
  remove: (id: number) => apiFetch<void>(`/certificats-credit/${id}`, { method: "DELETE" }),
  updateStatut: (id: number, statut: CertificatStatut) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/statut?statut=${statut}`, { method: "PATCH" }),
  updateMontants: (
    id: number,
    montantCordon: number,
    montantTVAInterieure: number,
    recap?: CertificatRecapFiscal,
  ) =>
    apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/montants`, {
      method: "PATCH",
      body: { montantCordon, montantTVAInterieure, ...(recap ?? {}) } satisfies UpdateCertificatCreditMontantsRequest,
    }),
  reject: (id: number, motif: string) =>
    apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/statut?statut=ANNULE&motif=${encodeURIComponent(motif)}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/certificats-credit/${id}/documents`),
  uploadDocument: (id: number, type: string, file: File) => {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/certificats-credit/${id}/documents`, { method: "POST", rawBody: formData });
  },
  // TVA Stock FIFO
  getTvaStock: (id: number) => apiFetch<TvaDeductibleStockDto[]>(`/certificats-credit/${id}/tva-stock`),
  // Decisions (REJET_TEMP + VISA)
  getDecisions: (id: number) => apiFetch<DecisionCorrectionDto[]>(`/certificats-credit/${id}/decisions`),
  postDecision: (id: number, decision: DecisionType, motifRejet?: string, documentsDemandes?: string[]) =>
    apiFetch<DecisionCorrectionDto>(`/certificats-credit/${id}/decisions`, {
      method: "POST",
      body: {
        decision,
        ...(motifRejet ? { motifRejet } : {}),
        ...(documentsDemandes && documentsDemandes.length > 0 ? { documentsDemandes } : {}),
      },
      }),
  // Résoudre manuellement un rejet temporaire
  resolveRejetTemp: (decisionId: number) =>
    apiFetch<DecisionCorrectionDto>(`/certificats-credit/decisions/${decisionId}/resolve`, {
      method: "PUT",
    }),
  // Répondre à un rejet temporaire (entreprise/AC)
  postRejetTempResponse: (decisionId: number, message: string) =>
    apiFetch<RejetTempResponseDto>(`/certificats-credit/decisions/${decisionId}/rejet-temp/reponses`, {
      method: "POST",
      body: { message },
    }),
};

// Utilisations de crédit (P4/P5)
export type UtilisationStatut = "BROUILLON" | "DEMANDEE" | "INCOMPLETE" | "A_RECONTROLER" | "EN_VERIFICATION" | "VISE" | "VALIDEE" | "LIQUIDEE" | "APUREE" | "REJETEE";
export type UtilisationType = "DOUANIER" | "TVA_INTERIEURE";

export interface TvaDeductibleStockDto {
  id: number;
  utilisationDouaneId: number;
  numeroDeclaration?: string;
  montantInitial: number;
  montantRestant: number;
  montantConsomme: number;
  dateCreation?: string;
  epuise: boolean;
}

export interface UtilisationCreditDto {
  id: number;
  certificatCreditId: number;
  type?: UtilisationType;
  montant?: number;
  statut: UtilisationStatut;
  dateCreation?: string;
  dateMiseAJour?: string;
  dateLiquidation?: string;
  description?: string;
  entrepriseNom?: string;
  entrepriseId?: number;
  certificatReference?: string;
  // Douane fields
  numeroDeclaration?: string;
  numeroBulletin?: string;
  dateDeclaration?: string;
  montantDroits?: number;
  montantTVADouane?: number;
  enregistreeSYDONIA?: boolean;
  // Douane liquidation trace
  soldeCordonAvant?: number;
  soldeCordonApres?: number;
  // TVA intérieure fields
  typeAchat?: string;
  numeroFacture?: string;
  dateFacture?: string;
  montantTVAInterieure?: number;
  numeroDecompte?: string;
  // Traçabilité TVA (après apurement)
  tvaDeductibleUtilisee?: number;
  tvaNette?: number;
  creditInterieurUtilise?: number;
  paiementEntreprise?: number;
  reportANouveau?: number;
  soldeTVAAvant?: number;
  soldeTVAApres?: number;
  // Traçabilité sous-traitant
  certificatTitulaireEntrepriseId?: number;
  certificatTitulaireRaisonSociale?: string;
  demandeurEstSousTraitant?: boolean;
}

export interface CreateUtilisationCreditRequest {
  certificatCreditId: number;
  entrepriseId: number;
  type: UtilisationType;
  montant?: number;
  description?: string;
  // Douane
  numeroDeclaration?: string;
  numeroBulletin?: string;
  dateDeclaration?: string;
  montantDroits?: number;
  montantTVA?: number;
  enregistreeSYDONIA?: boolean;
  // TVA intérieure
  typeAchat?: string;
  numeroFacture?: string;
  dateFacture?: string;
  montantTVAInterieure?: number;
  numeroDecompte?: string;
  /** Si true, l'utilisation reste au statut BROUILLON sans notification ni contrôle d'ouverture du certificat. */
  brouillon?: boolean;
}

export type TypeDocumentUtilisation =
  | "DEMANDE_UTILISATION"
  | "ORDRE_TRANSIT"
  | "DECLARATION_DOUANE"
  | "BULLETIN_LIQUIDATION"
  | "FACTURE"
  | "CONNAISSEMENT"
  | "CERTIFICAT_CREDIT_IMPOTS_SYDONIA"
  | "DECLARATION_TVA"
  | "DECOMPTE"
  | "AUTRE";

export const UTILISATION_DOC_TYPES_DOUANE: { value: TypeDocumentUtilisation; label: string }[] = [
  { value: "DEMANDE_UTILISATION", label: "Demande d'utilisation" },
  { value: "ORDRE_TRANSIT", label: "Ordre de transit" },
  { value: "DECLARATION_DOUANE", label: "Déclaration en douane" },
  { value: "BULLETIN_LIQUIDATION", label: "Bulletin de liquidation" },
  { value: "FACTURE", label: "Facture" },
  { value: "CONNAISSEMENT", label: "Connaissement" },
  { value: "CERTIFICAT_CREDIT_IMPOTS_SYDONIA", label: "Certificat crédit d'impôts SYDONIA" },
];

export const UTILISATION_DOC_TYPES_TVA: { value: TypeDocumentUtilisation; label: string }[] = [
  { value: "DEMANDE_UTILISATION", label: "Demande d'utilisation" },
  { value: "FACTURE", label: "Facture" },
  { value: "DECLARATION_TVA", label: "Déclaration TVA" },
  { value: "DECOMPTE", label: "Décompte" },
];

export const UTILISATION_DOCUMENT_TYPES: { value: TypeDocumentUtilisation; label: string }[] = [
  { value: "DEMANDE_UTILISATION", label: "Demande d'utilisation" },
  { value: "ORDRE_TRANSIT", label: "Ordre de transit" },
  { value: "DECLARATION_DOUANE", label: "Déclaration en douane" },
  { value: "BULLETIN_LIQUIDATION", label: "Bulletin de liquidation" },
  { value: "FACTURE", label: "Facture" },
  { value: "CONNAISSEMENT", label: "Connaissement" },
  { value: "CERTIFICAT_CREDIT_IMPOTS_SYDONIA", label: "Certificat crédit d'impôts SYDONIA" },
  { value: "DECLARATION_TVA", label: "Déclaration TVA" },
  { value: "DECOMPTE", label: "Décompte" },
  { value: "AUTRE", label: "Autre" },
];

export const utilisationCreditApi = {
  getAll: (params?: { demandeurSousTraitantOnly?: boolean }) => {
    const qs = params?.demandeurSousTraitantOnly ? "?demandeurSousTraitantOnly=true" : "";
    return apiFetch<UtilisationCreditDto[]>(`/utilisations-credit${qs}`);
  },
  getById: (id: number) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}`),
  getByCertificat: (certId: number) => apiFetch<UtilisationCreditDto[]>(`/utilisations-credit/by-certificat/${certId}`),
  create: (data: CreateUtilisationCreditRequest) => apiFetch<UtilisationCreditDto>("/utilisations-credit", { method: "POST", body: data }),
  /** Édition d'une utilisation (statut BROUILLON ou DEMANDEE). Le type ne peut pas changer. */
  update: (id: number, data: CreateUtilisationCreditRequest) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}`, { method: "PUT", body: data }),
  /** Soumission d'un brouillon : passe en DEMANDEE. */
  soumettre: (id: number) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/soumettre`, { method: "POST" }),
  /** Suppression définitive — réservée au statut BROUILLON. */
  remove: (id: number) => apiFetch<void>(`/utilisations-credit/${id}`, { method: "DELETE" }),
  updateStatut: (id: number, statut: UtilisationStatut) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/statut?statut=${statut}`, { method: "PATCH" }),
  liquiderDouane: (id: number, montantDroits: number, montantTVA: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/liquidation-douane`, {
      method: "POST",
      body: { montantDroits, montantTVA },
    }),
  apurerTVA: (id: number, tvaDeductibleUtilisee: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/apurement-tva`, {
      method: "POST",
      body: { tvaDeductibleUtilisee },
    }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/utilisations-credit/${id}/documents`),
  uploadDocument: (id: number, type: TypeDocumentUtilisation, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/utilisations-credit/${id}/documents?type=${encodeURIComponent(type)}`, {
      method: "POST",
      rawBody: formData,
    });
  },
  // Decisions (REJET_TEMP + VISA)
  getDecisions: (id: number) => apiFetch<DecisionCorrectionDto[]>(`/utilisations-credit/${id}/decisions`),
  postDecision: (id: number, decision: DecisionType, motifRejet?: string, documentsDemandes?: string[]) =>
    apiFetch<DecisionCorrectionDto>(`/utilisations-credit/${id}/decisions`, {
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
      if (typeDocument) formData.append("typeDocument", typeDocument);
      return apiFetch<RejetTempResponseDto>(`/utilisations-credit/decisions/${decisionId}/rejet-temp/reponses`, {
        method: "POST",
        rawBody: formData,
      });
    }

    return apiFetch<RejetTempResponseDto>(`/utilisations-credit/decisions/${decisionId}/rejet-temp/reponses`, {
      method: "POST",
      body: { message },
    });
  },
  // Résoudre manuellement un rejet temporaire
  resolveRejetTemp: (decisionId: number) =>
    apiFetch<DecisionCorrectionDto>(`/utilisations-credit/decisions/${decisionId}/resolve`, {
      method: "PUT",
    }),
};

// Audit Logs (P8 / Admin)
export interface AuditLogDto {
  id: number;
  username: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId?: number;
  details?: string;
  dateAction: string;
}

export interface PageAuditLogDto {
  content: AuditLogDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export const auditLogApi = {
  getAll: (params?: {
    username?: string;
    entityType?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.username) searchParams.set("username", params.username);
    if (params?.entityType) searchParams.set("entityType", params.entityType);
    if (params?.action) searchParams.set("action", params.action);
    if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
    if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
    searchParams.set("page", String(params?.page ?? 0));
    searchParams.set("size", String(params?.size ?? 20));
    return apiFetch<PageAuditLogDto>(`/audit-logs?${searchParams.toString()}`);
  },
};

// Statut labels
export const DEMANDE_STATUT_LABELS: Record<DemandeStatut, string> = {
  BROUILLON: "Brouillon",
  RECUE: "Reçue", INCOMPLETE: "Incomplète", RECEVABLE: "Recevable",
  EN_EVALUATION: "En évaluation", EN_VALIDATION: "En validation",
  ADOPTEE: "Adoptée", REJETEE: "Rejetée", NOTIFIEE: "Notifiée", ANNULEE: "Annulée",
};

export const CERTIFICAT_STATUT_LABELS: Record<CertificatStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  DEMANDE: "Demandé",
  EN_CONTROLE: "En contrôle",
  INCOMPLETE: "Incomplète",
  A_RECONTROLER: "À recontrôler",
  EN_VERIFICATION_DGI: "En vérification DGI",
  EN_VALIDATION_PRESIDENT: "En validation Président",
  VALIDE_PRESIDENT: "Validé Président",
  EN_OUVERTURE_DGTCP: "En ouverture DGTCP",
  OUVERT: "Ouvert",
  MODIFIE: "Modifié", CLOTURE: "Clôturé", ANNULE: "Annulé",
};

export const UTILISATION_STATUT_LABELS: Record<UtilisationStatut, string> = {
  BROUILLON: "Brouillon",
  DEMANDEE: "Demandée", INCOMPLETE: "Incomplète", A_RECONTROLER: "À recontrôler",
  EN_VERIFICATION: "En vérification", VISE: "Visé",
  VALIDEE: "Validée", LIQUIDEE: "Liquidée", APUREE: "Apurée", REJETEE: "Rejetée",
};

// Notifications
export type NotificationType = "CORRECTION_STATUT_CHANGE" | "CORRECTION_DECISION" | "REFERENTIEL_STATUT_CHANGE" | "CONVENTION_STATUT_CHANGE" | "CERTIFICAT_STATUT_CHANGE" | "UTILISATION_STATUT_CHANGE";

export interface NotificationDto {
  id: number;
  userId: number;
  type: NotificationType;
  entityType?: string;
  entityId?: number;
  message: string;
  payload?: string;
  read: boolean;
  createdAt?: string;
}

export const notificationApi = {
  getAll: () => apiFetch<NotificationDto[]>("/notifications"),
  getUnreadCount: () => apiFetch<number>("/notifications/unread-count"),
  markRead: (id: number) => apiFetch<void>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => apiFetch<void>("/notifications/read-all", { method: "PATCH" }),
};

// Bailleurs (référentiel)
export interface BailleurDto { id: number; nom: string; details?: string; }
export interface CreateBailleurRequest { nom: string; details?: string; }

export const bailleurApi = {
  getAll: () => apiFetch<BailleurDto[]>("/bailleurs"),
  create: (data: CreateBailleurRequest) => apiFetch<BailleurDto>("/bailleurs", { method: "POST", body: data }),
  /** Liste des conventions liées à un bailleur (droits convention.view ou convention.view.all). */
  getConventions: (id: number) => apiFetch<ConventionDto[]>(`/bailleurs/${id}/conventions`),
};

// Devises (référentiel)
export interface DeviseDto { id: number; code: string; libelle: string; symbole?: string; }
export interface CreateDeviseRequest { code: string; libelle: string; symbole?: string; }

export const deviseApi = {
  getAll: () => apiFetch<DeviseDto[]>("/devises"),
  create: (data: CreateDeviseRequest) => apiFetch<DeviseDto>("/devises", { method: "POST", body: data }),
};

// Taux de change
export interface TauxChangeResponse { devise: string; base: string; taux: number; source: string; }

export const tauxChangeApi = {
  get: (devise: string) => apiFetch<TauxChangeResponse>(`/taux-change?devise=${encodeURIComponent(devise)}`),
};

// Forex API (exchangerate.host)
export interface ForexConvertResponse { from: string; to: string; amount: number; result: number; source: string; }
export interface ForexRateResponse { from: string; to: string; rate: number; source: string; }

export const forexApi = {
  convert: (from: string, to: string, amount: number) =>
    apiFetch<ForexConvertResponse>(`/forex/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${amount}`),
  rate: (from: string, to: string) =>
    apiFetch<ForexRateResponse>(`/forex/rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};

// Document Requirements (GED)
export type ProcessusType = "CORRECTION_OFFRE_FISCALE" | "MISE_EN_PLACE_CI" | "UTILISATION_CI" | "UTILISATION_CI_EXTERIEUR" | "UTILISATION_CI_INTERIEUR" | "TRANSFERT_CREDIT" | "SOUS_TRAITANCE" | "CONVENTION" | "MARCHE" | "MODIFICATION_CI" | "CLOTURE_CI";
export type FormatFichier = "PDF" | "WORD" | "EXCEL" | "IMAGE";

export interface DocumentRequirementDto {
  id: number;
  processus: ProcessusType;
  typeDocument: string;
  obligatoire: boolean;
  typesAutorises: FormatFichier[];
  description?: string;
  ordreAffichage?: number;
}

export interface CreateDocumentRequirementRequest {
  processus: ProcessusType;
  typeDocument: string;
  obligatoire: boolean;
  typesAutorises: FormatFichier[];
  description?: string;
  ordreAffichage?: number;
}

export const documentRequirementApi = {
  getByProcessus: (processus: ProcessusType) =>
    apiFetch<DocumentRequirementDto[]>(`/document-requirements?processus=${processus}`),
  create: (data: CreateDocumentRequirementRequest) =>
    apiFetch<DocumentRequirementDto>("/document-requirements", { method: "POST", body: data }),
  update: (id: number, data: Partial<CreateDocumentRequirementRequest>) =>
    apiFetch<DocumentRequirementDto>(`/document-requirements/${id}`, { method: "PUT", body: data }),
  delete: (id: number) =>
    apiFetch<void>(`/document-requirements/${id}`, { method: "DELETE" }),
};

// Transferts de crédit (P9)
export type StatutTransfert = "DEMANDE" | "EN_COURS" | "VALIDE" | "TRANSFERE" | "REJETE";

export interface TransfertCreditDto {
  id: number;
  dateDemande?: string;
  certificatCreditId: number;
  certificatNumero?: string;
  entrepriseSourceId?: number;
  montant: string | number; // BigDecimal → string from backend
  operationsDouaneCloturees?: boolean;
  statut: StatutTransfert;
}

export interface CreateTransfertCreditRequest {
  certificatCreditId: number;
  montant: number;
  operationsDouaneCloturees?: boolean;
}

export interface DocumentTransfertCreditDto {
  id: number;
  type: string;
  nomFichier: string;
  chemin?: string;
  dateUpload?: string;
  taille?: number;
  version?: number;
  actif?: boolean;
}

export type TypeDocumentTransfert = "DEMANDE_MOTIVEE_TRANSFERT" | "DECLARATION_CLOTURE_DOUANE" | "JUSTIFICATIFS_CLOTURE_DOUANE";

export const TRANSFERT_DOCUMENT_TYPES: { value: TypeDocumentTransfert; label: string }[] = [
  { value: "DEMANDE_MOTIVEE_TRANSFERT", label: "Demande motivée" },
  { value: "DECLARATION_CLOTURE_DOUANE", label: "Déclaration clôture douane" },
  { value: "JUSTIFICATIFS_CLOTURE_DOUANE", label: "Justificatifs de clôture douane" },
];

export const TRANSFERT_STATUT_LABELS: Record<StatutTransfert, string> = {
  DEMANDE: "Demandé",
  EN_COURS: "En cours (pièces déposées)",
  VALIDE: "Ancien / réservé",
  TRANSFERE: "Transféré",
  REJETE: "Rejeté",
};

export const transfertCreditApi = {
  getAll: () => apiFetch<TransfertCreditDto[]>("/transferts-credit"),
  getById: (id: number) => apiFetch<TransfertCreditDto>(`/transferts-credit/${id}`),
  getByCertificat: (certificatCreditId: number) =>
    apiFetch<TransfertCreditDto>(`/transferts-credit/by-certificat/${certificatCreditId}`),
  create: (data: CreateTransfertCreditRequest) =>
    apiFetch<TransfertCreditDto>("/transferts-credit", { method: "POST", body: data }),
  valider: (id: number) =>
    apiFetch<TransfertCreditDto>(`/transferts-credit/${id}/valider`, { method: "POST" }),
  rejeter: (id: number) =>
    apiFetch<TransfertCreditDto>(`/transferts-credit/${id}/rejeter`, { method: "POST" }),
  getDocuments: (id: number) =>
    apiFetch<DocumentTransfertCreditDto[]>(`/transferts-credit/${id}/documents`),
  uploadDocument: (id: number, type: TypeDocumentTransfert, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentTransfertCreditDto>(
      `/transferts-credit/${id}/documents?type=${encodeURIComponent(type)}`,
      { method: "POST", rawBody: formData }
    );
  },
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

export const SOUS_TRAITANCE_DOCUMENT_TYPES: { value: TypeDocumentSousTraitance; label: string }[] = [
  { value: "CONTRAT_SOUS_TRAITANCE_ENREGISTRE", label: "Contrat de sous-traitance enregistré" },
  { value: "LETTRE_SOUS_TRAITANCE", label: "Lettre détaillant volumes, quantités et pouvoir" },
];

export const SOUS_TRAITANCE_STATUT_LABELS: Record<StatutSousTraitance, string> = {
  DEMANDE: "Demandé",
  EN_COURS: "En cours",
  AUTORISEE: "Autorisée",
  REFUSEE: "Refusée",
};

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
    apiFetch<DocumentSousTraitanceDto[]>(`/sous-traitances/${id}/documents`),
  uploadDocument: (id: number, type: TypeDocumentSousTraitance, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentSousTraitanceDto>(
      `/sous-traitances/${id}/documents?type=${encodeURIComponent(type)}`,
      { method: "POST", rawBody: formData }
    );
  },
};
// Clôture / Annulation (P9)
export type MotifCloture = "RECEPTION_DEFINITIVE" | "SOLDE_ZERO" | "EXPIRATION_VALIDITE" | "RENONCIATION";
export type TypeOperationCloture = "CLOTURE" | "ANNULATION";

export interface ClotureCreditDto {
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

export const clotureCreditApi = {
  getEligible: () => apiFetch<number[]>("/clotures-credit/eligible"),
  proposer: (data: CreateClotureCreditRequest) =>
    apiFetch<ClotureCreditDto>("/clotures-credit", { method: "POST", body: data }),
  getPropositions: () => apiFetch<ClotureCreditDto[]>("/clotures-credit/propositions"),
  valider: (id: number) =>
    apiFetch<ClotureCreditDto>(`/clotures-credit/${id}/valider`, { method: "POST" }),
  rejeter: (id: number) =>
    apiFetch<ClotureCreditDto>(`/clotures-credit/${id}/rejeter`, { method: "POST" }),
  finaliser: (id: number) =>
    apiFetch<ClotureCreditDto>(`/clotures-credit/${id}/finaliser`, { method: "POST" }),
  getDocuments: (id: number) => apiFetch<any[]>(`/clotures-credit/${id}/documents`),
  uploadDocument: (id: number, type: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<any>(
      `/clotures-credit/${id}/documents?type=${encodeURIComponent(type)}`,
      { method: "POST", rawBody: formData }
    );
  },
};

// Avenants / Modifications (P8)
export type StatutAvenant = "EN_ATTENTE" | "VALIDE" | "REJETE";

export interface AvenantDto {
  id: number;
  certificatCreditId?: number;
  certificatNumero?: string;
  marcheId?: number;
  marcheNumero?: string;
  type?: string;
  description?: string;
  statut: StatutAvenant;
  dateCreation?: string;
  dateMiseAJour?: string;
}

export interface DocumentAvenantDto {
  id: number;
  type: string;
  nomFichier: string;
  chemin?: string;
  dateUpload?: string;
  taille?: number;
  version?: number;
  actif?: boolean;
}

export type TypeDocumentAvenant =
  | "NOTE_SERVICE"
  | "JUSTIFICATIONS_LEGALES"
  | "LETTRES_MOTIVEES"
  | "AVENANT_CONTRAT"
  | "LETTRES_AUTORITE_CONTRACTANTE"
  | "DETAIL_CORRECTIONS_NECESSAIRES"
  | "DOCUMENTS_OFFICIELS"
  | "DECISION_COMMISSION"
  | "AUTRE_DOCUMENT";

export const AVENANT_DOCUMENT_TYPES: { value: TypeDocumentAvenant; label: string }[] = [
  { value: "NOTE_SERVICE", label: "Note de service" },
  { value: "JUSTIFICATIONS_LEGALES", label: "Justifications légales" },
  { value: "LETTRES_MOTIVEES", label: "Lettres motivées" },
  { value: "AVENANT_CONTRAT", label: "Avenant au contrat" },
  { value: "LETTRES_AUTORITE_CONTRACTANTE", label: "Lettres de l'autorité contractante" },
  { value: "DETAIL_CORRECTIONS_NECESSAIRES", label: "Détail des corrections nécessaires" },
  { value: "DOCUMENTS_OFFICIELS", label: "Documents officiels" },
  { value: "DECISION_COMMISSION", label: "Décision de la commission" },
  { value: "AUTRE_DOCUMENT", label: "Autre document" },
];

export const AVENANT_STATUT_LABELS: Record<StatutAvenant, string> = {
  EN_ATTENTE: "En attente",
  VALIDE: "Validé",
  REJETE: "Rejeté",
};

export const avenantApi = {
  // getAll and getById removed — backend only supports document endpoints
  getDocuments: (id: number) => apiFetch<DocumentAvenantDto[]>(`/avenants/${id}/documents`),
  uploadDocument: (id: number, type: TypeDocumentAvenant, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentAvenantDto>(
      `/avenants/${id}/documents?type=${encodeURIComponent(type)}`,
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

function buildReportingQuery(params?: ReportingParams): string {
  if (!params) return "";
  const parts: string[] = [];
  if (params.from) parts.push(`from=${encodeURIComponent(params.from)}`);
  if (params.to) parts.push(`to=${encodeURIComponent(params.to)}`);
  if (params.autoriteContractanteId) parts.push(`autoriteContractanteId=${params.autoriteContractanteId}`);
  if (params.entrepriseId) parts.push(`entrepriseId=${params.entrepriseId}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const reportingApi = {
  getSummary: (params?: ReportingParams) => apiFetch<ReportingSummaryDto>(`/reporting/summary${buildReportingQuery(params)}`, { skipAuthRedirect: true }),
  getDemandesTimeseries: (params?: ReportingParams) => apiFetch<TimeSeriesPointDto[]>(`/reporting/timeseries/demandes${buildReportingQuery(params)}`, { skipAuthRedirect: true }),
};

export { WS_BASE } from "./apiConfig";

// ── Dossiers GED ──

export interface DossierEtapeGed {
  etape: string;
  label: string;
  documents: Array<{
    id: number;
    nom: string;
    type: string;
    dateUpload?: string;
    taille?: number;
    url?: string;
  }>;
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

export const dossierGedApi = {
  getAll: () => apiFetch<DossierGedDto[]>("/dossiers"),
  getById: (id: number) => apiFetch<DossierGedDto>(`/dossiers/${id}`),
};
