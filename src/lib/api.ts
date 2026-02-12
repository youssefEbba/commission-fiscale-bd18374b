const API_BASE = "https://8881-41-188-117-39.ngrok-free.app/api";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem("auth_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erreur ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  role: string;
  nomComplet?: string;
  email?: string;
}

export interface LoginResponse {
  token: string;
  type: string;
  userId: number;
  username: string;
  role: string;
  nomComplet: string;
}

export interface UtilisateurDto {
  id: number;
  username: string;
  role: string;
  nomComplet: string;
  email: string;
  actif: boolean;
}

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
  DGD: "DGD",
  DGTCP: "DGTCP",
  DGI: "DGI",
  DGB: "DGB",
  ADMIN_SI: "Admin SI",
  AUTORITE_CONTRACTANTE: "Autorité Contractante",
  ENTREPRISE: "Entreprise",
};

export const authApi = {
  login: (data: LoginRequest) =>
    apiFetch<LoginResponse>("/auth/login", { method: "POST", body: data }),
  register: (data: RegisterRequest) =>
    apiFetch<LoginResponse>("/auth/register", { method: "POST", body: data }),
  me: () => apiFetch<Record<string, unknown>>("/auth/me"),
};

export interface UpdateUtilisateurRequest {
  username?: string;
  nomComplet?: string;
  email?: string;
  role?: string;
}

export const utilisateurApi = {
  getAll: () => apiFetch<UtilisateurDto[]>("/utilisateurs"),
  getPending: () => apiFetch<UtilisateurDto[]>("/utilisateurs/pending"),
  setActif: (id: number, actif: boolean) =>
    apiFetch<void>(`/utilisateurs/${id}/actif?actif=${actif}`, { method: "PATCH" }),
  create: (data: RegisterRequest) =>
    apiFetch<UtilisateurDto>("/auth/register", { method: "POST", body: data }),
  update: (id: number, data: UpdateUtilisateurRequest) =>
    apiFetch<UtilisateurDto>(`/utilisateurs/${id}`, { method: "PUT", body: data }),
  delete: (id: number) =>
    apiFetch<void>(`/utilisateurs/${id}`, { method: "DELETE" }),
  resetPassword: (id: number, newPassword: string) =>
    apiFetch<void>(`/utilisateurs/${id}/reset-password`, { method: "PATCH", body: { password: newPassword } }),
};

// Permissions
export interface PermissionDto {
  id: number;
  code: string;
  description: string;
  processus?: string;
}

export const permissionApi = {
  listAll: () => apiFetch<PermissionDto[]>("/admin/permissions"),
  listRoles: () => apiFetch<string[]>("/admin/permissions/roles"),
  getByRole: (role: string) => apiFetch<PermissionDto[]>(`/admin/permissions/roles/${role}`),
  assign: (role: string, permissionCode: string) =>
    apiFetch<void>(`/admin/permissions/roles/${role}?permissionCode=${encodeURIComponent(permissionCode)}`, { method: "POST" }),
  revoke: (role: string, permissionCode: string) =>
    apiFetch<void>(`/admin/permissions/roles/${role}?permissionCode=${encodeURIComponent(permissionCode)}`, { method: "DELETE" }),
};
