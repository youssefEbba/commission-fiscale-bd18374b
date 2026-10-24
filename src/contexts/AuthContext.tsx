import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LoginResponse } from "@/lib/api";

export type AppRole = "PRESIDENT" | "DGD" | "DGTCP" | "DGI" | "DGB" | "ADMIN_SI" | "AUTORITE_CONTRACTANTE" | "ENTREPRISE" | "AUTORITE_UPM" | "AUTORITE_UEP" | "SOUS_TRAITANT" | "COMMISSION_RELAIS";

// Permissions granulaires par rôle
const ROLE_PERMISSIONS_BASE: Record<AppRole, string[]> = {
  PRESIDENT: ["transfert.president.validate", "transfert.president.reject", "mise_en_place.annuler", "mise_en_place.visa", "mise_en_place.rejet_temp", "mise_en_place.generer_certificat", "mise_en_place.valider_president", "convention.activate", "autorite.create", "autorite.update", "autorite.delete", "rattachement.validate", "parametre.manage"],
  DGI: ["transfert.dgi.visa", "mise_en_place.annuler", "mise_en_place.visa", "mise_en_place.rejet_temp"],
  DGTCP: ["transfert.dgtcp.update", "mise_en_place.annuler", "mise_en_place.visa", "mise_en_place.rejet_temp", "mise_en_place.montants", "mise_en_place.dgtcp.validate", "mise_en_place.dgtcp.reject", "mise_en_place.ouvrir", "convention.activate"],
  DGB: [],
  DGD: ["transfert.dgd.visa", "mise_en_place.visa", "mise_en_place.rejet_temp"],
  AUTORITE_CONTRACTANTE: ["convention.activate", "convention.update", "delegue.list", "delegue.update", "delegue.disable", "mise_en_place.annuler", "mise_en_place.creer", "mise_en_place.soumettre"],
  ENTREPRISE: ["transfert.submit", "transfert.annuler", "transfert.entreprise.rejet.repondre"],
  ADMIN_SI: ["parametre.manage", "autorite.create", "autorite.update", "autorite.delete"],
  AUTORITE_UPM: ["convention.activate", "convention.update"],
  AUTORITE_UEP: ["convention.activate", "convention.update"],
  SOUS_TRAITANT: [],
  COMMISSION_RELAIS: [
    "commission.relais.list.entreprises",
    "commission.relais.list.autorites",
    "commission.relais.impersonate.entreprise",
    "commission.relais.impersonate.autorite",
    "commission.relais.release",
  ],
};

// `reporting.view` : détenue par tous les rôles sauf COMMISSION_RELAIS (non impersonant).
const ROLE_PERMISSIONS: Record<AppRole, string[]> = Object.fromEntries(
  Object.entries(ROLE_PERMISSIONS_BASE).map(([r, perms]) => [r, r === "COMMISSION_RELAIS" ? perms : [...perms, "reporting.view"]]),
) as Record<AppRole, string[]>;

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

/**
 * En prise de relais, l'entité du compte « commission_relais » est vide : l'entité
 * représentée (acting*) tient lieu d'entité du compte, comme le fait le serveur.
 * Hors relais, seules les entités du compte sont retenues.
 */
export function resolveEntityIds(input: {
  impersonating: boolean;
  autoriteContractanteId?: number;
  entrepriseId?: number;
  actingAutoriteContractanteId?: number;
  actingEntrepriseId?: number;
}): { autoriteContractanteId?: number; entrepriseId?: number } {
  if (!input.impersonating) {
    return { autoriteContractanteId: input.autoriteContractanteId, entrepriseId: input.entrepriseId };
  }
  return {
    autoriteContractanteId: input.actingAutoriteContractanteId ?? input.autoriteContractanteId,
    entrepriseId: input.actingEntrepriseId ?? input.entrepriseId,
  };
}

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

// Conserve la même instance de contexte lors du rechargement à chaud (évite « useAuth must be used within AuthProvider »).
const AuthContext: React.Context<AuthContextType | null> =
  ((globalThis as any).__authContext ??= createContext<AuthContextType | null>(null));

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
    const entityIds = resolveEntityIds({
      impersonating,
      autoriteContractanteId: data.autoriteContractanteId,
      entrepriseId: data.entrepriseId,
      actingAutoriteContractanteId,
      actingEntrepriseId,
    });
    return {
      token: data.token,
      userId: data.userId,
      username: data.username,
      role: data.role as AppRole,
      nativeRole,
      nomComplet: data.nomComplet,
      autoriteContractanteId: entityIds.autoriteContractanteId,
      entrepriseId: entityIds.entrepriseId,
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
