import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  allowedRoles?: AppRole[];
}

const ProtectedRoute = ({ children, adminOnly = false, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, isAdmin, hasRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (allowedRoles && !hasRole(allowedRoles)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
