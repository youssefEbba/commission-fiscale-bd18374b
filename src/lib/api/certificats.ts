import { apiFetch, normalizeDocs } from "./client";
import { buildCorrectionDecisionBody, type CorrectionMontants } from "../correctionMontants";
import type { PageResponse } from "./auth";
import type { DecisionCorrectionDto, DocumentDto } from "./demandes";
import type {
  CertificatCreditDto,
  CertificatStatut,
  CreateCertificatCreditRequest,
  CertificatRecapFiscal,
  UpdateCertificatCreditMontantsRequest,
} from "./marches";
export const certificatCreditApi = {
  getAll: () => apiFetch<CertificatCreditDto[]>("/certificats-credit"),
  getById: (id: number) => apiFetch<CertificatCreditDto>(`/certificats-credit/${id}`),
  /** Éligibilité du certificat pour une nouvelle utilisation (DOUANIER ou TVA_INTERIEURE). */
  getEligibiliteUtilisation: (id: number, type: UtilisationType) =>
    apiFetch<CertificatUtilisationEligibilityDto>(`/certificats-credit/${id}/eligibilite-utilisation?type=${type}`),
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
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/certificats-credit/${id}/documents`).then(normalizeDocs),
  uploadDocument: (id: number, type: string, file: File, message?: string, modeApposition?: ModeApposition) => {
    const formData = new FormData();
    formData.append("codeDocument", type);
    formData.append("file", file);
    if (message) formData.append("message", message);
    if (modeApposition) formData.append("modeApposition", modeApposition);
    return apiFetch<DocumentDto>(`/certificats-credit/${id}/documents`, { method: "POST", rawBody: formData });
  },
  // Stock TVA déductible
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
  /** État ordonné des visas du certificat (DGI, DGD, DGTCP, PRESIDENT) — vue administrateur. */
  getVisas: (id: number) => apiFetch<CertificatVisaEtatDto[]>(`/certificats-credit/${id}/visas`),
  /** Pose du visa par l'administrateur à la place du titulaire (multipart). */
  poserVisaAdmin: (id: number, role: string, motif: string, file?: File | null) => {
    const fd = new FormData();
    fd.append("role", role);
    fd.append("motif", motif);
    if (file) fd.append("file", file);
    return apiFetch<CertificatVisaAdminResponseDto>(`/certificats-credit/${id}/visas/admin`, {
      method: "POST",
      rawBody: fd,
    });
  },
  /** Ouverture du crédit par l'administrateur (effet financier — initialise les soldes). */
  ouvertureAdmin: (id: number, motif: string) =>
    apiFetch<CertificatCreditDto>(
      `/certificats-credit/${id}/ouverture/admin?motif=${encodeURIComponent(motif)}`,
      { method: "POST" },
    ),
  /** Prise en charge par l'administrateur (ENVOYEE → EN_CONTROLE). */
  priseEnChargeAdmin: (id: number, motif: string) =>
    apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/prise-en-charge/admin?motif=${encodeURIComponent(motif)}`, { method: "POST" }),
  /** Saisie des montants par l'administrateur à la place de la DGTCP. */
  montantsAdmin: (id: number, motif: string, body: UpdateCertificatCreditMontantsRequest) =>
    apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/montants/admin?motif=${encodeURIComponent(motif)}`, { method: "POST", body }),
  /** Résolution administrateur d'un rejet temporaire, quel que soit le rôle auteur. */
  resolveRejetTempAdmin: (decisionId: number, motif: string) =>
    apiFetch<DecisionCorrectionDto>(`/certificats-credit/decisions/${decisionId}/resolve/admin?motif=${encodeURIComponent(motif)}`, { method: "PUT" }),
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

// ============= Consultation crédits (Phase E) =============

export interface CertificatCreditSearchParams {
  nif?: string;
  /** Raison sociale ou NIF, « contient », insensible à la casse. */
  entreprise?: string;
  numeroMarche?: string;
  conventionRef?: string;
  projet?: string;
  autoriteContractanteId?: number;
  statut?: CertificatStatut;
  from?: string; // ISO Instant
  to?: string;   // ISO Instant
  page?: number;
  size?: number;
}

export interface CertificatCreditJournalDto {
  certificats: PageResponse<CertificatCreditDto>;
  nombreCredits: number;
  totalMontantCordon: number;
  totalMontantTVAInterieure: number;
  totalSoldeCordon: number;
  totalSoldeTVA: number;
}

export interface CertificatCreditFicheDto {
  certificat: CertificatCreditDto;
  entreprise?: EntrepriseDto;
  groupement?: GroupementDto | null;
  convention?: ConventionDto;
  marche?: MarcheDto;
  autoriteContractante?: AutoriteContractanteDto;
  intituleMarche?: string;
  /** Référence de l'appel d'offres de la demande de correction d'origine. */
  referenceAppelOffre?: string | null;
  documents?: DocumentDto[];
  utilisations?: UtilisationCreditDto[];
  tvaStock?: TvaDeductibleStockDto[];
}

export const certificatCreditConsultation = {
  search: (params: CertificatCreditSearchParams = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const query = qs.toString();
    return apiFetch<PageResponse<CertificatCreditDto>>(
      `/certificats-credit/search${query ? `?${query}` : ""}`
    );
  },
  journal: (params: { from?: string; to?: string; page?: number; size?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const query = qs.toString();
    return apiFetch<CertificatCreditJournalDto>(
      `/certificats-credit/journal${query ? `?${query}` : ""}`
    );
  },
  /** Référence contenant "/" — passée en query param, encodée automatiquement. */
  fiche: (reference: string) =>
    apiFetch<CertificatCreditFicheDto>(
      `/certificats-credit/fiche?reference=${encodeURIComponent(reference)}`
    ),
};

// Utilisations de crédit (P4/P5)
export type UtilisationStatut =
  | "BROUILLON" | "DEMANDEE" | "INCOMPLETE" | "A_RECONTROLER" | "EN_VERIFICATION"
  | "VISE" | "VALIDEE" | "LIQUIDEE" | "APUREE" | "REJETEE" | "CLOTUREE"
  // Nouveau workflow douanier
  | "EN_CONTROLE_DGD" | "CHEQUE_SAISI" | "ENVOYEE_AU_TRESOR" | "QUITTANCES_ENREGISTREES"
  // Workflow TVA intérieure : quittance DGI après validation
  | "QUITTANCE_DGI_ENREGISTREE"
  // Émission du certificat d'utilisation par le Président (après LIQUIDEE / APUREE)
  | "CERTIFICAT_EMIS"
  // Contrôle DGTCP avant le Président (douane)
  | "TRANSMISE_AU_PRESIDENT";
export type UtilisationType = "DOUANIER" | "TVA_INTERIEURE";

export type TvaDeductibleStockSource = "UTILISATION_DOUANE" | "TRANSFERT_CREDIT";

export interface TvaDeductibleStockDto {
  id: number;
  utilisationDouaneId?: number | null;
  numeroDeclaration?: string;
  montantInitial: number;
  montantRestant: number;
  montantConsomme: number;
  dateCreation?: string;
  epuise: boolean;
  source?: TvaDeductibleStockSource;
}

// === Bulletin de liquidation : lignes & décisions DGTCP ===
export type TypeLigneTaxe = "GLOBALE" | "ARTICLE";
export type AffectationTaxe = "AU_CI" | "A_PAYER";

export interface LigneBulletinDto {
  id: number;
  utilisationId?: number;
  /** Code de la taxe (alias backend: codeTaxe) */
  code: string;
  /** Libellé de la taxe (alias backend: denominationTaxe) */
  libelle: string;
  /** Type de ligne (alias backend: typeLigne) */
  type: TypeLigneTaxe;
  /** Valeur en MRU (alias backend: valeurTaxe) */
  valeur: number;
  /** Décision finale DGD (null tant que pas de visa). */
  affectation?: AffectationTaxe | null;
  /** Proposition entreprise (AU_CI / A_PAYER) — saisie à la création/édition. */
  affectationEntreprise?: AffectationTaxe | null;
  /** true si DGD a changé la proposition entreprise lors du visa ; false si validée à l'identique ; null avant visa. */
  affectationModifieeParDgd?: boolean | null;
  ordre?: number;
  // Champs bruts backend (au cas où)
  codeTaxe?: string;
  denominationTaxe?: string;
  typeLigne?: TypeLigneTaxe;
  valeurTaxe?: number;
}

/** Normalise une ligne du backend (codeTaxe/denominationTaxe/...) vers le format UI (code/libelle/...). */
export function normalizeLigneBulletin(l: any): LigneBulletinDto {
  return {
    id: l.id,
    utilisationId: l.utilisationId,
    code: l.code ?? l.codeTaxe ?? "",
    libelle: l.libelle ?? l.denominationTaxe ?? "",
    type: l.type ?? l.typeLigne,
    valeur: Number(l.valeur ?? l.valeurTaxe ?? 0),
    affectation: l.affectation ?? null,
    affectationEntreprise: l.affectationEntreprise ?? null,
    affectationModifieeParDgd: l.affectationModifieeParDgd ?? null,
    ordre: l.ordre,
  };
}

export interface LigneBulletinRequest {
  /** Optionnel — fourni en update pour conserver l'identité de la ligne. */
  id?: number;
  codeTaxe: string;
  denominationTaxe: string;
  typeLigne: TypeLigneTaxe;
  valeurTaxe: number;
  /** Proposition entreprise (AU_CI / A_PAYER). Obligatoire à la soumission pour toute ligne > 0. */
  affectation?: AffectationTaxe | null;
  ordre?: number;
}

export interface DecisionLigneRequest {
  ligneId: number;
  affectation: AffectationTaxe;
  valeurTaxe?: number | null;
}

export interface UtilisationCreditDto {
  id: number;
  /** Référence lisible (`DU-NNNN-MM-AAAA`). */
  reference?: string;
  certificatCreditId: number;
  type?: UtilisationType;
  montant?: number;
  statut: UtilisationStatut;
  /** Date de la demande d'utilisation (le serveur n'envoie pas de `dateCreation`). */
  dateDemande?: string;
  /** @deprecated absent du serveur — utiliser `dateDemande`. */
  dateCreation?: string;
  dateMiseAJour?: string;
  dateLiquidation?: string;
  /** Vrai = utilisation reprise d'archive : certificat d'utilisation non numérisé. */
  repriseArchive?: boolean;
  description?: string;
  entrepriseNom?: string;
  entrepriseId?: number;
  /** Référence lisible du crédit (ex. CR-0001-01-2026). À afficher en priorité. */
  certificatReference?: string;
  /** Numéro technique du crédit, repli si `certificatReference` est absente. */
  certificatNumero?: string;
  // Douane fields
  numeroDeclaration?: string;
  numeroBulletin?: string;
  dateDeclaration?: string;
  /** @deprecated Conservé pour compat / lecture historique — utiliser `lignes` + totaux. */
  montantDroits?: number;
  /** @deprecated Conservé pour compat / lecture historique — utiliser `lignes` + totaux. */
  montantTVADouane?: number;
  enregistreeSYDONIA?: boolean;
  // Bulletin de liquidation (nouveau modèle)
  lignes?: LigneBulletinDto[];
  totalPrisEnCharge?: number;
  totalAPayer?: number;
  // Douane liquidation trace
  soldeCordonAvant?: number;
  soldeCordonApres?: number;
  // Chèque certifié (entreprise)
  banqueNom?: string;
  numeroCheque?: string;
  montantCheque?: number;
  dateCheque?: string;
  // Quittances Trésor (DGTCP)
  quittances?: QuittanceTresorDto[];
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
  // Quittance DGI (TVA intérieure, après validation)
  quittanceDgi?: QuittanceDgiDto | null;
  // Certificat d'utilisation (émis par le Président, douane et TVA)
  numeroCertificatUtilisation?: string | null;
  dateCertificatUtilisation?: string | null;
  /**
   * Vrai pour les directions. Pour le déposant, vrai seulement à l'envoi au Trésor (douane)
   * ou à l'enregistrement de la quittance DGI (TVA) ; tant que faux, numéro et date sont `null`.
   */
  certificatUtilisationCommunicable?: boolean;
  // Traçabilité sous-traitant
  certificatTitulaireEntrepriseId?: number;
  certificatTitulaireRaisonSociale?: string;
  demandeurEstSousTraitant?: boolean;
}

export interface QuittanceDgiDto {
  id?: number;
  numeroQuittance: string;
  dateQuittance: string;
  montant: number;
  documentChemin?: string;
  documentNomFichier?: string;
  documentId?: number;
  deposeePar?: string;
  dateDepot?: string;
}

export interface QuittanceTresorDto {
  id?: number;
  numeroQuittance: string;
  dateQuittance: string;
  montant: number;
  referencePaiement?: string;
  utilisationDouaneId?: number;
  documentChemin?: string;
  documentNomFichier?: string;
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
  /** Bulletin de liquidation : lignes (code, libellé, type, valeur). Obligatoire pour DOUANIER. */
  lignes?: LigneBulletinRequest[];
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

export interface CertificatUtilisationEtatDto {
  emissible: boolean;
  codeBlocage: "ROLE_NON_HABILITE" | "STATUT_INCOMPATIBLE" | null | (string & {});
  motifBlocage?: string | null;
  statut?: UtilisationStatut;
  statutPrealableAttendu?: UtilisationStatut | null;
  numeroCertificatUtilisation?: string | null;
  dateCertificatUtilisation?: string | null;
  certificatSigneDepose?: boolean;
}

export type TypeDocumentUtilisation =
  | "CERTIFICAT_UTILISATION"
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

export const UTILISATION_DOC_TYPES_DOUANE: readonly TypeDocumentUtilisation[] = [
  "DEMANDE_UTILISATION",
  "ORDRE_TRANSIT",
  "DECLARATION_DOUANE",
  "BULLETIN_LIQUIDATION",
  "FACTURE",
  "CONNAISSEMENT",
  "CERTIFICAT_CREDIT_IMPOTS_SYDONIA",
] as const;

export const UTILISATION_DOC_TYPES_TVA: readonly TypeDocumentUtilisation[] = [
  "DEMANDE_UTILISATION",
  "FACTURE",
  "DECLARATION_TVA",
  "DECOMPTE",
] as const;

export function getUtilisationDocTypesTVA(typeAchat?: string): readonly TypeDocumentUtilisation[] {
  if (typeAchat === "ACHAT_LOCAL") {
    return UTILISATION_DOC_TYPES_TVA.filter(dt => dt !== "DECOMPTE");
  }
  if (typeAchat === "DECOMPTE") {
    return UTILISATION_DOC_TYPES_TVA.filter(dt => dt !== "FACTURE");
  }
  return UTILISATION_DOC_TYPES_TVA;
}

export const UTILISATION_DOCUMENT_TYPES: readonly TypeDocumentUtilisation[] = [
  "DEMANDE_UTILISATION",
  "ORDRE_TRANSIT",
  "DECLARATION_DOUANE",
  "BULLETIN_LIQUIDATION",
  "FACTURE",
  "CONNAISSEMENT",
  "CERTIFICAT_CREDIT_IMPOTS_SYDONIA",
  "DECLARATION_TVA",
  "DECOMPTE",
  "AUTRE",
] as const;


