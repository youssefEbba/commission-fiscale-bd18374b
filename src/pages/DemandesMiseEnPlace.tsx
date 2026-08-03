import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  certificatCreditApi, CertificatCreditDto, CertificatStatut,
  CreateCertificatCreditRequest,
  demandeCorrectionApi, DemandeCorrectionDto,
  documentRequirementApi, DocumentRequirementDto,
  DocumentDto, entrepriseApi, EntrepriseDto, marcheApi, MarcheDto,
  DecisionCorrectionDto, isApiError,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Award, Search, RefreshCw, Eye, Loader2, Filter, Plus, Upload, FileText, CheckCircle, Info, XCircle, AlertTriangle, History, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { API_BASE } from "@/lib/apiConfig";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutCertificat, tTypeDocument } from "@/i18n/enums";
import { formatDate, formatAmount } from "@/i18n/format";
import { displayRef } from "@/lib/displayRef";

// Couleurs de badge par statut — décoratives, conservées en dur (cohérence UI cross-module).
const STATUT_COLORS: Record<CertificatStatut, string> = {
  BROUILLON: "bg-slate-100 text-slate-700",
  ENVOYEE: "bg-sky-100 text-sky-800",
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_CONTROLE: "bg-teal-100 text-teal-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION_DGI: "bg-indigo-100 text-indigo-800",
  EN_VALIDATION_PRESIDENT: "bg-purple-100 text-purple-800",
  VALIDE_PRESIDENT: "bg-violet-100 text-violet-800",
  EN_OUVERTURE_DGTCP: "bg-yellow-100 text-yellow-800",
  OUVERT: "bg-emerald-100 text-emerald-800",
  MODIFIE: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

// Types de documents demandables en rejet temporaire pour la mise en place (P4).
// Valeurs brutes alignées sur l'enum TypeDocument backend ; libellés traduits via tTypeDocument().
const MISE_EN_PLACE_DOC_TYPES = [
  "LETTRE_SAISINE",
  "CONTRAT",
  "LETTRE_NOTIFICATION_CONTRAT",
  "CERTIFICAT_NIF",
  "LETTRE_CORRECTION",
];

const DECISION_ROLES_LIST = ["DGI", "DGTCP", "DGB", "DGD", "PRESIDENT"];

function describeApiError(e: unknown, fallback: string, dupMsg: string): string {
  if (isApiError(e)) {
    if (e.status === 409 || e.code === "CONFLICT") {
      return e.message || dupMsg;
    }
    return e.message || fallback;
  }
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

function getDocFileUrl(doc: DocumentDto): string {
  if (!doc.chemin) return "#";
  if (doc.chemin.startsWith("http")) return doc.chemin;
  return `${API_BASE}/documents/download/${doc.id}`;
}

const DemandesMiseEnPlace = () => {
  const { t } = useTranslation(["mise_en_place", "common", "enums"]);
  usePageTitle("mise_en_place:list.title");

  const { user, hasPermission } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const navigate = useNavigate();

  const [annulTarget, setAnnulTarget] = useState<CertificatCreditDto | null>(null);
  const [annulMotif, setAnnulMotif] = useState("");
  const [annulLoading, setAnnulLoading] = useState(false);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [visaConfirmOpen, setVisaConfirmOpen] = useState(false);
  const [visaConfirmId, setVisaConfirmId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<CertificatCreditDto | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [selected, setSelected] = useState<CertificatCreditDto | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingBrouillon, setSavingBrouillon] = useState(false);
  const [editingBrouillon, setEditingBrouillon] = useState<CertificatCreditDto | null>(null);
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingExistingDocs, setEditingExistingDocs] = useState<DocumentDto[]>([]);
  const [loadingExistingDocs, setLoadingExistingDocs] = useState(false);
  const [corrections, setCorrections] = useState<DemandeCorrectionDto[]>([]);
  const [docRequirements, setDocRequirements] = useState<DocumentRequirementDto[]>([]);
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string>("");
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [marcheForm, setMarcheForm] = useState<{ numeroMarche?: string; intitule?: string; dateSignature?: string; montantContratHt?: number }>({});
  const [creatingMarche, setCreatingMarche] = useState(false);
  /** Date du jour (YYYY-MM-DD) — borne max pour la date de signature. */
  const todayIso = () => new Date().toISOString().slice(0, 10);


  const [detailDocs, setDetailDocs] = useState<DocumentDto[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [correctionCache, setCorrectionCache] = useState<Record<number, DemandeCorrectionDto>>({});
  const [marcheCache, setMarcheCache] = useState<Record<number, MarcheDto>>({});
  const [entrepriseCache, setEntrepriseCache] = useState<Record<number, EntrepriseDto>>({});

  const [infoModal, setInfoModal] = useState<{ type: "entreprise" | "correction" | "marche"; id: number } | null>(null);

  const [showReject, setShowReject] = useState<CertificatCreditDto | null>(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [showRejetTemp, setShowRejetTemp] = useState<CertificatCreditDto | null>(null);
  const [rejetTempMotif, setRejetTempMotif] = useState("");
  const [rejetTempDocs, setRejetTempDocs] = useState<string[]>([]);
  const [rejetTempLoading, setRejetTempLoading] = useState(false);

  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [activeOrg, setActiveOrg] = useState("DGI");
  const [visaLoading, setVisaLoading] = useState(false);

  const tErr = (e: unknown, fallback: string) =>
    describeApiError(e, fallback, t("mise_en_place:toast.duplicate_active"));

  const okToast = (description: string) =>
    toast({ title: t("common:states.success"), description });
  const errToast = (description: string) =>
    toast({ title: t("common:states.error"), description, variant: "destructive" });

  const fetchCertificats = async () => {
    setLoading(true);
    try {
      let data: CertificatCreditDto[];
      if (role === "ENTREPRISE" && user?.entrepriseId) {
        data = await certificatCreditApi.getByEntreprise(user.entrepriseId);
      } else {
        data = await certificatCreditApi.getAll();
      }
      setCertificats(data);

      const corrIds = [...new Set(data.map(c => c.demandeCorrectionId).filter(Boolean))] as number[];
      const marcheIds = [...new Set(data.map(c => c.marcheId).filter(Boolean))] as number[];
      const entIds = [...new Set(data.map(c => c.entrepriseId).filter(Boolean))] as number[];

      const [corrResults, marcheResults, entResults] = await Promise.all([
        Promise.all(corrIds.map(id => demandeCorrectionApi.getById(id).then(r => ({ id, data: r })).catch(() => null))),
        Promise.all(marcheIds.map(id => marcheApi.getById(id).then(r => ({ id, data: r })).catch(() => null))),
        Promise.all(entIds.map(id => entrepriseApi.getById(id).then(r => ({ id, data: r })).catch(() => null))),
      ]);

      setCorrectionCache(Object.fromEntries(corrResults.filter(Boolean).map(r => [r!.id, r!.data])));
      setMarcheCache(Object.fromEntries(marcheResults.filter(Boolean).map(r => [r!.id, r!.data])));
      setEntrepriseCache(Object.fromEntries(entResults.filter(Boolean).map(r => [r!.id, r!.data])));
    } catch {
      errToast(t("mise_en_place:list.load_error"));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCertificats(); }, []);

  const [openingCreate, setOpeningCreate] = useState(false);

  const openCreateDialog = async () => {
    if (openingCreate) return;
    setOpeningCreate(true);
    setSelectedCorrectionId("");
    setDocFiles({});
    setMarcheForm({});

    try {
      const [corrs, reqs] = await Promise.all([
        user?.autoriteContractanteId
          ? demandeCorrectionApi.getByAutorite(user.autoriteContractanteId)
          : demandeCorrectionApi.getAll(),
        documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI"),
      ]);
      setCorrections(corrs.filter(c => c.statut === "NOTIFIEE" || c.statut === "ADOPTEE"));
      setDocRequirements(reqs);
      setShowCreate(true);
    } catch {
      toast({ title: t("common:states.error"), description: t("mise_en_place:dialogs.create.load_error"), variant: "destructive" });
    } finally {
      setOpeningCreate(false);
    }
  };

  /** Crée le marché directement depuis la popup et le rattache à la correction sélectionnée. */
  const handleCreateMarcheInline = async () => {
    const correction = corrections.find(c => c.id === Number(selectedCorrectionId));
    if (!correction) return;
    if (!marcheForm.numeroMarche?.trim()) {
      errToast(t("mise_en_place:dialogs.create.marche_numero_required"));
      return;
    }
    if (!marcheForm.dateSignature) {
      errToast(t("mise_en_place:dialogs.create.marche_date_required"));
      return;
    }
    if (marcheForm.dateSignature > todayIso()) {
      errToast(t("mise_en_place:dialogs.create.marche_date_future"));
      return;
    }
    setCreatingMarche(true);
    try {
      const created = await marcheApi.create({
        conventionId: correction.conventionId || undefined,
        demandeCorrectionId: correction.id,
        numeroMarche: marcheForm.numeroMarche.trim(),
        intitule: correction.intituleMarche?.trim() || undefined,
        dateSignature: `${marcheForm.dateSignature}T00:00:00Z`,
        montantContratHt: marcheForm.montantContratHt,
        statut: "EN_COURS",
      });
      setCorrections(prev => prev.map(c => (c.id === correction.id ? { ...c, marcheId: created.id } : c)));
      setMarcheForm({});
      okToast(t("mise_en_place:dialogs.create.marche_created"));
    } catch (e) {
      errToast(tErr(e, t("mise_en_place:dialogs.create.marche_create_error")));
    } finally {
      setCreatingMarche(false);
    }
  };



  /** Clé stable d'une exigence documentaire — évite que plusieurs lignes sans `typeDocument`
   *  partagent la même clé `undefined` dans `docFiles` (sinon un fichier remplit toutes les lignes). */
  const reqKey = (req: { id?: number | string; typeDocument?: string | null; codeDocument?: string | null }) =>
    req.codeDocument || req.typeDocument || `req-${req.id ?? "anon"}`;

  const uploadDocsFor = async (certId: number) => {
    if (Object.keys(docFiles).length === 0) return;
    setUploadingDocs(true);
    const failures: string[] = [];
    for (const [type, file] of Object.entries(docFiles)) {
      try {
        await certificatCreditApi.uploadDocument(certId, type, file);
      } catch {
        failures.push(type);
      }
    }
    setUploadingDocs(false);
    if (failures.length > 0) {
      errToast(t("mise_en_place:toast.upload_failures", { list: failures.map(tTypeDocument).join(", ") }));
    }
  };

  const handleCreate = async (asBrouillon: boolean) => {
    if (!selectedCorrectionId) {
      errToast(t("mise_en_place:dialogs.create.no_correction_selected"));
      return;
    }
    const correction = corrections.find(c => c.id === Number(selectedCorrectionId));
    if (!correction?.entrepriseId) {
      errToast(t("mise_en_place:dialogs.create.no_entreprise"));
      return;
    }

    if (asBrouillon) setSavingBrouillon(true); else setCreating(true);
    try {
      const request: CreateCertificatCreditRequest = {
        entrepriseId: correction.entrepriseId,
        demandeCorrectionId: Number(selectedCorrectionId),
        brouillon: asBrouillon,
      };
      const created = await certificatCreditApi.create(request);

      await uploadDocsFor(created.id);

      if (!asBrouillon) {
        try {
          await certificatCreditApi.soumettre(created.id);
        } catch {
          // si la soumission échoue, le brouillon reste créé
        }
      }

      okToast(asBrouillon ? t("mise_en_place:toast.draft_saved") : t("mise_en_place:toast.submitted_to_control"));
      setShowCreate(false);
      fetchCertificats();
    } catch (e: unknown) {
      errToast(tErr(e, t("mise_en_place:dialogs.create.create_error")));
    } finally {
      setCreating(false);
      setSavingBrouillon(false);
    }
  };

  const openEditBrouillon = async (c: CertificatCreditDto) => {
    setEditingBrouillon(c);
    setSelectedCorrectionId(c.demandeCorrectionId ? String(c.demandeCorrectionId) : "");
    setDocFiles({});
    setEditingExistingDocs([]);
    setLoadingExistingDocs(true);
    try {
      const [corrs, reqs, existingDocs] = await Promise.all([
        user?.autoriteContractanteId
          ? demandeCorrectionApi.getByAutorite(user.autoriteContractanteId)
          : demandeCorrectionApi.getAll(),
        documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI"),
        certificatCreditApi.getDocuments(c.id).catch(() => [] as DocumentDto[]),
      ]);
      setCorrections(corrs.filter(co => co.statut === "NOTIFIEE" || co.statut === "ADOPTEE" || co.id === c.demandeCorrectionId));
      setDocRequirements(reqs);
      setEditingExistingDocs(existingDocs);
    } catch {
      errToast(t("mise_en_place:dialogs.create.load_error"));
    } finally {
      setLoadingExistingDocs(false);
    }
  };

  const handleUpdateBrouillon = async (alsoSubmit: boolean) => {
    if (!editingBrouillon || !selectedCorrectionId) return;
    const correction = corrections.find(c => c.id === Number(selectedCorrectionId));
    if (!correction?.entrepriseId) {
      errToast(t("mise_en_place:dialogs.create.no_entreprise"));
      return;
    }
    const wasBrouillon = editingBrouillon.statut === "BROUILLON";
    setEditingLoading(true);
    try {
      await certificatCreditApi.update(editingBrouillon.id, {
        entrepriseId: correction.entrepriseId,
        demandeCorrectionId: Number(selectedCorrectionId),
        brouillon: wasBrouillon,
      });
      await uploadDocsFor(editingBrouillon.id);
      if (alsoSubmit && wasBrouillon) {
        await certificatCreditApi.soumettre(editingBrouillon.id);
      }
      okToast(alsoSubmit && wasBrouillon ? t("mise_en_place:toast.draft_submitted_short") : t("mise_en_place:toast.updated"));
      setEditingBrouillon(null);
      fetchCertificats();
    } catch (e: unknown) {
      errToast(tErr(e, t("mise_en_place:dialogs.edit.update_error")));
    } finally {
      setEditingLoading(false);
    }
  };

  const handlePrendreEnCharge = async (id: number) => {
    setActionLoading(id);
    try {
      await certificatCreditApi.prendreEnCharge(id);
      okToast(t("mise_en_place:toast.taken_charge"));
      fetchCertificats();
    } catch (e: unknown) {
      errToast(tErr(e, t("mise_en_place:toast.taken_charge")));
    } finally { setActionLoading(null); }
  };

  const handleSoumettreBrouillon = async (id: number) => {
    setSubmittingId(id);
    try {
      await certificatCreditApi.soumettre(id);
      okToast(t("mise_en_place:toast.submitted_envoyee_to_encontrole"));
      fetchCertificats();
    } catch (e: unknown) {
      errToast(tErr(e, t("mise_en_place:toast.submitted_envoyee_to_encontrole")));
    } finally { setSubmittingId(null); }
  };

  const confirmVisa = async () => {
    if (visaConfirmId == null) return;
    setVisaLoading(true);
    try {
      await certificatCreditApi.postDecision(visaConfirmId, "VISA");
      okToast(t("mise_en_place:toast.visa_apposed"));
      if (selected && selected.id === visaConfirmId) openDetail(selected);
      fetchCertificats();
    } catch (e: unknown) {
      errToast(tErr(e, t("mise_en_place:toast.visa_apposed")));
    } finally { setVisaLoading(false); setVisaConfirmOpen(false); }
  };

  const handleDeleteBrouillon = async () => {
    if (!deletingTarget) return;
    setDeletingLoading(true);
    try {
      await certificatCreditApi.remove(deletingTarget.id);
      okToast(t("mise_en_place:toast.draft_deleted"));
      setDeletingTarget(null);
      fetchCertificats();
    } catch (e: unknown) {
      errToast(tErr(e, t("mise_en_place:toast.draft_deleted")));
    } finally { setDeletingLoading(false); }
  };

  const handleReject = async () => {
    if (!showReject || !motifRejet.trim()) return;
    setRejecting(true);
    try {
      await certificatCreditApi.reject(showReject.id, motifRejet.trim());
      okToast(t("mise_en_place:toast.rejected"));
      setShowReject(null);
      setMotifRejet("");
      fetchCertificats();
    } catch (e: unknown) {
      errToast(tErr(e, t("mise_en_place:toast.rejected")));
    } finally { setRejecting(false); }
  };

  const handleRejetTemp = async () => {
    if (!showRejetTemp || !rejetTempMotif.trim() || rejetTempDocs.length === 0) return;
    setRejetTempLoading(true);
    try {
      await certificatCreditApi.postDecision(showRejetTemp.id, "REJET_TEMP", rejetTempMotif.trim(), rejetTempDocs);
      okToast(t("mise_en_place:toast.rejet_temp_sent"));
      setShowRejetTemp(null);
      setRejetTempMotif("");
      setRejetTempDocs([]);
      fetchCertificats();
    } catch (e: unknown) {
      errToast(tErr(e, t("mise_en_place:toast.rejet_temp_sent")));
    } finally { setRejetTempLoading(false); }
  };

  const openDetail = async (c: CertificatCreditDto) => {
    setSelected(c);
    setDetailDocs([]);
    setDecisions([]);
    setLoadingDocs(true);
    try {
      const [docsRes, decisionsRes] = await Promise.all([
        certificatCreditApi.getDocuments(c.id),
        certificatCreditApi.getDecisions(c.id).catch(() => []),
      ]);
      setDetailDocs(docsRes);
      setDecisions(decisionsRes);
    } catch { /* ignore */ }
    setLoadingDocs(false);
  };

  // Une mise en place "ouverte" (OUVERT/MODIFIE/CLOTURE) bascule dans le module Certificats
  const HIDDEN_STATUTS: CertificatStatut[] = ["OUVERT", "MODIFIE", "CLOTURE"];
  const filtered = certificats.filter((c) => {
    if (HIDDEN_STATUTS.includes(c.statut)) return false;
    const s = search.toLowerCase();
    const ms = (c.reference || "").toLowerCase().includes(s) ||
      (c.entrepriseNom || "").toLowerCase().includes(s) ||
      String(c.id).includes(search);
    return ms && (filterStatut === "ALL" || c.statut === filterStatut);
  });

  const getEntrepriseName = (c: CertificatCreditDto) => c.entrepriseNom || (c.entrepriseId && entrepriseCache[c.entrepriseId]?.raisonSociale) || "—";
  const getCorrectionName = (c: CertificatCreditDto) => (c.demandeCorrectionId && correctionCache[c.demandeCorrectionId] ? displayRef(correctionCache[c.demandeCorrectionId]) : c.demandeCorrectionNumero) || "—";
  const getMarcheName = (c: CertificatCreditDto) => c.marcheIntitule || (c.marcheId && (marcheCache[c.marcheId]?.intitule || marcheCache[c.marcheId]?.numeroMarche)) || "—";

  const selectedCorrection = corrections.find(c => c.id === Number(selectedCorrectionId));
  const canCreate = role === "AUTORITE_CONTRACTANTE" || role === "ENTREPRISE";

  const lockedCorrectionIds = new Set<number>(
    certificats.filter(c => c.statut !== "ANNULE" && c.demandeCorrectionId).map(c => c.demandeCorrectionId as number)
  );
  const editingOwnCorrectionId = editingBrouillon?.demandeCorrectionId ?? null;

  // Toutes les valeurs CertificatStatut connues (pour le filtre — labels via tStatutCertificat)
  const STATUT_FILTER_OPTIONS: CertificatStatut[] = [
    "BROUILLON", "ENVOYEE", "DEMANDE", "EN_CONTROLE", "INCOMPLETE", "A_RECONTROLER",
    "EN_VERIFICATION_DGI", "EN_VALIDATION_PRESIDENT", "VALIDE_PRESIDENT",
    "EN_OUVERTURE_DGTCP", "OUVERT", "MODIFIE", "CLOTURE", "ANNULE",
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              {t("mise_en_place:list.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("mise_en_place:list.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreateDialog} disabled={openingCreate}>
                {openingCreate ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}
                {t("mise_en_place:actions.new")}
              </Button>

            )}
            <Button variant="outline" onClick={fetchCertificats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} /> {t("mise_en_place:actions.refresh")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("mise_en_place:list.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 me-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("mise_en_place:list.filter_all")}</SelectItem>
              {STATUT_FILTER_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{tStatutCertificat(s)}</SelectItem>))}
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
                    <TableHead className="text-start">{t("mise_en_place:list.columns.reference")}</TableHead>
                    <TableHead className="text-start">{t("mise_en_place:list.columns.entreprise")}</TableHead>
                    <TableHead className="text-start">{t("mise_en_place:list.columns.correction")}</TableHead>
                    <TableHead className="text-start">{t("mise_en_place:list.columns.marche")}</TableHead>
                    <TableHead className="text-start">{t("mise_en_place:list.columns.statut")}</TableHead>
                    <TableHead className="text-end">{t("mise_en_place:list.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("mise_en_place:list.empty")}</TableCell></TableRow>
                  ) : filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.reference || `#${c.id}`}</TableCell>
                      <TableCell>{getEntrepriseName(c)}</TableCell>
                      <TableCell>{getCorrectionName(c)}</TableCell>
                      <TableCell>{getMarcheName(c)}</TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[c.statut]}`}>{tStatutCertificat(c.statut)}</Badge></TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end flex-wrap items-center">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/mise-en-place/${c.id}`)}>
                            <Eye className="h-4 w-4 me-1" /> {role === "AUTORITE_CONTRACTANTE" ? t("mise_en_place:list.row_actions.view") : t("mise_en_place:list.row_actions.process")}
                          </Button>
                          {c.statut === "ENVOYEE" && ["DGI", "DGD", "DGTCP"].includes(role as string) && (
                            <Button variant="default" size="sm" disabled={actionLoading === c.id} onClick={() => handlePrendreEnCharge(c.id)}>
                              {actionLoading === c.id ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <CheckCircle className="h-4 w-4 me-1" />}
                              {t("mise_en_place:list.row_actions.take_charge")}
                            </Button>
                          )}
                          {c.statut === "BROUILLON" && (role === "DGTCP" || role === "ADMIN_SI" || role === "ENTREPRISE" || role === "AUTORITE_CONTRACTANTE") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" title={t("mise_en_place:list.row_actions.draft_menu_title")}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditBrouillon(c)}>
                                  <FileText className="h-4 w-4 me-2" /> {t("mise_en_place:list.row_actions.edit_draft")}
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={submittingId === c.id} onClick={() => handleSoumettreBrouillon(c.id)}>
                                  {submittingId === c.id ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Send className="h-4 w-4 me-2" />}
                                  {t("mise_en_place:list.row_actions.submit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingTarget(c)}>
                                  <Trash2 className="h-4 w-4 me-2" /> {t("mise_en_place:list.row_actions.delete_draft")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {c.statut === "ENVOYEE" && (role === "ENTREPRISE" || role === "AUTORITE_CONTRACTANTE" || role === "ADMIN_SI") && (
                            <Button variant="ghost" size="sm" title={t("mise_en_place:list.row_actions.edit")} onClick={() => openEditBrouillon(c)}>
                              <FileText className="h-4 w-4 me-1" /> {t("mise_en_place:list.row_actions.edit")}
                            </Button>
                          )}
                          {hasPermission("mise_en_place.annuler") && !["BROUILLON", "OUVERT", "CLOTURE", "ANNULE"].includes(c.statut) && (
                            <Button variant="ghost" size="sm" title={t("mise_en_place:list.row_actions.cancel_tooltip")} className="text-destructive hover:text-destructive" onClick={() => { setAnnulTarget(c); setAnnulMotif(""); }}>
                              <XCircle className="h-4 w-4 me-1" /> {t("mise_en_place:list.row_actions.cancel")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog (résumé) */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("mise_en_place:dialogs.detail_dialog.title", { ref: selected?.reference || `#${selected?.id}` })}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{t("mise_en_place:detail.info.entreprise")}</span><p className="font-medium">
                  {selected.entrepriseId ? <button className="text-primary underline hover:opacity-80" onClick={() => setInfoModal({ type: "entreprise", id: selected.entrepriseId! })}>{getEntrepriseName(selected)}</button> : "—"}
                </p></div>
                <div><span className="text-muted-foreground">{t("mise_en_place:list.columns.statut")}</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{tStatutCertificat(selected.statut)}</Badge></p></div>
                <div><span className="text-muted-foreground">{t("mise_en_place:detail.info.date")}</span><p>{formatDate(selected.dateCreation)}</p></div>
                <div><span className="text-muted-foreground">{t("mise_en_place:list.columns.correction")}</span><p className="font-medium">
                  {selected.demandeCorrectionId ? <button className="text-primary underline hover:opacity-80" onClick={() => setInfoModal({ type: "correction", id: selected.demandeCorrectionId! })}>{getCorrectionName(selected)}</button> : "—"}
                </p></div>
                <div><span className="text-muted-foreground">{t("mise_en_place:list.columns.marche")}</span><p className="font-medium">
                  {selected.marcheId ? <button className="text-primary underline hover:opacity-80" onClick={() => setInfoModal({ type: "marche", id: selected.marcheId! })}>{getMarcheName(selected)}</button> : "—"}
                </p></div>
              </div>

              {/* Statut par organisme — Tabs */}
              {(() => {
                const decs = decisions;
                const r = activeOrg;
                const roleDecs = decs.filter(d => d.role === r);
                const latestDec = roleDecs.length > 0 ? roleDecs[roleDecs.length - 1] : undefined;
                const allRejets = roleDecs.filter(d => d.decision === "REJET_TEMP");
                const openRejets = allRejets.filter(d => d.rejetTempStatus !== "RESOLU");
                const resolvedRejets = allRejets.filter(d => d.rejetTempStatus === "RESOLU");
                const hasVisa = latestDec?.decision === "VISA";
                const hasRejets = allRejets.length > 0;
                const allResolved = hasRejets && openRejets.length === 0 && resolvedRejets.length > 0;
                const isMyRole = (role as string) === r;
                const cardStyle = hasVisa ? "border-green-300 bg-green-50" : allResolved ? "border-emerald-300 bg-emerald-50" : hasRejets ? "border-red-300 bg-red-50" : "border-border bg-muted/30";

                return (
                  <div className="border-t pt-3">
                    <h4 className="font-semibold mb-2 text-sm">{t("mise_en_place:detail.orgs.title")}</h4>
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
                          <button key={orgRole} onClick={() => setActiveOrg(orgRole)}
                            className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                              isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                            }`}>
                            {orgHasVisa ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : orgAllResolved ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : orgHasRejets ? <XCircle className="h-3.5 w-3.5 text-red-600" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />}
                            <span>{t(`mise_en_place:detail.orgs.labels.${orgRole}`)}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className={`rounded-lg border p-4 min-h-[100px] ${cardStyle}`}>
                      <div className="text-center mb-3">
                        {hasVisa ? <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" /> : allResolved ? <CheckCircle className="h-6 w-6 text-emerald-600 mx-auto mb-1" /> : hasRejets ? <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" /> : <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />}
                        <p className="font-semibold text-sm">{t(`mise_en_place:detail.orgs.labels.${r}`)}</p>
                        {hasVisa && <p className="text-green-700 font-medium text-xs mt-0.5">{t("mise_en_place:detail.orgs.visa_apposed")}</p>}
                        {allResolved && !hasVisa && <p className="text-emerald-700 font-medium text-xs mt-0.5">{t("mise_en_place:detail.orgs.all_resolved")}</p>}
                        {!latestDec && <p className="text-muted-foreground text-xs mt-0.5">{t("mise_en_place:detail.orgs.waiting")}</p>}
                        {hasVisa && latestDec?.dateDecision && <p className="text-muted-foreground text-[10px] mt-0.5">{t("mise_en_place:detail.orgs.on_date", { date: formatDate(latestDec.dateDecision) })}</p>}
                      </div>
                      {openRejets.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-red-700 font-semibold text-xs text-center">{t("mise_en_place:detail.orgs.open_rejets_count", { count: openRejets.length })}</p>
                          {openRejets.map((rej, idx) => (
                            <div key={idx} className="border-s-2 border-red-300 ps-3 py-2 space-y-1 bg-background/50 rounded-e">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium text-red-800 text-xs">{t("mise_en_place:detail.orgs.rejet_label", { n: idx + 1 })}</span>
                                <Badge className="text-[9px] bg-red-100 text-red-700">{t("mise_en_place:detail.orgs.rejet_open")}</Badge>
                                {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{formatDate(rej.dateDecision)}</span>}
                              </div>
                              {rej.motifRejet && <p className="text-muted-foreground italic text-xs">{rej.motifRejet}</p>}
                              {rej.documentsDemandes && rej.documentsDemandes.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  <span className="text-[10px] text-muted-foreground">{t("mise_en_place:detail.orgs.docs_demanded")}</span>
                                  {rej.documentsDemandes.map((dt: string) => (
                                    <Badge key={dt} variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">{tTypeDocument(dt)}</Badge>
                                  ))}
                                </div>
                              )}
                              {rej.role === role && (
                                <Button size="sm" variant="default" className="h-6 text-[10px] px-2 mt-1" disabled={actionLoading === selected.id} onClick={async () => {
                                  setActionLoading(selected.id);
                                  try {
                                    await certificatCreditApi.resolveRejetTemp(rej.id);
                                    okToast(t("mise_en_place:toast.rejet_resolved"));
                                    openDetail(selected);
                                  } catch (e: unknown) {
                                    errToast(tErr(e, t("mise_en_place:toast.rejet_resolved")));
                                  } finally { setActionLoading(null); }
                                }}>
                                  <CheckCircle className="h-3 w-3 me-0.5" /> {t("mise_en_place:detail.orgs.resolve_btn")}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {isMyRole && !["OUVERT", "ANNULE", "CLOTURE"].includes(selected.statut) && (
                        <div className="flex gap-2 mt-3 justify-center">
                          <Button variant="default" size="sm" className="h-7 text-xs" disabled={visaLoading} onClick={() => { setVisaConfirmId(selected.id); setVisaConfirmOpen(true); }}>
                            <CheckCircle className="h-3.5 w-3.5 me-1" /> {t("mise_en_place:actions.visa")}
                          </Button>
                          <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { setShowRejetTemp(selected); setRejetTempMotif(""); setRejetTempDocs([]); }}>
                            <XCircle className="h-3.5 w-3.5 me-1" /> {t("mise_en_place:actions.reject")}
                          </Button>
                        </div>
                      )}
                      {resolvedRejets.length > 0 && (
                        <details className="mt-3 border-t border-border pt-3">
                          <summary className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                            <History className="h-3.5 w-3.5" />
                            {t("mise_en_place:detail.orgs.history_summary", { count: resolvedRejets.length })}
                          </summary>
                          <div className="space-y-2 mt-2">
                            {resolvedRejets.map((rej, idx) => (
                              <div key={idx} className="border-s-2 border-muted ps-3 py-2 space-y-1 bg-muted/30 rounded-e opacity-75">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium text-muted-foreground text-xs">{t("mise_en_place:detail.orgs.rejet_label", { n: idx + 1 })}</span>
                                  <Badge className="text-[9px] bg-green-100 text-green-700">{t("mise_en_place:detail.orgs.rejet_resolved")}</Badge>
                                  {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{formatDate(rej.dateDecision)}</span>}
                                </div>
                                {rej.motifRejet && <p className="text-muted-foreground italic text-xs">{rej.motifRejet}</p>}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Documents */}
              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> {t("mise_en_place:detail.documents.title")}</h4>
                {loadingDocs ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : detailDocs.length === 0 ? (
                  <p className="text-muted-foreground text-xs">{t("mise_en_place:detail.documents.empty")}</p>
                ) : (
                  <div className="space-y-2">
                    {detailDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.nomFichier}</p>
                            <p className="text-xs text-muted-foreground">{tTypeDocument(doc.type)}</p>
                          </div>
                        </div>
                        <a href={getDocFileUrl(doc)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{t("mise_en_place:detail.documents.download")}</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              {t("mise_en_place:dialogs.create.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("mise_en_place:dialogs.create.correction_label")}</Label>
              <SearchableSelect
                value={selectedCorrectionId}
                onValueChange={setSelectedCorrectionId}
                placeholder={t("mise_en_place:dialogs.create.correction_placeholder")}
                searchPlaceholder={t("mise_en_place:dialogs.create.correction_search")}
                emptyMessage={corrections.length === 0 ? t("mise_en_place:dialogs.create.correction_empty_none") : t("mise_en_place:dialogs.create.correction_empty_search")}
                options={corrections.map((c) => {
                  const locked = lockedCorrectionIds.has(c.id);
                  return {
                    value: String(c.id),
                    label: `${displayRef(c)} — ${c.entrepriseRaisonSociale || t("mise_en_place:dialogs.info.entreprise")}${locked ? t("mise_en_place:dialogs.create.locked_suffix") : ""}`,
                    keywords: `${c.reference || ""} ${c.numero || ""} ${c.entrepriseRaisonSociale || ""}`,
                    disabled: locked,
                  };
                })}
              />
              {selectedCorrectionId && lockedCorrectionIds.has(Number(selectedCorrectionId)) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t("mise_en_place:dialogs.create.locked_alert")}
                </p>
              )}
            </div>

            {selectedCorrection && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 text-sm">
                  <p className="font-semibold mb-1">{t("mise_en_place:dialogs.create.selected_title")}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.create.selected_num")}</span> {displayRef(selectedCorrection)}</div>
                    <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.create.selected_entreprise")}</span> {selectedCorrection.entrepriseRaisonSociale}</div>
                    <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.create.selected_statut")}</span> {selectedCorrection.statut}</div>
                    <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.create.selected_ac")}</span> {selectedCorrection.autoriteContractanteNom}{selectedCorrection.autoriteContractanteMinistereTutelleNom ? ` — ${selectedCorrection.autoriteContractanteMinistereTutelleNom}` : ""}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedCorrection && !selectedCorrection.marcheId && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>{t("mise_en_place:dialogs.create.marche_missing")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("mise_en_place:dialogs.create.marche_numero")}</Label>
                    <Input
                      value={marcheForm.numeroMarche || ""}
                      onChange={e => setMarcheForm(f => ({ ...f, numeroMarche: e.target.value }))}
                      placeholder="MARC-2026-001"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("mise_en_place:dialogs.create.marche_date_signature")}</Label>
                    <Input
                      type="date"
                      max={todayIso()}
                      value={marcheForm.dateSignature || ""}
                      onChange={e => setMarcheForm(f => ({ ...f, dateSignature: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">{t("mise_en_place:dialogs.create.marche_intitule")}</Label>
                    <Input value={selectedCorrection.intituleMarche || "—"} readOnly disabled />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">{t("mise_en_place:dialogs.create.marche_montant")}</Label>
                    <Input
                      type="number"
                      value={marcheForm.montantContratHt ?? ""}
                      onChange={e => setMarcheForm(f => ({ ...f, montantContratHt: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <Button size="sm" onClick={handleCreateMarcheInline} disabled={creatingMarche}>
                  {creatingMarche && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                  {t("mise_en_place:dialogs.create.marche_create_link")}
                </Button>
              </div>
            )}



            <div className="space-y-3">
              <Label className="text-base font-semibold">{t("mise_en_place:dialogs.create.docs_title")}</Label>
              {docRequirements.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.create.docs_empty")}</p>
              ) : (
                <div className="space-y-2">
                  {docRequirements.map((req) => {
                    const key = reqKey(req);
                    const label = req.codeDocument || req.typeDocument;
                    const hasFile = !!docFiles[key];
                    return (
                      <div key={req.id ?? key} className="flex items-center gap-3 p-2 rounded border bg-background">
                        <div className="flex-1">
                          <p className="text-sm font-medium flex items-center gap-1">
                            {label ? tTypeDocument(label) : (req.libelle || key)}
                            {req.obligatoire && <span className="text-destructive ms-1">*</span>}
                            {req.description && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                {/* req.description vient du backend (configuration GED), laissé tel quel */}
                                <TooltipContent><p className="max-w-xs text-xs">{req.description}</p></TooltipContent>
                              </Tooltip>
                            )}
                          </p>
                          {hasFile && (
                            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                              <CheckCircle className="h-3 w-3" /> {docFiles[key].name}
                            </p>
                          )}
                        </div>
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setDocFiles(prev => ({ ...prev, [key]: file }));
                            }} />
                          <div className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <Upload className="h-3 w-3" />
                            {hasFile ? t("mise_en_place:dialogs.create.replace_file") : t("mise_en_place:dialogs.create.choose_file")}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="sm:me-auto">{t("mise_en_place:dialogs.create.cancel")}</Button>
            <Button variant="secondary" onClick={() => handleCreate(true)} disabled={creating || savingBrouillon || uploadingDocs || (!!selectedCorrectionId && lockedCorrectionIds.has(Number(selectedCorrectionId)))}>
              {savingBrouillon && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.create.save_draft")}
            </Button>
            <Button onClick={() => handleCreate(false)} disabled={creating || savingBrouillon || uploadingDocs || (!!selectedCorrectionId && lockedCorrectionIds.has(Number(selectedCorrectionId)))}>
              {(creating || (uploadingDocs && !savingBrouillon)) && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Brouillon Dialog */}
      <Dialog open={!!editingBrouillon} onOpenChange={(o) => !o && setEditingBrouillon(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {editingBrouillon?.statut === "BROUILLON"
                ? t("mise_en_place:dialogs.edit.title_draft", { ref: editingBrouillon?.reference || `#${editingBrouillon?.id}` })
                : t("mise_en_place:dialogs.edit.title_demande", { ref: editingBrouillon?.reference || `#${editingBrouillon?.id}` })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("mise_en_place:dialogs.edit.correction_label")}</Label>
              <SearchableSelect
                value={selectedCorrectionId}
                onValueChange={setSelectedCorrectionId}
                placeholder={t("mise_en_place:dialogs.edit.correction_placeholder")}
                searchPlaceholder={t("mise_en_place:dialogs.create.correction_search")}
                emptyMessage={corrections.length === 0 ? t("mise_en_place:dialogs.create.correction_empty_none") : t("mise_en_place:dialogs.create.correction_empty_search")}
                options={corrections.map((c) => {
                  const locked = lockedCorrectionIds.has(c.id) && c.id !== editingOwnCorrectionId;
                  return {
                    value: String(c.id),
                    label: `${displayRef(c)} — ${c.entrepriseRaisonSociale || t("mise_en_place:dialogs.info.entreprise")}${locked ? t("mise_en_place:dialogs.create.locked_suffix") : ""}`,
                    keywords: `${c.reference || ""} ${c.numero || ""} ${c.entrepriseRaisonSociale || ""}`,
                    disabled: locked,
                  };
                })}
              />
            </div>

            {selectedCorrection && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 text-sm">
                  <p className="font-semibold mb-1">{t("mise_en_place:dialogs.create.selected_title")}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.create.selected_num")}</span> {displayRef(selectedCorrection)}</div>
                    <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.create.selected_entreprise")}</span> {selectedCorrection.entrepriseRaisonSociale}</div>
                    <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.create.selected_statut")}</span> {selectedCorrection.statut}</div>
                    <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.create.selected_ac")}</span> {selectedCorrection.autoriteContractanteNom}{selectedCorrection.autoriteContractanteMinistereTutelleNom ? ` — ${selectedCorrection.autoriteContractanteMinistereTutelleNom}` : ""}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              <Label className="text-base font-semibold">{t("mise_en_place:dialogs.edit.existing_docs_title")}</Label>
              {loadingExistingDocs ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> {t("mise_en_place:dialogs.edit.existing_loading")}</p>
              ) : editingExistingDocs.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.edit.existing_empty")}</p>
              ) : (
                <div className="space-y-2">
                  {editingExistingDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded border bg-muted/20">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tTypeDocument(doc.type)}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.nomFichier || doc.chemin || `#${doc.id}`}</p>
                      </div>
                      <a href={getDocFileUrl(doc)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                        <Eye className="h-3 w-3" /> {t("mise_en_place:detail.documents.open")}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">{t("mise_en_place:dialogs.edit.add_replace_title")}</Label>
              {docRequirements.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.edit.no_doc_required")}</p>
              ) : (
                <div className="space-y-2">
                  {docRequirements.map((req) => {
                    const key = reqKey(req);
                    const label = req.codeDocument || req.typeDocument;
                    const hasFile = !!docFiles[key];
                    const existing = editingExistingDocs.find(d => d.type === label);
                    return (
                      <div key={req.id ?? key} className="flex items-center gap-3 p-2 rounded border bg-background">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {label ? tTypeDocument(label) : (req.libelle || key)}
                            {req.obligatoire && <span className="text-destructive ms-1">*</span>}
                          </p>
                          {existing && !hasFile && (
                            <p className="text-xs text-muted-foreground mt-0.5">{t("mise_en_place:dialogs.edit.already_loaded", { name: existing.nomFichier || `#${existing.id}` })}</p>
                          )}
                          {hasFile && (
                            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                              <CheckCircle className="h-3 w-3" /> {docFiles[key].name}
                            </p>
                          )}
                        </div>
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setDocFiles(prev => ({ ...prev, [key]: file }));
                            }} />
                          <div className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <Upload className="h-3 w-3" />
                            {hasFile || existing ? t("mise_en_place:dialogs.create.replace_file") : t("mise_en_place:dialogs.create.choose_file")}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">{t("mise_en_place:dialogs.edit.hint")}</p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setEditingBrouillon(null)} className="sm:me-auto" disabled={editingLoading || uploadingDocs}>{t("mise_en_place:dialogs.create.cancel")}</Button>
            <Button variant="secondary" onClick={() => handleUpdateBrouillon(false)} disabled={editingLoading || uploadingDocs}>
              {editingLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.edit.save")}
            </Button>
            {editingBrouillon?.statut === "BROUILLON" && (
              <Button onClick={() => handleUpdateBrouillon(true)} disabled={editingLoading || uploadingDocs}>
                {editingLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                <Send className="h-4 w-4 me-1" />
                {t("mise_en_place:dialogs.edit.save_submit")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!showReject} onOpenChange={() => setShowReject(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              {t("mise_en_place:dialogs.reject.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("mise_en_place:dialogs.reject.subtitle", { ref: showReject?.reference || `#${showReject?.id}`, entreprise: showReject ? getEntrepriseName(showReject) : "" })}
            </p>
            <div className="space-y-2">
              <Label>{t("mise_en_place:dialogs.reject.motif_label")}</Label>
              <Textarea placeholder={t("mise_en_place:dialogs.reject.motif_placeholder")} value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} className="min-h-[100px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(null)}>{t("mise_en_place:dialogs.reject.cancel")}</Button>
            <Button variant="destructive" disabled={rejecting || !motifRejet.trim()} onClick={handleReject}>
              {rejecting && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.reject.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJET_TEMP Dialog */}
      <Dialog open={!!showRejetTemp} onOpenChange={() => setShowRejetTemp(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("mise_en_place:dialogs.rejet_temp.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("mise_en_place:dialogs.rejet_temp.subtitle", { ref: showRejetTemp?.reference || `#${showRejetTemp?.id}`, entreprise: showRejetTemp ? getEntrepriseName(showRejetTemp) : "" })}
            </p>
            <div className="space-y-2">
              <Label>{t("mise_en_place:dialogs.rejet_temp.motif_label")}</Label>
              <Textarea placeholder={t("mise_en_place:dialogs.rejet_temp.motif_placeholder")} value={rejetTempMotif} onChange={(e) => setRejetTempMotif(e.target.value)} className="min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label>{t("mise_en_place:dialogs.rejet_temp.docs_label")}</Label>
              <p className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.rejet_temp.docs_hint")}</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {MISE_EN_PLACE_DOC_TYPES.map((dt) => (
                  <label key={dt} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={rejetTempDocs.includes(dt)}
                      onCheckedChange={(checked) => {
                        setRejetTempDocs(prev => checked ? [...prev, dt] : prev.filter(d => d !== dt));
                      }}
                    />
                    <span className="text-sm">{tTypeDocument(dt)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejetTemp(null)}>{t("mise_en_place:dialogs.rejet_temp.cancel")}</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" disabled={rejetTempLoading || !rejetTempMotif.trim() || rejetTempDocs.length === 0} onClick={handleRejetTemp}>
              {rejetTempLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.rejet_temp.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Modal */}
      <Dialog open={!!infoModal} onOpenChange={() => setInfoModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {infoModal?.type === "entreprise" && t("mise_en_place:dialogs.info.title_entreprise")}
              {infoModal?.type === "correction" && t("mise_en_place:dialogs.info.title_correction")}
              {infoModal?.type === "marche" && t("mise_en_place:dialogs.info.title_marche")}
            </DialogTitle>
          </DialogHeader>
          {infoModal?.type === "entreprise" && (() => {
            const ent = entrepriseCache[infoModal.id];
            if (!ent) return <p className="text-muted-foreground text-sm">{t("mise_en_place:dialogs.info.loading")}</p>;
            return (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.raison_sociale")}</span><p className="font-medium">{ent.raisonSociale}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.nif")}</span><p className="font-medium">{ent.nif || "—"}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.adresse")}</span><p>{ent.adresse || "—"}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.telephone")}</span><p>{ent.telephone || "—"}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.email")}</span><p>{ent.email || "—"}</p></div>
                  
                </div>
              </div>
            );
          })()}
          {infoModal?.type === "correction" && (() => {
            const corr = correctionCache[infoModal.id];
            if (!corr) return <p className="text-muted-foreground text-sm">{t("mise_en_place:dialogs.info.loading")}</p>;
            return (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.numero")}</span><p className="font-medium">{displayRef(corr)}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.statut")}</span><p className="font-medium">{corr.statut}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.entreprise")}</span><p>{corr.entrepriseRaisonSociale || "—"}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.ac")}</span><p>{corr.autoriteContractanteNom || "—"}</p>{corr.autoriteContractanteMinistereTutelleNom && <p className="text-xs text-muted-foreground">{corr.autoriteContractanteMinistereTutelleNom}</p>}</div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.date_depot")}</span><p>{formatDate(corr.dateDepot)}</p></div>
                  {corr.motifRejet && <div className="col-span-2"><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.motif_rejet")}</span><p className="text-destructive">{corr.motifRejet}</p></div>}
                </div>
              </div>
            );
          })()}
          {infoModal?.type === "marche" && (() => {
            const m = marcheCache[infoModal.id];
            if (!m) return <p className="text-muted-foreground text-sm">{t("mise_en_place:dialogs.info.loading")}</p>;
            // Devise du marché si disponible, sinon MRU par défaut.
            const cur = (m as any).deviseOrigine || "MRU";
            return (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.marche_num")}</span><p className="font-medium">{m.numeroMarche || `#${m.id}`}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.statut")}</span><p className="font-medium">{m.statut}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.date_signature")}</span><p>{formatDate(m.dateSignature)}</p></div>
                  <div><span className="text-muted-foreground">{t("mise_en_place:dialogs.info.montant_ttc")}</span><p>{formatAmount(m.montantContratTtc, { currency: cur })}</p></div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete draft */}
      <AlertDialog open={!!deletingTarget} onOpenChange={(o) => !o && setDeletingTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("mise_en_place:dialogs.delete_draft.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("mise_en_place:dialogs.delete_draft.description", { ref: deletingTarget?.reference || `#${deletingTarget?.id || ""}` })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLoading}>{t("mise_en_place:dialogs.delete_draft.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deletingLoading} onClick={(e) => { e.preventDefault(); handleDeleteBrouillon(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.delete_draft.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Annulation */}
      <Dialog open={!!annulTarget} onOpenChange={(o) => !o && setAnnulTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("mise_en_place:dialogs.annul_dialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {t("mise_en_place:dialogs.annul_dialog.description", { ref: annulTarget?.reference || `#${annulTarget?.id || ""}` })}
            </p>
            <div className="space-y-1">
              <Label htmlFor="annul-motif">{t("mise_en_place:dialogs.annul_dialog.motif_label")} <span className="text-destructive">*</span></Label>
              <Textarea id="annul-motif" value={annulMotif} onChange={(e) => setAnnulMotif(e.target.value)} placeholder={t("mise_en_place:dialogs.annul_dialog.motif_placeholder")} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnulTarget(null)} disabled={annulLoading}>{t("mise_en_place:dialogs.annul_dialog.back")}</Button>
            <Button variant="destructive" disabled={annulLoading || !annulMotif.trim()} onClick={async () => {
              if (!annulTarget) return;
              setAnnulLoading(true);
              try {
                await certificatCreditApi.reject(annulTarget.id, annulMotif.trim());
                okToast(t("mise_en_place:toast.cancelled"));
                setAnnulTarget(null);
                setAnnulMotif("");
                fetchCertificats();
              } catch (e: unknown) {
                errToast(tErr(e, t("mise_en_place:toast.cancelled")));
              } finally { setAnnulLoading(false); }
            }}>
              {annulLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.annul_dialog.confirm")}
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

export default DemandesMiseEnPlace;
