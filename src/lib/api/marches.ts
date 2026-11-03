import { apiFetch, normalizeDocs } from "./client";
import type { DecisionCorrectionDto, DocumentDto } from "./demandes";
export type StatutMarche = "EN_COURS" | "AVENANT" | "CLOTURE" | "ANNULE";

export interface MarcheDto {
  id: number;
  /** Référence lisible (`DM-NNNN-MM-AAAA`). */
  reference?: string;
  conventionId?: number;
  demandeCorrectionId?: number;
  numeroMarche?: string;
  intitule?: string;
  dateSignature?: string;
  /** Montant HT (nom canonique côté back). */
  montantContratHt?: number;
  /** Montant TTC du contrat. */
  montantContratTtc?: number;
  /** Devise du contrat (MRU par défaut). */
  deviseOrigine?: string;
  statut: StatutMarche;
  delegueIds?: number[];
  /** Nullable : les marchés anciens n'en portent pas — afficher « non renseigné », jamais de défaut. */
  typeMarche?: TypeMarche | null;
  /** Toutes les conventions du marché, la principale (`conventionId`) en tête. */
  conventionIds?: number[];
  /** Autorité contractante qui porte le marché. */
  autoriteContractanteId?: number;
  autoriteContractanteNom?: string;
}

export type TypeMarche = "FOURNITURE" | "PRESTATION" | "TRAVAUX";
export const TYPE_MARCHE_VALUES: TypeMarche[] = ["FOURNITURE", "PRESTATION", "TRAVAUX"];

/** Devises supportées pour les montants de contrat. */
export const DEVISES = ["MRU", "USD", "EUR", "CNY", "AED", "SAR", "MAD", "GBP"] as const;

export interface CreateMarcheRequest {
  /** Convention principale (obligatoire à la création) = `conventionIds[0]`. */
  conventionId?: number;
  /**
   * Toutes les conventions, la principale en tête. Facultatif à la création ;
   * en modification, réservé au Président et à l'administrateur (le premier devient la principale).
   */
  conventionIds?: number[];
  demandeCorrectionId?: number;
  numeroMarche?: string;
  intitule?: string;
  dateSignature?: string;
  /** Montant hors taxes du contrat. */
  montantContratHt?: number;
  /** Montant toutes taxes comprises du contrat. */
  montantContratTtc?: number;
  /** Devise des montants (MRU par défaut). */
  deviseOrigine?: string;
  statut?: StatutMarche;
  /** Facultatif : absent = le serveur conserve la valeur existante. */
  typeMarche?: TypeMarche | null;
}

/**
 * Valeurs ordonnées de StatutMarche pour les filtres / dropdowns.
 * Libellés via `tStatutMarche(code)` (cf. `enums.statut_marche.*`).
 */
export const MARCHE_STATUT_VALUES: readonly StatutMarche[] = [
  "EN_COURS", "AVENANT", "CLOTURE", "ANNULE",
] as const;

export type TypeDocumentMarche =
  | "PV_ADJUDICATION"
  | "AVIS_ATTRIBUTION"
  | "CONTRAT_SIGNE"
  | "AUTRE";

/**
 * Codes des types de documents Marché.
 * Libellés résolus via `tTypeDocument(code)` côté UI.
 */
export const MARCHE_DOCUMENT_TYPES: readonly TypeDocumentMarche[] = [
  "PV_ADJUDICATION", "AVIS_ATTRIBUTION", "CONTRAT_SIGNE", "AUTRE",
] as const;


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
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/marches/${id}/documents`).then(normalizeDocs),
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
  /** (c) Taxes de consommation (facultatif) — incluses dans le crédit extérieur. */
  taxesConsommation?: number;
  /** (f) Montant du marché HT */
  montantMarcheHt?: number;
  /** (g) TVA collectée sur les travaux */
  tvaCollecteeTravaux?: number;
}

export interface CertificatCreditDto extends CertificatRecapFiscal {
  /** Dérivé de la demande d'origine, lecture seule. */
  equipementsPresents?: boolean | null;
  id: number;
  reference?: string;
  numero?: string;
  autoriteContractanteNom?: string;
  autoriteContractanteMinistereTutelleNom?: string;
  autoriteContractanteMinistereTutelleCode?: string;
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
  dateEmission?: string;
  /** Date de mise en place effective (posée au passage OUVERT). Utilisée par le journal daté. */
  dateMiseEnPlace?: string;
  dateMiseAJour?: string;
  dateValidite?: string;
  lettreCorrectionId?: number;
  demandeCorrectionId?: number;
  demandeCorrectionNumero?: string;
  /** Référence lisible de la demande de correction d'origine (DC-…). */
  demandeCorrectionReference?: string | null;
  marcheId?: number;
  /** Numéro du marché (saisi par l'autorité). */
  marcheNumero?: string | null;
  /** Référence lisible du marché (DM-…). */
  marcheReference?: string | null;
  marcheIntitule?: string;
  /** (e) = b + c + d, calculé côté back si b et d présents */
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

/** Réponse de l'endpoint d'éligibilité d'utilisation d'un certificat de crédit. */
export interface CertificatUtilisationEligibilityDto {
  eligible: boolean;
  statutCertificat?: string;
  motifs: string[];
  soldeCordon?: number;
  tvaImportationDouane?: number;
  soldeTVA?: number;
  transfertExecute?: boolean;
  clotureEnCours?: boolean;
  dateValidite?: string;
  expire?: boolean;
}

/** État d'un visa du certificat (vue administrateur) — aucun ordre imposé entre visas. */
export interface CertificatVisaEtatDto {
  role: "DGI" | "DGD" | "DGTCP" | "PRESIDENT";
  requis: boolean;
  pose: boolean;
  decisionId: number | null;
  datePose: string | null;
  utilisateurId: number | null;
  utilisateurNom: string | null;
  visaParAdmin: boolean;
  codeDocumentRequis: string | null;
  documentRequisPresent: boolean;
  rejetTempOuvert: boolean;
  /** Toujours null pour le certificat (aucun ordre imposé). */
  visaPrealableManquant: null;
  visableParAdmin: boolean;
  /** Message destiné à l'utilisateur — à afficher tel quel, jamais à interpréter. */
  motifBlocage: string | null;
  /** Code stable du blocage (null si rien ne bloque) — seule base de la logique d'affichage. */
  codeBlocage: CertificatVisaCodeBlocage | null;
}

export type CertificatVisaCodeBlocage =
  | "ROLE_NON_HABILITE"
  | "ROLE_NON_CONCERNE"
  | "STATUT_INCOMPATIBLE"
  | "VISA_DEJA_POSE"
  | "REJET_TEMP_OUVERT"
  | "MONTANTS_MANQUANTS"
  | "DEJA_VALIDE"
  | "DOCUMENT_MANQUANT"
  // Tolère un futur code sans casser le typage.
  | (string & {});

export interface CertificatVisaAdminResponseDto {
  certificat: CertificatCreditDto;
  decision: DecisionCorrectionDto | null;
  document: DocumentDto | null;
  visas: CertificatVisaEtatDto[];
}

