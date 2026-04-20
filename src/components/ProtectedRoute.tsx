import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  allowedRoles?: AppRole[];
}

const ProtectedRoute = ({ children, adminOnly = false, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, isAdmin, hasRole, user, isCommissionRelais, isImpersonating } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Commission relais sans impersonation active : forcer la sélection d'une cible
  if (isCommissionRelais && !isImpersonating && location.pathname !== "/dashboard/relais") {
    return <Navigate to="/dashboard/relais" replace />;
  }

  // Autoriser l'accès à /dashboard/relais quel que soit le rôle effectif (le natif suffit)
  const nativeRole = (user?.nativeRole ?? user?.role) as AppRole | undefined;
  const passesRoleCheck = allowedRoles
    ? hasRole(allowedRoles) || (allowedRoles.includes("COMMISSION_RELAIS") && nativeRole === "COMMISSION_RELAIS")
    : true;

  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (allowedRoles && !passesRoleCheck) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
