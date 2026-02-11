import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LoginResponse } from "@/lib/api";

export type AppRole = "PRESIDENT" | "DGD" | "DGTCP" | "DGI" | "DGB" | "ADMIN_SI" | "AUTORITE_CONTRACTANTE" | "ENTREPRISE";

interface AuthUser {
  token: string;
  userId: number;
  username: string;
  role: AppRole;
  nomComplet: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (data: LoginResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasRole: (roles: AppRole[]) => boolean;
}

const ADMIN_ROLES: AppRole[] = ["PRESIDENT", "ADMIN_SI"];

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("auth_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("auth_user");
        localStorage.removeItem("auth_token");
      }
    }
  }, []);

  const login = (data: LoginResponse) => {
    const authUser: AuthUser = {
      token: data.token,
      userId: data.userId,
      username: data.username,
      role: data.role as AppRole,
      nomComplet: data.nomComplet,
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

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isAdmin, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
