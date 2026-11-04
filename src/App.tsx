import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorDialog } from "@/components/ErrorDialog";
import { DocumentTaskIndicator } from "@/components/documents/DocumentTaskIndicator";
import { I18nBootstrap } from "@/i18n/bootstrap";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Conventions = lazy(() => import("./pages/Conventions"));
const Demandes = lazy(() => import("./pages/Demandes"));
const Certificats = lazy(() => import("./pages/Certificats"));
const DemandesMiseEnPlace = lazy(() => import("./pages/DemandesMiseEnPlace"));
const Utilisations = lazy(() => import("./pages/Utilisations"));
const Utilisateurs = lazy(() => import("./pages/Utilisateurs"));
const MonProfil = lazy(() => import("./pages/MonProfil"));
const Signatures = lazy(() => import("./pages/Signatures"));
const Parametres = lazy(() => import("./pages/Parametres"));
const Roles = lazy(() => import("./pages/Roles"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Simulation = lazy(() => import("./pages/Simulation"));
const Register = lazy(() => import("./pages/Register"));
const CorrectionDouaniere = lazy(() => import("./pages/CorrectionDouaniere"));
const ExtractionDGD = lazy(() => import("./pages/ExtractionDGD"));
const Marches = lazy(() => import("./pages/Marches"));
const Delegues = lazy(() => import("./pages/Delegues"));
const GedConfiguration = lazy(() => import("./pages/GedConfiguration"));
const GedDossiers = lazy(() => import("./pages/GedDossiers"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Transferts = lazy(() => import("./pages/Transferts"));
const TransfertDetail = lazy(() => import("./pages/TransfertDetail"));
const SousTraitance = lazy(() => import("./pages/SousTraitance"));
const Presentation = lazy(() => import("./pages/Presentation"));
const Reporting = lazy(() => import("./pages/Reporting"));
const CreditFiche = lazy(() => import("./pages/CreditFiche"));
const CertificatDetail = lazy(() => import("./pages/CertificatDetail"));
const Cloture = lazy(() => import("./pages/Cloture"));
const Modifications = lazy(() => import("./pages/Modifications"));
const AvenantDetail = lazy(() => import("./pages/AvenantDetail"));
const DemandeDetail = lazy(() => import("./pages/DemandeDetail"));
const MiseEnPlaceDetail = lazy(() => import("./pages/MiseEnPlaceDetail"));
const UtilisationDetail = lazy(() => import("./pages/UtilisationDetail"));
const CommissionRelais = lazy(() => import("./pages/CommissionRelais"));
const ReferentielTaxes = lazy(() => import("./pages/ReferentielTaxes"));
const Groupements = lazy(() => import("./pages/Groupements"));
const GroupementDetail = lazy(() => import("./pages/GroupementDetail"));
const EntrepriseDetail = lazy(() => import("./pages/EntrepriseDetail"));
const Entreprises = lazy(() => import("./pages/Entreprises"));
const AutoritesContractantes = lazy(() => import("./pages/AutoritesContractantes"));
const AutoriteDetail = lazy(() => import("./pages/AutoriteDetail"));
const DemandesRattachement = lazy(() => import("./pages/DemandesRattachement"));
const DemandeRattachementDetail = lazy(() => import("./pages/DemandeRattachementDetail"));
const ConventionDetail = lazy(() => import("./pages/ConventionDetail"));
const MarcheDetail = lazy(() => import("./pages/MarcheDetail"));
const VerifierCertificat = lazy(() => import("./pages/VerifierCertificat"));
const VerificationPublique = lazy(() => import("./pages/VerificationPublique"));
const SuiviRattachement = lazy(() => import("./pages/SuiviRattachement"));
const ArchiveCredits = lazy(() => import("./pages/ArchiveCredits"));
const ArchiveLotDetail = lazy(() => import("./pages/ArchiveLotDetail"));
const ReferentielSecteurs = lazy(() => import("./pages/ReferentielSecteurs"));
const SatisfactionDashboard = lazy(() => import("./pages/SatisfactionDashboard"));
const SatisfactionEnquetes = lazy(() => import("./pages/SatisfactionEnquetes"));
const SatisfactionEnqueteReponse = lazy(() => import("./pages/SatisfactionEnqueteReponse"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
    Chargement…
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <I18nBootstrap>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <ErrorDialog />
        <DocumentTaskIndicator />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/register" element={<Register />} />
            <Route path="/presentation" element={<Presentation />} />
            <Route path="/verification" element={<VerificationPublique />} />
            <Route path="/suivi" element={<SuiviRattachement />} />
            <Route path="/verifier-certificat" element={<ProtectedRoute><VerifierCertificat /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

            <Route path="/dashboard/conventions" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Conventions />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/conventions/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <ConventionDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/demandes" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Demandes />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/marches" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Marches />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/marches/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <MarcheDetail />
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
            <Route path="/dashboard/credits/recherche" element={<Navigate to="/dashboard/certificats" replace />} />
            <Route path="/dashboard/credits/fiche/:reference" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <CreditFiche />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/certificats" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Certificats />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/utilisations" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGTCP", "DGI", "PRESIDENT", "ADMIN_SI"]}>
                <Utilisations />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/utilisations/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGTCP", "DGI", "PRESIDENT", "ADMIN_SI"]}>
                <UtilisationDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/transferts" element={
              <ProtectedRoute allowedRoles={["ENTREPRISE", "DGD", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Transferts />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/transferts/:id" element={
              <ProtectedRoute allowedRoles={["ENTREPRISE", "AUTORITE_CONTRACTANTE", "DGD", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <TransfertDetail />
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
            <Route path="/dashboard/modifications/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <AvenantDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/ged/configuration" element={
              <ProtectedRoute allowedRoles={["ADMIN_SI"]}>
                <GedConfiguration />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/ged/dossiers" element={
              <ProtectedRoute allowedRoles={["ADMIN_SI", "PRESIDENT"]}>
                <GedDossiers />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/certificats/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <CertificatDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/profil" element={<ProtectedRoute><MonProfil /></ProtectedRoute>} />
            <Route path="/dashboard/utilisateurs" element={<ProtectedRoute adminOnly><Utilisateurs /></ProtectedRoute>} />
            <Route path="/dashboard/roles" element={<ProtectedRoute adminOnly><Roles /></ProtectedRoute>} />
            <Route path="/dashboard/parametres" element={<ProtectedRoute allowedRoles={["ADMIN_SI", "PRESIDENT"]}><Parametres /></ProtectedRoute>} />
            <Route path="/dashboard/signatures" element={<ProtectedRoute adminOnly><Signatures /></ProtectedRoute>} />
            <Route path="/dashboard/audit" element={<ProtectedRoute adminOnly><AuditLogs /></ProtectedRoute>} />
            <Route path="/dashboard/reporting" element={<ProtectedRoute><Reporting /></ProtectedRoute>} />
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
            <Route path="/dashboard/extraction-dgd/:id" element={
              <ProtectedRoute allowedRoles={["DGD", "ADMIN_SI"]}>
                <ExtractionDGD />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/relais" element={
              <ProtectedRoute allowedRoles={["COMMISSION_RELAIS"]}>
                <CommissionRelais />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/groupements" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <Groupements />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/groupements/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <GroupementDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/entreprises" element={<ProtectedRoute allowedRoles={["PRESIDENT", "ADMIN_SI"]}><Entreprises /></ProtectedRoute>} />
            <Route path="/dashboard/autorites" element={<ProtectedRoute allowedRoles={["PRESIDENT", "ADMIN_SI"]}><AutoritesContractantes /></ProtectedRoute>} />
            <Route path="/dashboard/autorites/:id" element={<ProtectedRoute allowedRoles={["PRESIDENT", "ADMIN_SI"]}><AutoriteDetail /></ProtectedRoute>} />
            <Route path="/dashboard/demandes-rattachement" element={<ProtectedRoute permission="rattachement.validate"><DemandesRattachement /></ProtectedRoute>} />
            <Route path="/dashboard/demandes-rattachement/:id" element={<ProtectedRoute permission="rattachement.validate"><DemandeRattachementDetail /></ProtectedRoute>} />
            <Route path="/dashboard/entreprises/:id" element={
              <ProtectedRoute allowedRoles={["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"]}>
                <EntrepriseDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/archive/credits" element={
              <ProtectedRoute allowedRoles={["ADMIN_SI"]}>
                <ArchiveCredits />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/archive/lots/:id" element={
              <ProtectedRoute allowedRoles={["ADMIN_SI"]}>
                <ArchiveLotDetail />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/referentiel-secteurs" element={
              <ProtectedRoute allowedRoles={["ADMIN_SI", "PRESIDENT"]}>
                <ReferentielSecteurs />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/satisfaction" element={
              <ProtectedRoute allowedRoles={["ADMIN_SI", "PRESIDENT"]}>
                <SatisfactionDashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/satisfaction/enquetes" element={
              <ProtectedRoute allowedRoles={["ADMIN_SI", "PRESIDENT"]}>
                <SatisfactionEnquetes />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/satisfaction/enquetes/:id" element={<ProtectedRoute><SatisfactionEnqueteReponse /></ProtectedRoute>} />
            <Route path="/dashboard/referentiel-taxes" element={
              <ProtectedRoute allowedRoles={["ADMIN_SI"]}>
                <ReferentielTaxes />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </I18nBootstrap>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
