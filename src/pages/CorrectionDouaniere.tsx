import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DocumentDto, DecisionCorrectionDto,
  ALL_DOCUMENT_TYPES_VALUES, RejetTempResponseDto,
  ReclamationDemandeCorrectionDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import DiscussionCommissionPanel from "@/components/explication/DiscussionCommissionPanel";
import { displayRef } from "@/lib/displayRef";
import { tStatutDemande, tReclamationStatut, tTypeDocument } from "@/i18n/enums";
import { formatDate, formatDateTime } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  FileText, ArrowLeft, Loader2, CheckCircle, XCircle,
  Download, ExternalLink, /*Bot,*/ Upload, History, RefreshCw,
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
const SPECIAL_DOC_TYPES = ["CREDIT_EXTERIEUR", "CREDIT_INTERIEUR", "LETTRE_ADOPTION", "OFFRE_FISCALE_CORRIGEE"];
const UPLOAD_REQUIRED_ROLES: Record<string, { docType: string }> = {
  DGD: { docType: "OFFRE_FISCALE_CORRIGEE" },
};

const CorrectionDouaniere = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  usePageTitle("correction_douaniere:page.title");

  const [demande, setDemande] = useState<DemandeCorrectionDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejectDocsDemandes, setRejectDocsDemandes] = useState<string[]>([]);

  const [finalOpen, setFinalOpen] = useState(false);
  const [finalType, setFinalType] = useState<"ADOPTEE" | "REJETEE">("ADOPTEE");
  const [finalMotif, setFinalMotif] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const [activeOrg, setActiveOrg] = useState("DGD");

  const [responseOpen, setResponseOpen] = useState(false);
  const [responseDecisionId, setResponseDecisionId] = useState<number | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [responseLoading, setResponseLoading] = useState(false);

  const [preVisaUploadOpen, setPreVisaUploadOpen] = useState(false);
  const [preVisaFile, setPreVisaFile] = useState<File | null>(null);
  const [preVisaLoading, setPreVisaLoading] = useState(false);

  const [entrepriseDetail, setEntrepriseDetail] = useState<any | null>(null);
  const [entrepriseLoading, setEntrepriseLoading] = useState(false);
  const [entrepriseDialogOpen, setEntrepriseDialogOpen] = useState(false);

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
  const [visaConfirmOpen, setVisaConfirmOpen] = useState(false);

  const errTitle = t("common:errors.generic_title", { defaultValue: "Erreur" });
  const okTitle = t("common:success.generic_title", { defaultValue: "Succès" });

  const fetchDemande = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setDemande(await demandeCorrectionApi.getById(Number(id)));
    } catch {
      toast({ title: errTitle, description: t("correction_douaniere:toast.load_error"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const fetchDocs = async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      const list = await demandeCorrectionApi.getDocuments(Number(id));
      // Normalisation: le backend renvoie désormais `codeDocument`, on garde `type` pour la compat UI.
      setDocs(list.map(d => ({ ...d, type: d.codeDocument ?? d.type })));
    }
    catch { setDocs([]); }
    finally { setDocsLoading(false); }
  };

  const fetchDecisions = async () => {
    if (!id) return;
    try { setDecisions(await demandeCorrectionApi.getDecisions(Number(id))); }
    catch { setDecisions([]); }
  };

  const fetchReclamations = async () => {
    if (!id) return;
    try { setReclamations(await demandeCorrectionApi.getReclamations(Number(id))); }
    catch { setReclamations([]); }
  };

  useEffect(() => {
    fetchDemande(); fetchDocs(); fetchDecisions(); fetchReclamations();
  }, [id]);

  const handleCreateReclamation = async () => {
    if (!demande || !reclamationTexte.trim() || !reclamationFile) return;
    setReclamationSubmitting(true);
    try {
      await demandeCorrectionApi.createReclamation(demande.id, reclamationTexte.trim(), reclamationFile);
      toast({ title: okTitle, description: t("correction_douaniere:toast.reclamation_created") });
      setReclamationOpen(false); setReclamationTexte(""); setReclamationFile(null);
      fetchDemande(); fetchReclamations();
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally { setReclamationSubmitting(false); }
  };

  const handleTraiterReclamation = async () => {
    if (!demande || !traiterReclamationId) return;
    if (!traiterAcceptee && !traiterMotif.trim()) {
      toast({ title: t("correction_douaniere:toast.reclamation_motif_required_title"), description: t("correction_douaniere:toast.reclamation_motif_required_body"), variant: "destructive" });
      return;
    }
    if (!traiterAcceptee && !traiterFile) {
      toast({ title: t("correction_douaniere:toast.reclamation_file_required_title"), description: t("correction_douaniere:toast.reclamation_file_required_body"), variant: "destructive" });
      return;
    }
    setTraiterSubmitting(true);
    try {
      await demandeCorrectionApi.traiterReclamation(demande.id, traiterReclamationId, traiterAcceptee, traiterMotif.trim() || undefined, traiterFile || undefined);
      toast({ title: okTitle, description: traiterAcceptee ? t("correction_douaniere:toast.reclamation_accepted") : t("correction_douaniere:toast.reclamation_rejected") });
      setTraiterOpen(false); setTraiterReclamationId(null); setTraiterMotif(""); setTraiterFile(null);
      fetchDemande(); fetchDecisions(); fetchReclamations(); fetchDocs();
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally { setTraiterSubmitting(false); }
  };

  const handleAnnulerReclamation = async (reclamationId: number) => {
    if (!demande) return;
    try {
      await demandeCorrectionApi.annulerReclamation(demande.id, reclamationId);
      toast({ title: okTitle, description: t("correction_douaniere:toast.reclamation_annulee") });
      fetchDemande(); fetchReclamations(); fetchDecisions();
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    }
  };

  const openEntrepriseDetail = async (entrepriseId: number) => {
    setEntrepriseDialogOpen(true);
    setEntrepriseLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/entreprises/${entrepriseId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
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
        toast({ title: errTitle, description: t("correction_douaniere:toast.entreprise_error"), variant: "destructive" });
      }
    } finally { setEntrepriseLoading(false); }
  };

  const userRole = user?.role;
  const uploadReq = userRole ? UPLOAD_REQUIRED_ROLES[userRole] : null;
  const uploadReqLabel = uploadReq ? tTypeDocument(uploadReq.docType) : "";
  const hasUploadedRequiredDoc = uploadReq ? docs.some(d => d.type === uploadReq.docType) : true;

  const handlePreVisaUpload = async () => {
    if (!demande || !uploadReq || !preVisaFile) return;
    setPreVisaLoading(true);
    try {
      await demandeCorrectionApi.uploadDocument(demande.id, uploadReq.docType, preVisaFile);
      toast({ title: okTitle, description: t("correction_douaniere:toast.pre_visa_success", { label: uploadReqLabel }) });
      await fetchDocs();
      setPreVisaUploadOpen(false); setPreVisaFile(null);
      await demandeCorrectionApi.postDecision(demande.id, "VISA");
      toast({ title: okTitle, description: t("correction_douaniere:toast.visa_success") });
      await fetchDecisions(); await fetchDemande();
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally { setPreVisaLoading(false); }
  };

  const handleTempVisa = async () => {
    if (!demande) return;
    if (uploadReq && !hasUploadedRequiredDoc) { setPreVisaUploadOpen(true); return; }
    setActionLoading(true);
    try {
      await demandeCorrectionApi.postDecision(demande.id, "VISA");
      toast({ title: okTitle, description: t("correction_douaniere:toast.visa_temp_success") });
      await fetchDecisions(); await fetchDemande();
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const confirmVisa = () => {
    setVisaConfirmOpen(false);
    handleTempVisa();
  };

  const handleTempReject = async () => {
    if (!demande || !rejectMotif.trim() || rejectDocsDemandes.length === 0) return;
    setRejectOpen(false); setActionLoading(true);
    try {
      await demandeCorrectionApi.postDecision(demande.id, "REJET_TEMP", rejectMotif.trim(), rejectDocsDemandes);
      toast({ title: okTitle, description: t("correction_douaniere:toast.rejet_temp_success") });
      await fetchDecisions(); await fetchDemande();
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); setRejectMotif(""); setRejectDocsDemandes([]); }
  };

  const handleFinalDecision = async () => {
    if (!demande) return;
    setFinalOpen(false); setActionLoading(true);
    try {
      await demandeCorrectionApi.updateStatut(demande.id, finalType, finalType === "REJETEE" ? finalMotif.trim() || undefined : undefined, true);
      toast({ title: okTitle, description: finalType === "ADOPTEE" ? t("correction_douaniere:toast.final_adopted") : t("correction_douaniere:toast.final_rejected") });
      await fetchDemande(); await fetchDecisions();
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); setFinalMotif(""); }
  };

  const handleUpload = async () => {
    if (!demande || !uploadType || !uploadFile) return;
    setUploadLoading(true);
    try {
      const openRejets = decisions.filter(
        d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT" && d.documentsDemandes?.includes(uploadType)
      );
      if (openRejets.length > 0 && !uploadMessage.trim()) {
        toast({ title: t("correction_douaniere:toast.upload_message_required_title"), description: t("correction_douaniere:toast.upload_message_required_body"), variant: "destructive" });
        setUploadLoading(false); return;
      }
      await demandeCorrectionApi.uploadDocument(demande.id, uploadType, uploadFile, uploadMessage.trim() || undefined);
      toast({ title: okTitle, description: t("correction_douaniere:toast.upload_success") });
      await fetchDocs(); await fetchDecisions(); await fetchDemande();
      setUploadOpen(false); setUploadFile(null); setUploadType(""); setUploadMessage("");
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally { setUploadLoading(false); }
  };

  const handleRejetResponse = async () => {
    if (!responseDecisionId || !responseMessage.trim()) return;
    setResponseLoading(true);
    try {
      await demandeCorrectionApi.postRejetTempResponse(responseDecisionId, responseMessage.trim());
      toast({ title: t("correction_douaniere:toast.response_sent") });
      await fetchDecisions();
      setResponseOpen(false); setResponseMessage(""); setResponseDecisionId(null);
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally { setResponseLoading(false); }
  };

  // Phase A — routing dynamique : un organisme dont l'enveloppe est nulle est exclu du workflow.
  const dgdRequired = Number(demande?.creditExterieur ?? 0) > 0;
  const dgiRequired = Number(demande?.creditInterieur ?? 0) > 0;
  const visibleDecisionRoles = DECISION_ROLES.filter(r => (r !== "DGD" || dgdRequired) && (r !== "DGI" || dgiRequired));
  const isRoleConcerned = !userRole || ((userRole !== "DGD" || dgdRequired) && (userRole !== "DGI" || dgiRequired));
  const effectiveActiveOrg = visibleDecisionRoles.includes(activeOrg) ? activeOrg : (visibleDecisionRoles[0] || activeOrg);
  const isDirection = !!userRole && DECISION_ROLES.includes(userRole) && isRoleConcerned;
  const canFinalDecision = userRole === "PRESIDENT";
  const isAC = userRole === "AUTORITE_CONTRACTANTE" || userRole === "ADMIN_SI";
  const isFinal = demande?.statut === "ADOPTEE" || demande?.statut === "REJETEE" || demande?.statut === "ANNULEE";

  const myRoleDecs = decisions.filter(d => d.role === userRole);
  const myDecision = [...myRoleDecs].sort((a, b) => new Date(b.dateDecision || 0).getTime() - new Date(a.dateDecision || 0).getTime())[0] || null;
  const hasAnyRejet = decisions.some(d => d.decision === "REJET_TEMP");
  const myHasVisa = myRoleDecs.some(d => d.decision === "VISA");
  const myOpenRejets = myRoleDecs.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus !== "RESOLU");

  const dgdHasVisa = decisions.some(d => d.role === "DGD" && d.decision === "VISA");
  const isDGD = userRole === "DGD";
  const isPresident = userRole === "PRESIDENT";
  const blockedByDgd = dgdRequired && !isDGD && !isPresident && !dgdHasVisa;

  const specialDocs = docs.filter(d => SPECIAL_DOC_TYPES.includes(d.type));
  const dash = t("correction_douaniere:info.dash");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/demandes")}>
            <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("correction_douaniere:page.back")}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {t("correction_douaniere:page.title_with_number", { numero: demande ? displayRef(demande) : `#${id}` })}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("correction_douaniere:page.subtitle")}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !demande ? (
          <p className="text-center text-muted-foreground py-8">{t("correction_douaniere:page.not_found")}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">{t("correction_douaniere:info.card_title")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t("correction_douaniere:info.numero")}</span>
                      <p className="font-medium">{displayRef(demande)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("correction_douaniere:info.statut")}</span>
                      <p><Badge className={`text-xs ${STATUT_COLORS[demande.statut] || ""}`}>{tStatutDemande(demande.statut)}</Badge></p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("correction_douaniere:info.autorite")}</span>
                      <p className="font-medium">{demande.autoriteContractanteNom || dash}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("correction_douaniere:info.entreprise")}</span>
                      {demande.entrepriseId ? (
                        <button className="font-medium text-primary hover:underline cursor-pointer text-start" onClick={() => openEntrepriseDetail(demande.entrepriseId)}>
                          {demande.entrepriseRaisonSociale || dash}
                        </button>
                      ) : (
                        <p className="font-medium">{demande.entrepriseRaisonSociale || dash}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("correction_douaniere:info.date_depot")}</span>
                      <p>{formatDate(demande.dateDepot)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{t("correction_douaniere:decisions.card_title")}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={fetchDecisions} aria-label={t("correction_douaniere:decisions.refresh_aria")}><RefreshCw className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex border-b border-border mb-4 overflow-x-auto">
                    {visibleDecisionRoles.map((role) => {
                      const roleDecs = decisions.filter(d => d.role === role);
                      const orgHasVisa = roleDecs.some(d => d.decision === "VISA");
                      const orgHasRejets = roleDecs.some(d => d.decision === "REJET_TEMP");
                      const hasOpenRejet = roleDecs.some(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT");
                      return (
                        <button
                          key={role}
                          onClick={() => setActiveOrg(role)}
                          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                            activeOrg === role ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                          }`}
                        >
                          {orgHasVisa ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            : orgHasRejets ? <XCircle className={`h-3.5 w-3.5 ${hasOpenRejet ? "text-red-600" : "text-amber-500"}`} />
                            : <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30" />}
                          {t(`correction_douaniere:decision_roles.${role}`)}
                        </button>
                      );
                    })}
                  </div>

                  {(() => {
                    const roleDecs = decisions
                      .filter(d => d.role === activeOrg)
                      .sort((a, b) => new Date(b.dateDecision || 0).getTime() - new Date(a.dateDecision || 0).getTime());
                    const activeDecs = roleDecs.filter(d => d.decision === "VISA" || (d.decision === "REJET_TEMP" && d.rejetTempStatus !== "RESOLU"));
                    const resolvedDecs = roleDecs.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "RESOLU");

                    if (roleDecs.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <div className="h-10 w-10 rounded-full border-2 border-muted-foreground/20 mx-auto mb-3" />
                          <p className="text-sm font-medium">{t("correction_douaniere:decisions.waiting_title")}</p>
                          <p className="text-xs mt-1">{t("correction_douaniere:decisions.waiting_subtitle", { role: t(`correction_douaniere:decision_roles.${activeOrg}`) })}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {activeDecs.length === 0 && resolvedDecs.length > 0 && (
                          <div className="text-center py-4 text-muted-foreground">
                            <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                            <p className="text-xs">{t("correction_douaniere:decisions.all_resolved")}</p>
                          </div>
                        )}
                        {activeDecs.map((dec, idx) => (
                          <div key={dec.id || idx} className={`rounded-lg border p-3 text-sm ${dec.decision === "VISA" ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}>
                            <div className="flex items-start gap-3">
                              {dec.decision === "VISA" ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-medium text-xs ${dec.decision === "VISA" ? "text-green-800" : "text-red-800"}`}>
                                    {dec.decision === "VISA" ? t("correction_douaniere:decisions.visa") : t("correction_douaniere:decisions.rejet_temp")}
                                  </span>
                                  {dec.decision === "REJET_TEMP" && dec.rejetTempStatus && (
                                    <Badge className={`text-[9px] ${dec.rejetTempStatus === "OUVERT" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                      {dec.rejetTempStatus === "OUVERT" ? t("correction_douaniere:decisions.status_open") : t("correction_douaniere:decisions.status_resolved")}
                                    </Badge>
                                  )}
                                </div>
                                {dec.motifRejet && <p className="text-xs text-muted-foreground italic mt-1">{dec.motifRejet}</p>}
                                {dec.documentsDemandes && dec.documentsDemandes.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    <span className="text-[10px] text-muted-foreground">{t("correction_douaniere:decisions.docs_requested")}</span>
                                    {dec.documentsDemandes.map(dt => (
                                      <Badge key={dt} variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                        {tTypeDocument(dt)}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                {dec.decision === "REJET_TEMP" && dec.rejetTempResponses && dec.rejetTempResponses.length > 0 && (
                                  <div className="mt-2 space-y-1.5 ms-1">
                                    <span className="text-[10px] text-muted-foreground font-medium">{t("correction_douaniere:decisions.responses")}</span>
                                    {dec.rejetTempResponses.map((resp: RejetTempResponseDto, ri: number) => (
                                      <div key={ri} className="rounded border border-blue-200 bg-blue-50 p-2 text-xs space-y-0.5">
                                        <p className="text-foreground">{resp.message}</p>
                                        {resp.documentType && (
                                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            {tTypeDocument(resp.documentType)}
                                            {resp.documentVersion && ` (v${resp.documentVersion})`}
                                          </p>
                                        )}
                                        {resp.documentUrl && (
                                          <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                            <Upload className="h-2.5 w-2.5 me-0.5" /> {t("correction_douaniere:decisions.document_uploaded")}
                                          </Badge>
                                        )}
                                        <p className="text-[10px] text-muted-foreground">
                                          {resp.auteurNom && t("correction_douaniere:decisions.by", { name: resp.auteurNom })}
                                          {resp.createdAt && ` · ${formatDateTime(resp.createdAt)}`}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {dec.decision === "REJET_TEMP" && dec.rejetTempStatus === "OUVERT" && isAC && (
                                  <div className="flex gap-1.5 mt-2">
                                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                                      onClick={() => { setResponseDecisionId(dec.id); setResponseMessage(""); setResponseOpen(true); }}>
                                      {t("correction_douaniere:decisions.respond")}
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                                      onClick={() => {
                                        if (dec.documentsDemandes?.length) setUploadType(dec.documentsDemandes[0]);
                                        setUploadMessage(""); setUploadFile(null); setUploadOpen(true);
                                      }}>
                                      <Upload className="h-3 w-3 me-1" /> {t("correction_douaniere:decisions.upload_doc")}
                                    </Button>
                                  </div>
                                )}

                                {dec.decision === "REJET_TEMP" && dec.rejetTempStatus === "OUVERT" && isDirection && userRole === dec.role && (
                                  <div className="mt-2">
                                    <Button size="sm" variant="default" className="h-7 text-[11px]" disabled={actionLoading}
                                      onClick={async () => {
                                        setActionLoading(true);
                                        try {
                                          await demandeCorrectionApi.resolveRejetTemp(dec.id);
                                          toast({ title: okTitle, description: t("correction_douaniere:decisions.toast_mark_resolved") });
                                          await fetchDecisions(); await fetchDemande();
                                        } catch (e: any) {
                                          toast({ title: errTitle, description: e.message, variant: "destructive" });
                                        } finally { setActionLoading(false); }
                                      }}>
                                      <CheckCircle className="h-3 w-3 me-1" /> {t("correction_douaniere:decisions.mark_resolved")}
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="text-end shrink-0 text-[10px] text-muted-foreground">
                                {dec.dateDecision && <p>{formatDateTime(dec.dateDecision)}</p>}
                                {dec.utilisateurNom && <p>{t("correction_douaniere:decisions.by", { name: dec.utilisateurNom })}</p>}
                              </div>
                            </div>
                          </div>
                        ))}

                        {resolvedDecs.length > 0 && (
                          <details className="mt-3 border-t border-border pt-3">
                            <summary className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                              <History className="h-3.5 w-3.5" />
                              {t("correction_douaniere:decisions.history", { count: resolvedDecs.length })}
                            </summary>
                            <div className="space-y-2 mt-2">
                              {resolvedDecs.map((dec, idx) => (
                                <div key={dec.id || idx} className="rounded-lg border border-muted bg-muted/30 p-3 text-sm opacity-75">
                                  <div className="flex items-start gap-3">
                                    <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-xs text-muted-foreground">{t("correction_douaniere:decisions.rejet_temp")}</span>
                                        <Badge className="text-[9px] bg-green-100 text-green-700">{t("correction_douaniere:decisions.status_resolved")}</Badge>
                                      </div>
                                      {dec.motifRejet && <p className="text-xs text-muted-foreground italic mt-1">{dec.motifRejet}</p>}
                                      {dec.documentsDemandes && dec.documentsDemandes.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          <span className="text-[10px] text-muted-foreground">{t("correction_douaniere:decisions.docs_requested")}</span>
                                          {dec.documentsDemandes.map(dt => (
                                            <Badge key={dt} variant="outline" className="text-[10px] bg-muted text-muted-foreground border-muted-foreground/20">
                                              {tTypeDocument(dt)}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      {dec.rejetTempResponses && dec.rejetTempResponses.length > 0 && (
                                        <div className="mt-2 space-y-1.5 ms-1">
                                          <span className="text-[10px] text-muted-foreground font-medium">{t("correction_douaniere:decisions.responses")}</span>
                                          {dec.rejetTempResponses.map((resp: RejetTempResponseDto, ri: number) => (
                                            <div key={ri} className="rounded border border-muted bg-background p-2 text-xs space-y-0.5">
                                              <p className="text-foreground">{resp.message}</p>
                                              {resp.documentUrl && (
                                                <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                                  <Upload className="h-2.5 w-2.5 me-0.5" /> {t("correction_douaniere:decisions.document_uploaded")}
                                                </Badge>
                                              )}
                                              <p className="text-[10px] text-muted-foreground">
                                                {resp.auteurNom && t("correction_douaniere:decisions.by", { name: resp.auteurNom })}
                                                {resp.createdAt && ` · ${formatDate(resp.createdAt)}`}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-end shrink-0 text-[10px] text-muted-foreground">
                                      {dec.dateDecision && <p>{formatDate(dec.dateDecision)}</p>}
                                      {dec.utilisateurNom && <p>{t("correction_douaniere:decisions.by", { name: dec.utilisateurNom })}</p>}
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

                  <div className="mt-6">
                    <DiscussionCommissionPanel contexte="CORRECTION" dossierId={demande?.id} dossierStatut={demande?.statut as string} />
                  </div>



                  {(demande?.statut === "ADOPTEE" || demande?.statut === "NOTIFIEE") && <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> {t("correction_douaniere:decisions.special_docs_title")}
                    </p>
                    {(() => {
                      const visibleDocTypes = isDGD
                        ? SPECIAL_DOC_TYPES.filter(t => ["OFFRE_FISCALE_CORRIGEE", "LETTRE_ADOPTION"].includes(t))
                        : SPECIAL_DOC_TYPES;
                      return (
                    <div className={`grid ${visibleDocTypes.length <= 2 ? "grid-cols-2" : "grid-cols-3"} gap-4`}>
                      {visibleDocTypes.map((docType) => {
                        const doc = specialDocs.find(d => d.type === docType);
                        const fileUrl = doc ? getDocFileUrl(doc) : null;
                        return (
                          <div key={docType} className={`rounded-xl border-2 p-4 text-center transition-colors ${doc ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : "border-dashed border-muted-foreground/20 bg-muted/20"}`}>
                            {doc ? <FileDown className="h-10 w-10 text-primary mx-auto mb-2" /> : <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />}
                            <p className={`text-xs font-semibold ${doc ? "text-foreground" : "text-muted-foreground"}`}>
                              {t(`correction_douaniere:special_docs.${docType}`)}
                            </p>
                            {doc ? (
                              <div className="flex items-center justify-center gap-1 mt-2">
                                {fileUrl && (
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => window.open(fileUrl, "_blank")}>
                                    <ExternalLink className="h-3 w-3 me-1" /> {t("correction_douaniere:decisions.open")}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground mt-1">{t("correction_douaniere:decisions.special_doc_unavailable")}</p>
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

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{t("correction_douaniere:documents.card_title")}</CardTitle>
                    {isAC && !isFinal && (
                      <Button size="sm" onClick={() => setUploadOpen(true)}>
                        <Upload className="h-4 w-4 me-1" /> {t("correction_douaniere:documents.new_version")}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {docsLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : (() => {
                    // Les "docs spéciaux" (offre fiscale corrigée, lettre d'adoption, crédits...)
                    // ne sont affichés dans leur grille dédiée que lorsque le dossier est ADOPTEE/NOTIFIEE.
                    // Sinon on les liste ici pour qu'ils restent visibles dès l'upload.
                    const specialGridVisible = demande?.statut === "ADOPTEE" || demande?.statut === "NOTIFIEE";
                    const regularDocs = specialGridVisible
                      ? docs.filter(d => !SPECIAL_DOC_TYPES.includes(d.type))
                      : docs;
                    const groupedByType = regularDocs.reduce<Record<string, typeof docs>>((acc, d) => {
                      if (!acc[d.type]) acc[d.type] = [];
                      acc[d.type].push(d);
                      return acc;
                    }, {});

                    if (Object.keys(groupedByType).length === 0) {
                      return <p className="text-sm text-muted-foreground italic text-center py-4">{t("correction_douaniere:documents.none")}</p>;
                    }

                    return (
                      <div className="space-y-2">
                        {Object.entries(groupedByType).map(([type, versions]) => {
                          const label = tTypeDocument(type);
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
                                      <Badge variant="outline" className="ms-2 text-[10px]">v{activeDoc.version}</Badge>
                                    )}
                                  </p>
                                  {activeDoc && <p className="text-xs text-muted-foreground truncate">{activeDoc.nomFichier}</p>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {activeDoc && fileUrl && (
                                    <>
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(fileUrl, "_blank")}>
                                        <ExternalLink className="h-3.5 w-3.5 me-1" /> {t("correction_douaniere:documents.open")}
                                      </Button>
                                      <a href={fileUrl} download={activeDoc.nomFichier || label}>
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                          <Download className="h-3.5 w-3.5 me-1" /> {t("correction_douaniere:documents.download")}
                                        </Button>
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>
                              {hasVersions && (
                                <div className="mt-2 ms-7 space-y-1">
                                  <p className="text-xs text-muted-foreground flex items-center gap-1"><History className="h-3 w-3" /> {t("correction_douaniere:documents.versions_history")}</p>
                                  {sorted.filter(d => d.id !== activeDoc?.id).map(v => (
                                    <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground ps-2 border-s border-border">
                                      <Badge variant="outline" className="text-[10px]">v{v.version ?? 1}</Badge>
                                      <span className="truncate">{v.nomFichier}</span>
                                      {v.dateUpload && <span>{formatDate(v.dateUpload)}</span>}
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

            <div className="space-y-4">
              {isDirection && !isFinal && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">{t("correction_douaniere:actions.ma_decision")}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {myDecision ? (
                      <div className="text-center py-2">
                        {myDecision.decision === "VISA" ? (
                          <>
                            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-1" />
                            <p className="font-semibold text-green-700 text-sm">{t("correction_douaniere:actions.visa_apposed")}</p>
                          </>
                        ) : myDecision.rejetTempStatus === "RESOLU" ? (
                          <>
                            <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-1" />
                            <p className="font-semibold text-emerald-700 text-sm">{t("correction_douaniere:actions.rejet_resolved")}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t("correction_douaniere:actions.rejet_resolved_hint")}</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-8 w-8 text-red-600 mx-auto mb-1" />
                            <p className="font-semibold text-red-700 text-sm">{t("correction_douaniere:actions.rejet_in_progress")}</p>
                            {myDecision.motifRejet && <p className="text-xs text-muted-foreground italic mt-1">{myDecision.motifRejet}</p>}
                          </>
                        )}
                      </div>
                    ) : null}

                    {blockedByDgd && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        <p className="font-medium">{t("correction_douaniere:actions.blocked_by_dgd_title")}</p>
                        <p className="mt-1">{t("correction_douaniere:actions.blocked_by_dgd_body")}</p>
                      </div>
                    )}

                    {!blockedByDgd && uploadReq && !hasUploadedRequiredDoc && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        <p className="font-medium">{t("correction_douaniere:actions.upload_required_title")}</p>
                        <p className="mt-1">{t("correction_douaniere:actions.upload_required_body", { label: uploadReqLabel })}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full border-amber-300 text-amber-800 hover:bg-amber-100"
                          onClick={() => { setPreVisaFile(null); setPreVisaUploadOpen(true); }}>
                          <Upload className="h-3.5 w-3.5 me-1" /> {t("correction_douaniere:actions.upload_required_button", { label: uploadReqLabel })}
                        </Button>
                      </div>
                    )}

                    {!blockedByDgd && uploadReq && hasUploadedRequiredDoc && (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-xs text-green-700 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>{t("correction_douaniere:actions.upload_done", { label: uploadReqLabel })}</span>
                      </div>
                    )}

                    <Button className="w-full" onClick={() => setVisaConfirmOpen(true)} disabled={actionLoading || blockedByDgd || myHasVisa || myOpenRejets.length > 0}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle className="h-4 w-4 me-2" />}
                      {myHasVisa ? t("correction_douaniere:actions.visa_done_short") : myOpenRejets.length > 0 ? t("correction_douaniere:actions.solve_rejets_first") : t("correction_douaniere:actions.apposer_visa")}
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => { setRejectMotif(""); setRejectDocsDemandes([]); setRejectOpen(true); }} disabled={actionLoading || blockedByDgd || myHasVisa}>
                      <XCircle className="h-4 w-4 me-2" />
                      {myHasVisa ? t("correction_douaniere:actions.visa_already") : myRoleDecs.some(d => d.decision === "REJET_TEMP") ? t("correction_douaniere:actions.rejeter_temp_again") : t("correction_douaniere:actions.rejeter_temp_first")}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {canFinalDecision && !isFinal && (
                <Card className="border-primary/30">
                  <CardHeader><CardTitle className="text-lg">{t("correction_douaniere:final.card_title")}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {!docs.some(d => d.type === "LETTRE_ADOPTION") ? (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                        <p className="font-medium">{t("correction_douaniere:final.lettre_title")}</p>
                        <p className="mt-1">{t("correction_douaniere:final.lettre_hint")}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full border-blue-300 text-blue-800 hover:bg-blue-100"
                          onClick={() => { setUploadType("LETTRE_ADOPTION"); setUploadFile(null); setUploadOpen(true); }}>
                          <Upload className="h-3.5 w-3.5 me-1" /> {t("correction_douaniere:final.lettre_upload_btn")}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-xs text-green-700 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>{t("correction_douaniere:final.lettre_uploaded")}</span>
                      </div>
                    )}

                    {hasAnyRejet && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
                        {t("correction_douaniere:final.rejet_warning")}
                      </div>
                    )}
                    <Button className="w-full" onClick={() => { setFinalType("ADOPTEE"); setFinalMotif(""); setFinalOpen(true); }} disabled={actionLoading}>
                      <CheckCircle className="h-4 w-4 me-2" /> {t("correction_douaniere:final.adopt")}
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => { setFinalType("REJETEE"); setFinalMotif(""); setFinalOpen(true); }} disabled={actionLoading}>
                      <XCircle className="h-4 w-4 me-2" /> {t("correction_douaniere:final.reject")}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {isFinal && (
                <Card className={demande.statut === "ADOPTEE" ? "border-green-300" : "border-red-300"}>
                  <CardContent className="py-6 text-center">
                    {demande.statut === "ADOPTEE" ? (
                      <>
                        <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-2" />
                        <p className="font-bold text-green-700 text-lg">{t("correction_douaniere:final.status_adoptee")}</p>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-10 w-10 text-red-600 mx-auto mb-2" />
                        <p className="font-bold text-red-700 text-lg">{t("correction_douaniere:final.status_rejetee")}</p>
                        {demande.motifRejet && <p className="text-sm text-muted-foreground mt-2 italic">{demande.motifRejet}</p>}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {(demande.statut === "ADOPTEE" || demande.statut === "NOTIFIEE" || reclamations.length > 0) && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> {t("correction_douaniere:reclamation.section_title")}
                      </h3>
                      {hasRole(["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE"]) &&
                        (demande.statut === "ADOPTEE" || demande.statut === "NOTIFIEE") &&
                        !reclamations.some(r => r.statut === "SOUMISE") && (
                        <Button size="sm" variant="outline" onClick={() => setReclamationOpen(true)}>
                          <Plus className="h-4 w-4 me-1" /> {t("correction_douaniere:reclamation.deposit")}
                        </Button>
                      )}
                    </div>
                    {reclamations.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">{t("correction_douaniere:reclamation.none")}</p>
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
                                  {tReclamationStatut(rec.statut)}
                                </Badge>
                                {rec.auteurNom && <span className="text-xs text-muted-foreground">{t("correction_douaniere:reclamation.by_short", { name: rec.auteurNom })}</span>}
                              </div>
                              {rec.dateCreation && <span className="text-xs text-muted-foreground">{formatDate(rec.dateCreation)}</span>}
                            </div>
                            <p className="text-sm">{rec.texte}</p>
                            {rec.pieceJointeNomFichier && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <FileText className="h-3.5 w-3.5" />
                                <span>{rec.pieceJointeNomFichier}</span>
                                {rec.pieceJointeChemin && (
                                  <a href={rec.pieceJointeChemin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3" /> {t("correction_douaniere:reclamation.open_file")}
                                  </a>
                                )}
                              </div>
                            )}
                            {rec.statut === "REJETEE" && rec.motifReponse && (
                              <div className="rounded border border-red-200 bg-red-100/50 p-2 text-xs space-y-1">
                                <div><span className="font-medium">{t("correction_douaniere:reclamation.rejet_motif")}</span>{rec.motifReponse}</div>
                                {rec.reponseRejetNomFichier && (
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-3 w-3 text-red-600" />
                                    <span className="font-medium">{rec.reponseRejetNomFichier}</span>
                                    {rec.reponseRejetChemin && (
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => window.open(rec.reponseRejetChemin!, "_blank")}>
                                        <ExternalLink className="h-3 w-3 me-1" /> {t("correction_douaniere:reclamation.open_file")}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {rec.statut === "ACCEPTEE" && (
                              <div className="rounded border border-green-200 bg-green-100/50 p-2 text-xs">
                                <span className="font-medium">{t("correction_douaniere:reclamation.accepted_short")}</span> — {t("correction_douaniere:reclamation.accepted_info")}
                                {rec.motifReponse && <p className="mt-1">{rec.motifReponse}</p>}
                              </div>
                            )}
                            {rec.statut === "ANNULEE" && (
                              <div className="rounded border border-muted p-2 text-xs text-muted-foreground italic">
                                {t("correction_douaniere:reclamation.annulee_info")}
                              </div>
                            )}
                            {rec.statut === "SOUMISE" && (hasRole(["DGTCP"]) || hasRole(["PRESIDENT"])) && (
                              <div className="flex gap-2 mt-2">
                                {hasRole(["DGTCP"]) && (
                                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => {
                                    setTraiterReclamationId(rec.id); setTraiterAcceptee(true); setTraiterMotif(""); setTraiterFile(null); setTraiterOpen(true);
                                  }}>
                                    <CheckCircle className="h-3.5 w-3.5 me-1" /> {t("correction_douaniere:reclamation.accepter")}
                                  </Button>
                                )}
                                {hasRole(["PRESIDENT"]) && (
                                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => {
                                    setTraiterReclamationId(rec.id); setTraiterAcceptee(false); setTraiterMotif(""); setTraiterFile(null); setTraiterOpen(true);
                                  }}>
                                    <XCircle className="h-3.5 w-3.5 me-1" /> {t("correction_douaniere:reclamation.rejeter")}
                                  </Button>
                                )}
                              </div>
                            )}
                            {rec.statut === "SOUMISE" && ((rec.auteurUserId === user?.userId) || hasRole(["AUTORITE_CONTRACTANTE"])) && (
                              <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => handleAnnulerReclamation(rec.id)}>
                                <XCircle className="h-3.5 w-3.5 me-1" /> {t("correction_douaniere:reclamation.annuler")}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {demande.statut === "RECUE" && reclamations.some(r => r.statut === "ACCEPTEE") && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-sm text-amber-800">{t("correction_douaniere:reclamation.rebanner_title")}</p>
                        <p className="text-xs text-amber-700 mt-1">{t("correction_douaniere:reclamation.rebanner_body")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Assistance intelligente désactivée — sera activée dans une version ultérieure
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" /> {t("correction_douaniere:ai.card_title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("correction_douaniere:ai.body")}</p>
                  <Button className="w-full" onClick={() => navigate(`/dashboard/extraction-dgd/${id}`)}>
                    <Bot className="h-4 w-4 me-2" /> {t("correction_douaniere:ai.open_chatbot")}
                  </Button>
                </CardContent>
              </Card>
              */}
            </div>
          </div>
        )}
      </div>

      {/* Reject Temp Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("correction_douaniere:dialog.reject_temp.title")}</DialogTitle>
            <DialogDescription>{t("correction_douaniere:dialog.reject_temp.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder={t("correction_douaniere:dialog.reject_temp.motif_placeholder")} value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} rows={3} />
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t("correction_douaniere:dialog.reject_temp.docs_label")} <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-lg border border-border p-3">
                {ALL_DOCUMENT_TYPES_VALUES.map(dt => (
                  <label key={dt} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={rejectDocsDemandes.includes(dt)}
                      onCheckedChange={(checked) => {
                        setRejectDocsDemandes(prev => checked ? [...prev, dt] : prev.filter(v => v !== dt));
                      }}
                    />
                    <span>{tTypeDocument(dt)}</span>
                  </label>
                ))}
              </div>
              {rejectDocsDemandes.length === 0 && (
                <p className="text-xs text-destructive mt-1">{t("correction_douaniere:dialog.reject_temp.select_at_least_one")}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("correction_douaniere:dialog.reject_temp.cancel")}</Button>
            <Button variant="destructive" disabled={!rejectMotif.trim() || rejectDocsDemandes.length === 0} onClick={handleTempReject}>
              <XCircle className="h-4 w-4 me-1" /> {t("correction_douaniere:dialog.reject_temp.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Decision Dialog */}
      <Dialog open={finalOpen} onOpenChange={setFinalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{finalType === "ADOPTEE" ? t("correction_douaniere:dialog.final.title_adopt") : t("correction_douaniere:dialog.final.title_reject")}</DialogTitle>
            <DialogDescription>{t("correction_douaniere:dialog.final.description")}</DialogDescription>
          </DialogHeader>
          {finalType === "REJETEE" && (
            <Textarea placeholder={t("correction_douaniere:dialog.final.motif_placeholder")} value={finalMotif} onChange={(e) => setFinalMotif(e.target.value)} rows={3} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalOpen(false)}>{t("correction_douaniere:dialog.final.cancel")}</Button>
            <Button variant={finalType === "ADOPTEE" ? "default" : "destructive"} disabled={finalType === "REJETEE" && !finalMotif.trim()} onClick={handleFinalDecision}>
              {finalType === "ADOPTEE" ? <CheckCircle className="h-4 w-4 me-1" /> : <XCircle className="h-4 w-4 me-1" />}
              {t("correction_douaniere:dialog.final.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Visa Upload Dialog */}
      <Dialog open={preVisaUploadOpen} onOpenChange={setPreVisaUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("correction_douaniere:dialog.pre_visa.title", { label: uploadReqLabel })}</DialogTitle>
            <DialogDescription>{t("correction_douaniere:dialog.pre_visa.description", { label: uploadReqLabel })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("correction_douaniere:dialog.pre_visa.file_label")}</Label>
              <Input type="file" onChange={(e) => setPreVisaFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreVisaUploadOpen(false)}>{t("correction_douaniere:dialog.pre_visa.cancel")}</Button>
            <Button disabled={!preVisaFile || preVisaLoading} onClick={handlePreVisaUpload}>
              {preVisaLoading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Upload className="h-4 w-4 me-1" />}
              {t("correction_douaniere:dialog.pre_visa.upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("correction_douaniere:dialog.upload.title")}</DialogTitle>
            <DialogDescription>{t("correction_douaniere:dialog.upload.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("correction_douaniere:dialog.upload.type_label")}</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue placeholder={t("correction_douaniere:dialog.upload.type_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {ALL_DOCUMENT_TYPES_VALUES.map(dt => (
                    <SelectItem key={dt} value={dt}>{tTypeDocument(dt)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("correction_douaniere:dialog.upload.file_label")}</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            {(() => {
              const isRejetResponse = uploadType && decisions.some(
                d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT" && d.documentsDemandes?.includes(uploadType)
              );
              if (!isRejetResponse) return null;
              return (
                <div>
                  <Label className="text-xs">{t("correction_douaniere:dialog.upload.message_required_label")} <span className="text-destructive">*</span></Label>
                  <Textarea placeholder={t("correction_douaniere:dialog.upload.message_placeholder")} value={uploadMessage} onChange={(e) => setUploadMessage(e.target.value)} rows={2} />
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>{t("correction_douaniere:dialog.upload.cancel")}</Button>
            <Button disabled={!uploadType || !uploadFile || uploadLoading} onClick={handleUpload}>
              {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Upload className="h-4 w-4 me-1" />}
              {t("correction_douaniere:dialog.upload.upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response Dialog */}
      <Dialog open={responseOpen} onOpenChange={setResponseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("correction_douaniere:dialog.response.title")}</DialogTitle>
            <DialogDescription>{t("correction_douaniere:dialog.response.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const rejetDec = decisions.find(d => d.id === responseDecisionId);
              if (!rejetDec?.documentsDemandes?.length) return null;
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-800 mb-1.5">{t("correction_douaniere:dialog.response.requested_docs")}</p>
                  <div className="flex flex-wrap gap-1">
                    {rejetDec.documentsDemandes.map((dt: string) => (
                      <Badge key={dt} variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                        {tTypeDocument(dt)}
                      </Badge>
                    ))}
                  </div>
                  {rejetDec.motifRejet && (
                    <p className="text-xs text-amber-700 italic mt-2">{t("correction_douaniere:dialog.response.motif_label", { motif: rejetDec.motifRejet })}</p>
                  )}
                </div>
              );
            })()}
            <Textarea placeholder={t("correction_douaniere:dialog.response.message_placeholder")} value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseOpen(false)}>{t("correction_douaniere:dialog.response.cancel")}</Button>
            <Button disabled={!responseMessage.trim() || responseLoading} onClick={handleRejetResponse}>
              {responseLoading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {t("correction_douaniere:dialog.response.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entreprise Detail Dialog */}
      <Dialog open={entrepriseDialogOpen} onOpenChange={setEntrepriseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("correction_douaniere:dialog.entreprise.title")}</DialogTitle></DialogHeader>
          {entrepriseLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entrepriseDetail ? (
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">{t("correction_douaniere:dialog.entreprise.raison")}</span>
                <p className="font-medium">{entrepriseDetail.raisonSociale || dash}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">{t("correction_douaniere:dialog.entreprise.nif")}</span>
                <p className="font-medium">{entrepriseDetail.nif || dash}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">{t("correction_douaniere:dialog.entreprise.adresse")}</span>
                <p className="font-medium">{entrepriseDetail.adresse || dash}</p>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">{t("correction_douaniere:dialog.entreprise.empty")}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Réclamation Deposit Dialog */}
      <Dialog open={reclamationOpen} onOpenChange={(v) => { setReclamationOpen(v); if (!v) { setReclamationTexte(""); setReclamationFile(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("correction_douaniere:dialog.reclamation_create.title")}</DialogTitle>
            <DialogDescription>{t("correction_douaniere:dialog.reclamation_create.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("correction_douaniere:dialog.reclamation_create.motif_label")} <span className="text-destructive">*</span></Label>
              <Textarea placeholder={t("correction_douaniere:dialog.reclamation_create.motif_placeholder")} value={reclamationTexte} onChange={(e) => setReclamationTexte(e.target.value)} rows={4} maxLength={4000} />
              <p className="text-xs text-muted-foreground text-end">{t("correction_douaniere:dialog.reclamation_create.counter", { current: reclamationTexte.length, max: 4000 })}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("correction_douaniere:dialog.reclamation_create.file_label")} <span className="text-destructive">*</span></Label>
              <Input type="file" onChange={(e) => setReclamationFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReclamationOpen(false); setReclamationTexte(""); setReclamationFile(null); }}>{t("correction_douaniere:dialog.reclamation_create.cancel")}</Button>
            <Button onClick={handleCreateReclamation} disabled={reclamationSubmitting || !reclamationTexte.trim() || !reclamationFile}>
              {reclamationSubmitting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Upload className="h-4 w-4 me-1" />}
              {t("correction_douaniere:dialog.reclamation_create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Traiter Réclamation Dialog */}
      <Dialog open={traiterOpen} onOpenChange={(v) => { setTraiterOpen(v); if (!v) { setTraiterReclamationId(null); setTraiterMotif(""); setTraiterFile(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{traiterAcceptee ? t("correction_douaniere:dialog.reclamation_traiter.title_accept") : t("correction_douaniere:dialog.reclamation_traiter.title_reject")}</DialogTitle>
            <DialogDescription>
              {traiterAcceptee ? t("correction_douaniere:dialog.reclamation_traiter.description_accept") : t("correction_douaniere:dialog.reclamation_traiter.description_reject")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                {traiterAcceptee ? t("correction_douaniere:dialog.reclamation_traiter.motif_label_accept") : t("correction_douaniere:dialog.reclamation_traiter.motif_label_reject")} {!traiterAcceptee && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                placeholder={traiterAcceptee ? t("correction_douaniere:dialog.reclamation_traiter.motif_placeholder_accept") : t("correction_douaniere:dialog.reclamation_traiter.motif_placeholder_reject")}
                value={traiterMotif}
                onChange={(e) => setTraiterMotif(e.target.value.slice(0, 2000))}
                rows={3}
                maxLength={2000}
              />
              {!traiterAcceptee && (
                <p className="text-[10px] text-muted-foreground text-end">{t("correction_douaniere:dialog.reclamation_create.counter", { current: traiterMotif.length, max: 2000 })}</p>
              )}
            </div>
            {!traiterAcceptee && (
              <div className="space-y-2">
                <Label>{t("correction_douaniere:dialog.reclamation_traiter.file_label")} <span className="text-destructive">*</span></Label>
                <Input type="file" onChange={(e) => setTraiterFile(e.target.files?.[0] || null)} className="cursor-pointer" />
                {traiterFile && (
                  <p className="text-xs text-muted-foreground">{t("correction_douaniere:dialog.reclamation_traiter.file_size", { name: traiterFile.name, size: (traiterFile.size / 1024).toFixed(0) })}</p>
                )}
              </div>
            )}
            {traiterAcceptee && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">{t("correction_douaniere:dialog.reclamation_traiter.consequences_title")}</p>
                <ul className="list-disc ms-4 mt-1 space-y-0.5">
                  <li>{t("correction_douaniere:dialog.reclamation_traiter.consequence_status")}</li>
                  <li>{t("correction_douaniere:dialog.reclamation_traiter.consequence_visas")}</li>
                  <li>{t("correction_douaniere:dialog.reclamation_traiter.consequence_docs")}</li>
                  <li>{t("correction_douaniere:dialog.reclamation_traiter.consequence_reupload")}</li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTraiterOpen(false); setTraiterReclamationId(null); setTraiterMotif(""); setTraiterFile(null); }}>{t("correction_douaniere:dialog.reclamation_traiter.cancel")}</Button>
            <Button variant={traiterAcceptee ? "default" : "destructive"} onClick={handleTraiterReclamation} disabled={traiterSubmitting || (!traiterAcceptee && (!traiterMotif.trim() || !traiterFile))}>
              {traiterSubmitting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : traiterAcceptee ? <CheckCircle className="h-4 w-4 me-1" /> : <XCircle className="h-4 w-4 me-1" />}
              {traiterAcceptee ? t("correction_douaniere:dialog.reclamation_traiter.confirm_accept") : t("correction_douaniere:dialog.reclamation_traiter.confirm_reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={visaConfirmOpen} onOpenChange={setVisaConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Action irréversible</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Êtes-vous sûr de vouloir apposer votre visa ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVisaConfirmOpen(false)}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVisa}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default CorrectionDouaniere;
