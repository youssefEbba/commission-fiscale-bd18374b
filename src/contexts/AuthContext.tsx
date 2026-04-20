import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LoginResponse } from "@/lib/api";

export type AppRole = "PRESIDENT" | "DGD" | "DGTCP" | "DGI" | "DGB" | "ADMIN_SI" | "AUTORITE_CONTRACTANTE" | "ENTREPRISE" | "AUTORITE_UPM" | "AUTORITE_UEP" | "SOUS_TRAITANT" | "COMMISSION_RELAIS";

// Permissions granulaires par rôle
const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  PRESIDENT: ["mise_en_place.annuler", "mise_en_place.visa", "mise_en_place.rejet_temp", "mise_en_place.generer_certificat", "mise_en_place.valider_president"],
  DGI: ["mise_en_place.annuler", "mise_en_place.visa", "mise_en_place.rejet_temp"],
  DGTCP: ["mise_en_place.annuler", "mise_en_place.visa", "mise_en_place.rejet_temp", "mise_en_place.montants", "mise_en_place.dgtcp.validate", "mise_en_place.dgtcp.reject", "mise_en_place.ouvrir"],
  DGB: [],
  DGD: ["mise_en_place.visa", "mise_en_place.rejet_temp"],
  AUTORITE_CONTRACTANTE: ["mise_en_place.annuler", "mise_en_place.creer", "mise_en_place.soumettre"],
  ENTREPRISE: [],
  ADMIN_SI: [],
  AUTORITE_UPM: [],
  AUTORITE_UEP: [],
  SOUS_TRAITANT: [],
  COMMISSION_RELAIS: [
    "commission.relais.list.entreprises",
    "commission.relais.list.autorites",
    "commission.relais.impersonate.entreprise",
    "commission.relais.impersonate.autorite",
    "commission.relais.release",
  ],
};

interface AuthUser {
  token: string;
  userId: number;
  username: string;
  /** Rôle effectif tel que vu par les contrôles métier (ex: ENTREPRISE en impersonation). */
  role: AppRole;
  /** Rôle natif du compte en base (utile pour COMMISSION_RELAIS qui change de role effectif). */
  nativeRole: AppRole;
  nomComplet: string;
  autoriteContractanteId?: number;
  entrepriseId?: number;
  permissions?: string[];
  /** True quand l'utilisateur agit en mode commission relais sur une autre entité. */
  impersonating?: boolean;
  actingEntrepriseId?: number;
  actingAutoriteContractanteId?: number;
  /** Libellé de la cible (rempli côté front lors du choix). */
  actingTargetLabel?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (data: LoginResponse) => void;
  /** Remplace le token courant après impersonate ou release. */
  applyImpersonation: (data: LoginResponse, targetLabel?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCommissionRelais: boolean;
  isImpersonating: boolean;
  hasRole: (roles: AppRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

const ADMIN_ROLES: AppRole[] = ["PRESIDENT", "ADMIN_SI"];

function getStoredUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem("auth_user");
    if (stored) return JSON.parse(stored);
  } catch {
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
  }
  return null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);

  const decodeJwt = (token: string): Record<string, unknown> | null => {
    try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
  };

  const buildUser = (data: LoginResponse, previous?: AuthUser | null, targetLabel?: string): AuthUser => {
    const payload = decodeJwt(data.token) ?? {};
    let permissions = data.permissions;
    if (!permissions && Array.isArray((payload as any).permissions)) {
      permissions = (payload as any).permissions as string[];
    }
    const impersonating = Boolean((data as any).impersonating ?? (payload as any).impersonating);
    const actingEntrepriseId = (data as any).actingEntrepriseId ?? (payload as any).actingEntrepriseId;
    const actingAutoriteContractanteId = (data as any).actingAutoriteContractanteId ?? (payload as any).actingAutoriteContractanteId;
    // nativeRole: priority to existing native role (preserved across impersonations), else current role
    const nativeRole = (previous?.nativeRole as AppRole) || (data.role as AppRole);
    return {
      token: data.token,
      userId: data.userId,
      username: data.username,
      role: data.role as AppRole,
      nativeRole,
      nomComplet: data.nomComplet,
      autoriteContractanteId: data.autoriteContractanteId,
      entrepriseId: data.entrepriseId,
      permissions,
      impersonating,
      actingEntrepriseId,
      actingAutoriteContractanteId,
      actingTargetLabel: impersonating ? (targetLabel ?? previous?.actingTargetLabel) : undefined,
    };
  };

  const persist = (authUser: AuthUser) => {
    localStorage.setItem("auth_token", authUser.token);
    localStorage.setItem("auth_user", JSON.stringify(authUser));
    setUser(authUser);
  };

  const login = (data: LoginResponse) => {
    persist(buildUser(data, null));
  };

  const applyImpersonation = (data: LoginResponse, targetLabel?: string) => {
    persist(buildUser(data, user, targetLabel));
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setUser(null);
  };

  const isAdmin = !!user && ADMIN_ROLES.includes(user.nativeRole ?? user.role);
  const isCommissionRelais = !!user && (user.nativeRole ?? user.role) === "COMMISSION_RELAIS";
  const isImpersonating = !!user?.impersonating;
  const hasRole = (roles: AppRole[]) => !!user && roles.includes(user.role);
  const hasPermission = (permission: string) => {
    if (!user) return false;
    // Prefer JWT permissions if available
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(permission);
    }
    // Fallback to hardcoded role permissions
    const perms = ROLE_PERMISSIONS[user.role] || [];
    return perms.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, login, applyImpersonation, logout, isAuthenticated: !!user, isAdmin, isCommissionRelais, isImpersonating, hasRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
