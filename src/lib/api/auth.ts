import { apiFetch } from "./client";
// Auth
export interface LoginRequest { username: string; password: string; }
export interface LoginResponse { token: string; type: string; userId: number; username: string; role: string; nomComplet: string; autoriteContractanteId?: number; entrepriseId?: number; permissions?: string[]; impersonating?: boolean; actingEntrepriseId?: number; actingAutoriteContractanteId?: number; }

// Commission Relais (impersonation)
export interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; number?: number; page?: number; size: number; }
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

export interface UtilisateurDto {
  id: number;
  username: string;
  role: string;
  nomComplet?: string | null;
  email?: string | null;
  actif?: boolean | null;
  autoriteContractanteId?: number | null;
  autoriteContractanteNom?: string | null;
  entrepriseId?: number | null;
  entrepriseRaisonSociale?: string | null;
}

export interface UpdateMyProfileRequest {
  nomComplet?: string | null;
  email?: string | null;
}

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
  me: () => apiFetch<Record<string, unknown>>("/auth/me"),
  passwordResetRequest: (email: string) =>
    apiFetch<{ message: string }>("/auth/password-reset/request", { method: "POST", body: { email } }),
};

export interface UpdateUtilisateurRequest {
  nomComplet?: string | null;
  email?: string | null;
  role?: string | null;
  autoriteContractanteId?: number | null;
  entrepriseId?: number | null;
  newPassword?: string | null;
}

export type DemandeResetStatut = "EN_ATTENTE" | "APPROUVEE" | "REFUSEE";
export interface DemandeResetPasswordDto {
  id: number;
  utilisateurId: number;
  username: string;
  nomComplet?: string;
  email?: string;
  statut: DemandeResetStatut;
  dateCreation: string;
  dateTraitement?: string | null;
  traiteParId?: number | null;
  traiteParUsername?: string | null;
  motifRefus?: string | null;
}

export const utilisateurApi = {
  getAll: () => apiFetch<UtilisateurDto[]>("/utilisateurs"),
  getByEntreprise: (entrepriseId: number) => apiFetch<UtilisateurDto[]>(`/utilisateurs?entrepriseId=${entrepriseId}`),
  getSousTraitants: () => apiFetch<EntrepriseDto[]>("/utilisateurs/sous-traitants"),
  getEntreprisesSousTraitantes: () => apiFetch<EntrepriseDto[]>("/sous-traitances/entreprises-sous-traitantes"),
  getPending: () => apiFetch<UtilisateurDto[]>("/utilisateurs/pending"),
  getById: (id: number) => apiFetch<UtilisateurDto>(`/utilisateurs/${id}`),
  getMe: () => apiFetch<UtilisateurDto>("/utilisateurs/me"),
  updateMyProfile: (data: UpdateMyProfileRequest) =>
    apiFetch<UtilisateurDto>("/utilisateurs/me", { method: "PATCH", body: data }),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    apiFetch<void>("/utilisateurs/me/password", { method: "PATCH", body: { currentPassword, newPassword } }),
  setActif: (id: number, actif: boolean) => apiFetch<void>(`/utilisateurs/${id}/actif?actif=${actif}`, { method: "PATCH" }),
  update: (id: number, data: UpdateUtilisateurRequest) => apiFetch<UtilisateurDto>(`/utilisateurs/${id}`, { method: "PUT", body: data }),
  delete: (id: number) => apiFetch<void>(`/utilisateurs/${id}`, { method: "DELETE" }),
  resetPassword: (id: number, newPassword: string) => apiFetch<void>(`/utilisateurs/${id}/reset-password`, { method: "PATCH", body: { password: newPassword } }),
  listPasswordResetRequests: (statut?: DemandeResetStatut) =>
    apiFetch<DemandeResetPasswordDto[]>(
      statut
        ? `/utilisateurs/password-reset-requests?statut=${statut}`
        : `/utilisateurs/password-reset-requests`
    ),
  getPasswordResetRequest: (id: number) =>
    apiFetch<DemandeResetPasswordDto>(`/utilisateurs/password-reset-requests/${id}`),
  approvePasswordResetRequest: (id: number) =>
    apiFetch<DemandeResetPasswordDto>(`/utilisateurs/password-reset-requests/${id}/approve`, { method: "PATCH" }),
  rejectPasswordResetRequest: (id: number, motif?: string) =>
    apiFetch<DemandeResetPasswordDto>(`/utilisateurs/password-reset-requests/${id}/reject`, { method: "PATCH", body: { motif: motif ?? "" } }),
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
