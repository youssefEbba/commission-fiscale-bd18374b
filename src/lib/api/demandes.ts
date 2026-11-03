import { apiFetch, normalizeDocs } from "./client";
import { buildCorrectionDecisionBody, type CorrectionMontants } from "../correctionMontants";
export type DemandeStatut = "BROUILLON" | "RECUE" | "INCOMPLETE" | "RECEVABLE" | "EN_EVALUATION" | "EN_VALIDATION" | "ADOPTEE" | "REJETEE" | "NOTIFIEE" | "ANNULEE";

export interface DemandeCorrectionDto {
  /** Avenant financier à l'origine de la demande (null pour une demande ordinaire). */
  avenantId?: number | null;
  avenantNumero?: string | null;
  /** Véhicules/équipements sous régime (plaques TT). null = non. */
  equipementsPresents?: boolean | null;
  /** Distinct de `equipementsPresents` : seule l'admission temporaire impose une réexportation. */
  admissionTemporaire?: boolean | null;
  id: number;
  numero?: string;
  /** Référence lisible (`DC-NNNN-MM-AAAA`, ex. `DC-0010-10-2026`), à privilégier à l'affichage. */
  reference?: string;
  /** Intitulé libre du projet de marché (remplace la création de marché dans le wizard de correction). */
  intituleMarche?: string;
  /** Référence de l'appel d'offres (facultative, 100 caractères max). */
  referenceAppelOffre?: string | null;
  /** Crédit extérieur retenu (après correction le cas échéant) — celui qui compte pour la suite. */
  creditExterieur?: number;
  /** Crédit intérieur retenu (après correction le cas échéant). */
  creditInterieur?: number;
  /** Déclaration d'origine de l'autorité ; null tant qu'aucune correction n'a été saisie. */
  creditExterieurDeclare?: number | null;
  creditInterieurDeclare?: number | null;
  statut: DemandeStatut;
  dateDepot?: string;
  autoriteContractanteId?: number;
  autoriteContractanteNom?: string;
  autoriteContractanteMinistereTutelleNom?: string;
  autoriteContractanteMinistereTutelleCode?: string;
  entrepriseId?: number;
  entrepriseRaisonSociale?: string;
  entrepriseNif?: string;
  /** Groupement porteur (null = demande individuelle). */
  groupementId?: number | null;
  groupementRaisonSociale?: string | null;
  /** NIF du chef de file du groupement. */
  groupementNifAffiche?: string | null;
  conventionId?: number;
  conventionReference?: string;
  conventionIntitule?: string;
  marcheId?: number;
  /** Marché rattaché, renvoyé par le serveur comme objet imbriqué (`numeroMarche`, `reference`, `intitule`). */
  marche?: MarcheDto | null;
  /** @deprecated Non envoyé par le serveur (contrat antérieur) — lire `marche?.numeroMarche`. */
  marcheNumero?: string;
  /** @deprecated Non envoyé par le serveur (contrat antérieur) — lire `marche?.intitule`. */
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
  equipementsPresents?: boolean;
  /** Régime du matériel : true = admission temporaire ; null = non renseigné. */
  admissionTemporaire?: boolean | null;
  autoriteContractanteId?: number;
  /** Requis si `groupementId` absent (XOR logique). */
  entrepriseId?: number;
  /** Requis si `entrepriseId` absent. Prime sur `entrepriseId` si les deux sont envoyés. */
  groupementId?: number;
  conventionId?: number;
  /** Optionnel (rétro-compat). Le marché réel est créé lors de la mise en place. */
  marcheId?: number;
  /** Intitulé libre du projet de marché — requis lorsque `marcheId` n'est pas fourni. */
  intituleMarche?: string;
  /** Référence de l'appel d'offres (facultative, 100 caractères max ; `null` = non renseignée). */
  referenceAppelOffre?: string | null;
  /** Défaut 0 côté back. Au moins un des deux crédits doit être > 0 à la soumission. */
  creditExterieur?: number;
  creditInterieur?: number;
  modeleFiscal?: ModeleFiscal;
  dqe?: Dqe;
  /** Si true, la demande reste au statut BROUILLON sans notifier les services. */
  brouillon?: boolean;
}

/** PUT /demandes-correction/{id} : remplacement complet, mêmes champs que la création. */
export type UpdateDemandeCorrectionRequest = CreateDemandeCorrectionRequest;

export interface DocumentDto {
  id: number;
  /** @deprecated utiliser `codeDocument`. Conservé pour compatibilité ascendante. */
  type: string;
  codeDocument?: string;
  nomFichier: string;
  chemin?: string;
  dateUpload?: string;
  taille?: number;
  version?: number;
  actif?: boolean;
  /** Chemin d'apposition de la signature (documents officiels du Président). */
  modeApposition?: "MANUSCRIT_SCANNE" | "APPOSE_SYSTEME" | null;
  signataireUtilisateurId?: number | null;
}

/**
 * Le backend renvoie désormais `codeDocument` au lieu de `type` pour les documents.
 * On normalise ici pour garder `type` rempli (compat UI existante).
 */


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
  /** Visa posé par l'administrateur à la place du titulaire. */
  visaParAdmin?: boolean;
  /** Motif de la substitution administrateur. */
  motifAdmin?: string | null;
  /** Crédits fixés par ce visa (non nuls seulement pour le visa qui a saisi les montants). */
  creditExterieurRetenu?: number | null;
  creditInterieurRetenu?: number | null;
}

/** État d'un visa de la commission (vue administrateur). */
export interface VisaEtatDto {
  role: "DGD" | "DGTCP" | "DGI" | "DGB" | "PRESIDENT";
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
  visaPrealableManquant: "DGD" | "DGI" | null;
  visableParAdmin: boolean;
  motifBlocage: string | null;
  /** Vrai sur la seule ligne de la direction qui saisit les crédits retenus avec son visa. */
  saisieMontantsExigee?: boolean;
}

export interface VisaAdminResponseDto {
  demande: DemandeCorrectionDto;
  decision: DecisionCorrectionDto | null;
  document: DocumentDto | null;
  visas: VisaEtatDto[];
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

// Removed RECLAMATION_STATUT_LABELS (I2 migration — orpheline, remplacée par tReclamationStatut).



/** Types de documents requis pour soumettre une demande de correction douanière. */
export type TypeDocumentCorrectionRequis =
  | "LETTRE_SAISINE"
  | "OFFRE_FINANCIERE"
  | "TABLEAU_MODELE";

export const DOCUMENT_TYPES_REQUIS: readonly TypeDocumentCorrectionRequis[] = [
  "LETTRE_SAISINE",
  "OFFRE_FINANCIERE",
  "TABLEAU_MODELE",
] as const;

/**
 * Tous les types de documents acceptés pour une demande de correction douanière (P1).
 * Libellés via `tTypeDocument(value)` côté UI.
 */
export type TypeDocumentCorrection =
  | "LETTRE_SAISINE"
  | "PV_OUVERTURE"
  | "ATTESTATION_FISCALE"
  | "OFFRE_FINANCIERE"
  | "TABLEAU_MODELE"
  | "DAO_DQE"
  | "LISTE_ITEMS_EXCEL";

export const ALL_DOCUMENT_TYPES_VALUES: readonly TypeDocumentCorrection[] = [
  "LETTRE_SAISINE",
  "PV_OUVERTURE",
  "ATTESTATION_FISCALE",
  "OFFRE_FINANCIERE",
  "TABLEAU_MODELE",
  "DAO_DQE",
  "LISTE_ITEMS_EXCEL",
] as const;

export const DOCUMENT_TYPES = [...DOCUMENT_TYPES_REQUIS];

export const demandeCorrectionApi = {
  getAll: () => apiFetch<DemandeCorrectionDto[]>("/demandes-correction"),
  getById: (id: number) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}`),
  getByStatut: (statut: DemandeStatut) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-statut?statut=${statut}`),
  getByAutorite: (autoriteId: number) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-autorite/${autoriteId}`),
  getByEntreprise: (entrepriseId: number) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-entreprise/${entrepriseId}`),
  getByDelegue: (userId: number) => apiFetch<DemandeCorrectionDto[]>(`/demandes-correction/by-delegue/${userId}`),
  create: (data: CreateDemandeCorrectionRequest) => apiFetch<DemandeCorrectionDto>("/demandes-correction", { method: "POST", body: data }),
  /** Édition d'une demande (autorisée si BROUILLON / RECUE / INCOMPLETE et aucun visa). */
  update: (id: number, data: UpdateDemandeCorrectionRequest) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}`, { method: "PUT", body: data }),
  /** Soumission d'un brouillon : passe en RECUE et notifie les services. */
  soumettre: (id: number) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}/soumettre`, { method: "POST" }),
  /** Suppression définitive — réservée au statut BROUILLON. */
  remove: (id: number) => apiFetch<void>(`/demandes-correction/${id}`, { method: "DELETE" }),
  updateStatut: (id: number, statut: DemandeStatut, motifRejet?: string, decisionFinale?: boolean) => apiFetch<DemandeCorrectionDto>(`/demandes-correction/${id}/statut?statut=${statut}${motifRejet ? `&motifRejet=${encodeURIComponent(motifRejet)}` : ""}${decisionFinale ? `&decisionFinale=true` : ""}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/demandes-correction/${id}/documents`).then(normalizeDocs),
  uploadDocument: (id: number, type: string, file: File, message?: string, modeApposition?: ModeApposition) => {
    const formData = new FormData();
    formData.append("file", file);
    if (message) formData.append("message", message);
    if (modeApposition) formData.append("modeApposition", modeApposition);
    return apiFetch<DocumentDto>(`/demandes-correction/${id}/documents?codeDocument=${encodeURIComponent(type)}`, {
      method: "POST",
      rawBody: formData,
    });
  },
  // Décisions temporaires
  getDecisions: (id: number) => apiFetch<DecisionCorrectionDto[]>(`/demandes-correction/${id}/decisions`),
  /** État ordonné des visas (DGD, DGTCP, DGI, DGB, PRESIDENT) — vue administrateur. */
  getVisas: (id: number) => apiFetch<VisaEtatDto[]>(`/demandes-correction/${id}/visas`),
  /** Pose du visa par l'administrateur à la place du titulaire (multipart). */
  poserVisaAdmin: (id: number, role: string, motif: string, file?: File | null, montants?: CorrectionMontants | null) => {
    const fd = new FormData();
    fd.append("role", role);
    fd.append("motif", motif);
    if (file) fd.append("file", file);
    // Uniquement si la ligne du rôle remplacé porte `saisieMontantsExigee: true`.
    if (montants) {
      fd.append("creditExterieur", String(montants.creditExterieur));
      fd.append("creditInterieur", String(montants.creditInterieur));
    }
    return apiFetch<VisaAdminResponseDto>(`/demandes-correction/${id}/visas/admin`, {
      method: "POST",
      rawBody: fd,
    });
  },
  /**
   * `montants` : uniquement pour le VISA de la direction dont la ligne `/visas`
   * porte `saisieMontantsExigee: true` — jamais pour les autres cas.
   */
  postDecision: (id: number, decision: DecisionType, motifRejet?: string, documentsDemandes?: string[], montants?: CorrectionMontants | null) =>
    apiFetch<DecisionCorrectionDto>(`/demandes-correction/${id}/decisions`, {
      method: "POST",
      body: buildCorrectionDecisionBody(decision, motifRejet, documentsDemandes, montants),
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
