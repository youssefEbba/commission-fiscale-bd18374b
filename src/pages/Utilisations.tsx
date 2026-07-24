import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  utilisationCreditApi, UtilisationCreditDto, UtilisationStatut, UtilisationType,
  CreateUtilisationCreditRequest, UTILISATION_STATUT_VALUES,
  certificatCreditApi, CertificatCreditDto, CertificatUtilisationEligibilityDto,
  UTILISATION_DOCUMENT_TYPES, UTILISATION_DOC_TYPES_DOUANE, UTILISATION_DOC_TYPES_TVA,
  TypeDocumentUtilisation, DocumentDto,
  documentRequirementApi, DocumentRequirementDto,
  DecisionCorrectionDto,
  transfertCreditApi,
  LigneBulletinRequest, TypeLigneTaxe, AffectationTaxe,
  referentielTaxeApi, ReferentielTaxeDto,
  isStorageUnavailableError, formatApiErrorMessage,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { tStatutUtilisation, tTypeDocument, tDocRequirementLabel } from "@/i18n/enums";
import { formatAmount, formatDate, formatNumber } from "@/i18n/format";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { UploadRow } from "@/components/ui/upload-row";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Landmark, Search, RefreshCw, Loader2, Plus, Eye, Filter, Upload, FileText, AlertCircle, CheckCircle2, Info, AlertTriangle, MoreHorizontal, Pencil, Send, Trash2, Save } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const STATUT_COLORS: Record<UtilisationStatut, string> = {
  BROUILLON: "bg-slate-100 text-slate-700",
  DEMANDEE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION: "bg-yellow-100 text-yellow-800",
  VISE: "bg-purple-100 text-purple-800",
  VALIDEE: "bg-emerald-100 text-emerald-800",
  LIQUIDEE: "bg-green-100 text-green-800",
  APUREE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
  CLOTUREE: "bg-slate-200 text-slate-800",
  EN_CONTROLE_DGD: "bg-purple-100 text-purple-800",
  CHEQUE_SAISI: "bg-indigo-100 text-indigo-800",
  ENVOYEE_AU_TRESOR: "bg-sky-100 text-sky-800",
  QUITTANCES_ENREGISTREES: "bg-teal-100 text-teal-800",
};

const emptyDouane: Partial<CreateUtilisationCreditRequest> = {
  type: "DOUANIER", montant: undefined, numeroDeclaration: "", numeroBulletin: "",
  dateDeclaration: "", lignes: [], enregistreeSYDONIA: false,
};

const emptyTVA: Partial<CreateUtilisationCreditRequest> = {
  type: "TVA_INTERIEURE", montant: undefined, typeAchat: "", numeroFacture: "",
  dateFacture: "", montantTVAInterieure: undefined, numeroDecompte: "",
};

// Lignes par défaut suggérées pour un bulletin de liquidation douanier
// (libellés sources métier — non destinés à l'affichage : le label provient du référentiel API à l'affichage)
const DEFAULT_BULLETIN_LIGNES: LigneBulletinRequest[] = [
  { codeTaxe: "DD", denominationTaxe: "Droit de Douane", typeLigne: "ARTICLE", valeurTaxe: 0, ordre: 1 },
  { codeTaxe: "TVA", denominationTaxe: "Taxe sur valeur ajoutée", typeLigne: "ARTICLE", valeurTaxe: 0, ordre: 2 },
];

const Utilisations = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation(["utilisations", "common", "errors"]);
  // Libellé contextualisé (CLOTUREE+DOUANIER = "Clôturée (transfert)"). Localisé via i18n.
  const tStatutContextuel = (statut: UtilisationStatut, type?: UtilisationType): string => {
    if (statut === "CLOTUREE" && type === "DOUANIER") return t("utilisations:statut.cloturee_transfert");
    return tStatutUtilisation(statut);
  };
  const titleKey = `utilisations:list.title_by_role.${role}`;
  const pageTitleLabel = role ? (t(titleKey, { defaultValue: "" }) || t("utilisations:list.title")) : t("utilisations:list.title");
  usePageTitle("utilisations:list.title");

  const [data, setData] = useState<UtilisationCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [tab, setTab] = useState("all");

  // Create / edit dialog
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createType, setCreateType] = useState<UtilisationType>("DOUANIER");
  const [form, setForm] = useState<Partial<CreateUtilisationCreditRequest>>({ ...emptyDouane });
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [creating, setCreating] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<UtilisationCreditDto | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // (Dialogs détail & apurement TVA retirés — l'affichage détaillé et l'apurement
  // sont gérés dans UtilisationDetail.tsx.)

  // Document upload (existing utilisation)
  const [docDialog, setDocDialog] = useState<number | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docType, setDocType] = useState<TypeDocumentUtilisation>("DEMANDE_UTILISATION");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);

  // GED requirements + create-time document uploads
  const [gedRequirements, setGedRequirements] = useState<DocumentRequirementDto[]>([]);
  const [createDocFiles, setCreateDocFiles] = useState<Record<string, File>>({});

  // REJET_TEMP dialog state
  const [showRejetTemp, setShowRejetTemp] = useState<UtilisationCreditDto | null>(null);
  const [rejetTempMotif, setRejetTempMotif] = useState("");
  const [rejetTempDocs, setRejetTempDocs] = useState<string[]>([]);
  const [rejetTempLoading, setRejetTempLoading] = useState(false);

  // Decisions state (detail)
  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);

  // Certificats avec un transfert déjà exécuté (TRANSFERE) → utilisations DOUANIERES bloquées
  const [transferredCertIds, setTransferredCertIds] = useState<Set<number>>(new Set());

  // Éligibilité du certificat sélectionné (rafraîchi à chaque changement de cert/type)
  const [eligibilite, setEligibilite] = useState<CertificatUtilisationEligibilityDto | null>(null);
  const [eligibiliteLoading, setEligibiliteLoading] = useState(false);

  useEffect(() => {
    if (!showCreate || !form.certificatCreditId) {
      setEligibilite(null);
      return;
    }
    let cancelled = false;
    setEligibiliteLoading(true);
    certificatCreditApi
      .getEligibiliteUtilisation(form.certificatCreditId, createType)
      .then((res) => { if (!cancelled) setEligibilite(res); })
      .catch(() => { if (!cancelled) setEligibilite(null); })
      .finally(() => { if (!cancelled) setEligibiliteLoading(false); });
    return () => { cancelled = true; };
  }, [showCreate, form.certificatCreditId, createType]);

  // Référentiel des taxes (admin-managed)
  const [referentielTaxes, setReferentielTaxes] = useState<ReferentielTaxeDto[]>([]);
  const [referentielTaxesLoading, setReferentielTaxesLoading] = useState(false);
  const [showAddTaxe, setShowAddTaxe] = useState(false);
  const [newTaxeCode, setNewTaxeCode] = useState("");
  const [newTaxeLibelle, setNewTaxeLibelle] = useState("");
  const [addingTaxe, setAddingTaxe] = useState(false);

  const loadReferentielTaxes = async (): Promise<ReferentielTaxeDto[]> => {
    setReferentielTaxesLoading(true);
    try {
      const list = await referentielTaxeApi.getActives();
      const sorted = (list || []).slice().sort((a, b) => (a.ordreAffichage ?? 999) - (b.ordreAffichage ?? 999));
      setReferentielTaxes(sorted);
      return sorted;
    } catch {
      return [];
    } finally {
      setReferentielTaxesLoading(false);
    }
  };
  useEffect(() => { void loadReferentielTaxes(); }, []);

  const handleAddTaxe = async () => {
    const code = newTaxeCode.trim().toUpperCase();
    const libelle = newTaxeLibelle.trim();
    if (!code || !libelle) {
      toast({ title: t("utilisations:toast.fields_required"), description: t("utilisations:create.add_taxe.code_libelle_required"), variant: "destructive" });
      return;
    }
    setAddingTaxe(true);
    try {
      await referentielTaxeApi.create({ codeTaxe: code, denominationTaxe: libelle, active: true });
      const taxes = await loadReferentielTaxes();
      const currentValues = new Map((form.lignes || []).map(l => [l.codeTaxe, l.valeurTaxe]));
      const nextLignes: LigneBulletinRequest[] = taxes.map((tx, i) => ({
        codeTaxe: tx.codeTaxe,
        denominationTaxe: tx.denominationTaxe,
        typeLigne: "ARTICLE" as TypeLigneTaxe,
        valeurTaxe: currentValues.get(tx.codeTaxe) ?? 0,
        ordre: tx.ordreAffichage ?? i + 1,
      }));
      setForm({ ...form, lignes: nextLignes });
      toast({ title: t("utilisations:toast.tax_added_title"), description: t("utilisations:toast.tax_added_desc") });
      setShowAddTaxe(false);
    } catch (e: any) {
      toast({ title: t("common:errors.title", { defaultValue: "Erreur" }), description: e.message || t("utilisations:toast.tax_add_failed"), variant: "destructive" });
    } finally {
      setAddingTaxe(false);
    }
  };

  const buildDefaultLignesFromReferentiel = (taxes: ReferentielTaxeDto[]): LigneBulletinRequest[] => {
    if (!taxes || taxes.length === 0) return DEFAULT_BULLETIN_LIGNES.map(l => ({ ...l }));
    return taxes.map((tx, i) => ({
      codeTaxe: tx.codeTaxe,
      denominationTaxe: tx.denominationTaxe,
      typeLigne: "ARTICLE" as TypeLigneTaxe,
      valeurTaxe: 0,
      ordre: tx.ordreAffichage ?? i + 1,
    }));
  };

  const fetchData = async () => {
    setLoading(true);
    try { setData(await utilisationCreditApi.getAll()); }
    catch { toast({ title: t("common:errors.title", { defaultValue: "Erreur" }), description: t("utilisations:list.load_error"), variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const fetchTransfertsExecutes = async () => {
    try {
      const all = await transfertCreditApi.getAll();
      const ids = new Set(
        all.filter((tr) => tr.statut === "TRANSFERE").map((tr) => tr.certificatCreditId)
      );
      setTransferredCertIds(ids);
    } catch {
      // silencieux
    }
  };

  useEffect(() => { fetchData(); fetchTransfertsExecutes(); }, []);

  const loadCertificatsAndRequirements = async () => {
    try {
      const [certs, extReqs, intReqs] = await Promise.all([
        role === "ENTREPRISE" && (user as any)?.entrepriseId
          ? certificatCreditApi.getByEntreprise((user as any).entrepriseId)
          : certificatCreditApi.getAll(),
        documentRequirementApi.getByProcessus("UTILISATION_CI_EXTERIEUR").catch(() => []),
        documentRequirementApi.getByProcessus("UTILISATION_CI_INTERIEUR").catch(() => []),
      ]);
      setCertificats(certs);
      if (extReqs.length > 0 || intReqs.length > 0) {
        const allReqs = [...extReqs, ...intReqs].map(r => ({
          ...r,
          processus: r.processus === "UTILISATION_CI"
            ? (UTILISATION_DOC_TYPES_TVA.some(v => v === r.typeDocument && !UTILISATION_DOC_TYPES_DOUANE.some(d => d === r.typeDocument))
              ? "UTILISATION_CI_INTERIEUR" as const
              : "UTILISATION_CI_EXTERIEUR" as const)
            : r.processus,
        }));
        setGedRequirements(allReqs);
      } else {
        const fallbackExt: DocumentRequirementDto[] = UTILISATION_DOC_TYPES_DOUANE.map((dt, i) => ({
          id: -(i + 1),
          processus: "UTILISATION_CI_EXTERIEUR" as const,
          typeDocument: dt,
          obligatoire: dt === "DEMANDE_UTILISATION",
          typesAutorises: ["PDF" as const, "IMAGE" as const, "WORD" as const, "EXCEL" as const],
          ordreAffichage: i,
          description: tTypeDocument(dt),
        }));
        const fallbackInt: DocumentRequirementDto[] = UTILISATION_DOC_TYPES_TVA.map((dt, i) => ({
          id: -(100 + i),
          processus: "UTILISATION_CI_INTERIEUR" as const,
          typeDocument: dt,
          obligatoire: dt === "DEMANDE_UTILISATION",
          typesAutorises: ["PDF" as const, "IMAGE" as const, "WORD" as const, "EXCEL" as const],
          ordreAffichage: i,
          description: tTypeDocument(dt),
        }));
        setGedRequirements([...fallbackExt, ...fallbackInt]);
      }
    } catch { /* ignore */ }
  };

  const openCreate = async () => {
    setEditingId(null);
    setCreateType("DOUANIER");
    const taxes = await loadReferentielTaxes();
    setForm({
      ...emptyDouane,
      entrepriseId: (user as any)?.entrepriseId,
      lignes: buildDefaultLignesFromReferentiel(taxes),
    });
    setCreateDocFiles({});
    await loadCertificatsAndRequirements();
    setShowCreate(true);
  };

  const openEditBrouillon = async (u: UtilisationCreditDto) => {
    setEditingId(u.id);
    setCreateType(u.type);
    setForm({
      type: u.type,
      certificatCreditId: u.certificatCreditId,
      entrepriseId: u.entrepriseId,
      montant: u.montant,
      numeroDeclaration: u.numeroDeclaration,
      numeroBulletin: u.numeroBulletin,
      dateDeclaration: u.dateDeclaration ? u.dateDeclaration.substring(0, 10) : "",
      lignes: (u.lignes && u.lignes.length > 0)
        ? u.lignes.map(l => ({ id: l.id, codeTaxe: l.code, denominationTaxe: l.libelle, typeLigne: l.type, valeurTaxe: l.valeur, ordre: l.ordre, affectation: l.affectationEntreprise ?? l.affectation ?? null }))
        : [],
      enregistreeSYDONIA: u.enregistreeSYDONIA ?? false,
      typeAchat: u.typeAchat,
      numeroFacture: u.numeroFacture,
      dateFacture: u.dateFacture ? u.dateFacture.substring(0, 10) : "",
      montantTVAInterieure: u.montantTVAInterieure,
      numeroDecompte: u.numeroDecompte,
    });
    setCreateDocFiles({});
    await loadCertificatsAndRequirements();
    setShowCreate(true);
  };

  const handleCreateTypeChange = (typeVal: UtilisationType) => {
    setCreateType(typeVal);
    const base = typeVal === "DOUANIER" ? emptyDouane : emptyTVA;
    const lignes = typeVal === "DOUANIER" ? buildDefaultLignesFromReferentiel(referentielTaxes) : [];
    setForm({ ...base, lignes, certificatCreditId: form.certificatCreditId, entrepriseId: form.entrepriseId });
    setCreateDocFiles({});
  };

  const getFilteredRequirements = (): DocumentRequirementDto[] => {
    const matchProcessus = createType === "DOUANIER"
      ? ["UTILISATION_CI_EXTERIEUR", "UTILISATION_CI_DOUANE", "UTILISATION_CI"]
      : ["UTILISATION_CI_INTERIEUR", "UTILISATION_CI_TVA_INTERIEURE", "UTILISATION_CI"];
    return gedRequirements
      .filter((r) => matchProcessus.includes(r.processus))
      .sort((a, b) => (a.ordreAffichage || 0) - (b.ordreAffichage || 0));
  };

  const getMissingObligatoryDocs = (): DocumentRequirementDto[] => {
    return getFilteredRequirements().filter((r) => r.obligatoire && !createDocFiles[String(r.id)]);
  };

  const errorTitle = () => t("common:errors.title", { defaultValue: "Erreur" });

  // Totaux AU_CI (cordon vs TVA) pour validation côté front
  const sumAuCi = (lignes: LigneBulletinRequest[] | undefined): { cordon: number; tva: number } => {
    let cordon = 0, tva = 0;
    for (const l of (lignes || [])) {
      const v = Number(l.valeurTaxe) || 0;
      if (l.affectation !== "AU_CI" || v <= 0) continue;
      if ((l.codeTaxe || "").toUpperCase() === "TVA") tva += v;
      else cordon += v;
    }
    return { cordon, tva };
  };

  /** Erreurs bloquantes pré-soumission (combine éligibilité serveur + soldes locaux). */
  const computePreSubmitErrors = (): string[] => {
    const errors: string[] = [];
    if (!form.certificatCreditId) return errors;
    const elig = eligibilite;
    if (elig && !elig.eligible) errors.push(...(elig.motifs ?? []));
    if (createType === "DOUANIER") {
      if (elig?.transfertExecute) errors.push(t("utilisations:validation.transfert_executed", { defaultValue: "Transfert exécuté — utilisations douanières interdites" }));
      const lignes = form.lignes || [];
      if (lignes.length === 0) errors.push(t("utilisations:validation.lignes_required", { defaultValue: "Au moins une ligne de bulletin requise" }));
      const { cordon, tva } = sumAuCi(lignes);
      const soldeCordon = elig?.soldeCordon ?? 0;
      const quotaTva = elig?.tvaImportationDouane ?? 0;
      if (elig && cordon > soldeCordon) {
        errors.push(t("utilisations:validation.solde_cordon_insuffisant", { defaultValue: `Solde cordon insuffisant (disponible=${soldeCordon}, requis=${cordon})`, disponible: soldeCordon, requis: cordon }));
      }
      if (elig && quotaTva > 0 && tva > quotaTva) {
        errors.push(t("utilisations:validation.quota_tva_insuffisant", { defaultValue: `Quota TVA import insuffisant (disponible=${quotaTva}, requis=${tva})`, disponible: quotaTva, requis: tva }));
      }
    } else if (createType === "TVA_INTERIEURE") {
      const m = Number(form.montantTVAInterieure) || 0;
      if (m <= 0) errors.push(t("utilisations:validation.montant_tva_required", { defaultValue: "Montant TVA intérieure > 0 requis" }));
    }
    return errors;
  };

  const preSubmitErrors = computePreSubmitErrors();
  const canSubmit = preSubmitErrors.length === 0;


  const handleSave = async (mode: "brouillon" | "submit") => {
    if (!form.certificatCreditId) {
      toast({ title: errorTitle(), description: t("utilisations:toast.cert_required"), variant: "destructive" });
      return;
    }
    if (createType === "DOUANIER" && transferredCertIds.has(form.certificatCreditId)) {
      toast({
        title: t("utilisations:toast.douane_blocked_title"),
        description: t("utilisations:toast.douane_blocked_desc"),
        variant: "destructive",
      });
      return;
    }
    if (mode === "submit") {
      const errs = computePreSubmitErrors();
      if (errs.length > 0) {
        toast({
          title: t("utilisations:validation.title", { defaultValue: "Validation impossible" }),
          description: errs.join(" • "),
          variant: "destructive",
        });
        return;
      }
      const missing = getMissingObligatoryDocs();
      if (missing.length > 0) {
        toast({
          title: t("utilisations:toast.missing_docs_title"),
          description: t("utilisations:toast.missing_docs_desc", { list: missing.map(m => tDocRequirementLabel(m)).join(", ") }),
          variant: "destructive",
        });
        return;
      }
      if (createType === "DOUANIER") {
        const missingAff = (form.lignes || []).filter(l => (Number(l.valeurTaxe) || 0) > 0 && !l.affectation);
        if (missingAff.length > 0) {
          toast({
            title: t("utilisations:toast.create_affectation_missing_title"),
            description: t("utilisations:toast.create_affectation_missing_desc", { count: missingAff.length }),
            variant: "destructive",
          });
          return;
        }
      }
    }
    setCreating(true);
    try {
      const dateFields = ["dateDeclaration", "dateFacture"];
      const sanitized: Record<string, any> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === "") sanitized[k] = null;
        else if (dateFields.includes(k) && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) sanitized[k] = `${v}T00:00:00Z`;
        else sanitized[k] = v;
      }

      let target: UtilisationCreditDto;
      if (editingId != null) {
        target = await utilisationCreditApi.update(editingId, sanitized as CreateUtilisationCreditRequest);
      } else {
        const payload: CreateUtilisationCreditRequest = {
          ...(sanitized as CreateUtilisationCreditRequest),
          ...(mode === "brouillon" ? { brouillon: true } : {}),
        };
        target = await utilisationCreditApi.create(payload);
      }

      const uploadEntries = Object.entries(createDocFiles);
      const reqById = new Map(gedRequirements.map(r => [String(r.id), r]));
      for (const [key, file] of uploadEntries) {
        const req = reqById.get(key);
        const code = (req?.codeDocument ?? req?.typeDocument) as TypeDocumentUtilisation | undefined;
        if (!code) continue;
        await utilisationCreditApi.uploadDocument(target.id, code, file);
      }

      if (mode === "submit" && editingId != null && target.statut === "BROUILLON") {
        await utilisationCreditApi.soumettre(target.id);
      }

      let description: string;
      if (mode === "brouillon") description = t("utilisations:toast.draft_saved");
      else if (editingId != null) description = t("utilisations:toast.submitted");
      else if (uploadEntries.length > 0) description = t("utilisations:toast.created_with_docs", { count: uploadEntries.length });
      else description = t("utilisations:toast.created");

      toast({ title: t("common:states.success", { defaultValue: "Succès" }), description });
      setShowCreate(false);
      setEditingId(null);
      fetchData();
    } catch (e: any) {
      toast({ title: errorTitle(), description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleSoumettreFromList = async (u: UtilisationCreditDto) => {
    if (u.type === "DOUANIER" && transferredCertIds.has(u.certificatCreditId)) {
      toast({
        title: t("utilisations:toast.submit_blocked_title"),
        description: t("utilisations:toast.submit_blocked_desc"),
        variant: "destructive",
      });
      return;
    }
    setSubmittingId(u.id);
    try {
      await utilisationCreditApi.soumettre(u.id);
      toast({ title: t("common:states.success", { defaultValue: "Succès" }), description: t("utilisations:toast.submitted") });
      fetchData();
    } catch (e: any) {
      toast({ title: errorTitle(), description: e.message, variant: "destructive" });
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDeleteBrouillon = async () => {
    if (!deletingTarget) return;
    setDeletingLoading(true);
    try {
      await utilisationCreditApi.remove(deletingTarget.id);
      toast({ title: t("common:states.success", { defaultValue: "Succès" }), description: t("utilisations:toast.draft_deleted") });
      setDeletingTarget(null);
      fetchData();
    } catch (e: any) {
      toast({ title: errorTitle(), description: e.message, variant: "destructive" });
    } finally {
      setDeletingLoading(false);
    }
  };


  const handleRejetTemp = async () => {
    if (!showRejetTemp || !rejetTempMotif.trim() || rejetTempDocs.length === 0) return;
    setRejetTempLoading(true);
    try {
      await utilisationCreditApi.postDecision(showRejetTemp.id, "REJET_TEMP", rejetTempMotif.trim(), rejetTempDocs);
      toast({ title: t("common:states.success", { defaultValue: "Succès" }), description: t("utilisations:toast.rejet_temp_sent") });
      setShowRejetTemp(null);
      setRejetTempMotif("");
      setRejetTempDocs([]);
      fetchData();
    } catch (e: any) {
      toast({ title: errorTitle(), description: e.message, variant: "destructive" });
    } finally { setRejetTempLoading(false); }
  };

  const openDocs = async (id: number) => {
    setDocDialog(id);
    setDocsLoading(true);
    try { setDocs(await utilisationCreditApi.getDocuments(id)); } catch { setDocs([]); }
    finally { setDocsLoading(false); }
  };

  const handleUpload = async () => {
    if (!docDialog || !docFile) return;
    setUploading(true);
    try {
      await utilisationCreditApi.uploadDocument(docDialog, docType, docFile);
      toast({ title: t("common:states.success", { defaultValue: "Succès" }), description: t("utilisations:toast.doc_uploaded") });
      setDocFile(null);
      setDocs(await utilisationCreditApi.getDocuments(docDialog));
    } catch (e: any) {
      const description = isStorageUnavailableError(e)
        ? t("errors:storage_unavailable")
        : formatApiErrorMessage(e, e?.message);
      toast({ title: errorTitle(), description, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const filtered = data.filter((u) => {
    const ms = (u.certificatReference || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.entrepriseNom || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.certificatTitulaireRaisonSociale || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.numeroDeclaration || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.numeroFacture || "").toLowerCase().includes(search.toLowerCase()) ||
      String(u.id).includes(search);
    const matchStatut = filterStatut === "ALL" || u.statut === filterStatut;
    const matchTab = tab === "all" ||
      (tab === "DOUANIER" && u.type === "DOUANIER") ||
      (tab === "TVA_INTERIEURE" && u.type === "TVA_INTERIEURE") ||
      (tab === "SOUS_TRAITANT" && u.demandeurEstSousTraitant === true);
    return ms && matchStatut && matchTab;
  }).sort((a, b) => {
    const ta = a.dateCreation ? new Date(a.dateCreation).getTime() : 0;
    const tb = b.dateCreation ? new Date(b.dateCreation).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (b.id ?? 0) - (a.id ?? 0);
  });

  const canCreate = role === "ENTREPRISE" || role === "SOUS_TRAITANT" || role === "ADMIN_SI";

  // Currency: MRU par défaut (devise du certificat parent non disponible à ce niveau de liste).
  const fmtAmt = (v: any) => formatAmount(v);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Landmark className="h-6 w-6 text-primary" />
              {pageTitleLabel}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("utilisations:list.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreate}><Plus className="h-4 w-4 me-2" /> {t("utilisations:list.actions.new")}</Button>
            )}
            <Button variant="outline" onClick={fetchData} disabled={loading} aria-label={t("common:actions.refresh")}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} /> {t("common:actions.refresh")}
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">{t("utilisations:list.tabs.all")}</TabsTrigger>
            <TabsTrigger value="DOUANIER">{t("utilisations:list.tabs.douane")}</TabsTrigger>
            <TabsTrigger value="TVA_INTERIEURE">{t("utilisations:list.tabs.tva")}</TabsTrigger>
            {(role === "ENTREPRISE" || role === "ADMIN_SI" || role === "DGD" || role === "DGTCP") && (
              <TabsTrigger value="SOUS_TRAITANT">
                {t("utilisations:list.tabs.sous_traitant")}
                {data.filter(u => u.demandeurEstSousTraitant).length > 0 && (
                  <Badge variant="secondary" className="ms-1.5 text-[10px] px-1.5 py-0">
                    {formatNumber(data.filter(u => u.demandeurEstSousTraitant).length)}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("utilisations:list.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
              aria-label={t("common:actions.search")}
            />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48" aria-label={t("utilisations:list.columns.statut")}>
              <Filter className="h-4 w-4 me-2" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("utilisations:list.filter_all")}</SelectItem>
              {UTILISATION_STATUT_VALUES.map((k) => (
                <SelectItem key={k} value={k}>{tStatutUtilisation(k)}</SelectItem>
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
                    <TableHead>{t("utilisations:list.columns.id")}</TableHead>
                    <TableHead>{t("utilisations:list.columns.certificat")}</TableHead>
                    <TableHead>{t("utilisations:list.columns.demandeur")}</TableHead>
                    <TableHead>{t("utilisations:list.columns.type")}</TableHead>
                    <TableHead>{t("utilisations:list.columns.reference_metier")}</TableHead>
                    <TableHead>{t("utilisations:list.columns.montant")}</TableHead>
                    <TableHead>{t("utilisations:list.columns.statut")}</TableHead>
                    <TableHead className="text-end">{t("utilisations:list.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("utilisations:list.empty")}</TableCell></TableRow>
                  ) : filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">#{u.id}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{u.certificatReference || t("utilisations:list.cert_fallback", { id: u.certificatCreditId })}</div>
                        {u.certificatTitulaireRaisonSociale && (
                          <div className="text-[11px] text-muted-foreground/70">{t("utilisations:list.titulaire_prefix", { name: u.certificatTitulaireRaisonSociale })}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{u.entrepriseNom || "—"}</span>
                          {u.demandeurEstSousTraitant && (
                            <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700 bg-orange-50">
                              {t("utilisations:list.sous_traite_badge")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {u.type === "DOUANIER" ? t("utilisations:list.type_short.douane") : u.type === "TVA_INTERIEURE" ? t("utilisations:list.type_short.tva") : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.type === "DOUANIER" ? (u.numeroDeclaration || u.numeroBulletin || "—") : (u.numeroFacture || u.numeroDecompte || "—")}
                      </TableCell>
                      <TableCell>{fmtAmt(u.montant)}</TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[u.statut]}`}>{tStatutContextuel(u.statut, u.type)}</Badge></TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end flex-wrap items-center">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/utilisations/${u.id}`)} title={t("utilisations:list.actions.view_detail")} aria-label={t("utilisations:list.actions.view_detail")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {((role === "DGD" && u.type === "DOUANIER") || (role === "DGTCP")) && !["BROUILLON", "LIQUIDEE", "APUREE", "REJETEE", "CLOTUREE"].includes(u.statut) && (
                            <Button variant="default" size="sm" onClick={() => navigate(`/dashboard/utilisations/${u.id}`)}>
                              {t("utilisations:list.actions.process")}
                            </Button>
                          )}
                          {u.statut === "BROUILLON" && (role === "ENTREPRISE" || role === "SOUS_TRAITANT" || role === "ADMIN_SI") && (() => {
                            const blockedByTransfert = u.type === "DOUANIER" && transferredCertIds.has(u.certificatCreditId);
                            return (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" title={blockedByTransfert ? t("utilisations:list.actions.drafts_blocked_title") : t("utilisations:list.actions.drafts_menu_title")} aria-label={t("utilisations:list.actions.drafts_menu_title")}>
                                    <MoreHorizontal className="h-4 w-4" />
                                    {blockedByTransfert && <AlertTriangle className="h-3.5 w-3.5 ms-1 text-amber-600" />}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {blockedByTransfert && (
                                    <div className="px-2 py-1.5 text-[11px] text-amber-700 bg-amber-50 border-b border-amber-200">
                                      {t("utilisations:list.actions.drafts_blocked_banner")}
                                    </div>
                                  )}
                                  <DropdownMenuItem disabled={blockedByTransfert} onClick={() => openEditBrouillon(u)}>
                                    <Pencil className="h-4 w-4 me-2" /> {t("utilisations:list.actions.edit_draft")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={submittingId === u.id || blockedByTransfert}
                                    onClick={() => handleSoumettreFromList(u)}
                                  >
                                    {submittingId === u.id ? (
                                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4 me-2" />
                                    )}
                                    {t("utilisations:list.actions.submit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeletingTarget(u)}
                                  >
                                    <Trash2 className="h-4 w-4 me-2" /> {t("utilisations:list.actions.delete_draft")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          })()}
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


      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setEditingId(null); }}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId != null ? t("utilisations:create.title_edit", { id: editingId }) : t("utilisations:create.title_new")}
            </DialogTitle>
            {editingId != null && (
              <p className="text-xs text-muted-foreground">
                {t("utilisations:create.type_immutable_hint")}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("utilisations:create.certificat_label")} *</Label>
              <SearchableSelect
                value={form.certificatCreditId ? String(form.certificatCreditId) : ""}
                onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}
                placeholder={t("utilisations:create.certificat_placeholder")}
                searchPlaceholder={t("utilisations:create.certificat_search")}
                options={certificats
                  .filter(c => editingId != null || c.statut === "OUVERT" || c.statut === "MODIFIE")
                  .map(c => {
                    const blockedDouane = createType === "DOUANIER" && transferredCertIds.has(c.id);
                    return {
                      value: String(c.id),
                      label: `${c.reference || c.numero || `#${c.id}`} — ${c.entrepriseRaisonSociale || c.entrepriseNom || ""}${blockedDouane ? ` ${t("utilisations:create.certificat_blocked_suffix")}` : ""}`,
                      keywords: `${c.reference || ""} ${c.numero || ""} ${c.entrepriseRaisonSociale || ""} ${c.entrepriseNom || ""}`,
                      disabled: blockedDouane,
                    };
                  })}
              />
              {createType === "DOUANIER" && form.certificatCreditId && transferredCertIds.has(form.certificatCreditId) && (
                <div className="mt-2 p-2.5 rounded-md border border-amber-300 bg-amber-50 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{t("utilisations:create.transfert_warning")}</div>
                </div>
              )}
              {form.certificatCreditId && eligibilite && !eligibilite.eligible && (
                <div className="mt-2 p-2.5 rounded-md border border-destructive/40 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {t("utilisations:validation.cert_not_eligible", { defaultValue: "Certificat non éligible pour une nouvelle utilisation" })}
                      {eligibilite.statutCertificat ? ` (${eligibilite.statutCertificat})` : ""}
                    </div>
                    {eligibilite.motifs?.length > 0 && (
                      <ul className="list-disc pl-4">
                        {eligibilite.motifs.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {form.certificatCreditId && eligibilite?.eligible && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                  {createType === "DOUANIER" && (
                    <>
                      <div>{t("utilisations:validation.solde_cordon_label", { defaultValue: "Solde cordon" })}: <strong>{formatAmount(eligibilite.soldeCordon ?? 0)}</strong></div>
                      <div>{t("utilisations:validation.quota_tva_label", { defaultValue: "Quota TVA import" })}: <strong>{formatAmount(eligibilite.tvaImportationDouane ?? 0)}</strong></div>
                    </>
                  )}
                  {createType === "TVA_INTERIEURE" && (
                    <div>{t("utilisations:validation.solde_tva_label", { defaultValue: "Solde TVA" })}: <strong>{formatAmount(eligibilite.soldeTVA ?? 0)}</strong></div>
                  )}
                </div>
              )}
              {form.certificatCreditId && !eligibiliteLoading && preSubmitErrors.length > 0 && eligibilite?.eligible && (
                <div className="mt-2 p-2.5 rounded-md border border-amber-300 bg-amber-50 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <ul className="list-disc pl-4 space-y-0.5">
                    {preSubmitErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>


            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">{t("utilisations:create.type_label")}</Label>
              <Tabs value={createType} onValueChange={(v) => editingId == null && handleCreateTypeChange(v as UtilisationType)}>
                <TabsList className="w-full">
                  <TabsTrigger value="DOUANIER" className="flex-1" disabled={editingId != null && createType !== "DOUANIER"}>{t("utilisations:create.tab_douane")}</TabsTrigger>
                  <TabsTrigger value="TVA_INTERIEURE" className="flex-1" disabled={editingId != null && createType !== "TVA_INTERIEURE"}>{t("utilisations:create.tab_tva")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-3">
              {createType === "DOUANIER" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("utilisations:create.douane.numero_declaration")} *</Label><Input placeholder={t("utilisations:create.douane.numero_declaration_placeholder")} value={form.numeroDeclaration || ""} onChange={e => setForm({ ...form, numeroDeclaration: e.target.value })} /></div>
                    <div><Label>{t("utilisations:create.douane.numero_bulletin")} *</Label><Input placeholder={t("utilisations:create.douane.numero_bulletin_placeholder")} value={form.numeroBulletin || ""} onChange={e => setForm({ ...form, numeroBulletin: e.target.value })} /></div>
                  </div>
                  <div><Label>{t("utilisations:create.douane.date_declaration")}</Label><Input type="date" value={form.dateDeclaration || ""} onChange={e => setForm({ ...form, dateDeclaration: e.target.value })} /></div>
                  <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">{t("utilisations:create.douane.bulletin_title")} *</Label>
                        <p className="text-[11px] text-muted-foreground">{t("utilisations:create.douane.bulletin_hint")}</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setNewTaxeCode(""); setNewTaxeLibelle(""); setShowAddTaxe(true); }}>
                        <Plus className="h-3.5 w-3.5 me-1" /> {t("utilisations:create.douane.add_tax_btn")}
                      </Button>
                    </div>
                    {referentielTaxesLoading ? (
                      <p className="text-xs text-muted-foreground italic">{t("utilisations:create.douane.bulletin_loading")}</p>
                    ) : (!form.lignes || form.lignes.length === 0) ? (
                      <p className="text-xs text-muted-foreground italic">{t("utilisations:create.douane.bulletin_empty")}</p>
                    ) : (() => {
                      const totalLignes = (form.lignes || []).reduce((s, l) => s + (Number(l.valeurTaxe) || 0), 0);
                      const montantSaisi = Number(form.montant) || 0;
                      // Tolérance 0,01 MRU (1 centime) pour éviter les faux positifs dus aux erreurs d'arrondi flottant lors de la somme des taxes
                      const mismatch = form.montant !== undefined && form.montant !== null && Math.abs(Math.round(totalLignes * 100) - Math.round(montantSaisi * 100)) > 1;
                      return (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-12 gap-1.5 items-center px-1">
                            <span className="col-span-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("utilisations:create.douane.col_code")}</span>
                            <span className="col-span-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("utilisations:create.douane.col_name")}</span>
                            <span className="col-span-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("utilisations:create.douane.col_value")}</span>
                            <span className="col-span-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("utilisations:create.douane.col_affectation")}</span>
                          </div>
                          {form.lignes.map((ligne, idx) => {
                            const valNum = Number(ligne.valeurTaxe) || 0;
                            const isEmpty = ligne.valeurTaxe === undefined || ligne.valeurTaxe === null || (ligne.valeurTaxe as any) === "";
                            const isZero = valNum === 0;
                            const affMissing = !isZero && !ligne.affectation;
                            const setAff = (aff: AffectationTaxe | null) => {
                              const next = [...(form.lignes || [])];
                              next[idx] = { ...next[idx], affectation: aff };
                              setForm({ ...form, lignes: next });
                            };
                            return (
                              <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                                {/* `denominationTaxe` provient du référentiel API — non traduit (donnée métier) */}
                                <Input className="col-span-2 h-8 text-xs uppercase bg-muted/40" value={ligne.codeTaxe} readOnly />
                                <Input className="col-span-4 h-8 text-xs bg-muted/40" value={ligne.denominationTaxe} readOnly />
                                <Input
                                  className={`col-span-3 h-8 text-xs ${isEmpty ? "border-destructive focus-visible:ring-destructive bg-destructive/5" : ""}`}
                                  type="text"
                                  inputMode="decimal"
                                  placeholder={t("utilisations:create.douane.value_required")}
                                  value={ligne.valeurTaxe ?? ""}
                                  onChange={e => {
                                    const raw = e.target.value.replace(/\s/g, "").replace(",", ".");
                                    if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
                                    const next = [...(form.lignes || [])];
                                    const newVal = raw === "" ? (undefined as any) : (raw.endsWith(".") || raw === "-" ? (raw as any) : Number(raw));
                                    const newAff = (Number(newVal) || 0) === 0 ? null : next[idx].affectation;
                                    next[idx] = { ...next[idx], valeurTaxe: newVal, affectation: newAff };
                                    setForm({ ...form, lignes: next });
                                  }}
                                />

                                <div className={`col-span-3 flex gap-1 ${affMissing ? "ring-1 ring-destructive rounded-md p-0.5" : ""}`}>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={ligne.affectation === "AU_CI" ? "default" : "outline"}
                                    disabled={isZero}
                                    className={`h-8 flex-1 text-[10px] px-1 ${ligne.affectation === "AU_CI" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                                    onClick={() => setAff(ligne.affectation === "AU_CI" ? null : "AU_CI")}
                                    title={t("utilisations:create.douane.affectation_au_ci_title")}
                                  >
                                    {t("utilisations:create.douane.affectation_au_ci_short")}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={ligne.affectation === "A_PAYER" ? "default" : "outline"}
                                    disabled={isZero}
                                    className={`h-8 flex-1 text-[10px] px-1 ${ligne.affectation === "A_PAYER" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                                    onClick={() => setAff(ligne.affectation === "A_PAYER" ? null : "A_PAYER")}
                                    title={t("utilisations:create.douane.affectation_a_payer_title")}
                                  >
                                    {t("utilisations:create.douane.affectation_a_payer_short")}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-[10px] text-muted-foreground italic px-1">
                            {t("utilisations:create.douane.affectation_hint")}
                          </p>
                          <div className={`text-end text-xs pt-1 border-t ${mismatch ? "text-destructive font-semibold" : ""}`}>
                            {t("utilisations:create.douane.total")} : <strong>{formatAmount(totalLignes, { maximumFractionDigits: 2 })}</strong>
                            {form.montant !== undefined && form.montant !== null && (
                              <> &nbsp;|&nbsp; {t("utilisations:create.douane.amount_typed")} : <strong>{formatAmount(montantSaisi, { maximumFractionDigits: 2 })}</strong></>
                            )}
                          </div>
                          {mismatch && (
                            <div className="flex items-start gap-2 p-2 rounded-md border border-destructive/40 bg-destructive/10 text-xs text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span>{t("utilisations:create.douane.mismatch", { total: formatAmount(totalLignes, { maximumFractionDigits: 2 }), amount: formatAmount(montantSaisi, { maximumFractionDigits: 2 }) })}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <Label>{t("utilisations:create.douane.montant_total")} *</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder={t("utilisations:create.douane.montant_total_placeholder")}
                      value={form.montant ?? ""}
                      onChange={e => setForm({ ...form, montant: e.target.value ? Number(e.target.value) : undefined })}
                      className={form.montant === undefined || form.montant === null ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                  </div>
                </>
              )}

              {createType === "TVA_INTERIEURE" && (
                <>
                  <div>
                    <Label>{t("utilisations:create.tva.type_achat")} *</Label>
                    <Select value={form.typeAchat || ""} onValueChange={(v) => setForm({ ...form, typeAchat: v })}>
                      <SelectTrigger><SelectValue placeholder={t("utilisations:create.tva.type_achat_placeholder")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACHAT_LOCAL">{t("utilisations:create.tva.achat_local")}</SelectItem>
                        <SelectItem value="DECOMPTE">{t("utilisations:create.tva.decompte")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.typeAchat === "ACHAT_LOCAL" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>{t("utilisations:create.tva.numero_facture")} *</Label><Input placeholder={t("utilisations:create.tva.numero_facture_placeholder")} value={form.numeroFacture || ""} onChange={e => setForm({ ...form, numeroFacture: e.target.value })} /></div>
                      <div><Label>{t("utilisations:create.tva.date_facture")}</Label><Input type="date" value={form.dateFacture || ""} onChange={e => setForm({ ...form, dateFacture: e.target.value })} /></div>
                    </div>
                  )}
                  {form.typeAchat === "DECOMPTE" && (
                    <div><Label>{t("utilisations:create.tva.numero_decompte")} *</Label><Input placeholder={t("utilisations:create.tva.numero_decompte_placeholder")} value={form.numeroDecompte || ""} onChange={e => setForm({ ...form, numeroDecompte: e.target.value })} /></div>
                  )}
                  <div><Label>{t("utilisations:create.tva.montant_tva")} *</Label><Input type="number" min="0" placeholder="0" value={form.montantTVAInterieure ?? ""} onChange={e => setForm({ ...form, montantTVAInterieure: e.target.value ? Number(e.target.value) : undefined })} /></div>
                </>
              )}
            </div>

            {/* Documents requis (GED) */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {t("utilisations:create.docs.title")}
                {getFilteredRequirements().length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({getMissingObligatoryDocs().length > 0
                      ? t("utilisations:create.docs.missing_count", { count: getMissingObligatoryDocs().length })
                      : t("utilisations:create.docs.all_attached")})
                  </span>
                )}
              </h4>
              {getFilteredRequirements().length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("utilisations:create.docs.loading")}
                </p>
              ) : (
                <div className="space-y-2">
                  {getFilteredRequirements().map((req) => {
                    const fileKey = String(req.id);
                    const inputId = `doc-${fileKey}`;
                    const currentFile = createDocFiles[fileKey];
                    const accept = req.typesAutorises?.map(f => f === "PDF" ? ".pdf" : f === "WORD" ? ".doc,.docx" : f === "EXCEL" ? ".xls,.xlsx" : f === "IMAGE" ? ".jpg,.jpeg,.png" : "").join(",");
                    return (
                      <UploadRow
                        key={fileKey}
                        id={inputId}
                        label={tDocRequirementLabel(req)}
                        required={req.obligatoire}
                        accept={accept}
                        file={currentFile || null}
                        onFileChange={(f) => {
                          setCreateDocFiles((prev) => {
                            const next = { ...prev };
                            if (f) next[fileKey] = f;
                            else delete next[fileKey];
                            return next;
                          });
                        }}
                        helperText={req.description}
                        browseLabel={t("utilisations:create.docs.btn_choose") as string}
                        replaceLabel={t("utilisations:create.docs.btn_replace") as string}
                        rightSlot={req.obligatoire ? <Badge variant="destructive" className="text-[10px] px-1 py-0">{t("utilisations:create.docs.obligatoire_badge")}</Badge> : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}>{t("common:actions.cancel")}</Button>
              <Button variant="secondary" onClick={() => handleSave("brouillon")} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                <Save className="h-4 w-4 me-2" />
                {editingId != null ? t("utilisations:create.actions.save_edit") : t("utilisations:create.actions.save_draft")}
              </Button>
              <Button
                onClick={() => handleSave("submit")}
                disabled={creating || eligibiliteLoading || !canSubmit}
                title={!canSubmit ? preSubmitErrors.join(" • ") : undefined}
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                <Send className="h-4 w-4 me-2" />
                {editingId != null ? t("utilisations:create.actions.submit_edit") : t("utilisations:create.actions.submit_new")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Documents dialog */}
      <Dialog open={docDialog !== null} onOpenChange={() => { setDocDialog(null); setDocs([]); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("utilisations:docs_dialog.title", { id: docDialog ?? "" })}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {docsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : docs.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">{t("utilisations:docs_dialog.empty")}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {docs.filter(d => d.actif !== false).map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2 rounded border text-sm">
                    <div>
                      <span className="font-medium">{d.nomFichier}</span>
                      <span className="text-muted-foreground ms-2 text-xs">{tTypeDocument(d.type)} — {t("utilisations:docs_dialog.version_short", { n: d.version || 1 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1"><Upload className="h-4 w-4" /> {t("utilisations:docs_dialog.add_title")}</h4>
              <Select value={docType} onValueChange={(v) => setDocType(v as TypeDocumentUtilisation)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(() => {
                    const sel = data.find(u => u.id === docDialog);
                    const types: readonly TypeDocumentUtilisation[] = sel?.type === "DOUANIER"
                      ? UTILISATION_DOC_TYPES_DOUANE
                      : sel?.type === "TVA_INTERIEURE"
                        ? UTILISATION_DOC_TYPES_TVA
                        : UTILISATION_DOCUMENT_TYPES;
                    return types.map(tv => <SelectItem key={tv} value={tv}>{tTypeDocument(tv)}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
              <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
              <Button onClick={handleUpload} disabled={uploading || !docFile} className="w-full">
                {uploading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:docs_dialog.upload_btn")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* REJET_TEMP Dialog */}
      <Dialog open={!!showRejetTemp} onOpenChange={() => setShowRejetTemp(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("utilisations:rejet_temp.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("utilisations:rejet_temp.subline", { id: showRejetTemp?.id ?? "", demandeur: showRejetTemp?.entrepriseNom || "" })}
            </p>
            <div className="space-y-2">
              <Label>{t("utilisations:rejet_temp.motif_label")} *</Label>
              <Textarea
                placeholder={t("utilisations:rejet_temp.motif_placeholder")}
                value={rejetTempMotif}
                onChange={(e) => setRejetTempMotif(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("utilisations:rejet_temp.docs_label")} *</Label>
              <p className="text-xs text-muted-foreground">{t("utilisations:rejet_temp.docs_hint")}</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(showRejetTemp?.type === "DOUANIER" ? UTILISATION_DOC_TYPES_DOUANE : UTILISATION_DOC_TYPES_TVA).map((dt) => (
                  <label key={dt} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={rejetTempDocs.includes(dt)}
                      onCheckedChange={(checked) => {
                        setRejetTempDocs(prev =>
                          checked ? [...prev, dt] : prev.filter(d => d !== dt)
                        );
                      }}
                    />
                    <span className="text-sm">{tTypeDocument(dt)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejetTemp(null)}>{t("common:actions.cancel")}</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={rejetTempLoading || !rejetTempMotif.trim() || rejetTempDocs.length === 0}
              onClick={handleRejetTemp}
            >
              {rejetTempLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("utilisations:rejet_temp.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suppression définitive d'un brouillon */}
      <AlertDialog open={!!deletingTarget} onOpenChange={(o) => !o && setDeletingTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("utilisations:delete_draft.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("utilisations:delete_draft.description", { id: deletingTarget ? ` #${deletingTarget.id}` : "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLoading}>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingLoading}
              onClick={(e) => { e.preventDefault(); handleDeleteBrouillon(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("utilisations:delete_draft.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Ajouter une taxe au référentiel */}
      <Dialog open={showAddTaxe} onOpenChange={(o) => !addingTaxe && setShowAddTaxe(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("utilisations:create.add_taxe.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("utilisations:create.add_taxe.code")} *</Label>
              <Input className="uppercase" placeholder={t("utilisations:create.add_taxe.code_placeholder")} value={newTaxeCode} onChange={e => setNewTaxeCode(e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label>{t("utilisations:create.add_taxe.libelle")} *</Label>
              <Input placeholder={t("utilisations:create.add_taxe.libelle_placeholder")} value={newTaxeLibelle} onChange={e => setNewTaxeLibelle(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTaxe(false)} disabled={addingTaxe}>{t("common:actions.cancel")}</Button>
            <Button onClick={handleAddTaxe} disabled={addingTaxe}>
              {addingTaxe && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("common:actions.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Utilisations;
