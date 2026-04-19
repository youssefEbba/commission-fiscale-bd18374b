import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DemandeStatut,
  DEMANDE_STATUT_LABELS, DocumentDto, DOCUMENT_TYPES_REQUIS, RejetDto,
  DecisionCorrectionDto, ALL_DOCUMENT_TYPES, RejetTempResponseDto,
  ReclamationDemandeCorrectionDto, RECLAMATION_STATUT_LABELS,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Search, RefreshCw, Plus, Eye, Upload, Loader2,
  CheckCircle, XCircle, ArrowRight, Filter, Download, ExternalLink,
  AlertTriangle, Lock, Unlock, MoreHorizontal, Info, History,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import CreateDemandeWizard from "@/components/demandes/CreateDemandeWizard";
import { Textarea } from "@/components/ui/textarea";

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

// Visa/rejet actions: no status change on backend (decisionFinale=false)
// Decision finale: only PRESIDENT can adopt/reject with decisionFinale=true
const ALL_STATUTS: DemandeStatut[] = ["RECUE", "INCOMPLETE", "RECEVABLE", "EN_EVALUATION", "EN_VALIDATION"];

const ROLE_TRANSITIONS: Record<string, { from: DemandeStatut[]; to: DemandeStatut; label: string; icon: React.ElementType; isVisa?: boolean; isDecisionFinale?: boolean }[]> = {
  DGD: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Douanes", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGTCP: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Trésor", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
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

import { API_BASE } from "@/lib/apiConfig";

function getDocFileUrl(doc: DocumentDto): string {
  if (doc.chemin) {
    // Convert Windows backslash path to a file:/// URL
    const normalized = doc.chemin.replace(/\\/g, "/");
    if (normalized.match(/^[A-Za-z]:\//)) {
      return "file:///" + normalized;
    }
    return normalized;
  }
  return "";
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

const Demandes = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const role = user?.role as AppRole;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [demandes, setDemandes] = useState<DemandeCorrectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Detail/Document dialog
  const [selected, setSelected] = useState<DemandeCorrectionDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadAllowedTypes, setUploadAllowedTypes] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");

  // Message-only response to rejet
  const [responseOpen, setResponseOpen] = useState(false);
  const [responseDecisionId, setResponseDecisionId] = useState<number | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [responseSending, setResponseSending] = useState(false);

  // Upload offre corrigée dialog (DGTCP/DGB before visa)
  const [offreCorrigeeOpen, setOffreCorrigeeOpen] = useState(false);
  const [offreCorrigeeFile, setOffreCorrigeeFile] = useState<File | null>(null);
  const [offreCorrigeeUploading, setOffreCorrigeeUploading] = useState(false);
  const [offreCorrigeePendingId, setOffreCorrigeePendingId] = useState<number | null>(null);

  // Create / Edit wizard
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDemande, setEditingDemande] = useState<DemandeCorrectionDto | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);

  // Charge la version COMPLETE (modeleFiscal, dqe, marcheId, conventionId, entrepriseId)
  // avant d'ouvrir le wizard en mode édition. La liste `getAll` peut omettre ces champs.
  const openEditWizard = async (d: DemandeCorrectionDto) => {
    setLoadingEditId(d.id);
    try {
      const full = await demandeCorrectionApi.getById(d.id);
      setEditingDemande(full);
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible de charger la demande complète",
        variant: "destructive",
      });
      // Fallback : ouvrir avec ce qu'on a
      setEditingDemande(d);
    } finally {
      setLoadingEditId(null);
    }
  };

  // Delete brouillon
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  // Rejection modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectDecisionFinale, setRejectDecisionFinale] = useState(false);
  const [rejectDocsDemandes, setRejectDocsDemandes] = useState<string[]>([]);
  // Cancel confirmation
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  // Entreprise detail dialog
  const [entrepriseDetail, setEntrepriseDetail] = useState<any | null>(null);
  const [entrepriseLoading, setEntrepriseLoading] = useState(false);
  const [entrepriseDialogOpen, setEntrepriseDialogOpen] = useState(false);
  const [activeOrg, setActiveOrg] = useState("DGD");
  // Adoption with lettre upload (President)
  const [adoptionOpen, setAdoptionOpen] = useState(false);
  const [adoptionFile, setAdoptionFile] = useState<File | null>(null);
  const [adoptionUploading, setAdoptionUploading] = useState(false);
  const [adoptionTargetId, setAdoptionTargetId] = useState<number | null>(null);

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
      // Fallback: try list and filter
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${API_BASE}/entreprises`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
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

  const fetchDemandes = async () => {
    if (!role) return;
    setLoading(true);
    try {
      let data: DemandeCorrectionDto[];
      if (role === "ENTREPRISE" && user?.entrepriseId) {
        data = await demandeCorrectionApi.getByEntreprise(user.entrepriseId);
      } else if (role === "AUTORITE_CONTRACTANTE" && user?.autoriteContractanteId) {
        data = await demandeCorrectionApi.getByAutorite(user.autoriteContractanteId);
      } else if ((role === "AUTORITE_UPM" || role === "AUTORITE_UEP") && user?.userId) {
        // Delegates: strict server-side filtering via marche_delegue
        data = await demandeCorrectionApi.getByDelegue(user.userId);
      } else {
        data = await demandeCorrectionApi.getAll();
      }
      // Les brouillons ne doivent pas être visibles par les contrôleurs (DG*) ni par le Président
      if (["DGD", "DGTCP", "DGI", "DGB", "PRESIDENT"].includes(role)) {
        data = data.filter((d) => d.statut !== "BROUILLON");
      }
      setDemandes(data);
    } catch (e: any) {
      const message = String(e?.message || "");
      const accessDenied = message.includes("Accès refusé") || message.includes("Access Denied");
      toast({
        title: "Erreur",
        description: accessDenied
          ? "Votre compte n'a pas encore la permission de consulter les demandes de correction."
          : "Impossible de charger les demandes",
        variant: "destructive",
      });
      setDemandes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!role) return;
    fetchDemandes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user?.entrepriseId, user?.autoriteContractanteId]);

  // Wizard handles creation now

  const openDetail = async (d: DemandeCorrectionDto) => {
    setDocsLoading(true);
    try {
      // Fetch full detail (includes rejets)
      const full = await demandeCorrectionApi.getById(d.id);
      setSelected(full);
    } catch {
      setSelected(d);
    }
    try {
      const documents = await demandeCorrectionApi.getDocuments(d.id);
      setDocs(documents);
    } catch {
      setDocs(d.documents || []);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleStatutChange = async (id: number, statut: DemandeStatut, motifRejet?: string, decisionFinale?: boolean) => {
    setActionLoading(id);
    try {
      const updated = await demandeCorrectionApi.updateStatut(id, statut, motifRejet, decisionFinale);
      toast({ title: "Succès", description: decisionFinale ? `Décision finale appliquée: ${DEMANDE_STATUT_LABELS[updated.statut || statut]}` : statut === "REJETEE" ? "Rejet enregistré" : "Visa apposé avec succès" });
      fetchDemandes();
      if (selected?.id === id) {
        setSelected(updated);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // DGTCP must upload CREDIT_INTERIEUR, DGD must upload CREDIT_EXTERIEUR before visa
  const UPLOAD_BEFORE_VISA: Record<string, { docType: string; label: string }> = {
    DGD: { docType: "CREDIT_EXTERIEUR", label: "Crédit Extérieur" },
  };
  const uploadBeforeVisa = role ? UPLOAD_BEFORE_VISA[role] : undefined;

  const checkAndHandleVisa = async (id: number) => {
    if (uploadBeforeVisa) {
      try {
        const documents = await demandeCorrectionApi.getDocuments(id);
        const hasDoc = documents.some(d => d.type === uploadBeforeVisa.docType && d.actif !== false);
        if (!hasDoc) {
          setOffreCorrigeePendingId(id);
          setOffreCorrigeeOpen(true);
          return;
        }
      } catch {
        setOffreCorrigeePendingId(id);
        setOffreCorrigeeOpen(true);
        return;
      }
    }
    await handleTempVisa(id);
  };

  const handleOffreCorrigeeUploadAndVisa = async () => {
    if (!offreCorrigeePendingId || !offreCorrigeeFile) return;
    setOffreCorrigeeUploading(true);
    try {
      await demandeCorrectionApi.uploadDocument(offreCorrigeePendingId, uploadBeforeVisa?.docType || "OFFRE_CORRIGEE", offreCorrigeeFile);
      toast({ title: "Succès", description: `${uploadBeforeVisa?.label || "Document"} uploadé` });
      setOffreCorrigeeOpen(false);
      setOffreCorrigeeFile(null);
      // Now proceed with visa
      await handleTempVisa(offreCorrigeePendingId);
      // Refresh docs if detail is open
      if (selected?.id === offreCorrigeePendingId) {
        const documents = await demandeCorrectionApi.getDocuments(offreCorrigeePendingId);
        setDocs(documents);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setOffreCorrigeeUploading(false);
      setOffreCorrigeePendingId(null);
    }
  };

  // Note: la transition de statut (RECUE/RECEVABLE -> EN_EVALUATION, et -> EN_VALIDATION
  // après les 4 visas DGD/DGTCP/DGI/DGB) est gérée automatiquement côté backend
  // dans DecisionCorrectionService.saveDecision. Le front se contente de recharger la demande.

  // Temporary decision (VISA / REJET_TEMP) via POST /decisions
  const handleTempVisa = async (id: number) => {
    setActionLoading(id);
    try {
      await demandeCorrectionApi.postDecision(id, "VISA");
      toast({ title: "Succès", description: "Visa temporaire apposé" });
      fetchDemandes();
      if (selected) {
        const full = await demandeCorrectionApi.getById(id);
        setSelected(full);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTempReject = async (id: number, motif: string, documentsDemandes?: string[]) => {
    setActionLoading(id);
    try {
      await demandeCorrectionApi.postDecision(id, "REJET_TEMP", motif, documentsDemandes);
      toast({ title: "Succès", description: "Rejet temporaire enregistré" });
      fetchDemandes();
      if (selected) {
        const full = await demandeCorrectionApi.getById(id);
        setSelected(full);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (id: number, decisionFinale?: boolean) => {
    setRejectTargetId(id);
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

  // Annulation par l'AC
  const handleCancelDemande = async () => {
    if (!cancelTargetId) return;
    setCancelLoading(true);
    try {
      await demandeCorrectionApi.updateStatut(cancelTargetId, "ANNULEE");
      toast({ title: "Demande annulée avec succès" });
      setCancelOpen(false);
      setCancelTargetId(null);
      fetchDemandes();
      if (selected?.id === cancelTargetId) setSelected(null);
    } catch (e: any) {
      const msg = e?.message || "Erreur lors de l'annulation";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleAdoptWithLetter = async () => {
    if (!adoptionTargetId || !adoptionFile) return;
    setAdoptionUploading(true);
    try {
      await demandeCorrectionApi.uploadDocument(adoptionTargetId, "LETTRE_ADOPTION", adoptionFile);
      const updated = await demandeCorrectionApi.updateStatut(adoptionTargetId, "ADOPTEE", undefined, true);
      toast({ title: "Succès", description: "Demande adoptée et lettre d'adoption enregistrée" });
      setAdoptionOpen(false);
      setAdoptionFile(null);
      fetchDemandes();
      if (selected?.id === adoptionTargetId) {
        setSelected(updated);
        const documents = await demandeCorrectionApi.getDocuments(adoptionTargetId);
        setDocs(documents);
      }
      setAdoptionTargetId(null);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setAdoptionUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!selected || !uploadFile || !uploadType) return;
    // Check if this upload responds to an open REJET_TEMP
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
      const documents = await demandeCorrectionApi.getDocuments(selected.id);
      setDocs(documents);
      // Refresh selected to get updated rejetTempStatus
      const full = await demandeCorrectionApi.getById(selected.id);
      setSelected(full);
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
      if (selected) {
        const full = await demandeCorrectionApi.getById(selected.id);
        setSelected(full);
      }
      fetchDemandes();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setResponseSending(false);
    }
  };

  const filtered = demandes.filter((d) => {
    // AC ne voit que ses propres demandes
    if (role === "AUTORITE_CONTRACTANTE" && user?.autoriteContractanteId && d.autoriteContractanteId !== user.autoriteContractanteId) {
      return false;
    }
    // Entreprise ne voit que ses propres demandes
    if (role === "ENTREPRISE" && user?.entrepriseId && d.entrepriseId !== user.entrepriseId) {
      return false;
    }
    const matchSearch =
      (d.numero || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.autoriteContractanteNom || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.entrepriseRaisonSociale || "").toLowerCase().includes(search.toLowerCase()) ||
      String(d.id).includes(search);
    const matchStatut = filterStatut === "ALL" || d.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const transitions = ROLE_TRANSITIONS[role] || [];

  const pageTitle: Record<string, string> = {
    AUTORITE_CONTRACTANTE: "Mes demandes de correction",
    DGD: "Dossiers à évaluer (Douanes)",
    DGI: "Dossiers en attente de visa (Impôts)",
    DGB: "Dossiers en attente de visa (Budget)",
    DGTCP: "Dossiers à valider (Trésor)",
    PRESIDENT: "Dossiers en attente de validation finale",
    ADMIN_SI: "Toutes les demandes (Audit)",
    ENTREPRISE: "Demandes associées",
    AUTORITE_UPM: "Mes demandes (Délégué UPM)",
    AUTORITE_UEP: "Mes demandes (Délégué UEP)",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {pageTitle[role] || "Demandes de correction"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Correction de l'offre fiscale
            </p>
          </div>
          <div className="flex gap-2">
            {hasRole(["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ADMIN_SI"]) && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle demande de correction
              </Button>
            )}
            <Button variant="outline" onClick={fetchDemandes} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(DEMANDE_STATUT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Demande</TableHead>
                    <TableHead>Autorité Contractante</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Stade</TableHead>
                    <TableHead>Date dépôt</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.numero || `#${d.id}`}</TableCell>
                        <TableCell className="text-muted-foreground">{d.autoriteContractanteNom || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{d.entrepriseRaisonSociale || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUT_COLORS[d.statut] || ""}`}>
                            {DEMANDE_STATUT_LABELS[d.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const decs = d.decisions || [];
                            const dgdVisa = decs.some(dec => dec.role === "DGD" && dec.decision === "VISA");
                            const isCurrentDGD = (role as string) === "DGD";
                            const isPres = (role as string) === "PRESIDENT";
                            const blocked = !isCurrentDGD && !isPres && !dgdVisa;
                            const rejets = decs.filter(dec => dec.decision === "REJET_TEMP");
                            const openRejets = rejets.filter(dec => dec.rejetTempStatus !== "RESOLU");
                            const hasRejet = rejets.length > 0 || (d.rejets && d.rejets.length > 0);
                            const allRejetsResolved = hasRejet && openRejets.length === 0;
                            const myRoleDecs = decs.filter(dec => dec.role === role);
                            const myHasVisa = myRoleDecs.some(dec => dec.decision === "VISA");

                            const badgeContent = blocked
                              ? <Badge className="bg-amber-100 text-amber-800 text-xs cursor-pointer">⏳ Visa DGD</Badge>
                              : myHasVisa
                              ? <Badge className="bg-green-100 text-green-800 text-xs cursor-pointer">Visa apposé</Badge>
                              : hasRejet && !allRejetsResolved
                              ? <Badge className="bg-red-100 text-red-800 text-xs cursor-pointer">Rejet en cours</Badge>
                              : allRejetsResolved
                              ? <Badge className="bg-emerald-100 text-emerald-800 text-xs cursor-pointer">Rejets résolus</Badge>
                              : <span className="text-muted-foreground text-xs">—</span>;

                            const allRejets = [
                              ...rejets.map(r => ({
                                role: r.role,
                                motif: r.motifRejet || "—",
                                docs: r.documentsDemandes || [],
                                date: r.dateDecision,
                                utilisateur: r.utilisateurNom,
                                status: r.rejetTempStatus,
                              })),
                              ...((d.rejets && (!decs.length)) ? d.rejets.map(r => ({
                                role: "—",
                                motif: r.motifRejet || "—",
                                docs: [] as string[],
                                date: r.dateRejet,
                                utilisateur: r.utilisateurNom,
                                status: undefined as string | undefined,
                              })) : []),
                            ];

                            if (allRejets.length === 0 && decs.length === 0) return badgeContent;

                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex">{badgeContent}</button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0" align="start">
                                  <div className="p-3 border-b">
                                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                                      <Info className="h-4 w-4 text-primary" />
                                      Détails du stade
                                    </h4>
                                  </div>
                                  <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                                    {/* Visas */}
                                    {decs.filter(dec => dec.decision === "VISA").map((v, i) => (
                                      <div key={`v-${i}`} className="flex items-center gap-2 text-xs rounded border border-green-200 bg-green-50 p-2">
                                        <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                        <div>
                                          <span className="font-medium">{v.role}</span> — Visa
                                          {v.dateDecision && <span className="text-muted-foreground ml-1">({new Date(v.dateDecision).toLocaleDateString("fr-FR")})</span>}
                                        </div>
                                      </div>
                                    ))}
                                    {/* Rejets */}
                                    {allRejets.length > 0 ? allRejets.map((r, i) => (
                                      <div key={`r-${i}`} className="rounded border border-red-200 bg-red-50 p-2 text-xs space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                                          <span className="font-medium">{r.role}</span>
                                          {r.status && (
                                            <Badge className={`text-[9px] ${r.status === "OUVERT" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                                              {r.status === "OUVERT" ? "Ouvert" : "Résolu"}
                                            </Badge>
                                          )}
                                          {r.date && <span className="text-muted-foreground ml-auto text-[10px]">{new Date(r.date).toLocaleDateString("fr-FR")}</span>}
                                        </div>
                                        <p className="text-muted-foreground ml-5">{r.motif}</p>
                                        {r.docs.length > 0 && (
                                          <div className="ml-5 space-y-1">
                                            <span className="text-[10px] text-muted-foreground">Docs requis :</span>
                                            <div className="flex flex-wrap gap-1">
                                              {r.docs.map(dt => (
                                                <Badge key={dt} variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                                  {ALL_DOCUMENT_TYPES.find(t => t.value === dt)?.label || dt}
                                                </Badge>
                                              ))}
                                            </div>
                                            {hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) && (
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {r.docs.map(dt => (
                                                  <Button
                                                    key={`upload-${dt}`}
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-6 px-2 text-[10px]"
                                                    onClick={() => {
                                                      navigate(`/dashboard/demandes/${d.id}`);
                                                    }}
                                                  >
                                                    <Upload className="h-3 w-3 mr-1" />
                                                    {ALL_DOCUMENT_TYPES.find(t => t.value === dt)?.label || dt}
                                                  </Button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )) : (
                                      <p className="text-xs text-muted-foreground text-center py-2">Aucun rejet</p>
                                    )}
                                    {blocked && (
                                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                        ⏳ Le DGD doit valider en premier.
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {d.dateDepot ? new Date(d.dateDepot).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end items-center">
                            {role === "DGD" ? (
                              <Button size="sm" onClick={() => navigate(`/dashboard/correction-douaniere/${d.id}`)}>
                                <ArrowRight className="h-4 w-4 mr-1" /> Correction douanière
                              </Button>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => navigate(`/dashboard/demandes/${d.id}`)}>
                                    <Eye className="h-4 w-4 mr-2" /> Détail
                                  </DropdownMenuItem>
                                  {/* Actions Brouillon (entreprise / AC dépositaire) */}
                                  {d.statut === "BROUILLON" && hasRole(["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "ADMIN_SI"]) && (
                                    <>
                                      <DropdownMenuItem
                                        disabled={loadingEditId === d.id}
                                        onClick={() => openEditWizard(d)}
                                      >
                                        {loadingEditId === d.id
                                          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          : <FileText className="h-4 w-4 mr-2" />}
                                        Modifier le brouillon
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={actionLoading === d.id}
                                        onClick={async () => {
                                          setActionLoading(d.id);
                                          try {
                                            await demandeCorrectionApi.soumettre(d.id);
                                            toast({ title: "Brouillon soumis", description: "La demande est passée en Reçue." });
                                            fetchDemandes();
                                          } catch (e: any) {
                                            toast({ title: "Erreur", description: e.message, variant: "destructive" });
                                          } finally { setActionLoading(null); }
                                        }}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" /> Soumettre
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setDeleteTargetId(d.id)}
                                      >
                                        <XCircle className="h-4 w-4 mr-2" /> Supprimer
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  {hasRole(["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "ADMIN_SI"]) && d.statut === "RECUE" && (
                                    <DropdownMenuItem
                                      disabled={loadingEditId === d.id}
                                      onClick={() => openEditWizard(d)}
                                    >
                                      {loadingEditId === d.id
                                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        : <FileText className="h-4 w-4 mr-2" />}
                                      Modifier
                                    </DropdownMenuItem>
                                  )}
                                  {(() => {
                                    const myRoleDecs = (d.decisions || []).filter(dec => dec.role === role);
                                    const myHasVisa = myRoleDecs.some(dec => dec.decision === "VISA");
                                    const myOpenRejets = myRoleDecs.filter(dec => dec.decision === "REJET_TEMP" && dec.rejetTempStatus !== "RESOLU");
                                    const canCancel = hasRole(["AUTORITE_CONTRACTANTE"]) && d.statut === "RECUE";
                                    

                                    const visaTransitions = transitions
                                      .filter(t => t.from.includes(d.statut) && !t.isDecisionFinale && t.isVisa)
                                      .filter(() => !myHasVisa && myOpenRejets.length === 0);

                                    const rejetTransitions = transitions
                                      .filter(t => t.from.includes(d.statut) && !t.isDecisionFinale && t.to === "REJETEE")
                                      .filter(() => !myHasVisa);

                                    const actionItems = [
                                      ...visaTransitions.map((t, idx) => (
                                        <DropdownMenuItem
                                          key={`v-${idx}`}
                                          disabled={actionLoading === d.id}
                                          onClick={() => checkAndHandleVisa(d.id)}
                                        >
                                          <t.icon className="h-4 w-4 mr-2" />
                                          {t.label}
                                        </DropdownMenuItem>
                                      )),
                                      ...rejetTransitions.map((t, idx) => (
                                        <DropdownMenuItem
                                          key={`r-${idx}`}
                                          className="text-destructive focus:text-destructive"
                                          disabled={actionLoading === d.id}
                                          onClick={() => openRejectDialog(d.id)}
                                        >
                                          <t.icon className="h-4 w-4 mr-2" />
                                          {myRoleDecs.some(dec => dec.decision === "REJET_TEMP") ? "Nouveau rejet temporaire" : t.label}
                                        </DropdownMenuItem>
                                      )),
                                    ];

                                    return (
                                      <>
                                        {actionItems.length > 0 && <DropdownMenuSeparator />}
                                        {actionItems}
                                        {canCancel && <DropdownMenuSeparator />}
                                        {canCancel && (
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => { setCancelTargetId(d.id); setCancelOpen(true); }}
                                          >
                                            <XCircle className="h-4 w-4 mr-2" /> Annuler la demande
                                          </DropdownMenuItem>
                                        )}
                                      </>
                                    );
                                  })()}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>




      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { setUploadOpen(v); if (!v) { setUploadMessage(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de document</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez le type" /></SelectTrigger>
                <SelectContent>
                  {(uploadAllowedTypes.length > 0
                    ? ALL_DOCUMENT_TYPES.filter(t => uploadAllowedTypes.includes(t.value))
                    : ALL_DOCUMENT_TYPES
                  ).map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fichier</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            {/* Message field — required if responding to an open REJET_TEMP */}
            {(() => {
              const isRejetResponse = selected && uploadType && (selected.decisions || []).some(
                d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT" && d.documentsDemandes?.includes(uploadType)
              );
              return (
                <div className="space-y-2">
                  <Label>
                    Message {isRejetResponse && <span className="text-destructive">* (réponse à un rejet)</span>}
                  </Label>
                  <Textarea
                    placeholder={isRejetResponse ? "Décrivez les corrections apportées..." : "Message optionnel..."}
                    value={uploadMessage}
                    onChange={(e) => setUploadMessage(e.target.value)}
                    rows={2}
                  />
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

      {/* Message-only response to rejet dialog */}
      <Dialog open={responseOpen} onOpenChange={(v) => { setResponseOpen(v); if (!v) { setResponseDecisionId(null); setResponseMessage(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Répondre au rejet temporaire</DialogTitle>
            <DialogDescription>Envoyez un message de réponse sans upload de document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Saisissez votre réponse..."
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResponseOpen(false); setResponseDecisionId(null); setResponseMessage(""); }}>Annuler</Button>
            <Button onClick={handleRejetTempResponse} disabled={responseSending || !responseMessage.trim()}>
              {responseSending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Envoyer la réponse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Wizard */}
      <CreateDemandeWizard
        open={createOpen || !!editingDemande}
        onOpenChange={(v) => { if (!v) { setCreateOpen(false); setEditingDemande(null); } }}
        onCreated={fetchDemandes}
        editingId={editingDemande?.id ?? null}
        editingDemande={editingDemande}
      />

      {/* Confirm delete brouillon */}
      <Dialog open={deleteTargetId !== null} onOpenChange={(v) => { if (!v) setDeleteTargetId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le brouillon ?</DialogTitle>
            <DialogDescription>
              Cette action est définitive et ne peut pas être annulée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={async () => {
                if (!deleteTargetId) return;
                setDeleteLoading(true);
                try {
                  await demandeCorrectionApi.remove(deleteTargetId);
                  toast({ title: "Brouillon supprimé" });
                  setDeleteTargetId(null);
                  fetchDemandes();
                } catch (e: any) {
                  toast({ title: "Erreur", description: e.message, variant: "destructive" });
                } finally {
                  setDeleteLoading(false);
                }
              }}
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entreprise Detail Dialog */}
      <Dialog open={entrepriseDialogOpen} onOpenChange={setEntrepriseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Informations de l'entreprise</DialogTitle>
          </DialogHeader>
          {entrepriseLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entrepriseDetail ? (
            <div className="space-y-4">
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
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Aucune information disponible</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Motif Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{rejectDecisionFinale ? "Rejet final" : "Rejet temporaire"}</DialogTitle>
            <DialogDescription>
              {rejectDecisionFinale
                ? "Veuillez indiquer le motif du rejet final de cette demande."
                : "Indiquez le motif du rejet et sélectionnez les documents à corriger/compléter."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Saisissez le motif du rejet..."
              value={rejectMotif}
              onChange={(e) => setRejectMotif(e.target.value)}
              rows={3}
            />
            {!rejectDecisionFinale && (
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
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={!rejectMotif.trim() || (!rejectDecisionFinale && rejectDocsDemandes.length === 0)}
              onClick={handleRejectConfirm}
            >
              <XCircle className="h-4 w-4 mr-1" /> Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Offre Corrigée Upload Dialog (DGTCP/DGB) */}
      <Dialog open={offreCorrigeeOpen} onOpenChange={(v) => { setOffreCorrigeeOpen(v); if (!v) { setOffreCorrigeeFile(null); setOffreCorrigeePendingId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload du {uploadBeforeVisa?.label || "document"}</DialogTitle>
            <DialogDescription>
              Vous devez uploader le document « {uploadBeforeVisa?.label || "requis"} » avant de pouvoir apposer votre visa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fichier du {uploadBeforeVisa?.label || "document"}</Label>
              <Input type="file" onChange={(e) => setOffreCorrigeeFile(e.target.files?.[0] || null)} />
            </div>
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

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelOpen} onOpenChange={(v) => { if (!v) { setCancelOpen(false); setCancelTargetId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer l'annulation</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler cette demande de correction ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelTargetId(null); }}>Non, garder</Button>
            <Button variant="destructive" onClick={handleCancelDemande} disabled={cancelLoading}>
              {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Oui, annuler la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adoption Dialog — President uploads lettre */}
      <Dialog open={adoptionOpen} onOpenChange={(v) => { setAdoptionOpen(v); if (!v) { setAdoptionFile(null); setAdoptionTargetId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adopter la demande</DialogTitle>
            <DialogDescription>
              Uploadez la lettre d'adoption avant de confirmer l'adoption de cette demande.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lettre d'adoption <span className="text-destructive">*</span></Label>
              <Input type="file" onChange={(e) => setAdoptionFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdoptionOpen(false); setAdoptionFile(null); setAdoptionTargetId(null); }}>Annuler</Button>
            <Button onClick={handleAdoptWithLetter} disabled={adoptionUploading || !adoptionFile}>
              {adoptionUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Adopter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Demandes;