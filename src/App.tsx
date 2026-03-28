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
// ReferentielProjets supprimé: convention = projet
import Conventions from "./pages/Conventions";
import Demandes from "./pages/Demandes";
import Certificats from "./pages/Certificats";
import DemandesMiseEnPlace from "./pages/DemandesMiseEnPlace";
import Utilisations from "./pages/Utilisations";
import Utilisateurs from "./pages/Utilisateurs";
import Roles from "./pages/Roles";
import AuditLogs from "./pages/AuditLogs";
import Simulation from "./pages/Simulation";
import Register from "./pages/Register";
import CorrectionDouaniere from "./pages/CorrectionDouaniere";
import AssistanceIA from "./pages/AssistanceIA";
import ChatbotDGD from "./pages/ChatbotDGD";
import ExtractionDGD from "./pages/ExtractionDGD";
import Marches from "./pages/Marches";
import Delegues from "./pages/Delegues";
import GedConfiguration from "./pages/GedConfiguration";
import GedDossiers from "./pages/GedDossiers";
import NotFound from "./pages/NotFound";
import Transferts from "./pages/Transferts";
import SousTraitance from "./pages/SousTraitance";
import Presentation from "./pages/Presentation";
import CertificatDetail from "./pages/CertificatDetail";
import Cloture from "./pages/Cloture";
import Modifications from "./pages/Modifications";
import DemandeDetail from "./pages/DemandeDetail";
import MiseEnPlaceDetail from "./pages/MiseEnPlaceDetail";
import UtilisationDetail from "./pages/UtilisationDetail";

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
            <Route path="/register" element={<Register />} />
            <Route path="/presentation" element={<Presentation />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/conventions" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "DGB", "PRESIDENT", "ADMIN_SI"]}>
                <Conventions />
              </ProtectedRoute>
            } />
            {/* Référentiel Projet supprimé: convention = projet */}
            <Route path="/dashboard/demandes" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Demandes />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/marches" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ADMIN_SI", "PRESIDENT"]}>
                <Marches />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/delegues" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE"]}>
                <Delegues />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/mise-en-place" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <DemandesMiseEnPlace />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/mise-en-place/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <MiseEnPlaceDetail />
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
            <Route path="/dashboard/utilisations/:id" element={
              <ProtectedRoute allowedRoles={["ENTREPRISE", "DGD", "DGTCP", "DGI", "ADMIN_SI"]}>
                <UtilisationDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/transferts" element={
              <ProtectedRoute allowedRoles={["ENTREPRISE", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Transferts />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/sous-traitance" element={
              <ProtectedRoute allowedRoles={["ENTREPRISE", "SOUS_TRAITANT", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <SousTraitance />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/cloture" element={
              <ProtectedRoute allowedRoles={["DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Cloture />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/modifications" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Modifications />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/ged/configuration" element={
              <ProtectedRoute allowedRoles={["PRESIDENT", "ADMIN_SI"]}>
                <GedConfiguration />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/ged/dossiers" element={
              <ProtectedRoute allowedRoles={["PRESIDENT", "ADMIN_SI"]}>
                <GedDossiers />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/certificats/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <CertificatDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/utilisateurs" element={<ProtectedRoute adminOnly><Utilisateurs /></ProtectedRoute>} />
            <Route path="/dashboard/roles" element={<ProtectedRoute adminOnly><Roles /></ProtectedRoute>} />
            <Route path="/dashboard/audit" element={<ProtectedRoute adminOnly><AuditLogs /></ProtectedRoute>} />
            <Route path="/dashboard/simulation" element={
              <ProtectedRoute allowedRoles={["ENTREPRISE", "ADMIN_SI"]}>
                <Simulation />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/demandes/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <DemandeDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/correction-douaniere/:id" element={
              <ProtectedRoute allowedRoles={["DGD", "ADMIN_SI"]}>
                <CorrectionDouaniere />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/assistance-ia/:id" element={
              <ProtectedRoute allowedRoles={["DGD", "ADMIN_SI"]}>
                <AssistanceIA />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/extraction-dgd/:id" element={
              <ProtectedRoute allowedRoles={["DGD", "ADMIN_SI"]}>
                <ExtractionDGD />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/chatbot-dgd/:id" element={
              <ProtectedRoute allowedRoles={["DGD", "ADMIN_SI"]}>
                <ChatbotDGD />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
