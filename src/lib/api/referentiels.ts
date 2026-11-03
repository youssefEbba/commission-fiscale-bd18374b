import { apiFetch } from "./client";
import type { ConventionDto } from "./entites";
export const bailleurApi = {
  getAll: () => apiFetch<BailleurDto[]>("/bailleurs"),
  create: (data: CreateBailleurRequest) => apiFetch<BailleurDto>("/bailleurs", { method: "POST", body: data }),
  /** Président / administrateur (`bailleur.update`). */
  update: (id: number, data: UpdateBailleurRequest) => apiFetch<BailleurDto>(`/bailleurs/${id}`, { method: "PUT", body: data }),
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
export type ProcessusType = "CORRECTION_OFFRE_FISCALE" | "MISE_EN_PLACE_CI" | "UTILISATION_CI" | "UTILISATION_CI_EXTERIEUR" | "UTILISATION_CI_INTERIEUR" | "TRANSFERT_CREDIT" | "SOUS_TRAITANCE" | "CONVENTION" | "MARCHE" | "MODIFICATION_CI" | "CLOTURE_CI" | "RATTACHEMENT_COMPTE";
export type FormatFichier = "PDF" | "WORD" | "EXCEL" | "IMAGE";

export interface DocumentRequirementDto {
  id: number;
  processus: ProcessusType;
  typeDocument?: string;
  codeDocument?: string;
  libelle?: string;
  obligatoire: boolean;
  typesAutorises: FormatFichier[];
  description?: string;
  ordreAffichage?: number;
  /** true = pièce apportée par le demandeur ; false = produite par la Commission. */
  deposableParLeDemandeur?: boolean;
  /** ENTREE = fournie par le déposant ; SORTIE = produite par la Commission. Absent ⇒ ENTREE. */
  sens?: DocumentSens;
  /** false = pièce désactivée (reste listée en configuration seulement). Absent ⇒ active. */
  actif?: boolean;
  /** true = pièce exigée par le circuit : ni désactivable ni supprimable. */
  pieceDuCircuit?: boolean;
}

export type DocumentSens = "ENTREE" | "SORTIE";

/** Une pièce est active sauf si le serveur renvoie explicitement `actif: false`. */
export const isRequirementActive = (r: Pick<DocumentRequirementDto, "actif">) => r.actif !== false;

export interface CreateDocumentRequirementRequest {
  processus: ProcessusType;
  typeDocument?: string;
  codeDocument?: string;
  libelle?: string; // création inline d'un nouveau type dans le référentiel
  obligatoire: boolean;
  typesAutorises: FormatFichier[];
  description?: string;
  ordreAffichage?: number;
  sens?: DocumentSens;
}

const requirementsUrl = (processus: ProcessusType, depot?: boolean) =>
  `/document-requirements?processus=${processus}${depot ? "&depot=true" : ""}`;

export const documentRequirementApi = {
  /**
   * Pièces actives d'un process (pièces attendues, compteurs, pièces à réclamer…).
   * Les pièces désactivées sont écartées ici, une fois pour tous les écrans métier.
   * `depot: true` → uniquement les pièces déposables par le demandeur (formulaire de dépôt).
   */
  getByProcessus: async (processus: ProcessusType, opts: { depot?: boolean } = {}) =>
    (await apiFetch<DocumentRequirementDto[]>(requirementsUrl(processus, opts.depot))).filter(isRequirementActive),
  /** Écran de configuration uniquement : inclut les pièces désactivées pour pouvoir les réactiver. */
  getConfiguration: (processus: ProcessusType) =>
    apiFetch<DocumentRequirementDto[]>(requirementsUrl(processus)),
  create: (data: CreateDocumentRequirementRequest) =>
    apiFetch<DocumentRequirementDto>("/document-requirements", { method: "POST", body: data }),
  update: (id: number, data: Partial<CreateDocumentRequirementRequest>) =>
    apiFetch<DocumentRequirementDto>(`/document-requirements/${id}`, { method: "PUT", body: data }),
  setActivation: (id: number, actif: boolean) =>
    apiFetch<DocumentRequirementDto>(`/document-requirements/${id}/activation?actif=${actif}`, { method: "PATCH" }),
  delete: (id: number) =>
    apiFetch<void>(`/document-requirements/${id}`, { method: "DELETE" }),
};

// Référentiel des types de documents (catalogue global, paramétrable)
export interface ReferentielTypeDocumentDto {
  code: string;
  libelle: string;
  libelleAr?: string | null;
  actif: boolean;
  systeme?: boolean;
}

export interface CreateReferentielTypeDocumentRequest {
  code: string;
  libelle: string;
  libelleAr?: string | null;
  actif?: boolean;
}

export const referentielTypeDocumentApi = {
  list: (actifOnly = false) =>
    apiFetch<ReferentielTypeDocumentDto[]>(`/referentiel/types-document${actifOnly ? "?actif=true" : ""}`),
  get: (code: string) =>
    apiFetch<ReferentielTypeDocumentDto>(`/referentiel/types-document/${encodeURIComponent(code)}`),
  create: (data: CreateReferentielTypeDocumentRequest) =>
    apiFetch<ReferentielTypeDocumentDto>("/referentiel/types-document", { method: "POST", body: data }),
  update: (code: string, data: Partial<CreateReferentielTypeDocumentRequest>) =>
    apiFetch<ReferentielTypeDocumentDto>(`/referentiel/types-document/${encodeURIComponent(code)}`, { method: "PUT", body: data }),
  delete: (code: string) =>
    apiFetch<void>(`/referentiel/types-document/${encodeURIComponent(code)}`, { method: "DELETE" }),
};

// Transferts de crédit (P9)
export type StatutTransfert = "DEMANDE" | "EN_COURS" | "VALIDE" | "INCOMPLETE" | "A_RECONTROLER" | "TRANSFERE" | "REJETE" | "ANNULEE";

export interface TransfertCreditDto {
  id: number;
  dateDemande?: string;
  certificatCreditId: number;
  /** Référence lisible du crédit (CR-…) — à afficher en priorité. */
  certificatReference?: string | null;
  certificatNumero?: string;
  entrepriseSourceId?: number;
  montant: string | number; // BigDecimal → string from backend
  operationsDouaneCloturees?: boolean;
  statut: StatutTransfert;
}

export interface CreateTransfertCreditRequest {
  certificatCreditId: number;
  /** Optionnel : si absent, le back utilise le restant TVA importation cordon (d) actuel comme indicatif. */
  montant?: number;
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

// Pièces du transfert : paramétrées dans la GED (processus TRANSFERT_CREDIT), lues via `useGedPieces`.


// TRANSFERT_STATUT_LABELS supprimée (orpheline, détectée en POLISH-1).
// Libellés via `tStatutTransfert(code)` (cf. `enums.statut_transfert.*`).

export type TransfertVisaRole = "DGD" | "DGI" | "DGTCP" | "PRESIDENT";
export type TransfertCodeBlocage =
  | "ROLE_NON_HABILITE" | "STATUT_INCOMPATIBLE" | "VISA_DEJA_POSE"
  | "REJET_TEMP_OUVERT" | "VISA_PREALABLE_MANQUANT" | (string & {});

export interface TransfertVisaEtatDto {
  role: TransfertVisaRole;
  rang: number;
  pose: boolean;
  decisionId?: number | null;
  datePose?: string | null;
  utilisateurId?: number | null;
  utilisateurNom?: string | null;
  visablePourMoi: boolean;
  codeBlocage?: TransfertCodeBlocage | null;
  motifBlocage?: string | null;
  visaPrealableManquant?: TransfertVisaRole | null;
}

