import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DocumentDto, DecisionCorrectionDto,
  DEMANDE_STATUT_LABELS, DOCUMENT_TYPES_REQUIS, ALL_DOCUMENT_TYPES, RejetTempResponseDto,
  ReclamationDemandeCorrectionDto, RECLAMATION_STATUT_LABELS,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  FileText, ArrowLeft, Loader2, CheckCircle, XCircle,
  Download, ExternalLink, Bot, Upload, History, RefreshCw,
  FileDown, ShieldCheck, AlertTriangle, Plus,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const STATUT_COLORS: Record<string, string> = {
  RECUE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-yellow-100 text-yellow-800",
  RECEVABLE: "bg-emerald-100 text-emerald-800",
  EN_EVALUATION: "bg-orange-100 text-orange-800",
  EN_VALIDATION: "bg-purple-100 text-purple-800",
  ADOPTEE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
  NOTIFIEE: "bg-gray-100 text-gray-800",
};

import { API_BASE } from "@/lib/apiConfig";

function getDocFileUrl(doc: DocumentDto): string {
  if (doc.chemin) {
    const normalized = doc.chemin.replace(/\\/g, "/");
    if (normalized.match(/^[A-Za-z]:\//)) return "file:///" + normalized;
    return normalized;
  }
  return "";
}

const DECISION_ROLES = ["DGD", "DGTCP", "DGI", "DGB", "PRESIDENT"];
const DECISION_ROLE_LABELS: Record<string, string> = {
  DGD: "DGD – Douanes",
  DGTCP: "DGTCP – Trésor",
  DGI: "DGI – Impôts",
  DGB: "DGB – Budget",
  PRESIDENT: "Président",
};

// Documents spéciaux qui s'affichent en bas des visas (pas dans la liste normale)
const SPECIAL_DOC_TYPES = ["CREDIT_EXTERIEUR", "CREDIT_INTERIEUR", "LETTRE_ADOPTION", "OFFRE_FISCALE_CORRIGEE"];
const SPECIAL_DOC_LABELS: Record<string, string> = {
  CREDIT_EXTERIEUR: "Crédit Extérieur",
  CREDIT_INTERIEUR: "Crédit Intérieur",
  LETTRE_ADOPTION: "Lettre d'Adoption",
  OFFRE_FISCALE_CORRIGEE: "Offre Fiscale Corrigée",
};

// Roles that must upload before visa
const UPLOAD_REQUIRED_ROLES: Record<string, { docType: string; label: string }> = {
  DGD: { docType: "OFFRE_FISCALE_CORRIGEE", label: "Offre Fiscale Corrigée" },
};

const CorrectionDouaniere = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { toast } = useToast();

  const [demande, setDemande] = useState<DemandeCorrectionDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject modal for temp decision
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejectDocsDemandes, setRejectDocsDemandes] = useState<string[]>([]);

  // Final decision modal
  const [finalOpen, setFinalOpen] = useState(false);
  const [finalType, setFinalType] = useState<"ADOPTEE" | "REJETEE">("ADOPTEE");
  const [finalMotif, setFinalMotif] = useState("");

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  // Tab navigation for organism decisions
  const [activeOrg, setActiveOrg] = useState("DGD");

  // Response to rejet dialog
  const [responseOpen, setResponseOpen] = useState(false);
  const [responseDecisionId, setResponseDecisionId] = useState<number | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [responseLoading, setResponseLoading] = useState(false);

  // Upload required doc before visa
  const [preVisaUploadOpen, setPreVisaUploadOpen] = useState(false);
  const [preVisaFile, setPreVisaFile] = useState<File | null>(null);
  const [preVisaLoading, setPreVisaLoading] = useState(false);

  // Entreprise detail
  const [entrepriseDetail, setEntrepriseDetail] = useState<any | null>(null);
  const [entrepriseLoading, setEntrepriseLoading] = useState(false);
  const [entrepriseDialogOpen, setEntrepriseDialogOpen] = useState(false);

  // Réclamations
  const [reclamations, setReclamations] = useState<ReclamationDemandeCorrectionDto[]>([]);
  const [reclamationOpen, setReclamationOpen] = useState(false);
  const [reclamationTexte, setReclamationTexte] = useState("");
  const [reclamationFile, setReclamationFile] = useState<File | null>(null);
  const [reclamationSubmitting, setReclamationSubmitting] = useState(false);
  const [traiterReclamationId, setTraiterReclamationId] = useState<number | null>(null);
  const [traiterAcceptee, setTraiterAcceptee] = useState(true);
  const [traiterMotif, setTraiterMotif] = useState("");
  const [traiterFile, setTraiterFile] = useState<File | null>(null);
  const [traiterOpen, setTraiterOpen] = useState(false);
  const [traiterSubmitting, setTraiterSubmitting] = useState(false);

  const fetchDemande = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await demandeCorrectionApi.getById(Number(id));
      setDemande(data);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger la demande", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      const documents = await demandeCorrectionApi.getDocuments(Number(id));
      setDocs(documents);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchDecisions = async () => {
    if (!id) return;
    try {
      const data = await demandeCorrectionApi.getDecisions(Number(id));
      setDecisions(data);
    } catch {
      setDecisions([]);
    }
  };

  const fetchReclamations = async () => {
    if (!id) return;
    try {
      const recs = await demandeCorrectionApi.getReclamations(Number(id));
      setReclamations(recs);
    } catch { setReclamations([]); }
  };

  useEffect(() => {
    fetchDemande();
    fetchDocs();
    fetchDecisions();
    fetchReclamations();
  }, [id]);

  const handleCreateReclamation = async () => {
    if (!demande || !reclamationTexte.trim() || !reclamationFile) return;
    setReclamationSubmitting(true);
    try {
      await demandeCorrectionApi.createReclamation(demande.id, reclamationTexte.trim(), reclamationFile);
      toast({ title: "Succès", description: "Réclamation déposée avec succès" });
      setReclamationOpen(false);
      setReclamationTexte("");
      setReclamationFile(null);
      fetchDemande();
      fetchReclamations();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setReclamationSubmitting(false);
    }
  };

  const handleTraiterReclamation = async () => {
    if (!demande || !traiterReclamationId) return;
    if (!traiterAcceptee && !traiterMotif.trim()) {
      toast({ title: "Motif requis", description: "Le motif est obligatoire pour un rejet.", variant: "destructive" });
      return;
    }
    if (!traiterAcceptee && !traiterFile) {
      toast({ title: "Document requis", description: "Un document de réponse est obligatoire pour un rejet.", variant: "destructive" });
      return;
    }
    setTraiterSubmitting(true);
    try {
      await demandeCorrectionApi.traiterReclamation(demande.id, traiterReclamationId, traiterAcceptee, traiterMotif.trim() || undefined, traiterFile || undefined);
      toast({ title: "Succès", description: traiterAcceptee ? "Réclamation acceptée — la demande repasse au statut REÇUE" : "Réclamation rejetée" });
      setTraiterOpen(false);
      setTraiterReclamationId(null);
      setTraiterMotif("");
      setTraiterFile(null);
      fetchDemande();
      fetchDecisions();
      fetchReclamations();
      fetchDocs();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setTraiterSubmitting(false);
    }
  };

  const handleAnnulerReclamation = async (reclamationId: number) => {
    if (!demande) return;
    try {
      await demandeCorrectionApi.annulerReclamation(demande.id, reclamationId);
      toast({ title: "Succès", description: "Réclamation annulée" });
      fetchDemande();
      fetchReclamations();
      fetchDecisions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const openEntrepriseDetail = async (entrepriseId: number) => {
    setEntrepriseDialogOpen(true);
    setEntrepriseLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/entreprises/${entrepriseId}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (!res.ok) throw new Error("Erreur");
      setEntrepriseDetail(await res.json());
    } catch {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${API_BASE}/entreprises`, {
          headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        });
        const list = await res.json();
        const found = list.find((e: any) => e.id === entrepriseId);
        setEntrepriseDetail(found || null);
      } catch {
        toast({ title: "Erreur", description: "Impossible de charger les informations de l'entreprise", variant: "destructive" });
      }
    } finally {
      setEntrepriseLoading(false);
    }
  };

  // Check if current role has uploaded their required doc
  const userRole = user?.role;
  const uploadReq = userRole ? UPLOAD_REQUIRED_ROLES[userRole] : null;
  const hasUploadedRequiredDoc = uploadReq
    ? docs.some(d => d.type === uploadReq.docType)
    : true;

  // ---- Pre-visa upload for DGD/DGTCP ----
  const handlePreVisaUpload = async () => {
    if (!demande || !uploadReq || !preVisaFile) return;
    setPreVisaLoading(true);
    try {
      await demandeCorrectionApi.uploadDocument(demande.id, uploadReq.docType, preVisaFile);
      toast({ title: "Succès", description: `${uploadReq.label} uploadé avec succès` });
      await fetchDocs();
      setPreVisaUploadOpen(false);
      setPreVisaFile(null);
      // Auto-apposer le visa après upload réussi
      await demandeCorrectionApi.postDecision(demande.id, "VISA");
      toast({ title: "Succès", description: "Visa apposé avec succès" });
      await fetchDecisions();
      await fetchDemande();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setPreVisaLoading(false);
    }
  };

  // ---- Décision temporaire (VISA / REJET_TEMP) ----
  const handleTempVisa = async () => {
    if (!demande) return;
    // Check upload requirement
    if (uploadReq && !hasUploadedRequiredDoc) {
      setPreVisaUploadOpen(true);
      return;
    }
    setActionLoading(true);
    try {
      await demandeCorrectionApi.postDecision(demande.id, "VISA");
      toast({ title: "Succès", description: "Visa temporaire apposé" });
      await fetchDecisions();
      await fetchDemande();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTempReject = async () => {
    if (!demande || !rejectMotif.trim() || rejectDocsDemandes.length === 0) return;
    setRejectOpen(false);
    setActionLoading(true);
    try {
      await demandeCorrectionApi.postDecision(demande.id, "REJET_TEMP", rejectMotif.trim(), rejectDocsDemandes);
      toast({ title: "Succès", description: "Rejet temporaire enregistré" });
      await fetchDecisions();
      await fetchDemande();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setRejectMotif("");
      setRejectDocsDemandes([]);
    }
  };

  // ---- Décision finale (PRESIDENT only) ----
  const handleFinalDecision = async () => {
    if (!demande) return;
    setFinalOpen(false);
    setActionLoading(true);
    try {
      await demandeCorrectionApi.updateStatut(
        demande.id,
        finalType,
        finalType === "REJETEE" ? finalMotif.trim() || undefined : undefined,
        true
      );
      toast({ title: "Succès", description: finalType === "ADOPTEE" ? "Demande adoptée (décision finale)" : "Demande rejetée (décision finale)" });
      await fetchDemande();
      await fetchDecisions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setFinalMotif("");
    }
  };

  // ---- Upload document (nouvelle version) ----
  const handleUpload = async () => {
    if (!demande || !uploadType || !uploadFile) return;
    setUploadLoading(true);
    try {
      // Check if this upload responds to an open REJET_TEMP
      const openRejets = decisions.filter(
        d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT" && d.documentsDemandes?.includes(uploadType)
      );
      if (openRejets.length > 0 && !uploadMessage.trim()) {
        toast({ title: "Message requis", description: "Ajoutez un message de justification pour répondre au rejet.", variant: "destructive" });
        setUploadLoading(false);
        return;
      }
      await demandeCorrectionApi.uploadDocument(demande.id, uploadType, uploadFile, uploadMessage.trim() || undefined);
      toast({ title: "Succès", description: "Document uploadé (nouvelle version)" });
      await fetchDocs();
      // Refresh decisions to get updated rejetTempStatus
      await fetchDecisions();
      await fetchDemande();
      setUploadOpen(false);
      setUploadFile(null);
      setUploadType("");
      setUploadMessage("");
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setUploadLoading(false);
    }
  };

  // ---- Répondre à un rejet temporaire (message seul) ----
  const handleRejetResponse = async () => {
    if (!responseDecisionId || !responseMessage.trim()) return;
    setResponseLoading(true);
    try {
      await demandeCorrectionApi.postRejetTempResponse(responseDecisionId, responseMessage.trim());
      toast({ title: "Réponse envoyée" });
      await fetchDecisions();
      setResponseOpen(false);
      setResponseMessage("");
      setResponseDecisionId(null);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setResponseLoading(false);
    }
  };

  const isDirection = userRole && DECISION_ROLES.includes(userRole);
  const canFinalDecision = userRole === "PRESIDENT";
  const isAC = userRole === "AUTORITE_CONTRACTANTE" || userRole === "ADMIN_SI";
  const isFinal = demande?.statut === "ADOPTEE" || demande?.statut === "REJETEE" || demande?.statut === "ANNULEE";

  // Current user's decisions (multi-rejet support)
  const myRoleDecs = decisions.filter(d => d.role === userRole);
  const myDecision = [...myRoleDecs]
    .sort((a, b) => new Date(b.dateDecision || 0).getTime() - new Date(a.dateDecision || 0).getTime())[0] || null;
  const hasAnyRejet = decisions.some(d => d.decision === "REJET_TEMP");
  const myHasVisa = myRoleDecs.some(d => d.decision === "VISA");
  const myOpenRejets = myRoleDecs.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus !== "RESOLU");

  // DGD must validate first — block others if DGD hasn't visa'd
  const dgdHasVisa = decisions.some(d => d.role === "DGD" && d.decision === "VISA");
  const isDGD = userRole === "DGD";
  const isPresident = userRole === "PRESIDENT";
  const blockedByDgd = !isDGD && !isPresident && !dgdHasVisa;

  // Separate special docs from regular docs
  const specialDocs = docs.filter(d => SPECIAL_DOC_TYPES.includes(d.type));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/demandes")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Correction douanière — {demande?.numero || `#${id}`}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Évaluation et décisions</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !demande ? (
          <p className="text-center text-muted-foreground py-8">Demande introuvable</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left */}
            <div className="lg:col-span-2 space-y-6">
              {/* Infos demande */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Informations de la demande</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">N° Demande</span>
                      <p className="font-medium">{demande.numero || `#${demande.id}`}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Statut</span>
                      <p><Badge className={`text-xs ${STATUT_COLORS[demande.statut] || ""}`}>{DEMANDE_STATUT_LABELS[demande.statut]}</Badge></p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Autorité Contractante</span>
                      <p className="font-medium">{demande.autoriteContractanteNom || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entreprise</span>
                      {demande.entrepriseId ? (
                        <button className="font-medium text-primary hover:underline cursor-pointer text-left" onClick={() => openEntrepriseDetail(demande.entrepriseId)}>
                          {demande.entrepriseRaisonSociale || "—"}
                        </button>
                      ) : (
                        <p className="font-medium">{demande.entrepriseRaisonSociale || "—"}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date de dépôt</span>
                      <p>{demande.dateDepot ? new Date(demande.dateDepot).toLocaleDateString("fr-FR") : "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Décisions par organisme — Navigation par onglets */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Décisions par organisme</CardTitle>
                    <Button variant="ghost" size="sm" onClick={fetchDecisions}><RefreshCw className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Onglets */}
                  <div className="flex border-b border-border mb-4 overflow-x-auto">
                    {DECISION_ROLES.map((role) => {
                      const roleDecs = decisions.filter(d => d.role === role);
                      const orgHasVisa = roleDecs.some(d => d.decision === "VISA");
                      const orgHasRejets = roleDecs.some(d => d.decision === "REJET_TEMP");
                      const hasOpenRejet = roleDecs.some(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT");
                      return (
                        <button
                          key={role}
                          onClick={() => setActiveOrg(role)}
                          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                            activeOrg === role
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                          }`}
                        >
                          {orgHasVisa ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          ) : orgHasRejets ? (
                            <XCircle className={`h-3.5 w-3.5 ${hasOpenRejet ? "text-red-600" : "text-amber-500"}`} />
                          ) : (
                            <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30" />
                          )}
                          {DECISION_ROLE_LABELS[role]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Contenu de l'onglet actif */}
                  {(() => {
                    const roleDecs = decisions
                      .filter(d => d.role === activeOrg)
                      .sort((a, b) => new Date(b.dateDecision || 0).getTime() - new Date(a.dateDecision || 0).getTime());

                    // Séparer les décisions actives (visa + rejets ouverts) et résolues
                    const activeDecs = roleDecs.filter(d => d.decision === "VISA" || (d.decision === "REJET_TEMP" && d.rejetTempStatus !== "RESOLU"));
                    const resolvedDecs = roleDecs.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "RESOLU");

                    if (roleDecs.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <div className="h-10 w-10 rounded-full border-2 border-muted-foreground/20 mx-auto mb-3" />
                          <p className="text-sm font-medium">En attente</p>
                          <p className="text-xs mt-1">Aucune décision de {DECISION_ROLE_LABELS[activeOrg]} pour le moment.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {activeDecs.length === 0 && resolvedDecs.length > 0 && (
                          <div className="text-center py-4 text-muted-foreground">
                            <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                            <p className="text-xs">Tous les rejets ont été résolus.</p>
                          </div>
                        )}
                        {activeDecs.map((dec, idx) => (
                          <div key={dec.id || idx} className={`rounded-lg border p-3 text-sm ${
                            dec.decision === "VISA" ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"
                          }`}>
                            <div className="flex items-start gap-3">
                              {dec.decision === "VISA" ? (
                                <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-medium text-xs ${dec.decision === "VISA" ? "text-green-800" : "text-red-800"}`}>
                                    {dec.decision === "VISA" ? "Visa" : "Rejet temporaire"}
                                  </span>
                                  {dec.decision === "REJET_TEMP" && dec.rejetTempStatus && (
                                    <Badge className={`text-[9px] ${dec.rejetTempStatus === "OUVERT" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                      {dec.rejetTempStatus === "OUVERT" ? "Ouvert" : "Résolu"}
                                    </Badge>
                                  )}
                                </div>
                                {dec.motifRejet && <p className="text-xs text-muted-foreground italic mt-1">{dec.motifRejet}</p>}
                                {dec.documentsDemandes && dec.documentsDemandes.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    <span className="text-[10px] text-muted-foreground">Docs demandés :</span>
                                    {dec.documentsDemandes.map(dt => (
                                      <Badge key={dt} variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                        {ALL_DOCUMENT_TYPES.find(t => t.value === dt)?.label || dt}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                {/* Réponses au rejet */}
                                {dec.decision === "REJET_TEMP" && dec.rejetTempResponses && dec.rejetTempResponses.length > 0 && (
                                  <div className="mt-2 space-y-1.5 ml-1">
                                    <span className="text-[10px] text-muted-foreground font-medium">💬 Réponses :</span>
                                    {dec.rejetTempResponses.map((resp: RejetTempResponseDto, ri: number) => (
                                      <div key={ri} className="rounded border border-blue-200 bg-blue-50 p-2 text-xs space-y-0.5">
                                        <p className="text-foreground">{resp.message}</p>
                                        {resp.documentType && (
                                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            📎 {ALL_DOCUMENT_TYPES.find(t => t.value === resp.documentType)?.label || resp.documentType}
                                            {resp.documentVersion && ` (v${resp.documentVersion})`}
                                          </p>
                                        )}
                                        {resp.documentUrl && (
                                          <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                            <Upload className="h-2.5 w-2.5 mr-0.5" /> Document uploadé
                                          </Badge>
                                        )}
                                        <p className="text-[10px] text-muted-foreground">
                                          {resp.auteurNom && `Par: ${resp.auteurNom}`}
                                          {resp.createdAt && ` · ${new Date(resp.createdAt).toLocaleDateString("fr-FR")} ${new Date(resp.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Boutons AC : répondre + upload doc */}
                                {dec.decision === "REJET_TEMP" && dec.rejetTempStatus === "OUVERT" && isAC && (
                                  <div className="flex gap-1.5 mt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[11px]"
                                      onClick={() => { setResponseDecisionId(dec.id); setResponseMessage(""); setResponseOpen(true); }}
                                    >
                                      💬 Répondre
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[11px]"
                                      onClick={() => {
                                        if (dec.documentsDemandes?.length) setUploadType(dec.documentsDemandes[0]);
                                        setUploadMessage("");
                                        setUploadFile(null);
                                        setUploadOpen(true);
                                      }}
                                    >
                                      <Upload className="h-3 w-3 mr-1" /> Upload doc
                                    </Button>
                                  </div>
                                )}

                                {/* Bouton "Marquer résolu" pour l'acteur déclenchant */}
                                {dec.decision === "REJET_TEMP" && dec.rejetTempStatus === "OUVERT" && isDirection && userRole === dec.role && (
                                  <div className="mt-2">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="h-7 text-[11px]"
                                      disabled={actionLoading}
                                      onClick={async () => {
                                        setActionLoading(true);
                                        try {
                                          await demandeCorrectionApi.resolveRejetTemp(dec.id);
                                          toast({ title: "Succès", description: "Rejet marqué comme résolu" });
                                          await fetchDecisions();
                                          await fetchDemande();
                                        } catch (e: any) {
                                          toast({ title: "Erreur", description: e.message, variant: "destructive" });
                                        } finally {
                                          setActionLoading(false);
                                        }
                                      }}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" /> Marquer résolu
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0 text-[10px] text-muted-foreground">
                                {dec.dateDecision && <p>{new Date(dec.dateDecision).toLocaleDateString("fr-FR")} {new Date(dec.dateDecision).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>}
                                {dec.utilisateurNom && <p>Par: {dec.utilisateurNom}</p>}
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Historique des rejets résolus — pliable */}
                        {resolvedDecs.length > 0 && (
                          <details className="mt-3 border-t border-border pt-3">
                            <summary className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                              <History className="h-3.5 w-3.5" />
                              Historique ({resolvedDecs.length} rejet{resolvedDecs.length > 1 ? "s" : ""} résolu{resolvedDecs.length > 1 ? "s" : ""})
                            </summary>
                            <div className="space-y-2 mt-2">
                              {resolvedDecs.map((dec, idx) => (
                                <div key={dec.id || idx} className="rounded-lg border border-muted bg-muted/30 p-3 text-sm opacity-75">
                                  <div className="flex items-start gap-3">
                                    <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-xs text-muted-foreground">Rejet temporaire</span>
                                        <Badge className="text-[9px] bg-green-100 text-green-700">Résolu</Badge>
                                      </div>
                                      {dec.motifRejet && <p className="text-xs text-muted-foreground italic mt-1">{dec.motifRejet}</p>}
                                      {dec.documentsDemandes && dec.documentsDemandes.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          <span className="text-[10px] text-muted-foreground">Docs demandés :</span>
                                          {dec.documentsDemandes.map(dt => (
                                            <Badge key={dt} variant="outline" className="text-[10px] bg-muted text-muted-foreground border-muted-foreground/20">
                                              {ALL_DOCUMENT_TYPES.find(t => t.value === dt)?.label || dt}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      {dec.rejetTempResponses && dec.rejetTempResponses.length > 0 && (
                                        <div className="mt-2 space-y-1.5 ml-1">
                                          <span className="text-[10px] text-muted-foreground font-medium">💬 Réponses :</span>
                                          {dec.rejetTempResponses.map((resp: RejetTempResponseDto, ri: number) => (
                                            <div key={ri} className="rounded border border-muted bg-background p-2 text-xs space-y-0.5">
                                              <p className="text-foreground">{resp.message}</p>
                                              {resp.documentUrl && (
                                                <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                                  <Upload className="h-2.5 w-2.5 mr-0.5" /> Document uploadé
                                                </Badge>
                                              )}
                                              <p className="text-[10px] text-muted-foreground">
                                                {resp.auteurNom && `Par: ${resp.auteurNom}`}
                                                {resp.createdAt && ` · ${new Date(resp.createdAt).toLocaleDateString("fr-FR")}`}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right shrink-0 text-[10px] text-muted-foreground">
                                      {dec.dateDecision && <p>{new Date(dec.dateDecision).toLocaleDateString("fr-FR")}</p>}
                                      {dec.utilisateurNom && <p>Par: {dec.utilisateurNom}</p>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })()}

                  {/* Special documents displayed below visas with large icons — visibles uniquement après adoption */}
                  {(demande?.statut === "ADOPTEE" || demande?.statut === "NOTIFIEE") && <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Documents de décision
                    </p>
                    {(() => {
                      // DGD only sees Offre Fiscale Corrigée and Lettre d'Adoption
                      const visibleDocTypes = isDGD
                        ? SPECIAL_DOC_TYPES.filter(t => ["OFFRE_FISCALE_CORRIGEE", "LETTRE_ADOPTION"].includes(t))
                        : SPECIAL_DOC_TYPES;
                      return (
                    <div className={`grid ${visibleDocTypes.length <= 2 ? "grid-cols-2" : "grid-cols-3"} gap-4`}>
                      {visibleDocTypes.map((docType) => {
                        const doc = specialDocs.find(d => d.type === docType);
                        const fileUrl = doc ? getDocFileUrl(doc) : null;
                        return (
                          <div
                            key={docType}
                            className={`rounded-xl border-2 p-4 text-center transition-colors ${
                              doc
                                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                                : "border-dashed border-muted-foreground/20 bg-muted/20"
                            }`}
                          >
                            {doc ? (
                              <FileDown className="h-10 w-10 text-primary mx-auto mb-2" />
                            ) : (
                              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                            )}
                            <p className={`text-xs font-semibold ${doc ? "text-foreground" : "text-muted-foreground"}`}>
                              {SPECIAL_DOC_LABELS[docType]}
                            </p>
                            {doc ? (
                              <div className="flex items-center justify-center gap-1 mt-2">
                                {fileUrl && (
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => window.open(fileUrl, "_blank")}>
                                    <ExternalLink className="h-3 w-3 mr-1" /> Ouvrir
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground mt-1">Non disponible</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                      );
                    })()}
                   </div>}
                </CardContent>
              </Card>

              {/* Pièces du dossier (sans les documents spéciaux) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Pièces du dossier</CardTitle>
                    {isAC && !isFinal && (
                      <Button size="sm" onClick={() => setUploadOpen(true)}>
                        <Upload className="h-4 w-4 mr-1" /> Nouvelle version
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {docsLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : (() => {
                    // Group actual docs by type, excluding special doc types
                    const regularDocs = docs.filter(d => !SPECIAL_DOC_TYPES.includes(d.type));
                    const groupedByType = regularDocs.reduce<Record<string, typeof docs>>((acc, d) => {
                      if (!acc[d.type]) acc[d.type] = [];
                      acc[d.type].push(d);
                      return acc;
                    }, {});

                    if (Object.keys(groupedByType).length === 0) {
                      return <p className="text-sm text-muted-foreground italic text-center py-4">Aucun document associé</p>;
                    }

                    return (
                      <div className="space-y-2">
                        {Object.entries(groupedByType).map(([type, versions]) => {
                          const dt = ALL_DOCUMENT_TYPES.find(t => t.value === type);
                          const label = dt?.label || type;
                          const sorted = [...versions].sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
                          const activeDoc = sorted.find(d => d.actif !== false) || sorted[0];
                          const hasVersions = sorted.length > 1;
                          const fileUrl = activeDoc ? getDocFileUrl(activeDoc) : null;

                          return (
                            <div key={type} className="rounded-lg border border-border p-3 text-sm">
                              <div className="flex items-center gap-3">
                                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">
                                    {label}
                                    {activeDoc?.version && activeDoc.version > 1 && (
                                      <Badge variant="outline" className="ml-2 text-[10px]">v{activeDoc.version}</Badge>
                                    )}
                                  </p>
                                  {activeDoc && <p className="text-xs text-muted-foreground truncate">{activeDoc.nomFichier}</p>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {activeDoc && fileUrl && (
                                    <>
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(fileUrl, "_blank")}>
                                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir
                                      </Button>
                                      <a href={fileUrl} download={activeDoc.nomFichier || label}>
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                          <Download className="h-3.5 w-3.5 mr-1" /> Télécharger
                                        </Button>
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>
                              {hasVersions && (
                                <div className="mt-2 ml-7 space-y-1">
                                  <p className="text-xs text-muted-foreground flex items-center gap-1"><History className="h-3 w-3" /> Historique des versions</p>
                                  {sorted.filter(d => d.id !== activeDoc?.id).map(v => (
                                    <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-2 border-l border-border">
                                      <Badge variant="outline" className="text-[10px]">v{v.version ?? 1}</Badge>
                                      <span className="truncate">{v.nomFichier}</span>
                                      {v.dateUpload && <span>{new Date(v.dateUpload).toLocaleDateString("fr-FR")}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* Right: Actions */}
            <div className="space-y-4">
              {/* Actions pour les directions */}
              {isDirection && !isFinal && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Ma décision</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {myDecision ? (
                      <div className="text-center py-2">
                        {myDecision.decision === "VISA" ? (
                          <>
                            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-1" />
                            <p className="font-semibold text-green-700 text-sm">Visa apposé</p>
                          </>
                        ) : myDecision.rejetTempStatus === "RESOLU" ? (
                          <>
                            <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-1" />
                            <p className="font-semibold text-emerald-700 text-sm">Rejet résolu</p>
                            <p className="text-xs text-muted-foreground mt-1">Le rejet a été résolu — vous pouvez maintenant apposer votre visa</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-8 w-8 text-red-600 mx-auto mb-1" />
                            <p className="font-semibold text-red-700 text-sm">Rejet temporaire en cours</p>
                            {myDecision.motifRejet && <p className="text-xs text-muted-foreground italic mt-1">{myDecision.motifRejet}</p>}
                          </>
                        )}
                      </div>
                    ) : null}

                    {/* Blocked by DGD warning */}
                    {blockedByDgd && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        <p className="font-medium">⏳ En attente du visa DGD</p>
                        <p className="mt-1">Le DGD doit valider cette demande en premier avant que vous puissiez apposer votre visa.</p>
                      </div>
                    )}

                    {/* Upload requirement warning for DGD/DGTCP */}
                    {!blockedByDgd && uploadReq && !hasUploadedRequiredDoc && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        <p className="font-medium">⚠️ Upload requis avant visa</p>
                        <p className="mt-1">Vous devez uploader le document « {uploadReq.label} » avant de pouvoir apposer votre visa.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full border-amber-300 text-amber-800 hover:bg-amber-100"
                          onClick={() => { setPreVisaFile(null); setPreVisaUploadOpen(true); }}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" /> Uploader {uploadReq.label}
                        </Button>
                      </div>
                    )}

                    {!blockedByDgd && uploadReq && hasUploadedRequiredDoc && (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-xs text-green-700 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>{uploadReq.label} uploadé ✓</span>
                      </div>
                    )}

                    <Button className="w-full" onClick={handleTempVisa} disabled={actionLoading || blockedByDgd || myHasVisa || myOpenRejets.length > 0}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      {myHasVisa ? "Visa apposé ✓" : myOpenRejets.length > 0 ? "Résoudre les rejets d'abord" : "Apposer visa"}
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => { setRejectMotif(""); setRejectDocsDemandes([]); setRejectOpen(true); }} disabled={actionLoading || blockedByDgd || myHasVisa}>
                      <XCircle className="h-4 w-4 mr-2" />
                      {myHasVisa ? "Visa déjà apposé" : myRoleDecs.some(d => d.decision === "REJET_TEMP") ? "Nouveau rejet temporaire" : "Rejeter temporairement"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Décision finale + Lettre d'Adoption (PRESIDENT only) */}
              {canFinalDecision && !isFinal && (
                <Card className="border-primary/30">
                  <CardHeader><CardTitle className="text-lg">Décision finale</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {/* Lettre d'Adoption upload */}
                    {!docs.some(d => d.type === "LETTRE_ADOPTION") ? (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                        <p className="font-medium">📄 Lettre d'Adoption</p>
                        <p className="mt-1">Uploadez la lettre d'adoption avant de finaliser la décision.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full border-blue-300 text-blue-800 hover:bg-blue-100"
                          onClick={() => { setUploadType("LETTRE_ADOPTION"); setUploadFile(null); setUploadOpen(true); }}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" /> Uploader Lettre d'Adoption
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-xs text-green-700 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>Lettre d'Adoption uploadée ✓</span>
                      </div>
                    )}

                    {hasAnyRejet && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
                        ⚠️ Un rejet temporaire est en cours. Vérifiez les décisions avant de trancher.
                      </div>
                    )}
                    <Button className="w-full" onClick={() => { setFinalType("ADOPTEE"); setFinalMotif(""); setFinalOpen(true); }} disabled={actionLoading}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Adopter (final)
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => { setFinalType("REJETEE"); setFinalMotif(""); setFinalOpen(true); }} disabled={actionLoading}>
                      <XCircle className="h-4 w-4 mr-2" /> Rejeter (final)
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Statut final affiché */}
              {isFinal && (
                <Card className={demande.statut === "ADOPTEE" ? "border-green-300" : "border-red-300"}>
                  <CardContent className="py-6 text-center">
                    {demande.statut === "ADOPTEE" ? (
                      <>
                        <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-2" />
                        <p className="font-bold text-green-700 text-lg">Demande Adoptée</p>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-10 w-10 text-red-600 mx-auto mb-2" />
                        <p className="font-bold text-red-700 text-lg">Demande Rejetée</p>
                        {demande.motifRejet && <p className="text-sm text-muted-foreground mt-2 italic">{demande.motifRejet}</p>}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Réclamations Section */}
              {(demande.statut === "ADOPTEE" || demande.statut === "NOTIFIEE" || reclamations.length > 0) && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Réclamations
                      </h3>
                      {/* Bouton dépôt : AC/UPM/UEP/Entreprise sur ADOPTEE/NOTIFIEE, pas de SOUMISE en cours */}
                      {hasRole(["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE"]) &&
                        (demande.statut === "ADOPTEE" || demande.statut === "NOTIFIEE") &&
                        !reclamations.some(r => r.statut === "SOUMISE") && (
                        <Button size="sm" variant="outline" onClick={() => setReclamationOpen(true)}>
                          <Plus className="h-4 w-4 mr-1" /> Déposer une réclamation
                        </Button>
                      )}
                    </div>
                    {reclamations.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Aucune réclamation déposée.</p>
                    ) : (
                      <div className="space-y-3">
                        {reclamations.map((rec) => (
                          <div key={rec.id} className={`rounded-lg border p-3 space-y-2 ${
                            rec.statut === "SOUMISE" ? "border-amber-300 bg-amber-50" :
                            rec.statut === "ACCEPTEE" ? "border-green-300 bg-green-50" :
                            rec.statut === "ANNULEE" ? "border-muted bg-muted/30" :
                            "border-red-300 bg-red-50"
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${
                                  rec.statut === "SOUMISE" ? "bg-amber-100 text-amber-800" :
                                  rec.statut === "ACCEPTEE" ? "bg-green-100 text-green-800" :
                                  rec.statut === "ANNULEE" ? "bg-muted text-muted-foreground" :
                                  "bg-red-100 text-red-800"
                                }`}>
                                  {RECLAMATION_STATUT_LABELS[rec.statut]}
                                </Badge>
                                {rec.auteurNom && <span className="text-xs text-muted-foreground">Par : {rec.auteurNom}</span>}
                              </div>
                              {rec.dateCreation && <span className="text-xs text-muted-foreground">{new Date(rec.dateCreation).toLocaleDateString("fr-FR")}</span>}
                            </div>
                            <p className="text-sm">{rec.texte}</p>
                            {rec.pieceJointeNomFichier && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <FileText className="h-3.5 w-3.5" />
                                <span>{rec.pieceJointeNomFichier}</span>
                                {rec.pieceJointeChemin && (
                                  <a href={rec.pieceJointeChemin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3" /> Ouvrir
                                  </a>
                                )}
                              </div>
                            )}
                            {rec.statut === "REJETEE" && rec.motifReponse && (
                              <div className="rounded border border-red-200 bg-red-100/50 p-2 text-xs">
                                <span className="font-medium">Motif du rejet : </span>{rec.motifReponse}
                              </div>
                            )}
                            {rec.statut === "ACCEPTEE" && (
                              <div className="rounded border border-green-200 bg-green-100/50 p-2 text-xs">
                                <span className="font-medium">✅ Acceptée</span> — La demande a été réinitialisée au statut REÇUE.
                                {rec.motifReponse && <p className="mt-1">{rec.motifReponse}</p>}
                              </div>
                            )}
                            {rec.statut === "ANNULEE" && (
                              <div className="rounded border border-muted p-2 text-xs text-muted-foreground italic">
                                Réclamation annulée
                              </div>
                            )}
                            {/* Traitement : DGTCP accepte, PRESIDENT rejette */}
                            {rec.statut === "SOUMISE" && (hasRole(["DGTCP"]) || hasRole(["PRESIDENT"])) && (
                              <div className="flex gap-2 mt-2">
                                {hasRole(["DGTCP"]) && (
                                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => {
                                    setTraiterReclamationId(rec.id);
                                    setTraiterAcceptee(true);
                                    setTraiterMotif("");
                                    setTraiterOpen(true);
                                  }}>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Accepter
                                  </Button>
                                )}
                                {hasRole(["PRESIDENT"]) && (
                                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => {
                                    setTraiterReclamationId(rec.id);
                                    setTraiterAcceptee(false);
                                    setTraiterMotif("");
                                    setTraiterOpen(true);
                                  }}>
                                    <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeter
                                  </Button>
                                )}
                              </div>
                            )}
                            {/* Annulation par auteur ou AC */}
                            {rec.statut === "SOUMISE" && (
                              (rec.auteurUserId === user?.userId) || hasRole(["AUTORITE_CONTRACTANTE"])
                            ) && (
                              <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => handleAnnulerReclamation(rec.id)}>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Annuler la réclamation
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Bandeau re-upload après réclamation acceptée */}
              {demande.statut === "RECUE" && reclamations.some(r => r.statut === "ACCEPTEE") && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-sm text-amber-800">Réclamation acceptée — Nouveau cycle d'évaluation</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Le processus d'évaluation reprend. Le <strong>DGD</strong> doit téléverser la nouvelle <strong>offre corrigée</strong> et le <strong>Président</strong> la nouvelle <strong>lettre d'adoption</strong>.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Assistance Link */}
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" /> Assistance intelligente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Lancer l'analyse IA pour vérifier les corrections douanières.
                  </p>
                  <Button className="w-full" onClick={() => navigate(`/dashboard/extraction-dgd/${id}`)}>
                    <Bot className="h-4 w-4 mr-2" /> Chatbot DQE + Offre Fiscale
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Reject Temp Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rejet temporaire</DialogTitle>
            <DialogDescription>Indiquez le motif du rejet et sélectionnez les documents à corriger/compléter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Motif du rejet temporaire..." value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} rows={3} />
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Documents à corriger / compléter <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-lg border border-border p-3">
                {ALL_DOCUMENT_TYPES.map(dt => (
                  <label key={dt.value} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={rejectDocsDemandes.includes(dt.value)}
                      onCheckedChange={(checked) => {
                        setRejectDocsDemandes(prev =>
                          checked ? [...prev, dt.value] : prev.filter(v => v !== dt.value)
                        );
                      }}
                    />
                    <span>{dt.label}</span>
                  </label>
                ))}
              </div>
              {rejectDocsDemandes.length === 0 && (
                <p className="text-xs text-destructive mt-1">Sélectionnez au moins un document</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button variant="destructive" disabled={!rejectMotif.trim() || rejectDocsDemandes.length === 0} onClick={handleTempReject}>
              <XCircle className="h-4 w-4 mr-1" /> Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Decision Dialog */}
      <Dialog open={finalOpen} onOpenChange={setFinalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Décision finale — {finalType === "ADOPTEE" ? "Adopter" : "Rejeter"}</DialogTitle>
            <DialogDescription>Cette action est définitive et changera le statut de la demande.</DialogDescription>
          </DialogHeader>
          {finalType === "REJETEE" && (
            <Textarea placeholder="Motif du rejet final..." value={finalMotif} onChange={(e) => setFinalMotif(e.target.value)} rows={3} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalOpen(false)}>Annuler</Button>
            <Button
              variant={finalType === "ADOPTEE" ? "default" : "destructive"}
              disabled={finalType === "REJETEE" && !finalMotif.trim()}
              onClick={handleFinalDecision}
            >
              {finalType === "ADOPTEE" ? <CheckCircle className="h-4 w-4 mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Visa Upload Dialog (DGD/DGTCP) */}
      <Dialog open={preVisaUploadOpen} onOpenChange={setPreVisaUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload requis — {uploadReq?.label}</DialogTitle>
            <DialogDescription>
              Vous devez uploader le document « {uploadReq?.label} » avant de pouvoir apposer votre visa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Fichier</Label>
              <Input type="file" onChange={(e) => setPreVisaFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreVisaUploadOpen(false)}>Annuler</Button>
            <Button disabled={!preVisaFile || preVisaLoading} onClick={handlePreVisaUpload}>
              {preVisaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Uploader
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog (AC - nouvelle version) */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Uploader une nouvelle version</DialogTitle>
            <DialogDescription>L'ancien document deviendra inactif, le nouveau sera la version active.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Type de document</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue placeholder="Sélectionner le type" /></SelectTrigger>
                <SelectContent>
                  {ALL_DOCUMENT_TYPES.map(dt => (
                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fichier</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            {/* Message de justification si c'est en réponse à un rejet */}
            {(() => {
              const isRejetResponse = uploadType && decisions.some(
                d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT" && d.documentsDemandes?.includes(uploadType)
              );
              if (!isRejetResponse) return null;
              return (
                <div>
                  <Label className="text-xs">Message de justification <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="Expliquez la correction apportée..."
                    value={uploadMessage}
                    onChange={(e) => setUploadMessage(e.target.value)}
                    rows={2}
                  />
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Annuler</Button>
            <Button disabled={!uploadType || !uploadFile || uploadLoading} onClick={handleUpload}>
              {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Uploader
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Répondre à un rejet (message seul) */}
      <Dialog open={responseOpen} onOpenChange={setResponseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Répondre au rejet</DialogTitle>
            <DialogDescription>Envoyez un message de justification à l'organisme ayant émis le rejet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Afficher les documents demandés par ce rejet */}
            {(() => {
              const rejetDec = decisions.find(d => d.id === responseDecisionId);
              if (!rejetDec?.documentsDemandes?.length) return null;
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-800 mb-1.5">📋 Documents demandés par ce rejet :</p>
                  <div className="flex flex-wrap gap-1">
                    {rejetDec.documentsDemandes.map((dt: string) => (
                      <Badge key={dt} variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                        {ALL_DOCUMENT_TYPES.find(t => t.value === dt)?.label || dt}
                      </Badge>
                    ))}
                  </div>
                  {rejetDec.motifRejet && (
                    <p className="text-xs text-amber-700 italic mt-2">Motif : {rejetDec.motifRejet}</p>
                  )}
                </div>
              );
            })()}
            <Textarea
              placeholder="Votre message de justification..."
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseOpen(false)}>Annuler</Button>
            <Button disabled={!responseMessage.trim() || responseLoading} onClick={handleRejetResponse}>
              {responseLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entreprise Detail Dialog */}
      <Dialog open={entrepriseDialogOpen} onOpenChange={setEntrepriseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Informations de l'entreprise</DialogTitle></DialogHeader>
          {entrepriseLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entrepriseDetail ? (
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">Raison sociale</span>
                <p className="font-medium">{entrepriseDetail.raisonSociale || "—"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">NIF</span>
                <p className="font-medium">{entrepriseDetail.nif || "—"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">Adresse</span>
                <p className="font-medium">{entrepriseDetail.adresse || "—"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">Situation fiscale</span>
                <p>
                  <Badge className={entrepriseDetail.situationFiscale === "REGULIERE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                    {entrepriseDetail.situationFiscale || "—"}
                  </Badge>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Aucune information disponible</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Réclamation Deposit Dialog */}
      <Dialog open={reclamationOpen} onOpenChange={(v) => { setReclamationOpen(v); if (!v) { setReclamationTexte(""); setReclamationFile(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Déposer une réclamation</DialogTitle>
            <DialogDescription>Décrivez votre réclamation et joignez un document justificatif.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motif de la réclamation <span className="text-destructive">*</span></Label>
              <Textarea placeholder="Décrivez votre réclamation..." value={reclamationTexte} onChange={(e) => setReclamationTexte(e.target.value)} rows={4} maxLength={4000} />
              <p className="text-xs text-muted-foreground text-right">{reclamationTexte.length}/4000</p>
            </div>
            <div className="space-y-2">
              <Label>Pièce justificative <span className="text-destructive">*</span></Label>
              <Input type="file" onChange={(e) => setReclamationFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReclamationOpen(false); setReclamationTexte(""); setReclamationFile(null); }}>Annuler</Button>
            <Button onClick={handleCreateReclamation} disabled={reclamationSubmitting || !reclamationTexte.trim() || !reclamationFile}>
              {reclamationSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Déposer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Traiter Réclamation Dialog */}
      <Dialog open={traiterOpen} onOpenChange={(v) => { setTraiterOpen(v); if (!v) { setTraiterReclamationId(null); setTraiterMotif(""); setTraiterFile(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{traiterAcceptee ? "Accepter la réclamation" : "Rejeter la réclamation"}</DialogTitle>
            <DialogDescription>
              {traiterAcceptee
                ? "L'acceptation remettra la demande au statut REÇUE et réinitialisera les visas."
                : "Indiquez le motif et joignez un document de réponse pour rejeter cette réclamation."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                {traiterAcceptee ? "Commentaire (optionnel)" : "Motif du rejet"} {!traiterAcceptee && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                placeholder={traiterAcceptee ? "Commentaire interne..." : "Motif obligatoire (max 2000 caractères)..."}
                value={traiterMotif}
                onChange={(e) => setTraiterMotif(e.target.value.slice(0, 2000))}
                rows={3}
                maxLength={2000}
              />
              {!traiterAcceptee && (
                <p className="text-[10px] text-muted-foreground text-right">{traiterMotif.length}/2000</p>
              )}
            </div>
            {!traiterAcceptee && (
              <div className="space-y-2">
                <Label>Document de réponse <span className="text-destructive">*</span></Label>
                <Input
                  type="file"
                  onChange={(e) => setTraiterFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {traiterFile && (
                  <p className="text-xs text-muted-foreground">{traiterFile.name} ({(traiterFile.size / 1024).toFixed(0)} Ko)</p>
                )}
              </div>
            )}
            {traiterAcceptee && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">⚠️ Conséquences de l'acceptation :</p>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>La demande repasse au statut <strong>REÇUE</strong></li>
                  <li>Tous les visas sont réinitialisés</li>
                  <li>La lettre d'adoption et l'offre corrigée sont archivées</li>
                  <li>Le DGD et le Président devront retéléverser les documents</li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTraiterOpen(false); setTraiterReclamationId(null); setTraiterMotif(""); setTraiterFile(null); }}>Annuler</Button>
            <Button variant={traiterAcceptee ? "default" : "destructive"} onClick={handleTraiterReclamation} disabled={traiterSubmitting || (!traiterAcceptee && (!traiterMotif.trim() || !traiterFile))}>
              {traiterSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : traiterAcceptee ? <CheckCircle className="h-4 w-4 mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              {traiterAcceptee ? "Confirmer l'acceptation" : "Confirmer le rejet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CorrectionDouaniere;
