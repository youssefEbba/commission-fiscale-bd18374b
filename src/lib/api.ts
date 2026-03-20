const API_BASE = "https://f07a-197-231-3-232.ngrok-free.app/api";

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
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      window.location.href = "/login";
      throw new Error("Session expirée");
    }
    if (res.status === 403) {
      throw new Error("Accès refusé");
    }
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erreur ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export interface LoginRequest { username: string; password: string; }
export interface RegisterRequest { username: string; password: string; role: string; nomComplet?: string; email?: string; entrepriseId?: number; entrepriseRaisonSociale?: string; entrepriseNif?: string; entrepriseAdresse?: string; entrepriseSituationFiscale?: string; autoriteContractanteId?: number; }
export interface LoginResponse { token: string; type: string; userId: number; username: string; role: string; nomComplet: string; autoriteContractanteId?: number; entrepriseId?: number; }

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
  updateStatut: (id: number, statut: "VALIDE" | "REJETE", motifRejet?: string) => apiFetch<ReferentielProjetDto>(`/referentiels-projet/${id}/statut?statut=${statut}${motifRejet ? `&motifRejet=${encodeURIComponent(motifRejet)}` : ""}`, { method: "PATCH" }),
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
  motifRejet?: string;
}

export interface CreateConventionRequest {
  reference?: string;
  intitule?: string;
  bailleur?: string;
  bailleurDetails?: string;
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
  getAll: () => apiFetch<ConventionDto[]>("/conventions"),
  getById: (id: number) => apiFetch<ConventionDto>(`/conventions/${id}`),
  getByStatut: (statut: ConventionStatut) => apiFetch<ConventionDto[]>(`/conventions/statut/${statut}`),
  create: (data: CreateConventionRequest) => apiFetch<ConventionDto>("/conventions", { method: "POST", body: data }),
  updateStatut: (id: number, statut: ConventionStatut, motifRejet?: string) => apiFetch<ConventionDto>(`/conventions/${id}/statut?statut=${statut}${motifRejet ? `&motifRejet=${encodeURIComponent(motifRejet)}` : ""}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/conventions/${id}/documents`),
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

export interface DecisionCorrectionDto {
  id: number;
  role: string;
  decision: DecisionType;
  motifRejet?: string;
  dateDecision?: string;
  utilisateurId?: number;
  utilisateurNom?: string;
}

export const DOCUMENT_TYPES_REQUIS: { value: string; label: string }[] = [
  { value: "LETTRE_SAISINE", label: "Lettre de saisine" },
  { value: "OFFRE_FINANCIERE", label: "Offre financière (table de calcul)" },
  { value: "TABLEAU_MODELE", label: "Tableau modèle" },
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
  updateStatut: (id: number, statut: DemandeStatut, motifRejet?: string, decisionFinale?: boolean) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}/statut?statut=${statut}${motifRejet ? `&motifRejet=${encodeURIComponent(motifRejet)}` : ""}${decisionFinale ? `&decisionFinale=true` : ""}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/demandes-correction/${id}/documents`),
  uploadDocument: (id: number, type: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/demandes-correction/${id}/documents?type=${encodeURIComponent(type)}`, {
      method: "POST",
      rawBody: formData,
    });
  },
  // Décisions temporaires
  getDecisions: (id: number) => apiFetch<DecisionCorrectionDto[]>(`/demandes-correction/${id}/decisions`),
  postDecision: (id: number, decision: DecisionType, motifRejet?: string) =>
    apiFetch<DecisionCorrectionDto>(`/demandes-correction/${id}/decisions`, {
      method: "POST",
      body: motifRejet ? { decision, motifRejet } : { decision },
    }),
};

// Marchés
export type StatutMarche = "EN_COURS" | "AVENANT" | "CLOTURE";

export interface MarcheDto {
  id: number;
  conventionId?: number;
  demandeCorrectionId?: number;
  numeroMarche?: string;
  dateSignature?: string;
  montantContratTtc?: number;
  statut: StatutMarche;
  delegueIds?: number[];
}

export interface CreateMarcheRequest {
  conventionId: number;
  demandeCorrectionId?: number;
  numeroMarche?: string;
  dateSignature?: string;
  montantContratTtc?: number;
  statut?: StatutMarche;
}

export const MARCHE_STATUT_LABELS: Record<StatutMarche, string> = {
  EN_COURS: "En cours",
  AVENANT: "Avenant",
  CLOTURE: "Clôturé",
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
  getAll: () => apiFetch<MarcheDto[]>("/marches"),
  getById: (id: number) => apiFetch<MarcheDto>(`/marches/${id}`),
  getByCorrection: (demandeCorrectionId: number) => apiFetch<MarcheDto>(`/marches/by-correction/${demandeCorrectionId}`),
  create: (data: CreateMarcheRequest) => apiFetch<MarcheDto>("/marches", { method: "POST", body: data }),
  update: (id: number, data: Partial<CreateMarcheRequest>) => apiFetch<MarcheDto>(`/marches/${id}`, { method: "PUT", body: data }),
  assign: (id: number, delegueId: number) => apiFetch<MarcheDto>(`/marches/${id}/assign?delegueId=${delegueId}`, { method: "PATCH" }),
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

export const delegueApi = {
  getAll: () => apiFetch<DelegueDto[]>("/delegues"),
  create: (data: CreateDelegueRequest) => apiFetch<DelegueDto>("/delegues", { method: "POST", body: data }),
  setActif: (id: number, actif: boolean) => apiFetch<DelegueDto>(`/delegues/${id}/actif?actif=${actif}`, { method: "PATCH" }),
};

// Certificats de crédit (P3)
export type CertificatStatut = "DEMANDE" | "EN_VERIFICATION_DGI" | "EN_VALIDATION_PRESIDENT" | "VALIDE_PRESIDENT" | "EN_OUVERTURE_DGTCP" | "OUVERT" | "MODIFIE" | "CLOTURE" | "ANNULE";

export interface CertificatCreditDto {
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
}

export interface CreateCertificatCreditRequest {
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
}

export const certificatCreditApi = {
  getAll: () => apiFetch<CertificatCreditDto[]>("/certificats-credit"),
  getById: (id: number) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}`),
  getByStatut: (statut: CertificatStatut) => apiFetch<CertificatCreditDto[]>(`/certificats-credit/by-statut?statut=${statut}`),
  getByEntreprise: (entrepriseId: number) => apiFetch<CertificatCreditDto[]>(`/certificats-credit/by-entreprise/${entrepriseId}`),
  create: (data: CreateCertificatCreditRequest) => apiFetch<CertificatCreditDto>("/certificats-credit", { method: "POST", body: data }),
  updateStatut: (id: number, statut: CertificatStatut) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/statut?statut=${statut}`, { method: "PATCH" }),
  updateMontants: (id: number, montantCordon: number, montantTVAInterieure: number) =>
    apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/montants`, {
      method: "PATCH",
      body: { montantCordon, montantTVAInterieure },
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
};

// Utilisations de crédit (P4/P5)
export type UtilisationStatut = "DEMANDEE" | "EN_VERIFICATION" | "VISE" | "VALIDEE" | "LIQUIDEE" | "APUREE" | "REJETEE";
export type UtilisationType = "DOUANIER" | "TVA_INTERIEURE";

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
  // TVA intérieure fields
  typeAchat?: string;
  numeroFacture?: string;
  dateFacture?: string;
  montantTVAInterieure?: number;
  numeroDecompte?: string;
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
  getAll: () => apiFetch<UtilisationCreditDto[]>("/utilisations-credit"),
  getById: (id: number) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}`),
  getByCertificat: (certId: number) => apiFetch<UtilisationCreditDto[]>(`/utilisations-credit/by-certificat/${certId}`),
  create: (data: CreateUtilisationCreditRequest) => apiFetch<UtilisationCreditDto>("/utilisations-credit", { method: "POST", body: data }),
  updateStatut: (id: number, statut: UtilisationStatut) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/statut?statut=${statut}`, { method: "PATCH" }),
  liquiderDouane: (id: number, montantDroits: number, montantTVA: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/liquidation-douane`, {
      method: "POST",
      body: { montantDroits, montantTVA },
    }),
  apurerTVA: (id: number, montantTVA: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/apurement-tva`, {
      method: "POST",
      body: { montantTVA },
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
  DEMANDE: "Demandé",
  EN_VERIFICATION_DGI: "En vérification DGI",
  EN_VALIDATION_PRESIDENT: "En validation Président",
  VALIDE_PRESIDENT: "Validé Président",
  EN_OUVERTURE_DGTCP: "En ouverture DGTCP",
  OUVERT: "Ouvert",
  MODIFIE: "Modifié", CLOTURE: "Clôturé", ANNULE: "Annulé",
};

export const UTILISATION_STATUT_LABELS: Record<UtilisationStatut, string> = {
  DEMANDEE: "Demandée", EN_VERIFICATION: "En vérification", VISE: "Visé",
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

// Transferts de crédit (P7)
export type StatutTransfert = "DEMANDE" | "EN_COURS" | "VALIDE" | "TRANSFERE" | "REJETE";

export interface TransfertCreditDto {
  id: number;
  dateDemande?: string;
  certificatCreditId: number;
  certificatNumero?: string;
  entrepriseSourceId?: number;
  montant: number;
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
  EN_COURS: "En cours",
  VALIDE: "Validé",
  TRANSFERE: "Transféré",
  REJETE: "Rejeté",
};

export const transfertCreditApi = {
  getAll: () => apiFetch<TransfertCreditDto[]>("/transferts-credit"),
  getById: (id: number) => apiFetch<TransfertCreditDto>(`/transferts-credit/${id}`),
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
  getAll: () => apiFetch<AvenantDto[]>("/avenants"),
  getById: (id: number) => apiFetch<AvenantDto>(`/avenants/${id}`),
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

export const WS_BASE = "https://f07a-197-231-3-232.ngrok-free.app/ws";

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
