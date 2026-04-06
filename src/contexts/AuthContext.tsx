import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LoginResponse } from "@/lib/api";

export type AppRole = "PRESIDENT" | "DGD" | "DGTCP" | "DGI" | "DGB" | "ADMIN_SI" | "AUTORITE_CONTRACTANTE" | "ENTREPRISE" | "AUTORITE_UPM" | "AUTORITE_UEP" | "SOUS_TRAITANT";

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
};

interface AuthUser {
  token: string;
  userId: number;
  username: string;
  role: AppRole;
  nomComplet: string;
  autoriteContractanteId?: number;
  entrepriseId?: number;
  permissions?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  login: (data: LoginResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
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

  const login = (data: LoginResponse) => {
    // Extract permissions from JWT payload if not in response
    let permissions = data.permissions;
    if (!permissions) {
      try {
        const payload = JSON.parse(atob(data.token.split(".")[1]));
        if (Array.isArray(payload.permissions)) permissions = payload.permissions;
      } catch { /* ignore */ }
    }
    const authUser: AuthUser = {
      token: data.token,
      userId: data.userId,
      username: data.username,
      role: data.role as AppRole,
      nomComplet: data.nomComplet,
      autoriteContractanteId: data.autoriteContractanteId,
      entrepriseId: data.entrepriseId,
      permissions,
    };
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(authUser));
    setUser(authUser);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setUser(null);
  };

  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
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
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isAdmin, hasRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
