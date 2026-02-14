const API_BASE = "https://8881-41-188-117-39.ngrok-free.app/api";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  rawBody?: FormData;
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
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erreur ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export interface LoginRequest { username: string; password: string; }
export interface RegisterRequest { username: string; password: string; role: string; nomComplet?: string; email?: string; entrepriseId?: number; }
export interface LoginResponse { token: string; type: string; userId: number; username: string; role: string; nomComplet: string; autoriteContractanteId?: number; entrepriseId?: number; }

export interface UtilisateurDto { id: number; username: string; role: string; nomComplet: string; email: string; actif: boolean; }

export const ROLE_OPTIONS = [
  { value: "ENTREPRISE", label: "Entreprise" },
  { value: "AUTORITE_CONTRACTANTE", label: "Autorité Contractante" },
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
  ENTREPRISE: "Entreprise",
};

export const authApi = {
  login: (data: LoginRequest) => apiFetch<LoginResponse>("/auth/login", { method: "POST", body: data }),
  register: (data: RegisterRequest) => apiFetch<LoginResponse>("/auth/register", { method: "POST", body: data }),
  me: () => apiFetch<Record<string, unknown>>("/auth/me"),
};

export interface UpdateUtilisateurRequest { username?: string; nomComplet?: string; email?: string; role?: string; }

export const utilisateurApi = {
  getAll: () => apiFetch<UtilisateurDto[]>("/utilisateurs"),
  getPending: () => apiFetch<UtilisateurDto[]>("/utilisateurs/pending"),
  setActif: (id: number, actif: boolean) => apiFetch<void>(`/utilisateurs/${id}/actif?actif=${actif}`, { method: "PATCH" }),
  create: (data: RegisterRequest) => apiFetch<LoginResponse>("/auth/register", { method: "POST", body: data }),
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
export type ReferentielStatut = "EN_ATTENTE" | "VALIDE" | "REJETE";

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
  updateStatut: (id: number, statut: "VALIDE" | "REJETE") => apiFetch<ReferentielProjetDto>(`/referentiels-projet/${id}/statut?statut=${statut}`, { method: "PATCH" }),
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
};

// Conventions
export type ConventionStatut = "EN_ATTENTE" | "VALIDE" | "REJETE";

export interface ConventionDto {
  id: number;
  reference?: string;
  intitule?: string;
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
  valideParUserId?: number;
  dateValidation?: string;
}

export interface CreateConventionRequest {
  reference?: string;
  intitule?: string;
  bailleur?: string;
  bailleurDetails?: string;
  dateSignature?: string;
  dateDebut?: string;
  dateFin?: string;
  montantDevise?: number;
  deviseOrigine?: string;
  montantMru?: number;
  tauxChange?: number;
}

export const CONVENTION_STATUT_LABELS: Record<ConventionStatut, string> = {
  EN_ATTENTE: "En attente",
  VALIDE: "Validée",
  REJETE: "Rejetée",
};

export const conventionApi = {
  getAll: () => apiFetch<ConventionDto[]>("/conventions"),
  getById: (id: number) => apiFetch<ConventionDto>(`/conventions/${id}`),
  getByStatut: (statut: ConventionStatut) => apiFetch<ConventionDto[]>(`/conventions/by-statut?statut=${statut}`),
  create: (data: CreateConventionRequest) => apiFetch<ConventionDto>("/conventions", { method: "POST", body: data }),
  updateStatut: (id: number, statut: ConventionStatut) => apiFetch<ConventionDto>(`/conventions/${id}/statut?statut=${statut}`, { method: "PATCH" }),
};

// Demandes de correction (P2)
export type DemandeStatut = "RECUE" | "INCOMPLETE" | "RECEVABLE" | "EN_EVALUATION" | "EN_VALIDATION" | "ADOPTEE" | "REJETEE" | "NOTIFIEE";

export interface DemandeCorrectionDto {
  id: number;
  numero?: string;
  statut: DemandeStatut;
  dateDepot?: string;
  autoriteContractanteId?: number;
  autoriteContractanteNom?: string;
  entrepriseId?: number;
  entrepriseRaisonSociale?: string;
  documents?: DocumentDto[];
}

export interface CreateDemandeCorrectionRequest {
  autoriteContractanteId?: number;
  entrepriseId: number;
}

export interface DocumentDto {
  id: number;
  type: string;
  nomFichier: string;
  dateUpload?: string;
  taille?: number;
}

export const DOCUMENT_TYPES = [
  "LETTRE_SAISINE", "PV_OUVERTURE", "ATTESTATION_FISCALE", "OFFRE_FINANCIERE",
  "TABLEAU_MODELE", "DAO_DQE", "LISTE_ITEMS", "CONTRAT", "CERTIFICAT_NIF",
  "LETTRE_CORRECTION", "BULLETIN_LIQUIDATION", "DECLARATION_DOUANE", "FACTURE",
  "CONNAISSEMENT", "DECOMPTE",
] as const;

export const demandeCorrectionApi = {
  getAll: () => apiFetch<DemandeCorrectionDto[]>("/demandes-correction"),
  getById: (id: number) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}`),
  getByStatut: (statut: DemandeStatut) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-statut?statut=${statut}`),
  getByAutorite: (autoriteId: number) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-autorite/${autoriteId}`),
  getByEntreprise: (entrepriseId: number) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-entreprise/${entrepriseId}`),
  create: (data: CreateDemandeCorrectionRequest) => apiFetch<DemandeCorrectionDto>("/demandes-correction", { method: "POST", body: data }),
  updateStatut: (id: number, statut: DemandeStatut) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}/statut?statut=${statut}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/demandes-correction/${id}/documents`),
  uploadDocument: (id: number, type: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/demandes-correction/${id}/documents?type=${encodeURIComponent(type)}`, {
      method: "POST",
      rawBody: formData,
    });
  },
};

// Certificats de crédit (P3)
export type CertificatStatut = "DEMANDE" | "EMIS" | "OUVERT" | "MODIFIE" | "CLOTURE" | "ANNULE";

export interface CertificatCreditDto {
  id: number;
  reference?: string;
  entrepriseId?: number;
  entrepriseNom?: string;
  statut: CertificatStatut;
  montantDouane?: number;
  montantInterieur?: number;
  montantTotal?: number;
  dateCreation?: string;
  dateMiseAJour?: string;
}

export interface CreateCertificatCreditRequest {
  entrepriseId: number;
  demandeCorrectionId?: number;
  montantDouane?: number;
  montantInterieur?: number;
}

export const certificatCreditApi = {
  getAll: () => apiFetch<CertificatCreditDto[]>("/certificats-credit"),
  getById: (id: number) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}`),
  getByStatut: (statut: CertificatStatut) => apiFetch<CertificatCreditDto[]>(`/certificats-credit/by-statut?statut=${statut}`),
  getByEntreprise: (entrepriseId: number) => apiFetch<CertificatCreditDto[]>(`/certificats-credit/by-entreprise/${entrepriseId}`),
  create: (data: CreateCertificatCreditRequest) => apiFetch<CertificatCreditDto>("/certificats-credit", { method: "POST", body: data }),
  updateStatut: (id: number, statut: CertificatStatut) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/statut?statut=${statut}`, { method: "PATCH" }),
};

// Utilisations de crédit (P4/P5)
export type UtilisationStatut = "DEMANDEE" | "EN_VERIFICATION" | "VISE" | "VALIDEE" | "LIQUIDEE" | "APUREE" | "REJETEE";
export type UtilisationType = "DOUANE" | "INTERIEUR";

export interface UtilisationCreditDto {
  id: number;
  certificatCreditId: number;
  type?: UtilisationType;
  montant?: number;
  statut: UtilisationStatut;
  dateCreation?: string;
  dateMiseAJour?: string;
  description?: string;
  entrepriseNom?: string;
  certificatReference?: string;
}

export interface CreateUtilisationCreditRequest {
  certificatCreditId: number;
  type?: UtilisationType;
  montant?: number;
  description?: string;
}

export const utilisationCreditApi = {
  getAll: () => apiFetch<UtilisationCreditDto[]>("/utilisations-credit"),
  getById: (id: number) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}`),
  getByCertificat: (certId: number) => apiFetch<UtilisationCreditDto[]>(`/utilisations-credit/by-certificat/${certId}`),
  create: (data: CreateUtilisationCreditRequest) => apiFetch<UtilisationCreditDto>("/utilisations-credit", { method: "POST", body: data }),
  updateStatut: (id: number, statut: UtilisationStatut) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/statut?statut=${statut}`, { method: "PATCH" }),
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
  RECUE: "Reçue", INCOMPLETE: "Incomplète", RECEVABLE: "Recevable",
  EN_EVALUATION: "En évaluation", EN_VALIDATION: "En validation",
  ADOPTEE: "Adoptée", REJETEE: "Rejetée", NOTIFIEE: "Notifiée",
};

export const CERTIFICAT_STATUT_LABELS: Record<CertificatStatut, string> = {
  DEMANDE: "Demandé", EMIS: "Émis", OUVERT: "Ouvert",
  MODIFIE: "Modifié", CLOTURE: "Clôturé", ANNULE: "Annulé",
};

export const UTILISATION_STATUT_LABELS: Record<UtilisationStatut, string> = {
  DEMANDEE: "Demandée", EN_VERIFICATION: "En vérification", VISE: "Visé",
  VALIDEE: "Validée", LIQUIDEE: "Liquidée", APUREE: "Apurée", REJETEE: "Rejetée",
};
