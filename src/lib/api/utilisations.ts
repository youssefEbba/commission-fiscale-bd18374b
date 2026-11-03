import { apiFetch, normalizeDocs } from "./client";
import type { DocumentDto } from "./demandes";
import {
  normalizeLigneBulletin,
  type CreateUtilisationCreditRequest,
  type DecisionLigneRequest,
  type UtilisationCreditDto,
  type UtilisationStatut,
} from "./certificats";
import type { CertificatUtilisationEtatDto, QuittanceTresorDto, TypeDocumentUtilisation } from "./certificats";
import type { DecisionCorrectionDto, DecisionType, RejetTempResponseDto } from "./demandes";
import type { ModeApposition } from "./reporting";
export const utilisationCreditApi = {
  getAll: async (params?: { demandeurSousTraitantOnly?: boolean }) => {
    const qs = params?.demandeurSousTraitantOnly ? "?demandeurSousTraitantOnly=true" : "";
    const list = await apiFetch<UtilisationCreditDto[]>(`/utilisations-credit${qs}`);
    return (list || []).map(u => ({ ...u, lignes: u.lignes ? u.lignes.map(normalizeLigneBulletin) : u.lignes }));
  },
  getById: async (id: number) => {
    const u = await apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}`);
    if (u && u.lignes) u.lignes = u.lignes.map(normalizeLigneBulletin);
    return u;
  },
  getByCertificat: async (certId: number) => {
    const list = await apiFetch<UtilisationCreditDto[]>(`/utilisations-credit/by-certificat/${certId}`);
    return (list || []).map(u => ({ ...u, lignes: u.lignes ? u.lignes.map(normalizeLigneBulletin) : u.lignes }));
  },
  create: (data: CreateUtilisationCreditRequest) => apiFetch<UtilisationCreditDto>("/utilisations-credit", { method: "POST", body: data }),
  /** Édition d'une utilisation (statut BROUILLON ou DEMANDEE). Le type ne peut pas changer. */
  update: (id: number, data: CreateUtilisationCreditRequest) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}`, { method: "PUT", body: data }),
  /** Soumission d'un brouillon : passe en DEMANDEE. */
  soumettre: (id: number) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/soumettre`, { method: "POST" }),
  /** Suppression définitive — réservée au statut BROUILLON. */
  remove: (id: number) => apiFetch<void>(`/utilisations-credit/${id}`, { method: "DELETE" }),
  updateStatut: (id: number, statut: UtilisationStatut) => apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/statut?statut=${statut}`, { method: "PATCH" }),
  /** Visa DGD — annotation (AU_CI / A_PAYER) de chaque ligne + visa (statut → VISE). multipart/form-data avec scan optionnel du bulletin annoté. */
  visaDgd: (id: number, decisions: DecisionLigneRequest[], file?: File | null) => {
    const fd = new FormData();
    fd.append("decisions", JSON.stringify(decisions));
    if (file) fd.append("file", file);
    return apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/visa-dgd`, {
      method: "POST",
      rawBody: fd,
    });
  },
  /** Liquidation financière DGTCP — débite le solde cordon, le quota TVA et alimente le stock TVA déductible. Aucun body. Prérequis : statut QUITTANCES_ENREGISTREES (ou VISE en compat ancien workflow). */
  liquiderDouane: (id: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/liquidation-douane`, {
      method: "POST",
    }),
  /** Entreprise — saisie du chèque certifié couvrant la part À PAYER. Statut → CHEQUE_SAISI. multipart/form-data avec scan obligatoire. */
  saisirCheque: (id: number, data: { banqueNom: string; numeroCheque: string; montantCheque: number; dateCheque?: string; file: File }) => {
    const fd = new FormData();
    fd.append("banqueNom", data.banqueNom);
    fd.append("numeroCheque", data.numeroCheque);
    fd.append("montantCheque", String(data.montantCheque));
    if (data.dateCheque) fd.append("dateCheque", data.dateCheque);
    fd.append("file", data.file);
    return apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/cheque`, {
      method: "POST",
      rawBody: fd,
    });
  },
  /** DGTCP — contrôle (bulletin visé + chèque saisi) puis transmission au Président. Idempotent. Statut → TRANSMISE_AU_PRESIDENT. */
  transmettrePresident: (id: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/transmission-president`, { method: "POST" }),
  /** DGTCP — envoi du dossier au Trésor. Statut → ENVOYEE_AU_TRESOR. Aucun body. */
  envoyerAuTresor: (id: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/envoyer-au-tresor`, {
      method: "POST",
    }),
  /** DGTCP — saisie / mise à jour des quittances Trésor (idempotent : remplace les précédentes). Statut → QUITTANCES_ENREGISTREES.
   * Multipart : champ "quittances" (JSON string) + champ "files" (un fichier par quittance, indexé par position). */
  saisirQuittances: (id: number, quittances: QuittanceTresorDto[], files?: (File | null | undefined)[]) => {
    const fd = new FormData();
    fd.append("quittances", JSON.stringify(quittances));
    if (files && files.length > 0) {
      files.forEach((f) => {
        if (f) fd.append("files", f);
      });
    }
    return apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/quittances`, {
      method: "POST",
      rawBody: fd,
    });
  },
  /** Lecture seule des quittances Trésor d'une utilisation douanière. */
  getQuittances: (id: number) => apiFetch<QuittanceTresorDto[]>(`/utilisations-credit/${id}/quittances`),
  /**
   * DGTCP — clôture de l'utilisation une fois le crédit débité (LIQUIDEE / APUREE).
   * ADMIN_SI peut s'y substituer avec un motif obligatoire. Statut → CLOTUREE.
   */
  cloturer: (id: number, motif?: string) =>
    apiFetch<UtilisationCreditDto>(
      `/utilisations-credit/${id}/cloture${motif ? `?motif=${encodeURIComponent(motif)}` : ""}`,
      { method: "POST" },
    ),
  /** État d'émission du certificat d'utilisation (pilote le bouton du Président). */
  getCertificatUtilisationEtat: (id: number) =>
    apiFetch<CertificatUtilisationEtatDto>(`/utilisations-credit/${id}/certificat-utilisation/etat`),
  /**
   * PRÉSIDENT — réserve le numéro du certificat d'utilisation (CU-…) sans changer le statut.
   * Le certificat est émis au dépôt du document signé (`uploadDocument` CERTIFICAT_UTILISATION).
   */
  reserverNumeroCertificatUtilisation: (id: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/certificat-utilisation/numero`, { method: "POST" }),
  /**
   * PRÉSIDENT — ancienne émission directe. Répond 409 tant qu'aucun certificat signé n'est déposé :
   * ne plus l'appeler dans les chemins manuel et automatique (le dépôt du signé émet le certificat).
   */
  emettreCertificatUtilisation: (id: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/certificat-utilisation`, { method: "POST" }),
  /** ADMIN_SI — émission par substitution (motif obligatoire, certificat signé facultatif). */
  emettreCertificatUtilisationAdmin: (id: number, motif: string, file?: File | null) => {
    const fd = new FormData();
    fd.append("motif", motif);
    if (file) fd.append("file", file);
    return apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/certificat-utilisation/admin`, { method: "POST", rawBody: fd });
  },
  /** Liste des lignes du bulletin de liquidation pour une utilisation douanière. */
  getLignesBulletin: async (id: number) => {
    const raw = await apiFetch<any[]>(`/utilisations-credit/${id}/lignes-bulletin`);
    return (raw || []).map(normalizeLigneBulletin);
  },
  /** DGI — dépôt / remplacement de la quittance (TVA intérieure). Prérequis : VALIDEE ou QUITTANCE_DGI_ENREGISTREE. Statut → QUITTANCE_DGI_ENREGISTREE.
   * Multipart : numeroQuittance, dateQuittance (ISO Instant), montant, file (obligatoire au premier dépôt). */
  saisirQuittanceDgi: (id: number, data: { numeroQuittance: string; dateQuittance: string; montant: number }, file?: File | null) => {
    const fd = new FormData();
    fd.append("numeroQuittance", data.numeroQuittance);
    fd.append("dateQuittance", data.dateQuittance);
    fd.append("montant", String(data.montant));
    if (file) fd.append("file", file);
    return apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/quittance-dgi`, { method: "POST", rawBody: fd });
  },
  /** DGTCP — apurement TVA. Prérequis : QUITTANCE_DGI_ENREGISTREE. */
  apurerTVA: (id: number, tvaDeductibleUtilisee: number) =>
    apiFetch<UtilisationCreditDto>(`/utilisations-credit/${id}/apurement-tva`, {
      method: "POST",
      body: { tvaDeductibleUtilisee },
    }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/utilisations-credit/${id}/documents`).then(normalizeDocs),
  uploadDocument: (id: number, type: TypeDocumentUtilisation, file: File, modeApposition?: ModeApposition) => {
    const formData = new FormData();
    formData.append("file", file);
    if (modeApposition) formData.append("modeApposition", modeApposition);
    return apiFetch<DocumentDto>(`/utilisations-credit/${id}/documents?codeDocument=${encodeURIComponent(type)}`, {
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
      if (typeDocument) formData.append("codeDocument", typeDocument);
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

// ============= Corrections administrateur (ADMIN_SI) =============
// Un ADMIN_SI peut corriger une information ou remplacer un document à
// n'importe quel moment du workflow. `motif` est obligatoire et journalisé
// dans l'audit sous l'action ADMIN_CORRECTION.

export interface AdminCorrectionDemandePayload {
  creditInterieur?: number;
  creditExterieur?: number;
  intituleMarche?: string;
  /** Référence de l'appel d'offres (100 caractères max). */
  referenceAppelOffre?: string | null;
}

export interface AdminCorrectionCertificatPayload {
  dateValidite?: string;
  montantCordon?: number;
  montantTVAInterieure?: number;
  valeurDouaneFournitures?: number;
  droitsEtTaxesDouaneHorsTva?: number;
  tvaImportationDouane?: number;
  taxesConsommation?: number;
  montantMarcheHt?: number;
  tvaCollecteeTravaux?: number;
}

export interface AdminCorrectionUtilisationPayload {
  montant?: number;
  numeroDeclaration?: string;
  numeroBulletin?: string;
  dateDeclaration?: string;
}


