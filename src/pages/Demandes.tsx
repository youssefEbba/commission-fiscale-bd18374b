import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DemandeStatut,
  DocumentDto, ALL_DOCUMENT_TYPES,
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
  CheckCircle, XCircle, ArrowRight, Filter,
  AlertTriangle, MoreHorizontal, Info,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import CreateDemandeWizard from "@/components/demandes/CreateDemandeWizard";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutDemande, tTypeDocument } from "@/i18n/enums";
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
const TERMINAL_STATUTS: DemandeStatut[] = ["ADOPTEE", "REJETEE", "NOTIFIEE", "ANNULEE"];
const isTerminalStatut = (s?: DemandeStatut) => !!s && TERMINAL_STATUTS.includes(s);

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
    if (normalized.match(/^[A-Za-z]:\//)) {
      return "file:///" + normalized;
    }
    return normalized;
  }
  return "";
}

const Demandes = () => {
  const { user, hasRole } = useAuth();
  const role = user?.role as AppRole;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation(["demandes", "common"]);
  usePageTitle("demandes:list.title");

  const tTransition = (key: string): string => t(`demandes:${key}`);

  const [demandes, setDemandes] = useState<DemandeCorrectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [selected, setSelected] = useState<DemandeCorrectionDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);

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

  const [offreCorrigeeOpen, setOffreCorrigeeOpen] = useState(false);
  const [offreCorrigeeFile, setOffreCorrigeeFile] = useState<File | null>(null);
  const [offreCorrigeeUploading, setOffreCorrigeeUploading] = useState(false);
  const [offreCorrigeePendingId, setOffreCorrigeePendingId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingDemande, setEditingDemande] = useState<DemandeCorrectionDto | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);

  const openEditWizard = async (d: DemandeCorrectionDto) => {
    setLoadingEditId(d.id);
    try {
      const full = await demandeCorrectionApi.getById(d.id);
      setEditingDemande(full);
    } catch (e: any) {
      toast({
        title: t("demandes:toast.error"),
        description: e?.message || t("demandes:toast.load_demande_complete_error"),
        variant: "destructive",
      });
      setEditingDemande(d);
    } finally {
      setLoadingEditId(null);
    }
  };

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectDecisionFinale, setRejectDecisionFinale] = useState(false);
  const [rejectDocsDemandes, setRejectDocsDemandes] = useState<string[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [entrepriseDetail, setEntrepriseDetail] = useState<any | null>(null);
  const [entrepriseLoading, setEntrepriseLoading] = useState(false);
  const [entrepriseDialogOpen, setEntrepriseDialogOpen] = useState(false);
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
        toast({ title: t("demandes:toast.error"), description: t("demandes:toast.load_entreprise_error"), variant: "destructive" });
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
        data = await demandeCorrectionApi.getByDelegue(user.userId);
      } else {
        data = await demandeCorrectionApi.getAll();
      }
      setDemandes(data);
    } catch (e: any) {
      const message = String(e?.message || "");
      const accessDenied = message.includes("Accès refusé") || message.includes("Access Denied");
      toast({
        title: t("demandes:toast.error"),
        description: accessDenied ? t("demandes:toast.permission_denied") : t("demandes:toast.load_demandes_error"),
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

  const handleStatutChange = async (id: number, statut: DemandeStatut, motifRejet?: string, decisionFinale?: boolean) => {
    setActionLoading(id);
    try {
      const updated = await demandeCorrectionApi.updateStatut(id, statut, motifRejet, decisionFinale);
      toast({
        title: t("demandes:toast.success"),
        description: decisionFinale
          ? t("demandes:toast.decision_finale_applied", { statut: tStatutDemande(updated.statut || statut) })
          : statut === "REJETEE"
            ? t("demandes:toast.rejet_saved")
            : t("demandes:toast.visa_applied"),
      });
      fetchDemandes();
      if (selected?.id === id) setSelected(updated);
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // Document à uploader obligatoirement avant le visa, selon le rôle.
  // Le libellé est traduit via `tTypeDocument` (enums.type_document.CREDIT_EXTERIEUR).
  const UPLOAD_BEFORE_VISA: Record<string, { docType: string }> = {
    DGD: { docType: "CREDIT_EXTERIEUR" },
  };
  const uploadBeforeVisa = role ? UPLOAD_BEFORE_VISA[role] : undefined;
  const uploadBeforeVisaLabel = uploadBeforeVisa ? tTypeDocument(uploadBeforeVisa.docType) : undefined;

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
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.doc_uploaded_label", { label: uploadBeforeVisaLabel || t("demandes:dialogs.offre_corrigee.label_fallback") }) });
      setOffreCorrigeeOpen(false);
      setOffreCorrigeeFile(null);
      await handleTempVisa(offreCorrigeePendingId);
      if (selected?.id === offreCorrigeePendingId) {
        const documents = await demandeCorrectionApi.getDocuments(offreCorrigeePendingId);
        setDocs(documents);
      }
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally {
      setOffreCorrigeeUploading(false);
      setOffreCorrigeePendingId(null);
    }
  };

  const handleTempVisa = async (id: number) => {
    setActionLoading(id);
    try {
      await demandeCorrectionApi.postDecision(id, "VISA");
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.visa_temp_applied") });
      fetchDemandes();
      if (selected) {
        const full = await demandeCorrectionApi.getById(id);
        setSelected(full);
      }
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTempReject = async (id: number, motif: string, documentsDemandes?: string[]) => {
    setActionLoading(id);
    try {
      await demandeCorrectionApi.postDecision(id, "REJET_TEMP", motif, documentsDemandes);
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.rejet_temp_saved") });
      fetchDemandes();
      if (selected) {
        const full = await demandeCorrectionApi.getById(id);
        setSelected(full);
      }
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
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

  const handleCancelDemande = async () => {
    if (!cancelTargetId) return;
    setCancelLoading(true);
    try {
      await demandeCorrectionApi.updateStatut(cancelTargetId, "ANNULEE");
      toast({ title: t("demandes:toast.demande_cancelled") });
      setCancelOpen(false);
      setCancelTargetId(null);
      fetchDemandes();
      if (selected?.id === cancelTargetId) setSelected(null);
    } catch (e: any) {
      const msg = e?.message || t("demandes:toast.cancel_error");
      toast({ title: t("demandes:toast.error"), description: msg, variant: "destructive" });
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
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.demande_adopted") });
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
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally {
      setAdoptionUploading(false);
    }
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
      setUploadOpen(false);
      setUploadFile(null);
      setUploadType("");
      setUploadMessage("");
      const documents = await demandeCorrectionApi.getDocuments(selected.id);
      setDocs(documents);
      const full = await demandeCorrectionApi.getById(selected.id);
      setSelected(full);
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRejetTempResponse = async () => {
    if (!responseDecisionId || !responseMessage.trim()) return;
    setResponseSending(true);
    try {
      await demandeCorrectionApi.postRejetTempResponse(responseDecisionId, responseMessage.trim());
      toast({ title: t("demandes:toast.success"), description: t("demandes:toast.response_sent") });
      setResponseOpen(false);
      setResponseDecisionId(null);
      setResponseMessage("");
      if (selected) {
        const full = await demandeCorrectionApi.getById(selected.id);
        setSelected(full);
      }
      fetchDemandes();
    } catch (e: any) {
      toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
    } finally {
      setResponseSending(false);
    }
  };

  const filtered = demandes.filter((d) => {
    if (role === "AUTORITE_CONTRACTANTE" && user?.autoriteContractanteId && d.autoriteContractanteId !== user.autoriteContractanteId) return false;
    if (role === "ENTREPRISE" && user?.entrepriseId && d.entrepriseId !== user.entrepriseId) return false;
    const matchSearch =
      (d.numero || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.autoriteContractanteNom || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.entrepriseRaisonSociale || "").toLowerCase().includes(search.toLowerCase()) ||
      String(d.id).includes(search);
    const matchStatut = filterStatut === "ALL" || d.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const transitions = ROLE_TRANSITIONS[role] || [];
  const pageTitle = t(`demandes:list.page_titles.${role}`, { defaultValue: t("demandes:list.page_titles.default") });

  // All document type values (codes from backend); their labels come from ALL_DOCUMENT_TYPES (FR-only).
  // Per F3a rules, labels coming from backend lists are displayed as-is.
  const STATUT_KEYS: DemandeStatut[] = ["BROUILLON","RECUE","INCOMPLETE","RECEVABLE","EN_EVALUATION","EN_VALIDATION","ADOPTEE","REJETEE","NOTIFIEE","ANNULEE"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {pageTitle}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("demandes:list.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            {hasRole(["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ADMIN_SI"]) && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 me-2" /> {t("demandes:list.new")}
              </Button>
            )}
            <Button variant="outline" onClick={fetchDemandes} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} /> {t("demandes:list.refresh")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("demandes:list.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 me-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("demandes:list.all_statuses")}</SelectItem>
              {STATUT_KEYS.map((k) => (
                <SelectItem key={k} value={k}>{tStatutDemande(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("demandes:columns.numero")}</TableHead>
                    <TableHead>{t("demandes:columns.ac")}</TableHead>
                    <TableHead>{t("demandes:columns.entreprise")}</TableHead>
                    <TableHead>{t("demandes:columns.statut")}</TableHead>
                    <TableHead>{t("demandes:columns.stade")}</TableHead>
                    <TableHead>{t("demandes:columns.date_depot")}</TableHead>
                    <TableHead className="text-end">{t("demandes:columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("demandes:list.empty")}</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.numero || `#${d.id}`}</TableCell>
                        <TableCell className="text-muted-foreground">{d.autoriteContractanteNom || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{d.entrepriseRaisonSociale || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUT_COLORS[d.statut] || ""}`}>
                            {tStatutDemande(d.statut)}
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
                              ? <Badge className="bg-amber-100 text-amber-800 text-xs cursor-pointer">{t("demandes:stade.waiting_dgd_visa")}</Badge>
                              : myHasVisa
                              ? <Badge className="bg-green-100 text-green-800 text-xs cursor-pointer">{t("demandes:stade.visa_applied")}</Badge>
                              : hasRejet && !allRejetsResolved
                              ? <Badge className="bg-red-100 text-red-800 text-xs cursor-pointer">{t("demandes:stade.rejet_in_progress")}</Badge>
                              : allRejetsResolved
                              ? <Badge className="bg-emerald-100 text-emerald-800 text-xs cursor-pointer">{t("demandes:stade.rejets_resolved")}</Badge>
                              : <span className="text-muted-foreground text-xs">—</span>;

                            const allRejets = [
                              ...rejets.map(r => ({
                                role: r.role,
                                motif: r.motifRejet || "—",
                                docs: r.documentsDemandes || [],
                                date: r.dateDecision,
                                status: r.rejetTempStatus,
                              })),
                              ...((d.rejets && (!decs.length)) ? d.rejets.map(r => ({
                                role: "—",
                                motif: r.motifRejet || "—",
                                docs: [] as string[],
                                date: r.dateRejet,
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
                                      {t("demandes:stade.details_title")}
                                    </h4>
                                  </div>
                                  <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                                    {decs.filter(dec => dec.decision === "VISA").map((v, i) => (
                                      <div key={`v-${i}`} className="flex items-center gap-2 text-xs rounded border border-green-200 bg-green-50 p-2">
                                        <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                        <div>
                                          <span className="font-medium">{v.role}</span> — {t("demandes:stade.visa_applied")}
                                          {v.dateDecision && <span className="text-muted-foreground ms-1">({formatDate(v.dateDecision)})</span>}
                                        </div>
                                      </div>
                                    ))}
                                    {allRejets.length > 0 ? allRejets.map((r, i) => (
                                      <div key={`r-${i}`} className="rounded border border-red-200 bg-red-50 p-2 text-xs space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                                          <span className="font-medium">{r.role}</span>
                                          {r.status && (
                                            <Badge className={`text-[9px] ${r.status === "OUVERT" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                                              {r.status === "OUVERT" ? t("demandes:stade.rejet_open") : t("demandes:stade.rejet_resolved")}
                                            </Badge>
                                          )}
                                          {r.date && <span className="text-muted-foreground ms-auto text-[10px]">{formatDate(r.date)}</span>}
                                        </div>
                                        <p className="text-muted-foreground ms-5">{r.motif}</p>
                                        {r.docs.length > 0 && (
                                          <div className="ms-5 space-y-1">
                                            <span className="text-[10px] text-muted-foreground">{t("demandes:stade.docs_requis")}</span>
                                            <div className="flex flex-wrap gap-1">
                                              {r.docs.map(dt => (
                                                <Badge key={dt} variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                                  {tTypeDocument(dt)}
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
                                                    onClick={() => navigate(`/dashboard/demandes/${d.id}`)}
                                                  >
                                                    <Upload className="h-3 w-3 me-1" />
                                                    {tTypeDocument(dt)}
                                                  </Button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )) : (
                                      <p className="text-xs text-muted-foreground text-center py-2">{t("demandes:stade.no_rejet")}</p>
                                    )}
                                    {blocked && (
                                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                        {t("demandes:stade.dgd_first")}
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {d.dateDepot ? formatDate(d.dateDepot) : "—"}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex gap-1 justify-end items-center">
                            {role === "DGD" && !isTerminalStatut(d.statut) ? (
                              <Button size="sm" onClick={() => navigate(`/dashboard/correction-douaniere/${d.id}`)}>
                                <ArrowRight className="h-4 w-4 me-1 rtl:rotate-180" /> {t("demandes:actions.correction_douaniere")}
                              </Button>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t("demandes:actions.more")}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => navigate(`/dashboard/demandes/${d.id}`)}>
                                    <Eye className="h-4 w-4 me-2" /> {t("demandes:actions.view")}
                                  </DropdownMenuItem>
                                  {d.statut === "BROUILLON" && hasRole(["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "ADMIN_SI"]) && (
                                    <>
                                      <DropdownMenuItem disabled={loadingEditId === d.id} onClick={() => openEditWizard(d)}>
                                        {loadingEditId === d.id ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <FileText className="h-4 w-4 me-2" />}
                                        {t("demandes:actions.edit_draft")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={actionLoading === d.id}
                                        onClick={async () => {
                                          setActionLoading(d.id);
                                          try {
                                            await demandeCorrectionApi.soumettre(d.id);
                                            toast({ title: t("demandes:toast.draft_submitted_title"), description: t("demandes:toast.draft_submitted_desc") });
                                            fetchDemandes();
                                          } catch (e: any) {
                                            toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
                                          } finally { setActionLoading(null); }
                                        }}
                                      >
                                        <CheckCircle className="h-4 w-4 me-2" /> {t("demandes:actions.submit")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTargetId(d.id)}>
                                        <XCircle className="h-4 w-4 me-2" /> {t("demandes:actions.delete")}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  {hasRole(["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "ADMIN_SI"]) && d.statut === "RECUE" && (
                                    <DropdownMenuItem disabled={loadingEditId === d.id} onClick={() => openEditWizard(d)}>
                                      {loadingEditId === d.id ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <FileText className="h-4 w-4 me-2" />}
                                      {t("demandes:actions.edit")}
                                    </DropdownMenuItem>
                                  )}
                                  {(() => {
                                    const myRoleDecs = (d.decisions || []).filter(dec => dec.role === role);
                                    const myHasVisa = myRoleDecs.some(dec => dec.decision === "VISA");
                                    const myOpenRejets = myRoleDecs.filter(dec => dec.decision === "REJET_TEMP" && dec.rejetTempStatus !== "RESOLU");
                                    const canCancel = hasRole(["AUTORITE_CONTRACTANTE"]) && d.statut === "RECUE";

                                    const visaTransitions = transitions
                                      .filter(tr => tr.from.includes(d.statut) && !tr.isDecisionFinale && tr.isVisa)
                                      .filter(() => !myHasVisa && myOpenRejets.length === 0 && !isTerminalStatut(d.statut));

                                    const rejetTransitions = transitions
                                      .filter(tr => tr.from.includes(d.statut) && !tr.isDecisionFinale && tr.to === "REJETEE")
                                      .filter(() => !myHasVisa && !isTerminalStatut(d.statut));

                                    const actionItems = [
                                      ...visaTransitions.map((tr, idx) => (
                                        <DropdownMenuItem key={`v-${idx}`} disabled={actionLoading === d.id} onClick={() => checkAndHandleVisa(d.id)}>
                                          <tr.icon className="h-4 w-4 me-2" />
                                          {tTransition(tr.labelKey)}
                                        </DropdownMenuItem>
                                      )),
                                      ...rejetTransitions.map((tr, idx) => (
                                        <DropdownMenuItem
                                          key={`r-${idx}`}
                                          className="text-destructive focus:text-destructive"
                                          disabled={actionLoading === d.id}
                                          onClick={() => openRejectDialog(d.id)}
                                        >
                                          <tr.icon className="h-4 w-4 me-2" />
                                          {myRoleDecs.some(dec => dec.decision === "REJET_TEMP") ? t("demandes:actions.new_rejet_temp") : tTransition(tr.labelKey)}
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
                                            <XCircle className="h-4 w-4 me-2" /> {t("demandes:actions.cancel_demande")}
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
      <Dialog open={uploadOpen} onOpenChange={(v) => { setUploadOpen(v); if (!v) setUploadMessage(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("demandes:dialogs.upload.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("demandes:dialogs.upload.type_label")}</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue placeholder={t("demandes:dialogs.upload.type_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {(uploadAllowedTypes.length > 0
                    ? ALL_DOCUMENT_TYPES.filter(tt => uploadAllowedTypes.includes(tt.value))
                    : ALL_DOCUMENT_TYPES
                  ).map((tt) => (
                    <SelectItem key={tt.value} value={tt.value}>{tTypeDocument(tt.value)}</SelectItem>
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
                  <Label>
                    {t("demandes:dialogs.upload.message_label")} {isRejetResponse && <span className="text-destructive">{t("demandes:dialogs.upload.message_required_hint")}</span>}
                  </Label>
                  <Textarea
                    placeholder={isRejetResponse ? t("demandes:dialogs.upload.message_placeholder_rejet") : t("demandes:dialogs.upload.message_placeholder_default")}
                    value={uploadMessage}
                    onChange={(e) => setUploadMessage(e.target.value)}
                    rows={2}
                  />
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
            <DialogDescription>{t("demandes:dialogs.rejet_response.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={t("demandes:dialogs.rejet_response.placeholder")}
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResponseOpen(false); setResponseDecisionId(null); setResponseMessage(""); }}>{t("demandes:dialogs.rejet_response.cancel")}</Button>
            <Button onClick={handleRejetTempResponse} disabled={responseSending || !responseMessage.trim()}>
              {responseSending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {t("demandes:dialogs.rejet_response.send")}
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
            <DialogTitle>{t("demandes:dialogs.delete_brouillon.title")}</DialogTitle>
            <DialogDescription>{t("demandes:dialogs.delete_brouillon.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>{t("demandes:dialogs.delete_brouillon.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={async () => {
                if (!deleteTargetId) return;
                setDeleteLoading(true);
                try {
                  await demandeCorrectionApi.remove(deleteTargetId);
                  toast({ title: t("demandes:toast.draft_deleted") });
                  setDeleteTargetId(null);
                  fetchDemandes();
                } catch (e: any) {
                  toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
                } finally {
                  setDeleteLoading(false);
                }
              }}
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {t("demandes:dialogs.delete_brouillon.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entreprise Detail Dialog */}
      <Dialog open={entrepriseDialogOpen} onOpenChange={setEntrepriseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("demandes:dialogs.entreprise_info.title")}</DialogTitle>
          </DialogHeader>
          {entrepriseLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entrepriseDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground text-xs">{t("demandes:dialogs.entreprise_info.raison_sociale")}</span>
                  <p className="font-medium">{entrepriseDetail.raisonSociale || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground text-xs">{t("demandes:dialogs.entreprise_info.nif")}</span>
                  <p className="font-medium">{entrepriseDetail.nif || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground text-xs">{t("demandes:dialogs.entreprise_info.adresse")}</span>
                  <p className="font-medium">{entrepriseDetail.adresse || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground text-xs">{t("demandes:dialogs.entreprise_info.situation_fiscale")}</span>
                  <p>
                    <Badge className={entrepriseDetail.situationFiscale === "REGULIERE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                      {entrepriseDetail.situationFiscale || "—"}
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">{t("demandes:dialogs.entreprise_info.empty")}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Motif Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{rejectDecisionFinale ? t("demandes:dialogs.reject.title_final") : t("demandes:dialogs.reject.title_temp")}</DialogTitle>
            <DialogDescription>
              {rejectDecisionFinale ? t("demandes:dialogs.reject.description_final") : t("demandes:dialogs.reject.description_temp")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={t("demandes:dialogs.reject.motif_placeholder")}
              value={rejectMotif}
              onChange={(e) => setRejectMotif(e.target.value)}
              rows={3}
            />
            {!rejectDecisionFinale && (
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t("demandes:dialogs.reject.docs_label")} <span className="text-destructive">*</span>
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
                      <span>{tTypeDocument(dt.value)}</span>
                    </label>
                  ))}
                </div>
                {rejectDocsDemandes.length === 0 && (
                  <p className="text-xs text-destructive mt-1">{t("demandes:dialogs.reject.select_at_least_one")}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("demandes:dialogs.reject.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={!rejectMotif.trim() || (!rejectDecisionFinale && rejectDocsDemandes.length === 0)}
              onClick={handleRejectConfirm}
            >
              <XCircle className="h-4 w-4 me-1" /> {t("demandes:dialogs.reject.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offre Corrigée Upload Dialog */}
      <Dialog open={offreCorrigeeOpen} onOpenChange={(v) => { setOffreCorrigeeOpen(v); if (!v) { setOffreCorrigeeFile(null); setOffreCorrigeePendingId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("demandes:dialogs.offre_corrigee.title", { label: uploadBeforeVisa?.label || t("demandes:dialogs.offre_corrigee.label_fallback") })}</DialogTitle>
            <DialogDescription>
              {t("demandes:dialogs.offre_corrigee.description", { label: uploadBeforeVisa?.label || t("demandes:dialogs.offre_corrigee.label_required_fallback") })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("demandes:dialogs.offre_corrigee.file_label", { label: uploadBeforeVisa?.label || t("demandes:dialogs.offre_corrigee.label_fallback") })}</Label>
              <Input type="file" onChange={(e) => setOffreCorrigeeFile(e.target.files?.[0] || null)} />
            </div>
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

      {/* Cancel confirmation */}
      <Dialog open={cancelOpen} onOpenChange={(v) => { if (!v) { setCancelOpen(false); setCancelTargetId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("demandes:dialogs.cancel.title")}</DialogTitle>
            <DialogDescription>{t("demandes:dialogs.cancel.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelTargetId(null); }}>{t("demandes:dialogs.cancel.keep")}</Button>
            <Button variant="destructive" onClick={handleCancelDemande} disabled={cancelLoading}>
              {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <XCircle className="h-4 w-4 me-1" />}
              {t("demandes:dialogs.cancel.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adoption Dialog */}
      <Dialog open={adoptionOpen} onOpenChange={(v) => { setAdoptionOpen(v); if (!v) { setAdoptionFile(null); setAdoptionTargetId(null); } }}>
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
            <Button variant="outline" onClick={() => { setAdoptionOpen(false); setAdoptionFile(null); setAdoptionTargetId(null); }}>{t("demandes:dialogs.adoption.cancel")}</Button>
            <Button onClick={handleAdoptWithLetter} disabled={adoptionUploading || !adoptionFile}>
              {adoptionUploading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <CheckCircle className="h-4 w-4 me-1" />}
              {t("demandes:dialogs.adoption.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Demandes;
