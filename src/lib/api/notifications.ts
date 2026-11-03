import { apiFetch } from "./client";
import type { PageAuditLogDto } from "./admin";
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

// Statut value arrays (i18n via helpers tStatutDemande / tStatutCertificat — cf. `enums.json`)
// DEMANDE_STATUT_LABELS supprimée (orpheline). Si besoin d'un dropdown, utiliser :
//   const DEMANDE_STATUT_VALUES: readonly DemandeStatut[] = [...] + tStatutDemande(code).

export const CERTIFICAT_STATUT_VALUES: readonly CertificatStatut[] = [
  "BROUILLON", "ENVOYEE", "DEMANDE", "EN_CONTROLE", "INCOMPLETE",
  "A_RECONTROLER", "EN_VERIFICATION_DGI", "EN_VALIDATION_PRESIDENT",
  "VALIDE_PRESIDENT", "EN_OUVERTURE_DGTCP", "OUVERT",
  "MODIFIE", "CLOTURE", "ANNULE",
] as const;

/**
 * Valeurs ordonnées de UtilisationStatut pour les filtres / dropdowns.
 * Remplace l'ancienne map UTILISATION_STATUT_LABELS (i18n via tStatutUtilisation / tUtilisationStatutContextualise).
 */
export const UTILISATION_STATUT_VALUES: readonly UtilisationStatut[] = [
  "BROUILLON",
  "DEMANDEE", "INCOMPLETE", "A_RECONTROLER",
  "EN_VERIFICATION", "VISE",
  "VALIDEE", "LIQUIDEE", "APUREE", "REJETEE",
  "CLOTUREE",
  "EN_CONTROLE_DGD",
  "CHEQUE_SAISI",
  "TRANSMISE_AU_PRESIDENT",
  "ENVOYEE_AU_TRESOR",
  "QUITTANCES_ENREGISTREES",
  "CERTIFICAT_EMIS",
  "QUITTANCE_DGI_ENREGISTREE",
] as const;

// Notifications
export type NotificationType = "CORRECTION_STATUT_CHANGE" | "CORRECTION_DECISION" | "REFERENTIEL_STATUT_CHANGE" | "CONVENTION_STATUT_CHANGE" | "CERTIFICAT_STATUT_CHANGE" | "UTILISATION_STATUT_CHANGE" | "DEMANDE_EXPLICATION";

// Demandes d'explication (discussion interne commission)
export type ExplicationContexte = "CORRECTION" | "CERTIFICAT" | "UTILISATION";
export type ExplicationStatut = "OUVERTE" | "FERMEE";
export type ExplicationRoleDestinataire = "DGD" | "DGTCP" | "DGI" | "DGB" | "PRESIDENT";

export interface DemandeExplicationMessageDto {
  id: number;
  message: string;
  auteurId: number;
  auteurNom: string;
  roleAuteur: string;
  createdAt: string;
}

export interface DemandeExplicationDto {
  id: number;
  contexte: ExplicationContexte;
  dossierId: number;
  roleDestinataire: ExplicationRoleDestinataire;
  messageInitial: string;
  statut: ExplicationStatut;
  auteurId: number;
  auteurNom: string;
  roleAuteur: string;
  dateOuverture: string;
  dateFermeture?: string;
  messages: DemandeExplicationMessageDto[];
}

export interface CreateExplicationRequest {
  contexte: ExplicationContexte;
  dossierId: number;
  roleDestinataire: ExplicationRoleDestinataire;
  message: string;
}

export const demandeExplicationApi = {
  list: (contexte: ExplicationContexte, dossierId: number) =>
    apiFetch<DemandeExplicationDto[]>(`/demandes-explication?contexte=${contexte}&dossierId=${dossierId}`),
  create: (body: CreateExplicationRequest) =>
    apiFetch<DemandeExplicationDto>(`/demandes-explication`, { method: "POST", body }),
  reply: (id: number, message: string) =>
    apiFetch<DemandeExplicationDto>(`/demandes-explication/${id}/messages`, { method: "POST", body: { message } }),
  fermer: (id: number) =>
    apiFetch<DemandeExplicationDto>(`/demandes-explication/${id}/fermer`, { method: "PUT" }),
};

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
export type BailleurCategorie = "NATIONAL" | "MULTILATERAL" | "BILATERAL" | "PRIVE" | "NON_RENSEIGNE";
export const BAILLEUR_CATEGORIES: BailleurCategorie[] = ["NATIONAL", "MULTILATERAL", "BILATERAL", "PRIVE", "NON_RENSEIGNE"];
export interface BailleurDto { id: number; nom: string; details?: string; categorie?: BailleurCategorie | null; }
export interface CreateBailleurRequest { nom: string; details?: string; categorie?: BailleurCategorie | null; }
export interface UpdateBailleurRequest { nom: string; details?: string | null; categorie?: BailleurCategorie | null; }

