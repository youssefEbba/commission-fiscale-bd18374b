import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DemandeStatut,
  DEMANDE_STATUT_LABELS, DocumentDto, DOCUMENT_TYPES_REQUIS, RejetDto,
  DecisionCorrectionDto, ALL_DOCUMENT_TYPES, RejetTempResponseDto,
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
  FileText, ArrowLeft, Upload, Loader2,
  CheckCircle, XCircle, Download, ExternalLink,
  AlertTriangle, Lock, Unlock, History, Info,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

const STATUT_COLORS: Record<DemandeStatut, string> = {
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

const ROLE_TRANSITIONS: Record<string, { from: DemandeStatut[]; to: DemandeStatut; label: string; icon: React.ElementType; isVisa?: boolean; isDecisionFinale?: boolean }[]> = {
  DGD: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Douanes", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGTCP: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Trésor", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Décision finale : Adopter", icon: CheckCircle, isDecisionFinale: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Décision finale : Rejeter", icon: XCircle, isDecisionFinale: true },
  ],
  DGI: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Impôts", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGB: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Budget", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  PRESIDENT: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Décision finale : Adopter", icon: CheckCircle, isDecisionFinale: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Décision finale : Rejeter", icon: XCircle, isDecisionFinale: true },
  ],
};

const API_BASE = "https://df36-197-231-15-212.ngrok-free.app/api";
const REQUIRED_VISA_ROLES = ["DGD", "DGI", "DGTCP", "DGB"];

function getDocFileUrl(doc: DocumentDto): string {
  if (doc.chemin) {
    const normalized = doc.chemin.replace(/\\/g, "/");
    if (normalized.match(/^[A-Za-z]:\//)) {
      return "file:///" + normalized;
    }
    return normalized;
  }
  return "";
}

async function openDocInNewTab(url: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "ngrok-skip-browser-warning": "true",
    },
  });
  if (!res.ok) throw new Error("Impossible d'ouvrir le fichier");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank");
}

async function downloadDocAuthenticated(url: string, filename: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "ngrok-skip-browser-warning": "true",
    },
  });
  if (!res.ok) throw new Error("Téléchargement échoué");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

const DemandeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();

  const [selected, setSelected] = useState<DemandeCorrectionDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [activeOrg, setActiveOrg] = useState("DGD");

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadAllowedTypes, setUploadAllowedTypes] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");

  // Message-only response
  const [responseOpen, setResponseOpen] = useState(false);
  const [responseDecisionId, setResponseDecisionId] = useState<number | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [responseSending, setResponseSending] = useState(false);

  // Rejection modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectDecisionFinale, setRejectDecisionFinale] = useState(false);
  const [rejectDocsDemandes, setRejectDocsDemandes] = useState<string[]>([]);

  // Offre corrigée
  const [offreCorrigeeOpen, setOffreCorrigeeOpen] = useState(false);
  const [offreCorrigeeFile, setOffreCorrigeeFile] = useState<File | null>(null);
  const [offreCorrigeeUploading, setOffreCorrigeeUploading] = useState(false);
  const [offreCorrigeePendingId, setOffreCorrigeePendingId] = useState<number | null>(null);

  // Entreprise detail
  const [entrepriseDetail, setEntrepriseDetail] = useState<any | null>(null);
  const [entrepriseLoading, setEntrepriseLoading] = useState(false);
  const [entrepriseDialogOpen, setEntrepriseDialogOpen] = useState(false);

  const UPLOAD_BEFORE_VISA: Record<string, { docType: string; label: string }> = {
    DGD: { docType: "CREDIT_EXTERIEUR", label: "Crédit Extérieur" },
  };
  const uploadBeforeVisa = role ? UPLOAD_BEFORE_VISA[role] : undefined;

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
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible de charger la demande", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

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
        setEntrepriseDetail(list.find((e: any) => e.id === entrepriseId) || null);
      } catch {
        toast({ title: "Erreur", description: "Impossible de charger les informations de l'entreprise", variant: "destructive" });
      }
    } finally {
      setEntrepriseLoading(false);
    }
  };

  const updateDemandeStatusAfterDecision = async (demandeId: number) => {
    try {
      const demande = await demandeCorrectionApi.getById(demandeId);
      const decisions = demande.decisions || [];
      const visaRoles = decisions.filter((d: any) => d.decision === "VISA").map((d: any) => d.role);
      const allVisas = REQUIRED_VISA_ROLES.every(r => visaRoles.includes(r));
      const newStatut = allVisas ? "EN_VALIDATION" : "EN_EVALUATION";
      await demandeCorrectionApi.updateStatut(demandeId, newStatut);
    } catch (e: any) {
      console.error("Could not update demande status after decision", e);
    }
  };

  const handleTempVisa = async (demandeId: number) => {
    setActionLoading(demandeId);
    try {
      await demandeCorrectionApi.postDecision(demandeId, "VISA");
      await updateDemandeStatusAfterDecision(demandeId);
      toast({ title: "Succès", description: "Visa temporaire apposé" });
      fetchDetail();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTempReject = async (demandeId: number, motif: string, documentsDemandes?: string[]) => {
    setActionLoading(demandeId);
    try {
      await demandeCorrectionApi.postDecision(demandeId, "REJET_TEMP", motif, documentsDemandes);
      await updateDemandeStatusAfterDecision(demandeId);
      toast({ title: "Succès", description: "Rejet temporaire enregistré" });
      fetchDetail();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const checkAndHandleVisa = async (demandeId: number) => {
    if (uploadBeforeVisa) {
      try {
        const documents = await demandeCorrectionApi.getDocuments(demandeId);
        const hasDoc = documents.some(d => d.type === uploadBeforeVisa.docType && d.actif !== false);
        if (!hasDoc) {
          setOffreCorrigeePendingId(demandeId);
          setOffreCorrigeeOpen(true);
          return;
        }
      } catch {
        setOffreCorrigeePendingId(demandeId);
        setOffreCorrigeeOpen(true);
        return;
      }
    }
    await handleTempVisa(demandeId);
  };

  const handleOffreCorrigeeUploadAndVisa = async () => {
    if (!offreCorrigeePendingId || !offreCorrigeeFile) return;
    setOffreCorrigeeUploading(true);
    try {
      await demandeCorrectionApi.uploadDocument(offreCorrigeePendingId, uploadBeforeVisa?.docType || "OFFRE_CORRIGEE", offreCorrigeeFile);
      toast({ title: "Succès", description: `${uploadBeforeVisa?.label || "Document"} uploadé` });
      setOffreCorrigeeOpen(false);
      setOffreCorrigeeFile(null);
      await handleTempVisa(offreCorrigeePendingId);
      fetchDetail();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setOffreCorrigeeUploading(false);
      setOffreCorrigeePendingId(null);
    }
  };

  const handleStatutChange = async (demandeId: number, statut: DemandeStatut, motifRejet?: string, decisionFinale?: boolean) => {
    setActionLoading(demandeId);
    try {
      await demandeCorrectionApi.updateStatut(demandeId, statut, motifRejet, decisionFinale);
      toast({ title: "Succès", description: decisionFinale ? `Décision finale appliquée` : statut === "REJETEE" ? "Rejet enregistré" : "Visa apposé avec succès" });
      fetchDetail();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const generateAdoptionLetter = (demande: DemandeCorrectionDto): string => {
    const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const decisions = (demande.decisions || []).filter(d => d.decision === "VISA");
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Lettre d'adoption</title></head><body>
      <h1>LETTRE D'ADOPTION</h1>
      <p>Référence : ${demande.numero || `DC-${demande.id}`}</p>
      <p>Date : ${date}</p>
      <p>Autorité : ${demande.autoriteContractanteNom || "—"}</p>
      <p>Entreprise : ${demande.entrepriseRaisonSociale || "—"}</p>
      <p>Demande ADOPTÉE.</p>
      <table border="1"><tr><th>Organisme</th><th>Agent</th><th>Date</th></tr>
      ${decisions.map(d => `<tr><td>${d.role}</td><td>${d.utilisateurNom || "—"}</td><td>${d.dateDecision ? new Date(d.dateDecision).toLocaleDateString("fr-FR") : "—"}</td></tr>`).join("")}
      </table></body></html>`;
  };

  const handleAdoptWithLetter = async (demandeId: number) => {
    setActionLoading(demandeId);
    try {
      await demandeCorrectionApi.updateStatut(demandeId, "ADOPTEE", undefined, true);
      const demande = selected!;
      const letterContent = generateAdoptionLetter(demande);
      const blob = new Blob([letterContent], { type: "text/html" });
      const filename = `Lettre_Adoption_${demande.numero || demandeId}.html`;
      try {
        const file = new File([blob], filename, { type: "text/html" });
        await demandeCorrectionApi.uploadDocument(demandeId, "LETTRE_ADOPTION", file);
        toast({ title: "Succès", description: "Demande adoptée et lettre enregistrée" });
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Adoptée", description: "Lettre téléchargée localement." });
      }
      fetchDetail();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (demandeId: number, decisionFinale?: boolean) => {
    setRejectTargetId(demandeId);
    setRejectMotif("");
    setRejectDocsDemandes([]);
    setRejectDecisionFinale(!!decisionFinale);
    setRejectOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTargetId || !rejectMotif.trim()) return;
    if (!rejectDecisionFinale && rejectDocsDemandes.length === 0) return;
    setRejectOpen(false);
    if (rejectDecisionFinale) {
      await handleStatutChange(rejectTargetId, "REJETEE", rejectMotif.trim(), true);
    } else {
      await handleTempReject(rejectTargetId, rejectMotif.trim(), rejectDocsDemandes);
    }
    setRejectTargetId(null);
    setRejectMotif("");
    setRejectDocsDemandes([]);
    setRejectDecisionFinale(false);
  };

  const handleUpload = async () => {
    if (!selected || !uploadFile || !uploadType) return;
    const openRejets = (selected.decisions || []).filter(
      d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT" && d.documentsDemandes?.includes(uploadType)
    );
    if (openRejets.length > 0 && !uploadMessage.trim()) {
      toast({ title: "Message requis", description: "Ce document répond à un rejet temporaire. Veuillez saisir un message.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await demandeCorrectionApi.uploadDocument(selected.id, uploadType, uploadFile, uploadMessage.trim() || undefined);
      toast({ title: "Succès", description: "Document uploadé" });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadType("");
      setUploadMessage("");
      fetchDetail();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRejetTempResponse = async () => {
    if (!responseDecisionId || !responseMessage.trim()) return;
    setResponseSending(true);
    try {
      await demandeCorrectionApi.postRejetTempResponse(responseDecisionId, responseMessage.trim());
      toast({ title: "Succès", description: "Réponse envoyée" });
      setResponseOpen(false);
      setResponseDecisionId(null);
      setResponseMessage("");
      fetchDetail();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setResponseSending(false);
    }
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
          <p className="text-muted-foreground">Demande introuvable</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/demandes")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const decs = selected.decisions || [];
  const DECISION_ROLES_LIST = ["DGD", "DGTCP", "DGI", "DGB"];
  const DECISION_ROLE_LABELS: Record<string, string> = {
    DGD: "DGD – Douanes",
    DGTCP: "DGTCP – Trésor",
    DGI: "DGI – Impôts",
    DGB: "DGB – Budget",
  };

  const r = activeOrg;
  const roleDecs = decs.filter(d => d.role === r);
  const latestDec = roleDecs.length > 0 ? roleDecs[roleDecs.length - 1] : undefined;
  const allRejets = roleDecs.filter(d => d.decision === "REJET_TEMP");
  const openRejets = allRejets.filter(d => d.rejetTempStatus !== "RESOLU");
  const resolvedRejets = allRejets.filter(d => d.rejetTempStatus === "RESOLU");
  const hasVisa = latestDec?.decision === "VISA";
  const hasRejets = allRejets.length > 0;
  const isMyRole = (role as string) === r;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/demandes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Demande {selected.numero || `#${selected.id}`}
            </h1>
            <p className="text-sm text-muted-foreground">Détail de la demande de correction</p>
          </div>
        </div>

        {/* Info grid */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Autorité Contractante</span>
                <p className="font-medium">{selected.autoriteContractanteNom || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Entreprise</span>
                {selected.entrepriseId ? (
                  <button className="font-medium text-primary hover:underline cursor-pointer text-left block" onClick={() => openEntrepriseDetail(selected.entrepriseId)}>
                    {selected.entrepriseRaisonSociale || "—"}
                  </button>
                ) : (
                  <p className="font-medium">{selected.entrepriseRaisonSociale || "—"}</p>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Statut</span>
                <p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{DEMANDE_STATUT_LABELS[selected.statut]}</Badge></p>
              </div>
              <div>
                <span className="text-muted-foreground">Date de dépôt</span>
                <p>{selected.dateDepot ? new Date(selected.dateDepot).toLocaleDateString("fr-FR") : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statut par organisme */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-1">Statut par organisme</h3>
            <p className="text-[10px] text-muted-foreground mb-3">Les rejets ne sont pas modifiables.</p>
            {/* Tab navigation */}
            <div className="flex border-b border-border mb-3 gap-0">
              {DECISION_ROLES_LIST.map((orgRole) => {
                const orgDecs = decs.filter(d => d.role === orgRole);
                const orgLatest = orgDecs.length > 0 ? orgDecs[orgDecs.length - 1] : undefined;
                const orgHasVisa = orgLatest?.decision === "VISA";
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
                    <span className="hidden sm:inline">{DECISION_ROLE_LABELS[orgRole]}</span>
                    <span className="sm:hidden">{orgRole}</span>
                  </button>
                );
              })}
            </div>
            {/* Active organism content */}
            {(() => {
              const allResolved = hasRejets && openRejets.length === 0 && resolvedRejets.length > 0;
              const cardStyle = hasVisa ? "border-green-300 bg-green-50" : allResolved ? "border-emerald-300 bg-emerald-50" : hasRejets ? "border-red-300 bg-red-50" : "border-border bg-muted/30";
              return (
            <div className={`rounded-lg border p-4 min-h-[120px] ${cardStyle}`}>
              <div className="text-center mb-3">
                {hasVisa ? <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" /> : allResolved ? <CheckCircle className="h-6 w-6 text-emerald-600 mx-auto mb-1" /> : hasRejets ? <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" /> : <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />}
                <p className="font-semibold text-sm">{DECISION_ROLE_LABELS[r]}</p>
                {hasVisa && <p className="text-green-700 font-medium text-xs mt-0.5">Visa apposé</p>}
                {allResolved && !hasVisa && <p className="text-emerald-700 font-medium text-xs mt-0.5">✅ Tous les rejets ont été résolus</p>}
                {!latestDec && <p className="text-muted-foreground text-xs mt-0.5">En attente de décision</p>}
                {hasVisa && latestDec?.dateDecision && <p className="text-muted-foreground text-[10px] mt-0.5">Le : {new Date(latestDec.dateDecision).toLocaleDateString("fr-FR")}</p>}
              </div>
              {hasRejets && (
                <div className="space-y-3">
                  {openRejets.length > 0 && <p className="text-red-700 font-semibold text-xs text-center">{openRejets.length} rejet{openRejets.length > 1 ? "s" : ""} ouvert{openRejets.length > 1 ? "s" : ""}</p>}
                  {openRejets.map((rej, idx) => (
                    <div key={idx} className="border-l-2 border-red-300 pl-3 py-2 space-y-1 bg-background/50 rounded-r">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-red-800 text-xs">Rejet {idx + 1}</span>
                        {rej.rejetTempStatus && (
                          <Badge className={`text-[9px] ${rej.rejetTempStatus === "OUVERT" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {rej.rejetTempStatus === "OUVERT" ? "Ouvert" : "Résolu"}
                          </Badge>
                        )}
                        {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{new Date(rej.dateDecision).toLocaleDateString("fr-FR")}</span>}
                      </div>
                      {rej.motifRejet && <p className="text-muted-foreground italic text-xs">{rej.motifRejet}</p>}
                      {rej.documentsDemandes && rej.documentsDemandes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-muted-foreground">Docs demandés :</span>
                          {rej.documentsDemandes.map((dt: string) => (
                            <Badge key={dt} variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                              {ALL_DOCUMENT_TYPES.find(t => t.value === dt)?.label || dt}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {/* Réponses */}
                      {rej.rejetTempResponses && rej.rejetTempResponses.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          <span className="text-[10px] text-muted-foreground font-medium">Réponses :</span>
                          {rej.rejetTempResponses.map((resp: RejetTempResponseDto, ri: number) => (
                            <div key={ri} className="rounded border border-blue-200 bg-blue-50 p-2 text-[11px] space-y-0.5">
                              <p className="text-foreground">{resp.message}</p>
                              {resp.documentType && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <FileText className="h-3 w-3" />
                                  <span>{ALL_DOCUMENT_TYPES.find(t => t.value === resp.documentType)?.label || resp.documentType}</span>
                                  {resp.documentVersion && <span>(v{resp.documentVersion})</span>}
                                </div>
                              )}
                              {resp.documentUrl && (
                                <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                  <Upload className="h-2.5 w-2.5 mr-0.5" /> Document uploadé
                                </Badge>
                              )}
                              <div className="flex gap-2 text-muted-foreground">
                                {resp.auteurNom && <span>Par : {resp.auteurNom}</span>}
                                {resp.createdAt && <span>Le : {new Date(resp.createdAt).toLocaleDateString("fr-FR")}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Boutons AC : répondre + upload doc */}
                      {rej.rejetTempStatus === "OUVERT" && hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) && (
                        <div className="flex gap-1.5 mt-1.5">
                          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setResponseDecisionId(rej.id); setResponseMessage(""); setResponseOpen(true); }}>
                            💬 Répondre
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => { const d = rej.documentsDemandes || []; setUploadAllowedTypes(d); if (d.length) setUploadType(d[0]); else setUploadType(""); setUploadMessage(""); setUploadFile(null); setUploadOpen(true); }}>
                            <Upload className="h-3 w-3 mr-1" /> Upload doc
                          </Button>
                        </div>
                      )}
                      {/* Bouton résolu pour acteur déclenchant */}
                      {rej.rejetTempStatus === "OUVERT" && rej.role === role && hasRole(["DGD", "DGTCP", "DGI", "DGB", "PRESIDENT"]) && (
                        <div className="mt-1.5">
                          <Button size="sm" variant="default" className="h-6 text-[10px] px-2" disabled={actionLoading === selected.id} onClick={async () => {
                            setActionLoading(selected.id);
                            try {
                              await demandeCorrectionApi.resolveRejetTemp(rej.id);
                              toast({ title: "Succès", description: "Rejet marqué comme résolu" });
                              fetchDetail();
                            } catch (e: any) {
                              toast({ title: "Erreur", description: e.message, variant: "destructive" });
                            } finally {
                              setActionLoading(null);
                            }
                          }}>
                            <CheckCircle className="h-3 w-3 mr-0.5" /> Marquer résolu
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Actions for own role */}
                  {isMyRole && !["ADOPTEE", "NOTIFIEE", "REJETEE", "ANNULEE"].includes(selected.statut) && (
                    <div className="flex gap-2 mt-2 justify-center">
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={actionLoading === selected.id} onClick={() => checkAndHandleVisa(selected.id)}>
                        Annuler le rejet (Apposer visa)
                      </Button>
                      <Button variant="destructive" size="sm" className="h-7 text-xs" disabled={actionLoading === selected.id} onClick={() => openRejectDialog(selected.id)}>
                        Nouveau rejet
                      </Button>
                    </div>
                  )}
                  {/* Historique pliable */}
                  {resolvedRejets.length > 0 && (
                    <details className="mt-3 border-t border-border pt-3">
                      <summary className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                        <History className="h-3.5 w-3.5" />
                        Historique ({resolvedRejets.length} rejet{resolvedRejets.length > 1 ? "s" : ""} résolu{resolvedRejets.length > 1 ? "s" : ""})
                      </summary>
                      <div className="space-y-2 mt-2">
                        {resolvedRejets.map((rej, idx) => (
                          <div key={idx} className="border-l-2 border-muted pl-3 py-2 space-y-1 bg-muted/30 rounded-r opacity-75">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-medium text-muted-foreground text-xs">Rejet {idx + 1}</span>
                              <Badge className="text-[9px] bg-green-100 text-green-700">Résolu</Badge>
                              {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{new Date(rej.dateDecision).toLocaleDateString("fr-FR")}</span>}
                            </div>
                            {rej.motifRejet && <p className="text-muted-foreground italic text-xs">{rej.motifRejet}</p>}
                            {rej.documentsDemandes && rej.documentsDemandes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-[10px] text-muted-foreground">Docs demandés :</span>
                                {rej.documentsDemandes.map((dt: string) => (
                                  <Badge key={dt} variant="outline" className="text-[9px] bg-muted text-muted-foreground border-muted-foreground/20">
                                    {ALL_DOCUMENT_TYPES.find(t => t.value === dt)?.label || dt}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {rej.rejetTempResponses && rej.rejetTempResponses.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                <span className="text-[10px] text-muted-foreground font-medium">Réponses :</span>
                                {rej.rejetTempResponses.map((resp: RejetTempResponseDto, ri: number) => (
                                  <div key={ri} className="rounded border border-muted bg-background p-2 text-[11px] space-y-0.5">
                                    <p className="text-foreground">{resp.message}</p>
                                    {resp.documentUrl && (
                                      <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                        <Upload className="h-2.5 w-2.5 mr-0.5" /> Document uploadé
                                      </Badge>
                                    )}
                                    <div className="flex gap-2 text-muted-foreground">
                                      {resp.auteurNom && <span>Par : {resp.auteurNom}</span>}
                                      {resp.createdAt && <span>Le : {new Date(resp.createdAt).toLocaleDateString("fr-FR")}</span>}
                                    </div>
                                  </div>
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

        {/* Documents de décision — après adoption */}
        {(selected.statut === "ADOPTEE" || selected.statut === "NOTIFIEE") && (() => {
          const SPECIAL_DOC_TYPES_LIST = ["OFFRE_FISCALE_CORRIGEE", "LETTRE_ADOPTION"];
          const SPECIAL_DOC_LABELS_MAP: Record<string, string> = { OFFRE_FISCALE_CORRIGEE: "Offre Fiscale Corrigée", LETTRE_ADOPTION: "Lettre d'Adoption" };
          const specialDocs = docs.filter(d => SPECIAL_DOC_TYPES_LIST.includes(d.type));
          return (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" /> Documents de décision
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {SPECIAL_DOC_TYPES_LIST.map((docType) => {
                    const doc = specialDocs.find(d => d.type === docType);
                    const fileUrl = doc ? getDocFileUrl(doc) : null;
                    return (
                      <div key={docType} className={`rounded-xl border-2 p-4 text-center transition-colors ${doc ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : "border-dashed border-muted-foreground/20 bg-muted/20"}`}>
                        {doc ? <Download className="h-8 w-8 text-primary mx-auto mb-2" /> : <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />}
                        <p className={`text-xs font-semibold ${doc ? "text-foreground" : "text-muted-foreground"}`}>{SPECIAL_DOC_LABELS_MAP[docType]}</p>
                        {doc && fileUrl ? (
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => openDocInNewTab(fileUrl)}>
                              <ExternalLink className="h-3 w-3 mr-1" /> Ouvrir
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => downloadDocAuthenticated(fileUrl, doc.nomFichier)}>
                              <Download className="h-3 w-3 mr-1" /> Télécharger
                            </Button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-1">Non disponible</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Pièces du dossier — sans bouton "Ajouter un document" */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-3">Pièces du dossier</h3>
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
                    return <p className="text-sm text-muted-foreground italic py-2">Aucun document associé</p>;
                  }

                  const DOC_LABEL_MAP: Record<string, string> = {};
                  DOCUMENT_TYPES_REQUIS.forEach(dt => { DOC_LABEL_MAP[dt.value] = dt.label; });

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
                              {isUnlocked && <Badge className="ml-2 text-[10px] bg-amber-100 text-amber-800 border-amber-200">À corriger</Badge>}
                              {isLocked && <Badge variant="outline" className="ml-2 text-[10px]">Verrouillé</Badge>}
                            </p>
                            {uploaded && (
                              <p className="text-xs text-muted-foreground truncate">
                                {uploaded.nomFichier}
                                {uploaded.version && <span className="ml-1 font-medium">(v{uploaded.version})</span>}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {fileUrl && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(fileUrl, "_blank")}>
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir
                                </Button>
                                <a href={fileUrl} download={uploaded?.nomFichier || label}>
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                    <Download className="h-3.5 w-3.5 mr-1" /> Télécharger
                                  </Button>
                                </a>
                              </>
                            )}
                            {hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) && !isLocked && (
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => { setUploadAllowedTypes([]); setUploadType(type); setUploadOpen(true); }}>
                                <Upload className="h-3.5 w-3.5 mr-1" /> Nouvelle version
                              </Button>
                            )}
                          </div>
                        </div>
                        {olderVersions.length > 0 && (
                          <div className="ml-8 mt-1 space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Versions précédentes :</p>
                            {olderVersions.map(v => (
                              <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>v{v.version || '?'} — {v.nomFichier}</span>
                                <span>{new Date(v.dateUpload).toLocaleDateString("fr-FR")}</span>
                                {v.chemin && <a href={getDocFileUrl(v)} target="_blank" rel="noopener noreferrer" className="underline">Télécharger</a>}
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
        {transitions.length > 0 && (
          <Card>
            <CardContent className="p-6 space-y-3">
              {(() => {
                const myDec = decs.find(d => d.role === role);
                const dgdVisa = decs.some(d => d.role === "DGD" && d.decision === "VISA");
                const isCurrentDGD = (role as string) === "DGD";
                const isPres = (role as string) === "PRESIDENT";
                const blocked = !isCurrentDGD && !isPres && !dgdVisa;
                return (
                  <div className="space-y-2">
                    {myDec && (
                      <div className={`text-xs rounded px-2 py-1 inline-block ${myDec.decision === "VISA" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        Votre décision actuelle : {myDec.decision === "VISA" ? "Visa" : "Rejet"}
                      </div>
                    )}
                    {blocked ? (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        <p className="font-medium">⏳ En attente du visa DGD</p>
                        <p className="mt-1">Le DGD doit valider cette demande en premier.</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {transitions.filter(t => !t.isDecisionFinale && t.from.includes(selected.statut)).map((t, idx) => (
                          <Button key={idx} variant={t.to === "REJETEE" ? "destructive" : "default"} disabled={actionLoading === selected.id} onClick={() => t.to === "REJETEE" ? openRejectDialog(selected.id) : checkAndHandleVisa(selected.id)}>
                            {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <t.icon className="h-4 w-4 mr-1" />}
                            {myDec ? (t.isVisa ? "Re-valider" : "Rejeter à nouveau") : t.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Decision finale */}
              {(() => {
                const hasFinalTransitions = transitions.some(t => t.isDecisionFinale && t.from.includes(selected.statut));
                if (!hasFinalTransitions) return null;
                const REQUIRED_ROLES = ["DGD", "DGTCP", "DGI", "DGB"];
                const allValidated = REQUIRED_ROLES.every(r => decs.find(d => d.role === r)?.decision === "VISA");
                const missingRoles = REQUIRED_ROLES.filter(r => decs.find(d => d.role === r)?.decision !== "VISA");
                return (
                  <div className="pt-2 border-t border-dashed border-border space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground">Décision finale :</span>
                    {!allValidated ? (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        ⚠️ Tous les organismes doivent apposer leur visa avant la décision finale.<br />Manquant : {missingRoles.join(", ")}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {transitions.filter(t => t.isDecisionFinale && t.from.includes(selected.statut)).map((t, idx) => (
                          <Button key={`final-${idx}`} variant={t.to === "REJETEE" ? "destructive" : "default"} disabled={actionLoading === selected.id} onClick={() => t.to === "REJETEE" ? openRejectDialog(selected.id, true) : handleAdoptWithLetter(selected.id)}>
                            {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <t.icon className="h-4 w-4 mr-1" />}
                            {t.label}
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
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { setUploadOpen(v); if (!v) setUploadMessage(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de document</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez le type" /></SelectTrigger>
                <SelectContent>
                  {(uploadAllowedTypes.length > 0 ? DOCUMENT_TYPES_REQUIS.filter(t => uploadAllowedTypes.includes(t.value)) : DOCUMENT_TYPES_REQUIS).map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fichier</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            {(() => {
              const isRejetResponse = selected && uploadType && (selected.decisions || []).some(
                d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT" && d.documentsDemandes?.includes(uploadType)
              );
              return (
                <div className="space-y-2">
                  <Label>Message {isRejetResponse && <span className="text-destructive">* (réponse à un rejet)</span>}</Label>
                  <Textarea placeholder={isRejetResponse ? "Décrivez les corrections apportées..." : "Message optionnel..."} value={uploadMessage} onChange={(e) => setUploadMessage(e.target.value)} rows={2} />
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadMessage(""); }}>Annuler</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadType}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Uploader
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message response dialog */}
      <Dialog open={responseOpen} onOpenChange={(v) => { setResponseOpen(v); if (!v) { setResponseDecisionId(null); setResponseMessage(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Répondre au rejet temporaire</DialogTitle>
            <DialogDescription>Envoyez un message sans upload.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Saisissez votre réponse..." value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResponseOpen(false); setResponseDecisionId(null); setResponseMessage(""); }}>Annuler</Button>
            <Button onClick={handleRejetTempResponse} disabled={responseSending || !responseMessage.trim()}>
              {responseSending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{rejectDecisionFinale ? "Rejet final" : "Rejet temporaire"}</DialogTitle>
            <DialogDescription>{rejectDecisionFinale ? "Motif du rejet final." : "Motif du rejet et documents à corriger."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Motif du rejet..." value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} rows={3} />
            {!rejectDecisionFinale && (
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Documents à corriger <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-lg border border-border p-3">
                  {ALL_DOCUMENT_TYPES.map(dt => (
                    <label key={dt.value} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5">
                      <Checkbox checked={rejectDocsDemandes.includes(dt.value)} onCheckedChange={(checked) => setRejectDocsDemandes(prev => checked ? [...prev, dt.value] : prev.filter(v => v !== dt.value))} />
                      <span>{dt.label}</span>
                    </label>
                  ))}
                </div>
                {rejectDocsDemandes.length === 0 && <p className="text-xs text-destructive mt-1">Sélectionnez au moins un document</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button variant="destructive" disabled={!rejectMotif.trim() || (!rejectDecisionFinale && rejectDocsDemandes.length === 0)} onClick={handleRejectConfirm}>
              <XCircle className="h-4 w-4 mr-1" /> Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offre Corrigée Upload */}
      <Dialog open={offreCorrigeeOpen} onOpenChange={(v) => { setOffreCorrigeeOpen(v); if (!v) { setOffreCorrigeeFile(null); setOffreCorrigeePendingId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload du {uploadBeforeVisa?.label || "document"}</DialogTitle>
            <DialogDescription>Uploadez le document requis avant d'apposer votre visa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Fichier</Label>
            <Input type="file" onChange={(e) => setOffreCorrigeeFile(e.target.files?.[0] || null)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOffreCorrigeeOpen(false); setOffreCorrigeeFile(null); setOffreCorrigeePendingId(null); }}>Annuler</Button>
            <Button onClick={handleOffreCorrigeeUploadAndVisa} disabled={offreCorrigeeUploading || !offreCorrigeeFile}>
              {offreCorrigeeUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Uploader et valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entreprise detail */}
      <Dialog open={entrepriseDialogOpen} onOpenChange={setEntrepriseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Informations de l'entreprise</DialogTitle></DialogHeader>
          {entrepriseLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entrepriseDetail ? (
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3"><span className="text-muted-foreground text-xs">Raison sociale</span><p className="font-medium">{entrepriseDetail.raisonSociale || "—"}</p></div>
              <div className="rounded-lg border border-border p-3"><span className="text-muted-foreground text-xs">NIF</span><p className="font-medium">{entrepriseDetail.nif || "—"}</p></div>
              <div className="rounded-lg border border-border p-3"><span className="text-muted-foreground text-xs">Adresse</span><p className="font-medium">{entrepriseDetail.adresse || "—"}</p></div>
              <div className="rounded-lg border border-border p-3"><span className="text-muted-foreground text-xs">Situation fiscale</span><p><Badge className={entrepriseDetail.situationFiscale === "REGULIERE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>{entrepriseDetail.situationFiscale || "—"}</Badge></p></div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Aucune information disponible</p>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DemandeDetail;
