import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  utilisationCreditApi, UtilisationCreditDto, UtilisationStatut, UtilisationType,
  CreateUtilisationCreditRequest, UTILISATION_STATUT_LABELS,
  certificatCreditApi, CertificatCreditDto,
  UTILISATION_DOCUMENT_TYPES, UTILISATION_DOC_TYPES_DOUANE, UTILISATION_DOC_TYPES_TVA,
  TypeDocumentUtilisation, DocumentDto,
  documentRequirementApi, DocumentRequirementDto,
  DecisionCorrectionDto, DecisionType,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Landmark, Search, RefreshCw, Loader2, Plus, Eye, Filter, Upload, FileText, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const STATUT_COLORS: Record<UtilisationStatut, string> = {
  DEMANDEE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION: "bg-yellow-100 text-yellow-800",
  VISE: "bg-purple-100 text-purple-800",
  VALIDEE: "bg-emerald-100 text-emerald-800",
  LIQUIDEE: "bg-green-100 text-green-800",
  APUREE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
};

// Type-aware transitions: DGD handles Douane, DGTCP handles TVA + Douane final steps
const getTransitions = (role: string, type?: UtilisationType): { from: UtilisationStatut[]; to: UtilisationStatut; label: string }[] => {
  if (role === "DGD") {
    return [
      { from: ["DEMANDEE"], to: "EN_VERIFICATION", label: "Vérifier" },
      { from: ["EN_VERIFICATION"], to: "VISE", label: "Viser" },
      { from: ["DEMANDEE", "EN_VERIFICATION"], to: "REJETEE", label: "Rejeter" },
    ];
  }
    if (role === "DGTCP") {
    if (type === "DOUANIER") {
      return [
        { from: ["VISE"], to: "LIQUIDEE", label: "Liquider" },
        { from: ["VISE"], to: "REJETEE", label: "Rejeter" },
      ];
    }
    if (type === "TVA_INTERIEURE") {
      return [
        { from: ["DEMANDEE"], to: "EN_VERIFICATION", label: "Vérifier" },
        { from: ["EN_VERIFICATION"], to: "VALIDEE", label: "Valider" },
        { from: ["VALIDEE"], to: "APUREE", label: "Apurer" },
        { from: ["DEMANDEE", "EN_VERIFICATION", "VALIDEE"], to: "REJETEE", label: "Rejeter" },
      ];
    }
  }
  return [];
};

const emptyDouane: Partial<CreateUtilisationCreditRequest> = {
  type: "DOUANIER", montant: undefined, numeroDeclaration: "", numeroBulletin: "",
  dateDeclaration: "", montantDroits: undefined, montantTVA: undefined, enregistreeSYDONIA: false,
};

const emptyTVA: Partial<CreateUtilisationCreditRequest> = {
  type: "TVA_INTERIEURE", montant: undefined, typeAchat: "", numeroFacture: "",
  dateFacture: "", montantTVAInterieure: undefined, numeroDecompte: "",
};

const Utilisations = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<UtilisationCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [tab, setTab] = useState("all");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<UtilisationType>("DOUANIER");
  const [form, setForm] = useState<Partial<CreateUtilisationCreditRequest>>({ ...emptyDouane });
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [creating, setCreating] = useState(false);

  // Detail dialog
  const [selected, setSelected] = useState<UtilisationCreditDto | null>(null);

  // Liquidation Douane dialog
  const [liquidationTarget, setLiquidationTarget] = useState<UtilisationCreditDto | null>(null);
  const [liqDroits, setLiqDroits] = useState("");
  const [liqTVA, setLiqTVA] = useState("");
  const [liqLoading, setLiqLoading] = useState(false);

  // Apurement TVA dialog
  const [apurementTarget, setApurementTarget] = useState<UtilisationCreditDto | null>(null);
  const [apurMontant, setApurMontant] = useState("");
  const [apurLoading, setApurLoading] = useState(false);

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

  const fetchData = async () => {
    setLoading(true);
    try { setData(await utilisationCreditApi.getAll()); }
    catch { toast({ title: "Erreur", description: "Impossible de charger les utilisations", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = async () => {
    setCreateType("DOUANIER");
    setForm({ ...emptyDouane, entrepriseId: (user as any)?.entrepriseId });
    setCreateDocFiles({});
    try {
      const [certs, extReqs, intReqs] = await Promise.all([
        role === "ENTREPRISE" && (user as any)?.entrepriseId
          ? certificatCreditApi.getByEntreprise((user as any).entrepriseId)
          : certificatCreditApi.getAll(),
        documentRequirementApi.getByProcessus("UTILISATION_CI_EXTERIEUR").catch(() => []),
        documentRequirementApi.getByProcessus("UTILISATION_CI_INTERIEUR").catch(() => []),
      ]);
      setCertificats(certs);
      // Use backend requirements if available, otherwise build fallback from doc type constants
      if (extReqs.length > 0 || intReqs.length > 0) {
        // Merge backend data: ensure processus field is normalized
        const allReqs = [...extReqs, ...intReqs].map(r => ({
          ...r,
          // Normalize: if backend returns generic "UTILISATION_CI", map based on doc type
          processus: r.processus === "UTILISATION_CI"
            ? (UTILISATION_DOC_TYPES_TVA.some(dt => dt.value === r.typeDocument && !UTILISATION_DOC_TYPES_DOUANE.some(dd => dd.value === r.typeDocument))
              ? "UTILISATION_CI_INTERIEUR" as const
              : "UTILISATION_CI_EXTERIEUR" as const)
            : r.processus,
        }));
        setGedRequirements(allReqs);
      } else {
        // Fallback: build from hardcoded doc type constants
        const fallbackExt: DocumentRequirementDto[] = UTILISATION_DOC_TYPES_DOUANE.map((dt, i) => ({
          id: -(i + 1),
          processus: "UTILISATION_CI_EXTERIEUR" as const,
          typeDocument: dt.value,
          obligatoire: dt.value === "DEMANDE_UTILISATION",
          typesAutorises: ["PDF" as const, "IMAGE" as const, "WORD" as const, "EXCEL" as const],
          ordreAffichage: i,
          description: dt.label,
        }));
        const fallbackInt: DocumentRequirementDto[] = UTILISATION_DOC_TYPES_TVA.map((dt, i) => ({
          id: -(100 + i),
          processus: "UTILISATION_CI_INTERIEUR" as const,
          typeDocument: dt.value,
          obligatoire: dt.value === "DEMANDE_UTILISATION",
          typesAutorises: ["PDF" as const, "IMAGE" as const, "WORD" as const, "EXCEL" as const],
          ordreAffichage: i,
          description: dt.label,
        }));
        setGedRequirements([...fallbackExt, ...fallbackInt]);
      }
    } catch { /* ignore */ }
    setShowCreate(true);
  };

  const handleCreateTypeChange = (t: UtilisationType) => {
    setCreateType(t);
    setForm({ ...(t === "DOUANIER" ? emptyDouane : emptyTVA), certificatCreditId: form.certificatCreditId, entrepriseId: form.entrepriseId });
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
    return getFilteredRequirements().filter((r) => r.obligatoire && !createDocFiles[r.typeDocument]);
  };

  const handleCreate = async () => {
    if (!form.certificatCreditId) {
      toast({ title: "Erreur", description: "Certificat requis", variant: "destructive" });
      return;
    }
    const missing = getMissingObligatoryDocs();
    if (missing.length > 0) {
      toast({
        title: "Documents manquants",
        description: `Veuillez joindre : ${missing.map((m) => formatDocLabel(m.typeDocument)).join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      // Sanitize: replace empty strings with null/undefined so backend enums don't choke
      const sanitized: Record<string, any> = {};
      for (const [k, v] of Object.entries(form)) {
        sanitized[k] = v === "" ? null : v;
      }
      const created = await utilisationCreditApi.create(sanitized as CreateUtilisationCreditRequest);
      // Upload all attached documents
      const uploadEntries = Object.entries(createDocFiles);
      if (uploadEntries.length > 0) {
        for (const [type, file] of uploadEntries) {
          await utilisationCreditApi.uploadDocument(created.id, type as TypeDocumentUtilisation, file);
        }
      }
      toast({ title: "Succès", description: `Utilisation créée avec ${uploadEntries.length} document(s)` });
      setShowCreate(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleStatut = async (id: number, statut: UtilisationStatut) => {
    setActionLoading(id);
    try {
      await utilisationCreditApi.updateStatut(id, statut);
      toast({ title: "Succès", description: `Statut: ${UTILISATION_STATUT_LABELS[statut]}` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleRejetTemp = async () => {
    if (!showRejetTemp || !rejetTempMotif.trim() || rejetTempDocs.length === 0) return;
    setRejetTempLoading(true);
    try {
      await utilisationCreditApi.postDecision(showRejetTemp.id, "REJET_TEMP", rejetTempMotif.trim(), rejetTempDocs);
      toast({ title: "Succès", description: "Rejet temporaire envoyé — documents demandés" });
      setShowRejetTemp(null);
      setRejetTempMotif("");
      setRejetTempDocs([]);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
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
      toast({ title: "Succès", description: "Document uploadé" });
      setDocFile(null);
      setDocs(await utilisationCreditApi.getDocuments(docDialog));
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  // transitions are now per-row, see rendering below

  const filtered = data.filter((u) => {
    const ms = (u.certificatReference || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.entrepriseNom || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.numeroDeclaration || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.numeroFacture || "").toLowerCase().includes(search.toLowerCase()) ||
      String(u.id).includes(search);
    const matchStatut = filterStatut === "ALL" || u.statut === filterStatut;
    const matchTab = tab === "all" ||
      (tab === "DOUANIER" && u.type === "DOUANIER") ||
      (tab === "TVA_INTERIEURE" && u.type === "TVA_INTERIEURE");
    return ms && matchStatut && matchTab;
  });

  const canCreate = role === "ENTREPRISE" || role === "AUTORITE_CONTRACTANTE" || role === "ADMIN_SI";

  const pageTitle: Record<string, string> = {
    ENTREPRISE: "Mes utilisations de crédit",
    DGD: "Utilisations Douane – Vérification",
    DGTCP: "Utilisations – Imputation & apurement",
    DGI: "Utilisations – Consultation",
    ADMIN_SI: "Toutes les utilisations (Audit)",
  };

  const f = (v: any) => v != null ? Number(v).toLocaleString("fr-FR") : "—";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Landmark className="h-6 w-6 text-primary" />
              {pageTitle[role] || "Utilisations de crédit"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Douane (SYDONIA) & TVA Intérieure</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nouvelle utilisation</Button>
            )}
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="DOUANIER">Douane (SYDONIA)</TabsTrigger>
            <TabsTrigger value="TVA_INTERIEURE">TVA Intérieure</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(UTILISATION_STATUT_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
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
                    <TableHead>#</TableHead>
                    <TableHead>Certificat</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Réf. métier</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune utilisation</TableCell></TableRow>
                  ) : filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">#{u.id}</TableCell>
                      <TableCell className="text-muted-foreground">{u.certificatReference || `Cert #${u.certificatCreditId}`}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {u.type === "DOUANIER" ? "Douane" : u.type === "TVA_INTERIEURE" ? "TVA Int." : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.type === "DOUANIER" ? (u.numeroDeclaration || u.numeroBulletin || "—") : (u.numeroFacture || u.numeroDecompte || "—")}
                      </TableCell>
                      <TableCell>{f(u.montant)} MRU</TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[u.statut]}`}>{UTILISATION_STATUT_LABELS[u.statut]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/utilisations/${u.id}`)} title="Voir détail">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDocs(u.id)}><FileText className="h-4 w-4" /></Button>
                          {getTransitions(role, u.type).map((t) =>
                            t.from.includes(u.statut) ? (
                              <Button
                                key={t.to}
                                variant={t.to === "REJETEE" ? "destructive" : "default"}
                                size="sm"
                                disabled={actionLoading === u.id}
                                onClick={() => {
                                  // Douane + LIQUIDEE → open dedicated dialog
                                   if (u.type === "DOUANIER" && t.to === "LIQUIDEE") {
                                    setLiquidationTarget(u);
                                    setLiqDroits("");
                                    setLiqTVA("");
                                  } else if (u.type === "TVA_INTERIEURE" && t.to === "APUREE") {
                                    setApurementTarget(u);
                                    setApurMontant("");
                                  } else {
                                    handleStatut(u.id, t.to);
                                  }
                                }}
                              >
                                {actionLoading === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t.label}
                              </Button>
                            ) : null
                          )}
                          {/* REJET_TEMP button (DGD/DGTCP) */}
                          {(role === "DGD" || role === "DGTCP") && ["DEMANDEE", "EN_VERIFICATION", "VISE", "VALIDEE"].includes(u.statut) && (
                            <Button variant="outline" size="sm" className="text-amber-600 border-amber-300" onClick={() => { setShowRejetTemp(u); setRejetTempMotif(""); setRejetTempDocs([]); }}>
                              <AlertTriangle className="h-4 w-4 mr-1" /> Rejet temp.
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

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Utilisation #{selected?.id}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Type</span><p className="font-medium">{selected.type === "DOUANIER" ? "Crédit Douanier (SYDONIA)" : "TVA Intérieure"}</p></div>
                <div><span className="text-muted-foreground">Statut</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{UTILISATION_STATUT_LABELS[selected.statut]}</Badge></p></div>
                <div><span className="text-muted-foreground">Certificat</span><p className="font-medium">{selected.certificatReference || `#${selected.certificatCreditId}`}</p></div>
                <div><span className="text-muted-foreground">Montant</span><p className="font-bold text-primary">{f(selected.montant)} MRU</p></div>
                {selected.entrepriseNom && <div><span className="text-muted-foreground">Entreprise</span><p>{selected.entrepriseNom}</p></div>}
                {selected.dateCreation && <div><span className="text-muted-foreground">Date création</span><p>{new Date(selected.dateCreation).toLocaleDateString("fr-FR")}</p></div>}
                {selected.dateLiquidation && <div><span className="text-muted-foreground">Date liquidation</span><p>{new Date(selected.dateLiquidation).toLocaleDateString("fr-FR")}</p></div>}
              </div>
              {selected.type === "DOUANIER" && (
                <div className="border-t pt-3 mt-3">
                  <h4 className="font-semibold mb-2">Données Douane (SYDONIA)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">N° Déclaration</span><p>{selected.numeroDeclaration || "—"}</p></div>
                    <div><span className="text-muted-foreground">N° Bulletin</span><p>{selected.numeroBulletin || "—"}</p></div>
                    <div><span className="text-muted-foreground">Date déclaration</span><p>{selected.dateDeclaration ? new Date(selected.dateDeclaration).toLocaleDateString("fr-FR") : "—"}</p></div>
                    <div><span className="text-muted-foreground">Droits</span><p>{f(selected.montantDroits)} MRU</p></div>
                    <div><span className="text-muted-foreground">TVA Douane</span><p>{f(selected.montantTVADouane)} MRU</p></div>
                    <div><span className="text-muted-foreground">SYDONIA</span><p>{selected.enregistreeSYDONIA ? "✅ Oui" : "❌ Non"}</p></div>
                  </div>
                </div>
              )}
              {selected.type === "TVA_INTERIEURE" && (
                <div className="border-t pt-3 mt-3">
                  <h4 className="font-semibold mb-2">Données TVA Intérieure</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Type achat</span><p>{selected.typeAchat || "—"}</p></div>
                    <div><span className="text-muted-foreground">N° Facture</span><p>{selected.numeroFacture || "—"}</p></div>
                    <div><span className="text-muted-foreground">Date facture</span><p>{selected.dateFacture ? new Date(selected.dateFacture).toLocaleDateString("fr-FR") : "—"}</p></div>
                    <div><span className="text-muted-foreground">TVA Intérieure</span><p>{f(selected.montantTVAInterieure)} MRU</p></div>
                    <div><span className="text-muted-foreground">N° Décompte</span><p>{selected.numeroDecompte || "—"}</p></div>
                  </div>
                  {/* Traçabilité TVA (après apurement) */}
                  {selected.statut === "APUREE" && selected.tvaNette != null && (
                    <div className="mt-3 p-3 rounded-lg border bg-muted/50 space-y-2">
                      <h5 className="font-semibold text-sm flex items-center gap-1"><Info className="h-4 w-4" /> Traçabilité apurement</h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">TVA déductible utilisée</span><p className="font-medium">{f(selected.tvaDeductibleUtilisee)} MRU</p></div>
                        <div><span className="text-muted-foreground">TVA nette</span><p className={`font-bold ${(selected.tvaNette ?? 0) > 0 ? "text-destructive" : (selected.tvaNette ?? 0) < 0 ? "text-emerald-600" : ""}`}>{f(selected.tvaNette)} MRU</p></div>
                        <div><span className="text-muted-foreground">Crédit intérieur utilisé</span><p className="font-medium">{f(selected.creditInterieurUtilise)} MRU</p></div>
                        <div><span className="text-muted-foreground">Paiement entreprise</span><p className="font-medium">{f(selected.paiementEntreprise)} MRU</p></div>
                        <div><span className="text-muted-foreground">Report à nouveau</span><p className="font-medium">{f(selected.reportANouveau)} MRU</p></div>
                        <div className="col-span-2 border-t pt-1 flex justify-between">
                          <span className="text-muted-foreground">Solde TVA : {f(selected.soldeTVAAvant)} → {f(selected.soldeTVAApres)} MRU</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Decisions history */}
              {decisions.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Historique des décisions</h4>
                  <div className="space-y-2">
                    {decisions.map((d) => (
                      <div key={d.id} className={`p-2 rounded border text-xs ${d.decision === "REJET_TEMP" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={d.decision === "REJET_TEMP" ? "destructive" : "default"} className="text-[10px]">{d.decision}</Badge>
                          <span className="text-muted-foreground">{d.utilisateurNom || d.role}</span>
                          {d.dateDecision && <span className="text-muted-foreground">{new Date(d.dateDecision).toLocaleDateString("fr-FR")}</span>}
                        </div>
                        {d.motifRejet && <p className="text-muted-foreground mb-1">{d.motifRejet}</p>}
                        {d.documentsDemandes && d.documentsDemandes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-muted-foreground">Documents demandés :</span>
                            {d.documentsDemandes.map((doc) => (
                              <Badge key={doc} variant="outline" className="text-[10px]">{doc.replace(/_/g, " ")}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle utilisation de crédit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Tabs value={createType} onValueChange={(v) => handleCreateTypeChange(v as UtilisationType)}>
              <TabsList className="w-full">
                <TabsTrigger value="DOUANIER" className="flex-1">Douane (SYDONIA)</TabsTrigger>
                <TabsTrigger value="TVA_INTERIEURE" className="flex-1">TVA Intérieure</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-3">
              <div>
                <Label>Certificat de crédit *</Label>
                <Select value={form.certificatCreditId ? String(form.certificatCreditId) : ""} onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un certificat" /></SelectTrigger>
                  <SelectContent>
                    {certificats.filter(c => c.statut === "OUVERT").map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.reference || c.numero || `#${c.id}`} — {c.entrepriseRaisonSociale || c.entrepriseNom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {createType === "DOUANIER" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>N° Déclaration *</Label><Input placeholder="DEC-2024-001" value={form.numeroDeclaration || ""} onChange={e => setForm({ ...form, numeroDeclaration: e.target.value })} /></div>
                    <div><Label>N° Bulletin *</Label><Input placeholder="BUL-2024-001" value={form.numeroBulletin || ""} onChange={e => setForm({ ...form, numeroBulletin: e.target.value })} /></div>
                  </div>
                  <div><Label>Date déclaration</Label><Input type="date" value={form.dateDeclaration || ""} onChange={e => setForm({ ...form, dateDeclaration: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Montant Droits (MRU) *</Label><Input type="number" min="0" placeholder="0" value={form.montantDroits ?? ""} onChange={e => setForm({ ...form, montantDroits: e.target.value ? Number(e.target.value) : undefined })} /></div>
                    <div><Label>Montant TVA import (MRU) *</Label><Input type="number" min="0" placeholder="0" value={form.montantTVA ?? ""} onChange={e => setForm({ ...form, montantTVA: e.target.value ? Number(e.target.value) : undefined })} /></div>
                  </div>
                  {form.montantDroits != null && form.montantTVA != null && (
                    <div className="p-2 rounded bg-muted text-sm">Montant total : <strong>{((form.montantDroits || 0) + (form.montantTVA || 0)).toLocaleString("fr-FR")} MRU</strong> (auto-calculé)</div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch checked={form.enregistreeSYDONIA || false} onCheckedChange={v => setForm({ ...form, enregistreeSYDONIA: v })} />
                    <Label>Enregistrée dans SYDONIA</Label>
                  </div>
                </>
              )}

              {createType === "TVA_INTERIEURE" && (
                <>
                  <div>
                    <Label>Type d'achat *</Label>
                    <Select value={form.typeAchat || ""} onValueChange={(v) => setForm({ ...form, typeAchat: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner le type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACHAT_LOCAL">Achat Local</SelectItem>
                        <SelectItem value="DECOMPTE">Décompte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.typeAchat === "ACHAT_LOCAL" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>N° Facture *</Label><Input placeholder="FAC-2024-042" value={form.numeroFacture || ""} onChange={e => setForm({ ...form, numeroFacture: e.target.value })} /></div>
                      <div><Label>Date facture</Label><Input type="date" value={form.dateFacture || ""} onChange={e => setForm({ ...form, dateFacture: e.target.value })} /></div>
                    </div>
                  )}
                  {form.typeAchat === "DECOMPTE" && (
                    <div><Label>N° Décompte *</Label><Input placeholder="DEC-TRAV-003" value={form.numeroDecompte || ""} onChange={e => setForm({ ...form, numeroDecompte: e.target.value })} /></div>
                  )}
                  <div><Label>Montant TVA Intérieure (MRU) *</Label><Input type="number" min="0" placeholder="0" value={form.montantTVAInterieure ?? ""} onChange={e => setForm({ ...form, montantTVAInterieure: e.target.value ? Number(e.target.value) : undefined })} /></div>
                </>
              )}
            </div>

            {/* Documents requis (GED) */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Documents requis
                {getFilteredRequirements().length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({getMissingObligatoryDocs().length > 0
                      ? `${getMissingObligatoryDocs().length} obligatoire(s) manquant(s)`
                      : "Tous les documents obligatoires sont joints"})
                  </span>
                )}
              </h4>
              {getFilteredRequirements().length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement des exigences documentaires...
                </p>
              ) : (
                <div className="space-y-2">
                  {getFilteredRequirements().map((req) => {
                    const hasFile = !!createDocFiles[req.typeDocument];
                    return (
                      <div key={req.id} className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm ${hasFile ? "border-emerald-300 bg-emerald-50/50" : req.obligatoire ? "border-orange-300 bg-orange-50/50" : "border-border"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {hasFile ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : req.obligatoire ? <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <span className="font-medium truncate">{formatDocLabel(req.typeDocument)}</span>
                            {req.obligatoire && <Badge variant="destructive" className="text-[10px] px-1 py-0 shrink-0">Obligatoire</Badge>}
                            {req.description && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" /></TooltipTrigger>
                                  <TooltipContent><p className="max-w-xs text-xs">{req.description}</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          {hasFile && <span className="text-xs text-emerald-600 ml-5.5">{createDocFiles[req.typeDocument].name}</span>}
                        </div>
                        <div className="shrink-0">
                          <Label htmlFor={`doc-${req.typeDocument}`} className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors">
                            <Upload className="h-3 w-3" />
                            {hasFile ? "Remplacer" : "Choisir"}
                          </Label>
                          <input
                            id={`doc-${req.typeDocument}`}
                            type="file"
                            className="hidden"
                            accept={req.typesAutorises?.map(f => f === "PDF" ? ".pdf" : f === "WORD" ? ".doc,.docx" : f === "EXCEL" ? ".xls,.xlsx" : f === "IMAGE" ? ".jpg,.jpeg,.png" : "").join(",")}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setCreateDocFiles((prev) => ({ ...prev, [req.typeDocument]: file }));
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Soumettre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Documents dialog */}
      <Dialog open={docDialog !== null} onOpenChange={() => { setDocDialog(null); setDocs([]); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Documents — Utilisation #{docDialog}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {docsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : docs.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Aucun document</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {docs.filter(d => d.actif !== false).map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2 rounded border text-sm">
                    <div>
                      <span className="font-medium">{d.nomFichier}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{d.type} — v{d.version || 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1"><Upload className="h-4 w-4" /> Ajouter un document</h4>
              <Select value={docType} onValueChange={(v) => setDocType(v as TypeDocumentUtilisation)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(() => {
                    const sel = data.find(u => u.id === docDialog);
                    const types = sel?.type === "DOUANIER" ? UTILISATION_DOC_TYPES_DOUANE : sel?.type === "TVA_INTERIEURE" ? UTILISATION_DOC_TYPES_TVA : UTILISATION_DOCUMENT_TYPES;
                    return types.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
              <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
              <Button onClick={handleUpload} disabled={uploading || !docFile} className="w-full">
                {uploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Uploader
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Liquidation Douane dialog (DGTCP) */}
      <Dialog open={!!liquidationTarget} onOpenChange={() => setLiquidationTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Liquidation Douane — Utilisation #{liquidationTarget?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Saisissez les montants d'imputation pour liquider cette utilisation. Le solde du certificat sera automatiquement débité.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="liq-droits">Montant Droits de douane (MRU) *</Label>
                <Input
                  id="liq-droits"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={liqDroits}
                  onChange={(e) => setLiqDroits(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="liq-tva">Montant TVA Douane (MRU) *</Label>
                <Input
                  id="liq-tva"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={liqTVA}
                  onChange={(e) => setLiqTVA(e.target.value)}
                />
              </div>
              {liqDroits && liqTVA && (
                <div className="p-3 rounded-lg bg-muted text-sm">
                  <span className="text-muted-foreground">Total imputation :</span>{" "}
                  <span className="font-bold text-primary">
                    {(Number(liqDroits) + Number(liqTVA)).toLocaleString("fr-FR")} MRU
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setLiquidationTarget(null)}>Annuler</Button>
              <Button
                disabled={liqLoading || !liqDroits || !liqTVA || (Number(liqDroits) + Number(liqTVA)) <= 0}
                onClick={async () => {
                  if (!liquidationTarget) return;
                  setLiqLoading(true);
                  try {
                    await utilisationCreditApi.liquiderDouane(liquidationTarget.id, Number(liqDroits), Number(liqTVA));
                    toast({ title: "Succès", description: "Utilisation liquidée — solde mis à jour" });
                    setLiquidationTarget(null);
                    fetchData();
                  } catch (e: any) {
                    toast({ title: "Erreur", description: e.message, variant: "destructive" });
                  } finally { setLiqLoading(false); }
                }}
              >
                {liqLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmer la liquidation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apurement TVA dialog (DGTCP) */}
      <Dialog open={!!apurementTarget} onOpenChange={() => setApurementTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apurement TVA — Utilisation #{apurementTarget?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Saisissez le montant de TVA déductible (issue des importations) à imputer sur cette utilisation. Le système calculera la TVA nette et appliquera les 3 cas métier automatiquement.
            </p>
            {apurementTarget && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">TVA collectée (montant TVA) :</span><span className="font-semibold">{f(apurementTarget.montantTVAInterieure)} MRU</span></div>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <Label htmlFor="apur-tva-ded">TVA déductible à utiliser (MRU) *</Label>
                <Input
                  id="apur-tva-ded"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={apurMontant}
                  onChange={(e) => setApurMontant(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Montant de TVA déductible (provenant des liquidations Douane) à déduire de la TVA collectée.</p>
              </div>
              {apurMontant && apurementTarget?.montantTVAInterieure != null && (
                <div className="p-3 rounded-lg border space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">TVA collectée :</span><span>{f(apurementTarget.montantTVAInterieure)} MRU</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">TVA déductible :</span><span>- {f(Number(apurMontant))} MRU</span></div>
                  <div className="border-t pt-1 flex justify-between font-bold">
                    <span>TVA nette :</span>
                    <span className={
                      (apurementTarget.montantTVAInterieure - Number(apurMontant)) > 0 ? "text-destructive" :
                      (apurementTarget.montantTVAInterieure - Number(apurMontant)) < 0 ? "text-emerald-600" : "text-muted-foreground"
                    }>
                      {f(apurementTarget.montantTVAInterieure - Number(apurMontant))} MRU
                    </span>
                  </div>
                  {(apurementTarget.montantTVAInterieure - Number(apurMontant)) > 0 && (
                    <p className="text-xs text-amber-600 mt-1">⚠ Cas 2 : TVA nette positive — le solde TVA sera débité, un paiement complémentaire sera requis si le solde est insuffisant.</p>
                  )}
                  {(apurementTarget.montantTVAInterieure - Number(apurMontant)) < 0 && (
                    <p className="text-xs text-emerald-600 mt-1">✅ Cas 3 : TVA nette négative — un report à nouveau sera ajouté au solde TVA.</p>
                  )}
                  {(apurementTarget.montantTVAInterieure - Number(apurMontant)) === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">➡ Cas 1 : TVA nette nulle — opération neutre.</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setApurementTarget(null)}>Annuler</Button>
              <Button
                disabled={apurLoading || !apurMontant || Number(apurMontant) < 0}
                onClick={async () => {
                  if (!apurementTarget) return;
                  setApurLoading(true);
                  try {
                    await utilisationCreditApi.apurerTVA(apurementTarget.id, Number(apurMontant));
                    toast({ title: "Succès", description: "Utilisation apurée — TVA nette calculée et solde mis à jour" });
                    setApurementTarget(null);
                    fetchData();
                  } catch (e: any) {
                    toast({ title: "Erreur", description: e.message, variant: "destructive" });
                  } finally { setApurLoading(false); }
                }}
              >
                {apurLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmer l'apurement
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
              Rejet temporaire — Demander des compléments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Utilisation #{showRejetTemp?.id} — {showRejetTemp?.entrepriseNom || ""}
            </p>
            <div className="space-y-2">
              <Label>Motif *</Label>
              <Textarea
                placeholder="Précisez les corrections ou compléments attendus..."
                value={rejetTempMotif}
                onChange={(e) => setRejetTempMotif(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Documents à corriger / compléter *</Label>
              <p className="text-xs text-muted-foreground">Sélectionnez au moins un document</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(showRejetTemp?.type === "DOUANIER" ? UTILISATION_DOC_TYPES_DOUANE : UTILISATION_DOC_TYPES_TVA).map((dt) => (
                  <label key={dt.value} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={rejetTempDocs.includes(dt.value)}
                      onCheckedChange={(checked) => {
                        setRejetTempDocs(prev =>
                          checked ? [...prev, dt.value] : prev.filter(d => d !== dt.value)
                        );
                      }}
                    />
                    <span className="text-sm">{dt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejetTemp(null)}>Annuler</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={rejetTempLoading || !rejetTempMotif.trim() || rejetTempDocs.length === 0}
              onClick={handleRejetTemp}
            >
              {rejetTempLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer le rejet temporaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

function formatDocLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bCi\b/g, "CI")
    .replace(/\bTva\b/g, "TVA");
}

export default Utilisations;
