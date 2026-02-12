import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Demandes from "./pages/Demandes";
import Certificats from "./pages/Certificats";
import Utilisations from "./pages/Utilisations";
import Utilisateurs from "./pages/Utilisateurs";
import Roles from "./pages/Roles";
import AuditLogs from "./pages/AuditLogs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/demandes" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Demandes />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/certificats" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Certificats />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/utilisations" element={
              <ProtectedRoute allowedRoles={["ENTREPRISE", "DGD", "DGTCP", "DGI", "ADMIN_SI"]}>
                <Utilisations />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/transferts" element={
              <ProtectedRoute allowedRoles={["ENTREPRISE", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/cloture" element={
              <ProtectedRoute allowedRoles={["DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/utilisateurs" element={<ProtectedRoute adminOnly><Utilisateurs /></ProtectedRoute>} />
            <Route path="/dashboard/roles" element={<ProtectedRoute adminOnly><Roles /></ProtectedRoute>} />
            <Route path="/dashboard/audit" element={<ProtectedRoute adminOnly><AuditLogs /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
