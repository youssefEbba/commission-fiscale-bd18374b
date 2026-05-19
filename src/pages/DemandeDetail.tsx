import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DemandeStatut,
  DocumentDto, ALL_DOCUMENT_TYPES, RejetTempResponseDto,
  ReclamationDemandeCorrectionDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, ArrowLeft, Upload, Loader2, Plus,
  CheckCircle, XCircle, Download, ExternalLink,
  AlertTriangle, Lock, Unlock, History,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutDemande, tReclamationStatut, tTypeDocument } from "@/i18n/enums";
import { formatDate } from "@/i18n/format";
import { API_BASE } from "@/lib/apiConfig";

const STATUT_COLORS: Record<DemandeStatut, string> = {
  BROUILLON: "bg-slate-100 text-slate-700",
  RECUE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-yellow-100 text-yellow-800",
  RECEVABLE: "bg-emerald-100 text-emerald-800",
  EN_EVALUATION: "bg-orange-100 text-orange-800",
  EN_VALIDATION: "bg-purple-100 text-purple-800",
  ADOPTEE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
  NOTIFIEE: "bg-gray-100 text-gray-800",
  ANNULEE: "bg-red-200 text-red-900",
};

const ALL_STATUTS: DemandeStatut[] = ["RECUE", "INCOMPLETE", "RECEVABLE", "EN_EVALUATION", "EN_VALIDATION"];

type Transition = { from: DemandeStatut[]; to: DemandeStatut; labelKey: string; icon: React.ElementType; isVisa?: boolean; isDecisionFinale?: boolean };

const ROLE_TRANSITIONS: Record<string, Transition[]> = {
  DGD: [
    { from: ALL_STATUTS, to: "ADOPTEE", labelKey: "transitions.DGD.visa", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", labelKey: "transitions.reject", icon: XCircle },
  ],
  DGTCP: [
    { from: ALL_STATUTS, to: "ADOPTEE", labelKey: "transitions.DGTCP.visa", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", labelKey: "transitions.reject", icon: XCircle },
  ],
  DGI: [
    { from: ALL_STATUTS, to: "ADOPTEE", labelKey: "transitions.DGI.visa", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", labelKey: "transitions.reject", icon: XCircle },
  ],
  DGB: [
    { from: ALL_STATUTS, to: "ADOPTEE", labelKey: "transitions.DGB.visa", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", labelKey: "transitions.reject", icon: XCircle },
  ],
  PRESIDENT: [
    { from: ALL_STATUTS, to: "ADOPTEE", labelKey: "transitions.PRESIDENT.adopt", icon: CheckCircle, isDecisionFinale: true },
    { from: ALL_STATUTS, to: "REJETEE", labelKey: "transitions.PRESIDENT.reject", icon: XCircle, isDecisionFinale: true },
  ],
};

// Note: les libellés des transitions vivent dans `demandes.json` sous `transitions.*`
// et sont résolus via `t(\`demandes:${labelKey}\`)`.

function getDocFileUrl(doc: DocumentDto): string {
  if (doc.chemin) {
    const normalized = doc.chemin.replace(/\\/g, "/");
    if (normalized.match(/^[A-Za-z]:\//)) return "file:///" + normalized;
    return normalized;
  }
  return "";
}

async function openDocInNewTab(url: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(url, {
    headers: { Authorization: token ? `Bearer ${token}` : "", "ngrok-skip-browser-warning": "true" },
  });
  if (!res.ok) throw new Error("open failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank");
}

async function downloadDocAuthenticated(url: string, filename: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(url, {
    headers: { Authorization: token ? `Bearer ${token}` : "", "ngrok-skip-browser-warning": "true" },
  });
  if (!res.ok) throw new Error("download failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl; a.download = filename; a.click();
  URL.revokeObjectURL(objectUrl);
}

const DemandeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const { t } = useTranslation(["demandes", "common"]);

  const tTransition = (key: string): string => t(`demandes:${key}`);

  const [selected, setSelected] = useState<DemandeCorrectionDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [activeOrg, setActiveOrg] = useState("DGD");

  usePageTitle("demandes:detail.title", { numero: selected?.numero || `#${selected?.id ?? id}` });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadAllowedTypes, setUploadAllowedTypes] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");

  const [responseOpen, setResponseOpen] = useState(false);
  const [responseDecisionId, setResponseDecisionId] = useState<number | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [responseSending, setResponseSending] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectDecisionFinale, setRejectDecisionFinale] = useState(false);
  const [rejectDocsDemandes, setRejectDocsDemandes] = useState<string[]>([]);

  const [offreCorrigeeOpen, setOffreCorrigeeOpen] = useState(false);
  const [offreCorrigeeFile, setOffreCorrigeeFile] = useState<File | null>(null);
  const [offreCorrigeeUploading, setOffreCorrigeeUploading] = useState(false);
  const [offreCorrigeePendingId, setOffreCorrigeePendingId] = useState<number | null>(null);

  const [entrepriseDetail, setEntrepriseDetail] = useState<any | null>(null);
  const [entrepriseLoading, setEntrepriseLoading] = useState(false);
  const [entrepriseDialogOpen, setEntrepriseDialogOpen] = useState(false);

  const [adoptionOpen, setAdoptionOpen] = useState(false);
  const [adoptionFile, setAdoptionFile] = useState<File | null>(null);
  const [adoptionUploading, setAdoptionUploading] = useState(false);

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

  // Document à uploader obligatoirement avant le visa, selon le rôle.
  // Libellé via `tTypeDocument` (enums.type_document.CREDIT_EXTERIEUR).
  const UPLOAD_BEFORE_VISA: Record<string, { docType: string }> = {
    DGD: { docType: "CREDIT_EXTERIEUR" },
  };
  const uploadBeforeVisa = role ? UPLOAD_BEFORE_VISA[role] : undefined;
  const uploadBeforeVisaLabel = uploadBeforeVisa ? tTypeDocument(uploadBeforeVisa.docType) : undefined;
  const transitions = ROLE_TRANSITIONS[role] || [];

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const full = await demandeCorrectionApi.getById(Number(id));
      setSelected(full);
      try {
        const documents = await demandeCorrectionApi.getDocuments(Number(id));
        setDocs(documents);
      } catch {
        setDocs(full.documents || []);
      }
      if (["ADOPTEE", "NOTIFIEE", "RECUE", "EN_EVALUATION", "EN_VALIDATION"].includes(full.statut)) {
        try {
          const recs = await demandeCorrectionApi.getReclamations(Number(id));
          setReclamations(recs);
        } catch { setReclamations([]); }
      }
    } catch {
      toast({ title: t("demandes:toast.error"), description: t("demandes:toast.load_demande_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  const openEntrepriseDetail = async (entrepriseId: number) => {
    setEntrepriseDialogOpen(true);
    setEntrepriseLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/entreprises/${entrepriseId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      });
      if (!res.ok) throw new Error("err");
      setEntrepriseDetail(await res.json());
    } catch {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${API_BASE}/entreprises`, {
          headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        });
        const list = await res.json();
        setEntrepriseDetail(list.find((e: any) => e.id === entrepriseId) || null);
      } catch {
        toast({ title: t("demandes:toast.error"), description: t("demandes:toast.load_entreprise_error"), variant: "destructive" });
      }
    } finally { setEntrepriseLoading(false); }
  };

  const handleTempVisa = async (demandeId: number) => {
    setActionLoading(demandeId);
    try {
      await demandeCorrectionApi.postDecision(demandeId, "VISA");
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.visa_temp_applied") });
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleTempReject = async (demandeId: number, motif: string, documentsDemandes?: string[]) => {
    setActionLoading(demandeId);
    try {
      await demandeCorrectionApi.postDecision(demandeId, "REJET_TEMP", motif, documentsDemandes);
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.rejet_temp_saved") });
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const checkAndHandleVisa = async (demandeId: number) => {
    if (uploadBeforeVisa) {
      try {
        const documents = await demandeCorrectionApi.getDocuments(demandeId);
        const hasDoc = documents.some(d => d.type === uploadBeforeVisa.docType && d.actif !== false);
        if (!hasDoc) { setOffreCorrigeePendingId(demandeId); setOffreCorrigeeOpen(true); return; }
      } catch { setOffreCorrigeePendingId(demandeId); setOffreCorrigeeOpen(true); return; }
    }
    await handleTempVisa(demandeId);
  };

  const handleOffreCorrigeeUploadAndVisa = async () => {
    if (!offreCorrigeePendingId || !offreCorrigeeFile) return;
    setOffreCorrigeeUploading(true);
    try {
      await demandeCorrectionApi.uploadDocument(offreCorrigeePendingId, uploadBeforeVisa?.docType || "OFFRE_CORRIGEE", offreCorrigeeFile);
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.doc_uploaded_label", { label: uploadBeforeVisa?.label || t("demandes:dialogs.offre_corrigee.label_fallback") }) });
      setOffreCorrigeeOpen(false); setOffreCorrigeeFile(null);
      await handleTempVisa(offreCorrigeePendingId);
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally { setOffreCorrigeeUploading(false); setOffreCorrigeePendingId(null); }
  };

  const handleStatutChange = async (demandeId: number, statut: DemandeStatut, motifRejet?: string, decisionFinale?: boolean) => {
    setActionLoading(demandeId);
    try {
      await demandeCorrectionApi.updateStatut(demandeId, statut, motifRejet, decisionFinale);
      toast({
        title: t("demandes:toast.success"),
        description: decisionFinale
          ? t("demandes:toast.decision_finale_applied_short")
          : statut === "REJETEE" ? t("demandes:toast.rejet_saved") : t("demandes:toast.visa_applied"),
      });
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleAdoptWithLetter = async () => {
    if (!selected || !adoptionFile) return;
    setAdoptionUploading(true);
    try {
      await demandeCorrectionApi.uploadDocument(selected.id, "LETTRE_ADOPTION", adoptionFile);
      await demandeCorrectionApi.updateStatut(selected.id, "ADOPTEE", undefined, true);
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.demande_adopted") });
      setAdoptionOpen(false); setAdoptionFile(null);
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally { setAdoptionUploading(false); }
  };

  const handleCreateReclamation = async () => {
    if (!selected || !reclamationTexte.trim() || !reclamationFile) return;
    setReclamationSubmitting(true);
    try {
      await demandeCorrectionApi.createReclamation(selected.id, reclamationTexte.trim(), reclamationFile);
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.reclamation_created") });
      setReclamationOpen(false); setReclamationTexte(""); setReclamationFile(null);
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally { setReclamationSubmitting(false); }
  };

  const handleTraiterReclamation = async () => {
    if (!selected || !traiterReclamationId) return;
    if (!traiterAcceptee && !traiterMotif.trim()) {
      toast({ title: t("demandes:toast.motif_required_title"), description: t("demandes:toast.motif_required_desc"), variant: "destructive" });
      return;
    }
    if (!traiterAcceptee && !traiterFile) {
      toast({ title: t("demandes:toast.doc_required_title"), description: t("demandes:toast.doc_required_desc"), variant: "destructive" });
      return;
    }
    setTraiterSubmitting(true);
    try {
      await demandeCorrectionApi.traiterReclamation(selected.id, traiterReclamationId, traiterAcceptee, traiterMotif.trim() || undefined, traiterFile || undefined);
      toast({ title: t("demandes:toast.success"), description: traiterAcceptee ? t("demandes:toast.reclamation_accepted") : t("demandes:toast.reclamation_rejected") });
      setTraiterOpen(false); setTraiterReclamationId(null); setTraiterMotif(""); setTraiterFile(null);
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally { setTraiterSubmitting(false); }
  };

  const handleAnnulerReclamation = async (reclamationId: number) => {
    if (!selected) return;
    try {
      await demandeCorrectionApi.annulerReclamation(selected.id, reclamationId);
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.reclamation_cancelled") });
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    }
  };

  const openRejectDialog = (demandeId: number, decisionFinale?: boolean) => {
    setRejectTargetId(demandeId); setRejectMotif(""); setRejectDocsDemandes([]); setRejectDecisionFinale(!!decisionFinale); setRejectOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTargetId || !rejectMotif.trim()) return;
    if (!rejectDecisionFinale && rejectDocsDemandes.length === 0) return;
    setRejectOpen(false);
    if (rejectDecisionFinale) await handleStatutChange(rejectTargetId, "REJETEE", rejectMotif.trim(), true);
    else await handleTempReject(rejectTargetId, rejectMotif.trim(), rejectDocsDemandes);
    setRejectTargetId(null); setRejectMotif(""); setRejectDocsDemandes([]); setRejectDecisionFinale(false);
  };

  const handleUpload = async () => {
    if (!selected || !uploadFile || !uploadType) return;
    const openRejets = (selected.decisions || []).filter(
      d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT" && d.documentsDemandes?.includes(uploadType)
    );
    if (openRejets.length > 0 && !uploadMessage.trim()) {
      toast({ title: t("demandes:toast.message_required_title"), description: t("demandes:toast.message_required_desc"), variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await demandeCorrectionApi.uploadDocument(selected.id, uploadType, uploadFile, uploadMessage.trim() || undefined);
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.doc_uploaded") });
      setUploadOpen(false); setUploadFile(null); setUploadType(""); setUploadMessage("");
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleRejetTempResponse = async () => {
    if (!responseDecisionId || !responseMessage.trim()) return;
    setResponseSending(true);
    try {
      await demandeCorrectionApi.postRejetTempResponse(responseDecisionId, responseMessage.trim());
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.response_sent") });
      setResponseOpen(false); setResponseDecisionId(null); setResponseMessage("");
      fetchDetail();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally { setResponseSending(false); }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  if (!selected) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t("demandes:detail.not_found")}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/demandes")}>
            <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t("demandes:detail.back")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const decs = selected.decisions || [];
  const DECISION_ROLES_LIST = ["DGD", "DGTCP", "DGI", "DGB"];

  const r = activeOrg;
  const roleDecs = decs.filter(d => d.role === r);
  const allRejets = roleDecs.filter(d => d.decision === "REJET_TEMP");
  const openRejets = allRejets.filter(d => d.rejetTempStatus !== "RESOLU");
  const resolvedRejets = allRejets.filter(d => d.rejetTempStatus === "RESOLU");
  const visaDec = roleDecs.find(d => d.decision === "VISA");
  const hasVisa = !!visaDec;
  const hasRejets = allRejets.length > 0;
  const isMyRole = (role as string) === r;
  const canVisa = isMyRole && !hasVisa && openRejets.length === 0;
  const canNewRejet = isMyRole && !hasVisa;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/demandes")} aria-label={t("demandes:detail.back")}>
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {selected.numero
                ? t("demandes:detail.title", { numero: selected.numero })
                : t("demandes:detail.title_fallback", { id: selected.id })}
            </h1>
            <p className="text-sm text-muted-foreground">{t("demandes:detail.subtitle")}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("demandes:detail.fields.ac")}</span>
                <p className="font-medium">{selected.autoriteContractanteNom || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("demandes:detail.fields.entreprise")}</span>
                {selected.entrepriseId ? (
                  <button className="font-medium text-primary hover:underline cursor-pointer text-start block" onClick={() => openEntrepriseDetail(selected.entrepriseId!)}>
                    {selected.entrepriseRaisonSociale || "—"}
                  </button>
                ) : (
                  <p className="font-medium">{selected.entrepriseRaisonSociale || "—"}</p>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">{t("demandes:detail.fields.statut")}</span>
                <p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{tStatutDemande(selected.statut)}</Badge></p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("demandes:detail.fields.date_depot")}</span>
                <p>{selected.dateDepot ? formatDate(selected.dateDepot) : "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("demandes:detail.fields.convention")}</span>
                {selected.conventionId ? (
                  <button className="font-medium text-primary hover:underline cursor-pointer text-start block" onClick={() => navigate(`/dashboard/conventions`)}>
                    {selected.conventionReference || selected.conventionIntitule || t("demandes:detail.fields.convention_fallback", { id: selected.conventionId })}
                  </button>
                ) : (
                  <p className="font-medium text-muted-foreground">—</p>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">{t("demandes:detail.fields.marche")}</span>
                {selected.marcheId ? (
                  <button className="font-medium text-primary hover:underline cursor-pointer text-start block" onClick={() => navigate(`/dashboard/marches`)}>
                    {selected.marcheNumero || selected.marcheIntitule || t("demandes:detail.fields.marche_fallback", { id: selected.marcheId })}
                  </button>
                ) : selected.marcheIdTrace ? (
                  <p className="font-medium text-muted-foreground italic">
                    {t("demandes:detail.fields.marche_detached", { id: selected.marcheIdTrace })}
                  </p>
                ) : (
                  <p className="font-medium text-muted-foreground">—</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statut par organisme */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-1">{t("demandes:detail.org_status.title")}</h3>
            <p className="text-[10px] text-muted-foreground mb-3">{t("demandes:detail.org_status.hint")}</p>
            <div className="flex border-b border-border mb-3 gap-0">
              {DECISION_ROLES_LIST.map((orgRole) => {
                const orgDecs = decs.filter(d => d.role === orgRole);
                const orgHasVisa = orgDecs.some(d => d.decision === "VISA");
                const orgHasRejets = orgDecs.some(d => d.decision === "REJET_TEMP");
                const orgOpenRejets = orgDecs.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus !== "RESOLU");
                const orgAllResolved = orgHasRejets && orgOpenRejets.length === 0;
                const isActive = activeOrg === orgRole;
                return (
                  <button
                    key={orgRole}
                    onClick={() => setActiveOrg(orgRole)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    {orgHasVisa ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : orgAllResolved ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : orgHasRejets ? <XCircle className="h-3.5 w-3.5 text-red-600" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />}
                    <span className="hidden sm:inline">{t(`demandes:detail.org_status.roles.${orgRole}`)}</span>
                    <span className="sm:hidden">{orgRole}</span>
                  </button>
                );
              })}
            </div>
            {(() => {
              const allResolved = hasRejets && openRejets.length === 0 && resolvedRejets.length > 0;
              const cardStyle = hasVisa ? "border-green-300 bg-green-50" : allResolved ? "border-emerald-300 bg-emerald-50" : hasRejets ? "border-red-300 bg-red-50" : "border-border bg-muted/30";
              return (
            <div className={`rounded-lg border p-4 min-h-[120px] ${cardStyle}`}>
              <div className="text-center mb-3">
                {hasVisa ? <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" /> : allResolved ? <CheckCircle className="h-6 w-6 text-emerald-600 mx-auto mb-1" /> : hasRejets ? <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" /> : <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />}
                <p className="font-semibold text-sm">{t(`demandes:detail.org_status.roles.${r}`)}</p>
                {hasVisa && <p className="text-green-700 font-medium text-xs mt-0.5">{t("demandes:detail.org_status.visa_applied")}</p>}
                {allResolved && !hasVisa && <p className="text-emerald-700 font-medium text-xs mt-0.5">{t("demandes:detail.org_status.all_resolved")}</p>}
                {!hasVisa && !hasRejets && <p className="text-muted-foreground text-xs mt-0.5">{t("demandes:detail.org_status.awaiting")}</p>}
                {hasVisa && visaDec?.dateDecision && <p className="text-muted-foreground text-[10px] mt-0.5">{t("demandes:detail.org_status.on", { date: formatDate(visaDec.dateDecision) })}</p>}
              </div>
              {hasRejets && (
                <div className="space-y-3">
                  {openRejets.length > 0 && <p className="text-red-700 font-semibold text-xs text-center">{t("demandes:detail.org_status.rejets_open_count", { count: openRejets.length })}</p>}
                  {openRejets.map((rej, idx) => (
                    <div key={idx} className="border-s-2 border-red-300 ps-3 py-2 space-y-1 bg-background/50 rounded-e">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-red-800 text-xs">{t("demandes:detail.org_status.rejet_n", { n: idx + 1 })}</span>
                        {rej.rejetTempStatus && (
                          <Badge className={`text-[9px] ${rej.rejetTempStatus === "OUVERT" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {rej.rejetTempStatus === "OUVERT" ? t("demandes:stade.rejet_open") : t("demandes:stade.rejet_resolved")}
                          </Badge>
                        )}
                        {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{formatDate(rej.dateDecision)}</span>}
                      </div>
                      {rej.motifRejet && <p className="text-muted-foreground italic text-xs">{rej.motifRejet}</p>}
                      {rej.documentsDemandes && rej.documentsDemandes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-muted-foreground">{t("demandes:detail.org_status.docs_demandes")}</span>
                          {rej.documentsDemandes.map((dt: string) => (
                            <Badge key={dt} variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                              {ALL_DOCUMENT_TYPES.find(tt => tt.value === dt)?.label || dt}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {rej.rejetTempResponses && rej.rejetTempResponses.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          <span className="text-[10px] text-muted-foreground font-medium">{t("demandes:detail.org_status.responses")}</span>
                          {rej.rejetTempResponses.map((resp: RejetTempResponseDto, ri: number) => (
                            <div key={ri} className="rounded border border-blue-200 bg-blue-50 p-2 text-[11px] space-y-0.5">
                              <p className="text-foreground">{resp.message}</p>
                              {resp.documentType && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <FileText className="h-3 w-3" />
                                  <span>{ALL_DOCUMENT_TYPES.find(tt => tt.value === resp.documentType)?.label || resp.documentType}</span>
                                  {resp.documentVersion && <span>(v{resp.documentVersion})</span>}
                                </div>
                              )}
                              {resp.documentUrl && (
                                <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                  <Upload className="h-2.5 w-2.5 me-0.5" /> {t("demandes:detail.org_status.document_uploaded")}
                                </Badge>
                              )}
                              <div className="flex gap-2 text-muted-foreground">
                                {resp.auteurNom && <span>{t("demandes:detail.org_status.by", { name: resp.auteurNom })}</span>}
                                {resp.createdAt && <span>{t("demandes:detail.org_status.on_date", { date: formatDate(resp.createdAt) })}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {rej.rejetTempStatus === "OUVERT" && hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) && (
                        <div className="flex gap-1.5 mt-1.5">
                          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setResponseDecisionId(rej.id); setResponseMessage(""); setResponseOpen(true); }}>
                            {t("demandes:detail.org_status.reply")}
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => { const d = rej.documentsDemandes || []; setUploadAllowedTypes(d); if (d.length) setUploadType(d[0]); else setUploadType(""); setUploadMessage(""); setUploadFile(null); setUploadOpen(true); }}>
                            <Upload className="h-3 w-3 me-1" /> {t("demandes:detail.org_status.upload_doc")}
                          </Button>
                        </div>
                      )}
                      {rej.rejetTempStatus === "OUVERT" && rej.role === role && hasRole(["DGD", "DGTCP", "DGI", "DGB", "PRESIDENT"]) && (
                        <div className="mt-1.5">
                          <Button size="sm" variant="default" className="h-6 text-[10px] px-2" disabled={actionLoading === selected.id} onClick={async () => {
                            setActionLoading(selected.id);
                            try {
                              await demandeCorrectionApi.resolveRejetTemp(rej.id);
                              toast({ title: t("demandes:toast.success"), description: t("demandes:toast.rejet_resolved") });
                              fetchDetail();
                            } catch (e: any) {
                              toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
                            } finally { setActionLoading(null); }
                          }}>
                            <CheckCircle className="h-3 w-3 me-0.5" /> {t("demandes:detail.org_status.mark_resolved")}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {isMyRole && !hasVisa && !["ADOPTEE", "NOTIFIEE", "REJETEE", "ANNULEE"].includes(selected.statut) && (
                    <div className="flex gap-2 mt-2 justify-center">
                      {canVisa && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={actionLoading === selected.id} onClick={() => checkAndHandleVisa(selected.id)}>
                          {t("demandes:detail.org_status.apply_visa")}
                        </Button>
                      )}
                      {openRejets.length > 0 && (
                        <p className="text-amber-700 text-[10px] self-center">{t("demandes:detail.org_status.resolve_remaining")}</p>
                      )}
                      {canNewRejet && (
                        <Button variant="destructive" size="sm" className="h-7 text-xs" disabled={actionLoading === selected.id} onClick={() => openRejectDialog(selected.id)}>
                          {t("demandes:detail.org_status.new_rejet")}
                        </Button>
                      )}
                    </div>
                  )}
                  {resolvedRejets.length > 0 && (
                    <details className="mt-3 border-t border-border pt-3">
                      <summary className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                        <History className="h-3.5 w-3.5" />
                        {t("demandes:detail.org_status.history_title", { count: resolvedRejets.length })}
                      </summary>
                      <div className="space-y-2 mt-2">
                        {resolvedRejets.map((rej, idx) => (
                          <div key={idx} className="border-s-2 border-muted ps-3 py-2 space-y-1 bg-muted/30 rounded-e opacity-75">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-medium text-muted-foreground text-xs">{t("demandes:detail.org_status.rejet_n", { n: idx + 1 })}</span>
                              <Badge className="text-[9px] bg-green-100 text-green-700">{t("demandes:stade.rejet_resolved")}</Badge>
                              {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{formatDate(rej.dateDecision)}</span>}
                            </div>
                            {rej.motifRejet && <p className="text-muted-foreground italic text-xs">{rej.motifRejet}</p>}
                            {rej.documentsDemandes && rej.documentsDemandes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-[10px] text-muted-foreground">{t("demandes:detail.org_status.docs_demandes")}</span>
                                {rej.documentsDemandes.map((dt: string) => (
                                  <Badge key={dt} variant="outline" className="text-[9px] bg-muted text-muted-foreground border-muted-foreground/20">
                                    {ALL_DOCUMENT_TYPES.find(tt => tt.value === dt)?.label || dt}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Documents de décision */}
        {(selected.statut === "ADOPTEE" || selected.statut === "NOTIFIEE") && (() => {
          const SPECIAL_DOC_TYPES_LIST = ["OFFRE_FISCALE_CORRIGEE", "LETTRE_ADOPTION"];
          const SPECIAL_DOC_LABEL_KEYS: Record<string, string> = {
            OFFRE_FISCALE_CORRIGEE: "demandes:detail.decision_docs.offre_fiscale_corrigee",
            LETTRE_ADOPTION: "demandes:detail.decision_docs.lettre_adoption",
          };
          const specialDocs = docs.filter(d => SPECIAL_DOC_TYPES_LIST.includes(d.type));
          return (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" /> {t("demandes:detail.decision_docs.title")}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {SPECIAL_DOC_TYPES_LIST.map((docType) => {
                    const doc = specialDocs.find(d => d.type === docType);
                    const fileUrl = doc ? getDocFileUrl(doc) : null;
                    return (
                      <div key={docType} className={`rounded-xl border-2 p-4 text-center transition-colors ${doc ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : "border-dashed border-muted-foreground/20 bg-muted/20"}`}>
                        {doc ? <Download className="h-8 w-8 text-primary mx-auto mb-2" /> : <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />}
                        <p className={`text-xs font-semibold ${doc ? "text-foreground" : "text-muted-foreground"}`}>{t(SPECIAL_DOC_LABEL_KEYS[docType])}</p>
                        {doc && fileUrl ? (
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => openDocInNewTab(fileUrl)}>
                              <ExternalLink className="h-3 w-3 me-1" /> {t("demandes:detail.decision_docs.open")}
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => downloadDocAuthenticated(fileUrl, doc.nomFichier)}>
                              <Download className="h-3 w-3 me-1" /> {t("demandes:detail.decision_docs.download")}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-1">{t("demandes:detail.decision_docs.unavailable")}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Pièces du dossier */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-3">{t("demandes:detail.pieces.title")}</h3>
            {docsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const SPECIAL_TYPES = ["OFFRE_FISCALE_CORRIGEE", "LETTRE_ADOPTION"];
                  const regularDocs = docs.filter(d => !SPECIAL_TYPES.includes(d.type));
                  const groupedByType = regularDocs.reduce<Record<string, typeof docs>>((acc, d) => {
                    if (!acc[d.type]) acc[d.type] = [];
                    acc[d.type].push(d);
                    return acc;
                  }, {});

                  if (Object.keys(groupedByType).length === 0) {
                    return <p className="text-sm text-muted-foreground italic py-2">{t("demandes:detail.pieces.empty")}</p>;
                  }

                  const DOC_LABEL_MAP: Record<string, string> = {};
                  ALL_DOCUMENT_TYPES.forEach(dt => { DOC_LABEL_MAP[dt.value] = dt.label; });

                  const isIncomplete = selected.statut === "INCOMPLETE";
                  const allowedDocTypes = isIncomplete
                    ? (selected.decisions || []).filter(d => d.decision === "REJET_TEMP" && d.documentsDemandes).flatMap(d => d.documentsDemandes || [])
                    : null;

                  return Object.entries(groupedByType).map(([type, typeDocs]) => {
                    const sorted = [...typeDocs].sort((a, b) => (b.version || b.id) - (a.version || a.id));
                    const uploaded = sorted.find(d => d.actif === true) || sorted[0];
                    const fileUrl = uploaded ? getDocFileUrl(uploaded) : null;
                    const olderVersions = sorted.filter(d => d.id !== uploaded?.id);
                    const label = DOC_LABEL_MAP[type] || type;
                    const isLocked = isIncomplete && allowedDocTypes !== null && !allowedDocTypes.includes(type);
                    const isUnlocked = isIncomplete && allowedDocTypes !== null && allowedDocTypes.includes(type);

                    return (
                      <div key={type} className="space-y-1">
                        <div className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${isUnlocked ? "border-amber-300 bg-amber-50/50" : isLocked ? "border-border bg-muted/30 opacity-60" : "border-border"}`}>
                          {isUnlocked ? <Unlock className="h-4 w-4 text-amber-600 shrink-0" /> : isLocked ? <Lock className="h-4 w-4 text-muted-foreground shrink-0" /> : <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {label}
                              {isUnlocked && <Badge className="ms-2 text-[10px] bg-amber-100 text-amber-800 border-amber-200">{t("demandes:detail.pieces.to_correct")}</Badge>}
                              {isLocked && <Badge variant="outline" className="ms-2 text-[10px]">{t("demandes:detail.pieces.locked")}</Badge>}
                            </p>
                            {uploaded && (
                              <p className="text-xs text-muted-foreground truncate">
                                {uploaded.nomFichier}
                                {uploaded.version && <span className="ms-1 font-medium">(v{uploaded.version})</span>}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {fileUrl && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(fileUrl, "_blank")}>
                                  <ExternalLink className="h-3.5 w-3.5 me-1" /> {t("demandes:detail.pieces.open")}
                                </Button>
                                <a href={fileUrl} download={uploaded?.nomFichier || label}>
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                    <Download className="h-3.5 w-3.5 me-1" /> {t("demandes:detail.pieces.download")}
                                  </Button>
                                </a>
                              </>
                            )}
                            {hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) && !isLocked && (
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => { setUploadAllowedTypes([]); setUploadType(type); setUploadOpen(true); }}>
                                <Upload className="h-3.5 w-3.5 me-1" /> {t("demandes:detail.pieces.new_version")}
                              </Button>
                            )}
                          </div>
                        </div>
                        {olderVersions.length > 0 && (
                          <div className="ms-8 mt-1 space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">{t("demandes:detail.pieces.older_versions")}</p>
                            {olderVersions.map(v => (
                              <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>v{v.version || '?'} — {v.nomFichier}</span>
                                <span>{formatDate(v.dateUpload)}</span>
                                {v.chemin && <a href={getDocFileUrl(v)} target="_blank" rel="noopener noreferrer" className="underline">{t("demandes:detail.pieces.download")}</a>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workflow Actions */}
        {transitions.length > 0 && !["ADOPTEE", "NOTIFIEE", "REJETEE", "ANNULEE"].includes(selected.statut) && (
          <Card>
            <CardContent className="p-6 space-y-3">
              {(() => {
                const myHasVisa = decs.some(d => d.role === role && d.decision === "VISA");
                const myOpenRejets = decs.filter(d => d.role === role && d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT");
                const dgdVisa = decs.some(d => d.role === "DGD" && d.decision === "VISA");
                const isCurrentDGD = (role as string) === "DGD";
                const isPres = (role as string) === "PRESIDENT";
                const blocked = !isCurrentDGD && !isPres && !dgdVisa;
                return (
                  <div className="space-y-2">
                    {myHasVisa && (
                      <div className="text-xs rounded px-2 py-1 inline-block bg-green-100 text-green-800">
                        {t("demandes:detail.workflow.your_visa_applied")}
                      </div>
                    )}
                    {!myHasVisa && myOpenRejets.length > 0 && (
                      <div className="text-xs rounded px-2 py-1 inline-block bg-amber-100 text-amber-800">
                        {t("demandes:detail.workflow.open_rejets_warning", { count: myOpenRejets.length })}
                      </div>
                    )}
                    {blocked ? (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        <p className="font-medium">{t("demandes:detail.workflow.blocked_title")}</p>
                        <p className="mt-1">{t("demandes:detail.workflow.blocked_description")}</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {transitions.filter(tr => !tr.isDecisionFinale && tr.from.includes(selected.statut)).map((tr, idx) => {
                          const isVisaAction = tr.isVisa || tr.to !== "REJETEE";
                          const isRejetAction = tr.to === "REJETEE";
                          if (isVisaAction && (myHasVisa || myOpenRejets.length > 0)) return null;
                          if (isRejetAction && myHasVisa) return null;
                          return (
                          <Button key={idx} variant={isRejetAction ? "destructive" : "default"} disabled={actionLoading === selected.id} onClick={() => isRejetAction ? openRejectDialog(selected.id) : checkAndHandleVisa(selected.id)}>
                            {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <tr.icon className="h-4 w-4 me-1" />}
                            {tTransition(tr.labelKey)}
                          </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
              {(() => {
                const hasFinalTransitions = transitions.some(tr => tr.isDecisionFinale && tr.from.includes(selected.statut));
                if (!hasFinalTransitions) return null;
                const REQUIRED_ROLES = ["DGD", "DGTCP", "DGI", "DGB"];
                const allValidated = REQUIRED_ROLES.every(rr => decs.some(d => d.role === rr && d.decision === "VISA"));
                const missingRoles = REQUIRED_ROLES.filter(rr => !decs.some(d => d.role === rr && d.decision === "VISA"));
                return (
                  <div className="pt-2 border-t border-dashed border-border space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground">{t("demandes:detail.workflow.final_decision")}</span>
                    {!allValidated ? (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        {t("demandes:detail.workflow.missing_visas")}<br />{t("demandes:detail.workflow.missing_roles", { roles: missingRoles.join(", ") })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {transitions.filter(tr => tr.isDecisionFinale && tr.from.includes(selected.statut)).map((tr, idx) => (
                          <Button key={`final-${idx}`} variant={tr.to === "REJETEE" ? "destructive" : "default"} disabled={actionLoading === selected.id} onClick={() => tr.to === "REJETEE" ? openRejectDialog(selected.id, true) : setAdoptionOpen(true)}>
                            {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <tr.icon className="h-4 w-4 me-1" />}
                            {tTransition(tr.labelKey)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Réclamations */}
        {(selected.statut === "ADOPTEE" || selected.statut === "NOTIFIEE" || reclamations.length > 0) && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> {t("demandes:detail.reclamations.title")}
                </h3>
                {(() => {
                  if (!hasRole(["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE"])) return null;
                  if (selected.statut !== "ADOPTEE" && selected.statut !== "NOTIFIEE") return null;
                  if (reclamations.some(rc => rc.statut === "SOUMISE")) return null;
                  const adoptionDecision = selected.decisions
                    ?.filter(d => d.role === "PRESIDENT" && d.decision === "VISA")
                    .sort((a, b) => new Date(b.dateDecision || 0).getTime() - new Date(a.dateDecision || 0).getTime())[0];
                  const adoptionDate = adoptionDecision?.dateDecision ? new Date(adoptionDecision.dateDecision) : null;
                  const now = new Date();
                  const delai48h = adoptionDate ? (now.getTime() - adoptionDate.getTime()) > 48 * 60 * 60 * 1000 : false;
                  if (delai48h) {
                    return <span className="text-xs text-muted-foreground italic">{t("demandes:detail.reclamations.delay_expired")}</span>;
                  }
                  return (
                    <Button size="sm" variant="outline" onClick={() => setReclamationOpen(true)}>
                      <Plus className="h-4 w-4 me-1" /> {t("demandes:detail.reclamations.deposit")}
                    </Button>
                  );
                })()}
              </div>
              {reclamations.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">{t("demandes:detail.reclamations.empty")}</p>
              ) : (
                <div className="space-y-3">
                  {reclamations.map((rec) => (
                    <div key={rec.id} className={`rounded-lg border p-4 space-y-2 ${
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
                          {rec.auteurNom && <span className="text-xs text-muted-foreground">{t("demandes:detail.reclamations.by", { name: rec.auteurNom })}</span>}
                        </div>
                        {rec.dateCreation && <span className="text-xs text-muted-foreground">{formatDate(rec.dateCreation)}</span>}
                      </div>
                      <p className="text-sm">{rec.texte}</p>
                      {rec.pieceJointeNomFichier && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          <span>{rec.pieceJointeNomFichier}</span>
                          {rec.pieceJointeChemin && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => openDocInNewTab(rec.pieceJointeChemin!)}>
                              <ExternalLink className="h-3 w-3 me-1" /> {t("demandes:detail.decision_docs.open")}
                            </Button>
                          )}
                        </div>
                      )}
                      {rec.statut === "REJETEE" && rec.motifReponse && (
                        <div className="rounded border border-red-200 bg-red-100/50 p-2 text-xs space-y-1">
                          <div><span className="font-medium">{t("demandes:detail.reclamations.rejet_motif")}</span>{rec.motifReponse}</div>
                          {rec.reponseRejetNomFichier && (
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-red-600" />
                              <span className="font-medium">{rec.reponseRejetNomFichier}</span>
                              {rec.reponseRejetChemin && (
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => openDocInNewTab(rec.reponseRejetChemin!)}>
                                  <ExternalLink className="h-3 w-3 me-1" /> {t("demandes:detail.decision_docs.open")}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {rec.statut === "ACCEPTEE" && (
                        <div className="rounded border border-green-200 bg-green-100/50 p-2 text-xs">
                          <span className="font-medium">{t("demandes:detail.reclamations.accepted_banner")}</span>
                          {rec.motifReponse && <p className="mt-1">{rec.motifReponse}</p>}
                        </div>
                      )}
                      {rec.statut === "ANNULEE" && (
                        <div className="rounded border border-muted p-2 text-xs text-muted-foreground italic">
                          {t("demandes:detail.reclamations.cancelled")}
                        </div>
                      )}
                      {rec.statut === "SOUMISE" && (hasRole(["DGTCP"]) || hasRole(["PRESIDENT"])) && (
                        <div className="flex gap-2 mt-2">
                          {hasRole(["DGTCP"]) && (
                            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => {
                              setTraiterReclamationId(rec.id); setTraiterAcceptee(true); setTraiterMotif(""); setTraiterFile(null); setTraiterOpen(true);
                            }}>
                              <CheckCircle className="h-3.5 w-3.5 me-1" /> {t("demandes:detail.reclamations.accept")}
                            </Button>
                          )}
                          {hasRole(["PRESIDENT"]) && (
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => {
                              setTraiterReclamationId(rec.id); setTraiterAcceptee(false); setTraiterMotif(""); setTraiterFile(null); setTraiterOpen(true);
                            }}>
                              <XCircle className="h-3.5 w-3.5 me-1" /> {t("demandes:detail.reclamations.reject")}
                            </Button>
                          )}
                        </div>
                      )}
                      {rec.statut === "SOUMISE" && ((rec.auteurUserId === user?.userId) || hasRole(["AUTORITE_CONTRACTANTE"])) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => handleAnnulerReclamation(rec.id)}>
                          <XCircle className="h-3.5 w-3.5 me-1" /> {t("demandes:detail.reclamations.cancel")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selected.statut === "RECUE" && reclamations.some(rc => rc.statut === "ACCEPTEE") && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-amber-800">{t("demandes:detail.reupload_banner.title")}</p>
                  <p className="text-xs text-amber-700 mt-1">{t("demandes:detail.reupload_banner.body")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { setUploadOpen(v); if (!v) setUploadMessage(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("demandes:dialogs.upload.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("demandes:dialogs.upload.type_label")}</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue placeholder={t("demandes:dialogs.upload.type_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {(uploadAllowedTypes.length > 0 ? ALL_DOCUMENT_TYPES.filter(tt => uploadAllowedTypes.includes(tt.value)) : ALL_DOCUMENT_TYPES).map((tt) => (
                    <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("demandes:dialogs.upload.file_label")}</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            {(() => {
              const isRejetResponse = selected && uploadType && (selected.decisions || []).some(
                d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT" && d.documentsDemandes?.includes(uploadType)
              );
              return (
                <div className="space-y-2">
                  <Label>{t("demandes:dialogs.upload.message_label")} {isRejetResponse && <span className="text-destructive">{t("demandes:dialogs.upload.message_required_hint")}</span>}</Label>
                  <Textarea placeholder={isRejetResponse ? t("demandes:dialogs.upload.message_placeholder_rejet") : t("demandes:dialogs.upload.message_placeholder_default")} value={uploadMessage} onChange={(e) => setUploadMessage(e.target.value)} rows={2} />
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadMessage(""); }}>{t("demandes:dialogs.upload.cancel")}</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadType}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Upload className="h-4 w-4 me-1" />}
              {t("demandes:dialogs.upload.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message response dialog */}
      <Dialog open={responseOpen} onOpenChange={(v) => { setResponseOpen(v); if (!v) { setResponseDecisionId(null); setResponseMessage(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("demandes:dialogs.rejet_response.title")}</DialogTitle>
            <DialogDescription>{t("demandes:dialogs.rejet_response.description_short")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const rejetDec = decs.find(d => d.id === responseDecisionId);
              if (!rejetDec?.documentsDemandes?.length) return null;
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-800 mb-1.5">{t("demandes:dialogs.rejet_response.docs_requested_title")}</p>
                  <div className="flex flex-wrap gap-1">
                    {rejetDec.documentsDemandes.map((dt: string) => (
                      <Badge key={dt} variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                        {ALL_DOCUMENT_TYPES.find(tt => tt.value === dt)?.label || dt}
                      </Badge>
                    ))}
                  </div>
                  {rejetDec.motifRejet && (
                    <p className="text-xs text-amber-700 italic mt-2">{t("demandes:dialogs.rejet_response.motif_label", { motif: rejetDec.motifRejet })}</p>
                  )}
                </div>
              );
            })()}
            <Textarea placeholder={t("demandes:dialogs.rejet_response.placeholder")} value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResponseOpen(false); setResponseDecisionId(null); setResponseMessage(""); }}>{t("demandes:dialogs.rejet_response.cancel")}</Button>
            <Button onClick={handleRejetTempResponse} disabled={responseSending || !responseMessage.trim()}>
              {responseSending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {t("demandes:dialogs.rejet_response.send_short")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{rejectDecisionFinale ? t("demandes:dialogs.reject.title_final") : t("demandes:dialogs.reject.title_temp")}</DialogTitle>
            <DialogDescription>{rejectDecisionFinale ? t("demandes:dialogs.reject.description_final_short") : t("demandes:dialogs.reject.description_temp_short")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder={t("demandes:dialogs.reject.motif_placeholder_short")} value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} rows={3} />
            {!rejectDecisionFinale && (
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> {t("demandes:dialogs.reject.docs_label_short")} <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-lg border border-border p-3">
                  {ALL_DOCUMENT_TYPES.map(dt => (
                    <label key={dt.value} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5">
                      <Checkbox checked={rejectDocsDemandes.includes(dt.value)} onCheckedChange={(checked) => setRejectDocsDemandes(prev => checked ? [...prev, dt.value] : prev.filter(v => v !== dt.value))} />
                      <span>{dt.label}</span>
                    </label>
                  ))}
                </div>
                {rejectDocsDemandes.length === 0 && <p className="text-xs text-destructive mt-1">{t("demandes:dialogs.reject.select_at_least_one")}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("demandes:dialogs.reject.cancel")}</Button>
            <Button variant="destructive" disabled={!rejectMotif.trim() || (!rejectDecisionFinale && rejectDocsDemandes.length === 0)} onClick={handleRejectConfirm}>
              <XCircle className="h-4 w-4 me-1" /> {t("demandes:dialogs.reject.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offre Corrigée Upload */}
      <Dialog open={offreCorrigeeOpen} onOpenChange={(v) => { setOffreCorrigeeOpen(v); if (!v) { setOffreCorrigeeFile(null); setOffreCorrigeePendingId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("demandes:dialogs.offre_corrigee.title", { label: uploadBeforeVisa?.label || t("demandes:dialogs.offre_corrigee.label_fallback") })}</DialogTitle>
            <DialogDescription>{t("demandes:dialogs.offre_corrigee.description_short")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("demandes:dialogs.offre_corrigee.file_label_short")}</Label>
            <Input type="file" onChange={(e) => setOffreCorrigeeFile(e.target.files?.[0] || null)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOffreCorrigeeOpen(false); setOffreCorrigeeFile(null); setOffreCorrigeePendingId(null); }}>{t("demandes:dialogs.offre_corrigee.cancel")}</Button>
            <Button onClick={handleOffreCorrigeeUploadAndVisa} disabled={offreCorrigeeUploading || !offreCorrigeeFile}>
              {offreCorrigeeUploading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Upload className="h-4 w-4 me-1" />}
              {t("demandes:dialogs.offre_corrigee.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entreprise detail */}
      <Dialog open={entrepriseDialogOpen} onOpenChange={setEntrepriseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("demandes:dialogs.entreprise_info.title")}</DialogTitle></DialogHeader>
          {entrepriseLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entrepriseDetail ? (
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3"><span className="text-muted-foreground text-xs">{t("demandes:dialogs.entreprise_info.raison_sociale")}</span><p className="font-medium">{entrepriseDetail.raisonSociale || "—"}</p></div>
              <div className="rounded-lg border border-border p-3"><span className="text-muted-foreground text-xs">{t("demandes:dialogs.entreprise_info.nif")}</span><p className="font-medium">{entrepriseDetail.nif || "—"}</p></div>
              <div className="rounded-lg border border-border p-3"><span className="text-muted-foreground text-xs">{t("demandes:dialogs.entreprise_info.adresse")}</span><p className="font-medium">{entrepriseDetail.adresse || "—"}</p></div>
              <div className="rounded-lg border border-border p-3"><span className="text-muted-foreground text-xs">{t("demandes:dialogs.entreprise_info.situation_fiscale")}</span><p><Badge className={entrepriseDetail.situationFiscale === "REGULIERE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>{entrepriseDetail.situationFiscale || "—"}</Badge></p></div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">{t("demandes:dialogs.entreprise_info.empty")}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Adoption Dialog */}
      <Dialog open={adoptionOpen} onOpenChange={(v) => { setAdoptionOpen(v); if (!v) setAdoptionFile(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("demandes:dialogs.adoption.title")}</DialogTitle>
            <DialogDescription>{t("demandes:dialogs.adoption.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("demandes:dialogs.adoption.file_label")} <span className="text-destructive">*</span></Label>
              <Input type="file" onChange={(e) => setAdoptionFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdoptionOpen(false); setAdoptionFile(null); }}>{t("demandes:dialogs.adoption.cancel")}</Button>
            <Button onClick={handleAdoptWithLetter} disabled={adoptionUploading || !adoptionFile}>
              {adoptionUploading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <CheckCircle className="h-4 w-4 me-1" />}
              {t("demandes:dialogs.adoption.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Réclamation Dialog */}
      <Dialog open={reclamationOpen} onOpenChange={(v) => { setReclamationOpen(v); if (!v) { setReclamationTexte(""); setReclamationFile(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("demandes:dialogs.reclamation_create.title")}</DialogTitle>
            <DialogDescription>{t("demandes:dialogs.reclamation_create.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("demandes:dialogs.reclamation_create.motif_label")} <span className="text-destructive">*</span></Label>
              <Textarea placeholder={t("demandes:dialogs.reclamation_create.motif_placeholder")} value={reclamationTexte} onChange={(e) => setReclamationTexte(e.target.value)} rows={4} maxLength={4000} />
              <p className="text-xs text-muted-foreground text-end">{reclamationTexte.length}/4000</p>
            </div>
            <div className="space-y-2">
              <Label>{t("demandes:dialogs.reclamation_create.piece_label")} <span className="text-destructive">*</span></Label>
              <Input type="file" onChange={(e) => setReclamationFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReclamationOpen(false); setReclamationTexte(""); setReclamationFile(null); }}>{t("demandes:dialogs.reclamation_create.cancel")}</Button>
            <Button onClick={handleCreateReclamation} disabled={reclamationSubmitting || !reclamationTexte.trim() || !reclamationFile}>
              {reclamationSubmitting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Upload className="h-4 w-4 me-1" />}
              {t("demandes:dialogs.reclamation_create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Traiter Réclamation Dialog */}
      <Dialog open={traiterOpen} onOpenChange={(v) => { setTraiterOpen(v); if (!v) { setTraiterReclamationId(null); setTraiterMotif(""); setTraiterFile(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{traiterAcceptee ? t("demandes:dialogs.reclamation_traiter.title_accept") : t("demandes:dialogs.reclamation_traiter.title_reject")}</DialogTitle>
            <DialogDescription>{traiterAcceptee ? t("demandes:dialogs.reclamation_traiter.description_accept") : t("demandes:dialogs.reclamation_traiter.description_reject")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                {traiterAcceptee ? t("demandes:dialogs.reclamation_traiter.comment_label") : t("demandes:dialogs.reclamation_traiter.motif_label")} {!traiterAcceptee && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                placeholder={traiterAcceptee ? t("demandes:dialogs.reclamation_traiter.comment_placeholder") : t("demandes:dialogs.reclamation_traiter.motif_placeholder")}
                value={traiterMotif}
                onChange={(e) => setTraiterMotif(e.target.value.slice(0, 2000))}
                rows={3}
                maxLength={2000}
              />
              {!traiterAcceptee && (
                <p className="text-[10px] text-muted-foreground text-end">{traiterMotif.length}/2000</p>
              )}
            </div>
            {!traiterAcceptee && (
              <div className="space-y-2">
                <Label>{t("demandes:dialogs.reclamation_traiter.doc_label")} <span className="text-destructive">*</span></Label>
                <Input type="file" onChange={(e) => setTraiterFile(e.target.files?.[0] || null)} className="cursor-pointer" />
                {traiterFile && (
                  <p className="text-xs text-muted-foreground">{t("demandes:dialogs.reclamation_traiter.file_size", { name: traiterFile.name, size: (traiterFile.size / 1024).toFixed(0) })}</p>
                )}
              </div>
            )}
            {traiterAcceptee && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">{t("demandes:dialogs.reclamation_traiter.consequences_title")}</p>
                <ul className="list-disc ms-4 mt-1 space-y-0.5">
                  <li>{t("demandes:dialogs.reclamation_traiter.consequence_status")}</li>
                  <li>{t("demandes:dialogs.reclamation_traiter.consequence_visas")}</li>
                  <li>{t("demandes:dialogs.reclamation_traiter.consequence_docs")}</li>
                  <li>{t("demandes:dialogs.reclamation_traiter.consequence_reupload")}</li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTraiterOpen(false); setTraiterReclamationId(null); setTraiterMotif(""); setTraiterFile(null); }}>{t("demandes:dialogs.reclamation_traiter.cancel")}</Button>
            <Button variant={traiterAcceptee ? "default" : "destructive"} onClick={handleTraiterReclamation} disabled={traiterSubmitting || (!traiterAcceptee && (!traiterMotif.trim() || !traiterFile))}>
              {traiterSubmitting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : traiterAcceptee ? <CheckCircle className="h-4 w-4 me-1" /> : <XCircle className="h-4 w-4 me-1" />}
              {traiterAcceptee ? t("demandes:dialogs.reclamation_traiter.confirm_accept") : t("demandes:dialogs.reclamation_traiter.confirm_reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DemandeDetail;
