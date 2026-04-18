import { useEffect, useState, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  conventionApi, ConventionDto, ConventionStatut,
  CONVENTION_STATUT_LABELS, CreateConventionRequest,
  DocumentDto, TypeDocumentConvention, CONVENTION_DOCUMENT_TYPES,
  bailleurApi, BailleurDto, CreateBailleurRequest,
  deviseApi, DeviseDto, CreateDeviseRequest,
  forexApi,
  documentRequirementApi, DocumentRequirementDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText, Search, RefreshCw, Plus, Loader2,
  CheckCircle, XCircle, Filter, Upload, File, Paperclip,
  ArrowUp, ArrowDown, Merge, MoreHorizontal, Eye, Edit,
  Trash2, Ban, ShieldCheck, ShieldX,
} from "lucide-react";

const STATUT_COLORS: Record<ConventionStatut | "ANNULEE", string> = {
  EN_ATTENTE: "bg-orange-100 text-orange-800",
  VALIDE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
  ANNULEE: "bg-gray-100 text-gray-800",
};

const Conventions = () => {
  const { user, hasRole } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();

  const [conventions, setConventions] = useState<ConventionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailConvention, setDetailConvention] = useState<ConventionDto | null>(null);

  // Edit dialog (AC only)
  const [editOpen, setEditOpen] = useState(false);
  const [editConvention, setEditConvention] = useState<ConventionDto | null>(null);
  const [editForm, setEditForm] = useState<CreateConventionRequest>({
    reference: "", intitule: "", bailleurId: undefined,
    dateSignature: "", dateFin: "",
    montantDevise: undefined, deviseOrigine: "", montantMru: undefined, tauxChange: undefined,
  });
  const [editing, setEditing] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectConvention, setRejectConvention] = useState<ConventionDto | null>(null);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Cancel dialog (AC only)
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConvention, setCancelConvention] = useState<ConventionDto | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateConventionRequest>({
    reference: "", intitule: "", bailleurId: undefined,
    dateSignature: "", dateFin: "",
    montantDevise: undefined, deviseOrigine: "", montantMru: undefined, tauxChange: undefined,
  });
  const [creating, setCreating] = useState(false);

  // Bailleurs reference
  const [bailleurs, setBailleurs] = useState<BailleurDto[]>([]);
  const [bailleursLoading, setBailleursLoading] = useState(false);
  const [addBailleurOpen, setAddBailleurOpen] = useState(false);
  const [newBailleur, setNewBailleur] = useState<CreateBailleurRequest>({ nom: "", details: "" });
  const [addingBailleur, setAddingBailleur] = useState(false);

  // Devises reference
  const [devises, setDevises] = useState<DeviseDto[]>([]);
  const [devisesLoading, setDevisesLoading] = useState(false);
  const [addDeviseOpen, setAddDeviseOpen] = useState(false);
  const [newDevise, setNewDevise] = useState<CreateDeviseRequest>({ code: "", libelle: "", symbole: "" });
  const [addingDevise, setAddingDevise] = useState(false);

  // Taux de change auto
  const [tauxLoading, setTauxLoading] = useState(false);

  // GED requirements
  const [gedRequirements, setGedRequirements] = useState<DocumentRequirementDto[]>([]);
  const [gedReqLoading, setGedReqLoading] = useState(false);

  // Documents in creation form
  const [createDocs, setCreateDocs] = useState<{ type: TypeDocumentConvention; file: File }[]>([]);
  const [createDocType, setCreateDocType] = useState<TypeDocumentConvention>("CONVENTION_CONTRAT");

  // Documents state
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsConvention, setDocsConvention] = useState<ConventionDto | null>(null);
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadType, setUploadType] = useState<TypeDocumentConvention>("CONVENTION_CONTRAT");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Document replace
  const [replaceDocId, setReplaceDocId] = useState<number | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isDGB = hasRole(["DGB"]);
  const isDGI = hasRole(["DGI"]);
  const isAdmin = hasRole(["ADMIN_SI", "PRESIDENT"]);

  const fetchConventions = async (q?: string) => {
    setLoading(true);
    try {
      const data = await conventionApi.getAll(q);
      setConventions(data);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les conventions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchBailleurs = async () => {
    setBailleursLoading(true);
    try { setBailleurs(await bailleurApi.getAll()); } catch { /* ignore */ } finally { setBailleursLoading(false); }
  };

  const defaultDevises: DeviseDto[] = [
    { id: -1, code: "EUR", libelle: "Euro", symbole: "€" },
    { id: -2, code: "USD", libelle: "Dollar américain", symbole: "$" },
  ];

  const fetchDevises = async () => {
    setDevisesLoading(true);
    try {
      const fetched = await deviseApi.getAll();
      // Merge: keep API results, add defaults if not already present
      const codes = new Set(fetched.map(d => d.code));
      const merged = [...fetched, ...defaultDevises.filter(d => !codes.has(d.code))];
      setDevises(merged);
    } catch {
      setDevises(defaultDevises);
    } finally { setDevisesLoading(false); }
  };

  useEffect(() => { fetchConventions(); }, []);

  // Recherche côté serveur (debounce 300 ms) — back filtre sur référence / intitulé / projectReference
  useEffect(() => {
    const t = setTimeout(() => { fetchConventions(search.trim() || undefined); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Load references + GED requirements when create dialog opens
  useEffect(() => {
    if (createOpen) {
      fetchBailleurs();
      fetchDevises();
      // Fetch GED requirements for CONVENTION
      setGedReqLoading(true);
      documentRequirementApi.getByProcessus("CONVENTION")
        .then(reqs => {
          setGedRequirements(reqs);
          if (reqs.length > 0) {
            setCreateDocType(reqs[0].typeDocument as TypeDocumentConvention);
          }
        })
        .catch(() => setGedRequirements([]))
        .finally(() => setGedReqLoading(false));
    }
  }, [createOpen]);

  // Auto-fetch taux when devise changes
  useEffect(() => {
    if (!form.deviseOrigine || form.deviseOrigine === "MRU") {
      setForm(f => ({ ...f, tauxChange: form.deviseOrigine === "MRU" ? 1 : undefined, montantMru: form.deviseOrigine === "MRU" && f.montantDevise ? f.montantDevise : undefined }));
      return;
    }
    let cancelled = false;
    setTauxLoading(true);
    forexApi.rate(form.deviseOrigine, "MRU")
      .then(res => {
        if (cancelled) return;
        const rate = Math.round(res.rate * 10000) / 10000;
        setForm(f => ({
          ...f,
          tauxChange: rate,
          montantMru: f.montantDevise ? Math.round(f.montantDevise * rate * 100) / 100 : undefined,
        }));
        toast({ title: "Taux récupéré", description: `1 ${form.deviseOrigine} = ${rate.toLocaleString("fr-FR")} MRU` });
      })
      .catch(() => {
        if (!cancelled) toast({ title: "Erreur", description: `Impossible de récupérer le taux pour ${form.deviseOrigine} → MRU`, variant: "destructive" });
      })
      .finally(() => { if (!cancelled) setTauxLoading(false); });
    return () => { cancelled = true; };
  }, [form.deviseOrigine]);

  const handleDeviseChange = (code: string) => {
    setForm(f => ({ ...f, deviseOrigine: code, tauxChange: undefined, montantMru: undefined }));
  };

  const handleAddBailleur = async () => {
    if (!newBailleur.nom.trim()) return;
    setAddingBailleur(true);
    try {
      const created = await bailleurApi.create(newBailleur);
      setBailleurs(prev => [...prev, created]);
      setForm(f => ({ ...f, bailleurId: created.id }));
      setAddBailleurOpen(false);
      setNewBailleur({ nom: "", details: "" });
      toast({ title: "Succès", description: "Bailleur ajouté" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setAddingBailleur(false);
    }
  };

  const handleAddDevise = async () => {
    if (!newDevise.code.trim() || !newDevise.libelle.trim()) return;
    setAddingDevise(true);
    try {
      const created = await deviseApi.create(newDevise);
      setDevises(prev => [...prev, created]);
      handleDeviseChange(created.code);
      setAddDeviseOpen(false);
      setNewDevise({ code: "", libelle: "", symbole: "" });
      toast({ title: "Succès", description: "Devise ajoutée" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setAddingDevise(false);
    }
  };

  const addCreateDoc = (file: File) => {
    setCreateDocs(prev => [...prev, { type: createDocType, file }]);
  };

  const removeCreateDoc = (index: number) => {
    setCreateDocs(prev => prev.filter((_, i) => i !== index));
  };

  const moveCreateDoc = (index: number, direction: "up" | "down") => {
    setCreateDocs(prev => {
      const newDocs = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newDocs.length) return prev;
      [newDocs[index], newDocs[targetIndex]] = [newDocs[targetIndex], newDocs[index]];
      return newDocs;
    });
  };

  const [merging, setMerging] = useState(false);

  const mergeCreateDocs = useCallback(async () => {
    const pdfFiles = createDocs
      .filter(d => d.file.type === "application/pdf" || d.file.name.toLowerCase().endsWith(".pdf"))
      .map(d => d.file);
    if (pdfFiles.length < 2) {
      toast({ title: "Fusion impossible", description: "Il faut au moins 2 fichiers PDF à fusionner.", variant: "destructive" });
      return;
    }
    setMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of pdfFiles) {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }
      const mergedBytes = await mergedPdf.save();
      const mergedBlob = new Blob([mergedBytes as BlobPart], { type: "application/pdf" });
      const mergedFile = new window.File([mergedBlob], "convention_fusionnee.pdf", { type: "application/pdf" });
      // Replace all docs with the single merged file typed as CONVENTION_JOIGNED_DOCUMENT
      setCreateDocs([{ type: "CONVENTION_JOIGNED_DOCUMENT" as TypeDocumentConvention, file: mergedFile }]);
      toast({ title: "Succès", description: `${pdfFiles.length} PDF fusionnés. Le document résultant sera soumis comme CONVENTION_JOIGNED_DOCUMENT.` });
    } catch (e: any) {
      toast({ title: "Erreur de fusion", description: e.message || "Impossible de fusionner les PDF", variant: "destructive" });
    } finally {
      setMerging(false);
    }
  }, [createDocs, toast]);

  const mergeExistingDocs = async () => {
    if (documents.length < 2) return;
    const pdfDocs = documents.filter(d => d.nomFichier?.toLowerCase().endsWith(".pdf") && d.chemin);
    if (pdfDocs.length < 2) {
      toast({ title: "Fusion impossible", description: "Il faut au moins 2 fichiers PDF.", variant: "destructive" });
      return;
    }
    setMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const doc of pdfDocs) {
        const response = await fetch(doc.chemin!);
        const bytes = await response.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }
      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes) as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `convention_${docsConvention?.reference || "merged"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Succès", description: `${pdfDocs.length} PDF fusionnés.` });
    } catch (e: any) {
      toast({ title: "Erreur de fusion", description: e.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  };

  const handleCreate = async () => {
    if (!form.reference || !form.intitule) {
      toast({ title: "Erreur", description: "Référence et intitulé sont obligatoires", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const created = await conventionApi.create(form);
      for (const doc of createDocs) {
        try {
          await conventionApi.uploadDocument(created.id, doc.type, doc.file);
        } catch {
          toast({ title: "Attention", description: `Échec upload: ${doc.file.name}`, variant: "destructive" });
        }
      }
      toast({ title: "Succès", description: `Convention créée${createDocs.length ? ` avec ${createDocs.length} document(s)` : ""}` });
      setCreateOpen(false);
      setForm({
        reference: "", intitule: "", bailleurId: undefined,
        dateSignature: "", dateFin: "",
        montantDevise: undefined, deviseOrigine: "", montantMru: undefined, tauxChange: undefined,
      });
      setCreateDocs([]);
      fetchConventions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleStatutChange = async (id: number, statut: "VALIDE" | "REJETE") => {
    setActionLoading(id);
    try {
      await conventionApi.updateStatut(id, statut);
      toast({ title: "Succès", description: `Convention ${CONVENTION_STATUT_LABELS[statut].toLowerCase()}` });
      fetchConventions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // Open detail dialog
  const openDetail = (conv: ConventionDto) => {
    setDetailConvention(conv);
    setDetailOpen(true);
  };

  // Open edit dialog (AC only)
  const openEdit = (conv: ConventionDto) => {
    setEditConvention(conv);
    setEditForm({
      reference: conv.reference || "",
      intitule: conv.intitule || "",
      bailleurId: conv.bailleurId,
      bailleurDetails: conv.bailleurDetails || "",
      dateSignature: conv.dateSignature || "",
      dateFin: conv.dateFin || "",
      montantDevise: conv.montantDevise,
      deviseOrigine: conv.deviseOrigine || "",
      montantMru: conv.montantMru,
      tauxChange: conv.tauxChange,
    });
    fetchBailleurs();
    fetchDevises();
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editConvention || !editForm.reference || !editForm.intitule) return;
    setEditing(true);
    try {
      await conventionApi.update(editConvention.id, editForm);
      toast({ title: "Succès", description: "Convention modifiée" });
      setEditOpen(false);
      fetchConventions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setEditing(false);
    }
  };

  // Open reject dialog
  const openReject = (conv: ConventionDto) => {
    setRejectConvention(conv);
    setRejectMotif("");
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!rejectConvention || !rejectMotif.trim()) return;
    setRejecting(true);
    try {
      await conventionApi.updateStatut(rejectConvention.id, "REJETE", rejectMotif);
      toast({ title: "Succès", description: "Convention rejetée" });
      setRejectOpen(false);
      fetchConventions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setRejecting(false);
    }
  };

  // Cancel convention (AC only)
  const openCancel = (conv: ConventionDto) => {
    setCancelConvention(conv);
    setCancelOpen(true);
  };

  const handleCancel = async () => {
    if (!cancelConvention) return;
    setCancelling(true);
    try {
      await conventionApi.updateStatut(cancelConvention.id, "ANNULEE");
      toast({ title: "Succès", description: "Convention annulée" });
      setCancelOpen(false);
      fetchConventions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const openDocuments = async (conv: ConventionDto) => {
    setDocsConvention(conv);
    setDocsOpen(true);
    setDocsLoading(true);
    try {
      const docs = await conventionApi.getDocuments(conv.id);
      setDocuments(docs);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les documents", variant: "destructive" });
    } finally {
      setDocsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!docsConvention || !uploadFile) return;
    setUploading(true);
    try {
      await conventionApi.uploadDocument(docsConvention.id, uploadType, uploadFile);
      toast({ title: "Succès", description: "Document uploadé" });
      setUploadFile(null);
      const docs = await conventionApi.getDocuments(docsConvention.id);
      setDocuments(docs);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConvDoc = async (docId: number) => {
    if (!docsConvention) return;
    try {
      await conventionApi.deleteDocument(docsConvention.id, docId);
      toast({ title: "Succès", description: "Document supprimé" });
      const docs = await conventionApi.getDocuments(docsConvention.id);
      setDocuments(docs);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleReplaceConvDoc = async () => {
    if (!docsConvention || !replaceDocId || !replaceFile) return;
    setReplacing(true);
    try {
      await conventionApi.replaceDocument(docsConvention.id, replaceDocId, replaceFile);
      toast({ title: "Succès", description: "Document remplacé" });
      setReplaceDocId(null);
      setReplaceFile(null);
      const docs = await conventionApi.getDocuments(docsConvention.id);
      setDocuments(docs);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setReplacing(false);
    }
  };

  const filtered = conventions.filter((c) => {
    const s = search.toLowerCase();
    const matchSearch = !s || (
      (c.reference || "").toLowerCase().includes(s) ||
      (c.projectReference || "").toLowerCase().includes(s) ||
      (c.intitule || "").toLowerCase().includes(s) ||
      (c.bailleurNom || c.bailleur || "").toLowerCase().includes(s)
    );
    const matchStatut = filterStatut === "ALL" || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Conventions
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestion des conventions de financement
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchConventions(search.trim() || undefined)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
            {(isAC || isAdmin) && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle convention
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher (réf., intitulé, projet, bailleur)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(CONVENTION_STATUT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                   <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Intitulé</TableHead>
                      <TableHead>Bailleur</TableHead>
                      <TableHead>Montant Devise</TableHead>
                      <TableHead>Montant MRU</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Aucune convention trouvée
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium whitespace-nowrap">{c.reference || `#${c.id}`}</TableCell>
                          <TableCell className="max-w-[220px] truncate" title={c.intitule || ""}>{c.intitule || "—"}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{c.bailleurNom || c.bailleur || "—"}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {c.montantDevise ? `${c.montantDevise.toLocaleString("fr-FR")} ${c.deviseOrigine || ""}` : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {c.montantMru ? `${c.montantMru.toLocaleString("fr-FR")} MRU` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${STATUT_COLORS[c.statut] || ""}`}>
                              {CONVENTION_STATUT_LABELS[c.statut]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {c.dateCreation ? new Date(c.dateCreation).toLocaleDateString("fr-FR") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openDetail(c)}>
                                  <Eye className="h-4 w-4 mr-2" /> Voir les détails
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDocuments(c)}>
                                  <Paperclip className="h-4 w-4 mr-2" /> Documents
                                </DropdownMenuItem>
                                {(isDGB || isDGI) && c.statut === "EN_ATTENTE" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleStatutChange(c.id, "VALIDE")}>
                                      <ShieldCheck className="h-4 w-4 mr-2 text-green-600" /> Valider
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openReject(c)}>
                                      <ShieldX className="h-4 w-4 mr-2 text-destructive" /> Rejeter
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {(isAC || isAdmin) && c.statut !== "VALIDE" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openEdit(c)}>
                                      <Edit className="h-4 w-4 mr-2" /> Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openCancel(c)} className="text-destructive">
                                      <Ban className="h-4 w-4 mr-2" /> Annuler la convention
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle Convention</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Référence *</Label>
              <Input value={form.reference} onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="CONV-2026-001" />
            </div>
            <div className="space-y-2">
              <Label>Intitulé *</Label>
              <Input value={form.intitule} onChange={(e) => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder="Convention de financement..." />
            </div>

            {/* Bailleur - dropdown + add */}
            <div className="space-y-2">
              <Label>Bailleur de fonds *</Label>
              <div className="flex gap-2">
                <Select
                  value={form.bailleurId != null ? String(form.bailleurId) : ""}
                  onValueChange={(v) => setForm(f => ({ ...f, bailleurId: v ? Number(v) : undefined }))}
                >
                  <SelectTrigger className="flex-1">
                    {bailleursLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Sélectionner un bailleur" />}
                  </SelectTrigger>
                  <SelectContent>
                    {bailleurs.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setAddBailleurOpen(true)} title="Ajouter un bailleur">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descriptif de projets</Label>
              <Input value={form.bailleurDetails} onChange={(e) => setForm(f => ({ ...f, bailleurDetails: e.target.value }))} placeholder="Description du projet financé..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date signature</Label>
                <Input type="date" value={form.dateSignature} onChange={(e) => setForm(f => ({ ...f, dateSignature: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input type="date" value={form.dateFin} onChange={(e) => setForm(f => ({ ...f, dateFin: e.target.value }))} />
              </div>
            </div>

            {/* Devise - dropdown + add */}
            <div className="space-y-2">
              <Label>Devise d'origine</Label>
              <div className="flex gap-2">
                <Select value={form.deviseOrigine || ""} onValueChange={handleDeviseChange}>
                  <SelectTrigger className="flex-1">
                    {devisesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Sélectionner une devise" />}
                  </SelectTrigger>
                  <SelectContent>
                    {devises.map((d) => (
                      <SelectItem key={d.id} value={d.code}>{d.code} — {d.libelle} {d.symbole ? `(${d.symbole})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setAddDeviseOpen(true)} title="Ajouter une devise">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-2">
                <Label>Montant devise</Label>
                <Input type="number" value={form.montantDevise ?? ""} onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setForm(f => ({ ...f, montantDevise: val, montantMru: val && f.tauxChange ? Math.round(val * f.tauxChange * 100) / 100 : undefined }));
                }} placeholder="1200000" />
              </div>
              <div className="space-y-2">
                <Label>Taux de change</Label>
                <Input readOnly value={form.tauxChange ?? "—"} className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Montant MRU (auto)</Label>
                <Input readOnly value={form.montantMru ? form.montantMru.toLocaleString("fr-FR") : "—"} className="bg-muted" />
              </div>
            </div>
            {tauxLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Récupération du taux de change...
              </div>
            )}

            {/* Documents section - follows GED configuration */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Documents joints
              </Label>
              {gedReqLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement des exigences GED...
                </div>
              ) : gedRequirements.length > 0 ? (
                <div className="space-y-1">
                  {gedRequirements
                    .sort((a, b) => (a.ordreAffichage || 0) - (b.ordreAffichage || 0))
                    .map((req) => {
                      const docsForType = createDocs.filter(d => d.type === req.typeDocument);
                      const hasDoc = docsForType.length > 0;
                      return (
                        <div key={req.id} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${req.obligatoire && !hasDoc ? "bg-destructive/10" : hasDoc ? "bg-green-50" : "bg-muted/30"}`}>
                          {hasDoc ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className={`h-3.5 w-3.5 shrink-0 ${req.obligatoire ? "text-destructive" : "text-muted-foreground"}`} />
                          )}
                          <span className={req.obligatoire && !hasDoc ? "text-destructive font-medium" : ""}>
                            {req.typeDocument}
                          </span>
                          {hasDoc && <span className="text-muted-foreground">({docsForType.length} fichier{docsForType.length > 1 ? "s" : ""})</span>}
                          {req.obligatoire && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">Obligatoire</Badge>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune exigence GED configurée pour les conventions.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={createDocType} onValueChange={(v) => setCreateDocType(v as TypeDocumentConvention)}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(gedRequirements.length > 0
                      ? gedRequirements
                          .sort((a, b) => (a.ordreAffichage || 0) - (b.ordreAffichage || 0))
                          .map(r => ({ value: r.typeDocument, label: r.typeDocument }))
                      : CONVENTION_DOCUMENT_TYPES
                    ).map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="file"
                  multiple
                  className="flex-1"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files) {
                      Array.from(files).forEach(file => addCreateDoc(file));
                      e.target.value = "";
                    }
                  }}
                />
              </div>
              {createDocs.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {createDocs.length} fichier(s) — Réordonnez puis fusionnez les PDF
                    </span>
                    {createDocs.filter(d => d.file.name.toLowerCase().endsWith(".pdf")).length >= 2 && (
                      <Button type="button" variant="outline" size="sm" onClick={mergeCreateDocs} disabled={merging}>
                        {merging ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Merge className="h-4 w-4 mr-1" />}
                        Fusionner PDF
                      </Button>
                    )}
                  </div>
                  {createDocs.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1.5">
                      <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">{i + 1}</span>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0" disabled={i === 0} onClick={() => moveCreateDoc(i, "up")}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0" disabled={i === createDocs.length - 1} onClick={() => moveCreateDoc(i, "down")}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Badge variant="outline" className="text-xs shrink-0">
                        {d.type}
                      </Badge>
                      <span className="truncate flex-1">{d.file.name}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeCreateDoc(i)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={
              creating || !form.reference || !form.intitule ||
              (gedRequirements.length > 0
                ? gedRequirements.filter(r => r.obligatoire).some(r => !createDocs.some(d => d.type === r.typeDocument))
                : !createDocs.some(d => d.type === "CONVENTION_CONTRAT"))
            }>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Bailleur Dialog */}
      <Dialog open={addBailleurOpen} onOpenChange={setAddBailleurOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau bailleur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={newBailleur.nom} onChange={(e) => setNewBailleur(b => ({ ...b, nom: e.target.value }))} placeholder="Banque Mondiale" />
            </div>
            <div className="space-y-2">
              <Label>Détails</Label>
              <Input value={newBailleur.details} onChange={(e) => setNewBailleur(b => ({ ...b, details: e.target.value }))} placeholder="Description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBailleurOpen(false)}>Annuler</Button>
            <Button onClick={handleAddBailleur} disabled={addingBailleur || !newBailleur.nom.trim()}>
              {addingBailleur ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Devise Dialog */}
      <Dialog open={addDeviseOpen} onOpenChange={setAddDeviseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle devise</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input value={newDevise.code} onChange={(e) => setNewDevise(d => ({ ...d, code: e.target.value.toUpperCase() }))} placeholder="EUR" maxLength={5} />
            </div>
            <div className="space-y-2">
              <Label>Libellé *</Label>
              <Input value={newDevise.libelle} onChange={(e) => setNewDevise(d => ({ ...d, libelle: e.target.value }))} placeholder="Euro" />
            </div>
            <div className="space-y-2">
              <Label>Symbole</Label>
              <Input value={newDevise.symbole} onChange={(e) => setNewDevise(d => ({ ...d, symbole: e.target.value }))} placeholder="€" maxLength={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDeviseOpen(false)}>Annuler</Button>
            <Button onClick={handleAddDevise} disabled={addingDevise || !newDevise.code.trim() || !newDevise.libelle.trim()}>
              {addingDevise ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documents Dialog */}
      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Documents — {docsConvention?.reference || docsConvention?.intitule}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            {(isAC || isAdmin) && docsConvention?.statut !== "VALIDE" && docsConvention?.statut !== "ANNULEE" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Ajouter un document</Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={uploadType} onValueChange={(v) => setUploadType(v as TypeDocumentConvention)}>
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONVENTION_DOCUMENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                    <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                      Envoyer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Merge button for existing docs */}
            {!docsLoading && documents.filter(d => d.nomFichier?.toLowerCase().endsWith(".pdf")).length >= 2 && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={mergeExistingDocs} disabled={merging}>
                  {merging ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Merge className="h-4 w-4 mr-1" />}
                  Fusionner tous les PDF
                </Button>
              </div>
            )}

            {docsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <File className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>Aucun document associé</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Nom du fichier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {CONVENTION_DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{doc.nomFichier}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {doc.dateUpload ? new Date(doc.dateUpload).toLocaleDateString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {doc.chemin && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={doc.chemin} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4 mr-1" /> Ouvrir
                              </a>
                            </Button>
                          )}
                          {(isAC || isAdmin) && docsConvention?.statut !== "VALIDE" && docsConvention?.statut !== "ANNULEE" && (
                            <>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setReplaceDocId(doc.id); setReplaceFile(null); }}>
                                Remplacer
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive" onClick={() => handleDeleteConvDoc(doc.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {/* Inline replace file input */}
            {replaceDocId && (
              <div className="flex items-center gap-2 border border-border rounded-lg p-2">
                <Input type="file" onChange={(e) => setReplaceFile(e.target.files?.[0] || null)} className="flex-1" />
                <Button size="sm" onClick={handleReplaceConvDoc} disabled={replacing || !replaceFile}>
                  {replacing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Confirmer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setReplaceDocId(null); setReplaceFile(null); }}>
                  ✕
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Détails de la convention
            </DialogTitle>
          </DialogHeader>
          {detailConvention && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Référence :</span> <span className="font-medium">{detailConvention.reference || "—"}</span></div>
                <div><span className="text-muted-foreground">Statut :</span> <Badge className={`text-xs ml-1 ${STATUT_COLORS[detailConvention.statut] || ""}`}>{CONVENTION_STATUT_LABELS[detailConvention.statut] || detailConvention.statut}</Badge></div>
              </div>
              <div><span className="text-muted-foreground">Intitulé :</span> <span className="font-medium">{detailConvention.intitule || "—"}</span></div>
              <div><span className="text-muted-foreground">Bailleur :</span> {detailConvention.bailleurNom || detailConvention.bailleur || "—"}</div>
              <div><span className="text-muted-foreground">Descriptif :</span> {detailConvention.bailleurDetails || "—"}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Date signature :</span> {detailConvention.dateSignature ? new Date(detailConvention.dateSignature).toLocaleDateString("fr-FR") : "—"}</div>
                <div><span className="text-muted-foreground">Date fin :</span> {detailConvention.dateFin ? new Date(detailConvention.dateFin).toLocaleDateString("fr-FR") : "—"}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><span className="text-muted-foreground">Montant devise :</span><br />{detailConvention.montantDevise ? `${detailConvention.montantDevise.toLocaleString("fr-FR")} ${detailConvention.deviseOrigine || ""}` : "—"}</div>
                <div><span className="text-muted-foreground">Taux :</span><br />{detailConvention.tauxChange ?? "—"}</div>
                <div><span className="text-muted-foreground">Montant MRU :</span><br />{detailConvention.montantMru ? `${detailConvention.montantMru.toLocaleString("fr-FR")} MRU` : "—"}</div>
              </div>
              {detailConvention.autoriteContractanteNom && (
                <div><span className="text-muted-foreground">Autorité contractante :</span> {detailConvention.autoriteContractanteNom}</div>
              )}
              {detailConvention.motifRejet && (
                <div className="bg-destructive/10 rounded p-2"><span className="text-destructive font-medium">Motif de rejet :</span> {detailConvention.motifRejet}</div>
              )}
              <div><span className="text-muted-foreground">Créée le :</span> {detailConvention.dateCreation ? new Date(detailConvention.dateCreation).toLocaleDateString("fr-FR") : "—"}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (AC only) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" /> Modifier la convention
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Référence *</Label>
              <Input value={editForm.reference} onChange={(e) => setEditForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Intitulé *</Label>
              <Input value={editForm.intitule} onChange={(e) => setEditForm(f => ({ ...f, intitule: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Bailleur</Label>
              <Select
                value={editForm.bailleurId != null ? String(editForm.bailleurId) : ""}
                onValueChange={(v) => setEditForm(f => ({ ...f, bailleurId: v ? Number(v) : undefined }))}
              >
                <SelectTrigger>
                  {bailleursLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Sélectionner" />}
                </SelectTrigger>
                <SelectContent>
                  {bailleurs.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descriptif</Label>
              <Input value={editForm.bailleurDetails} onChange={(e) => setEditForm(f => ({ ...f, bailleurDetails: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date signature</Label>
                <Input type="date" value={editForm.dateSignature} onChange={(e) => setEditForm(f => ({ ...f, dateSignature: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input type="date" value={editForm.dateFin} onChange={(e) => setEditForm(f => ({ ...f, dateFin: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Montant devise</Label>
                <Input type="number" value={editForm.montantDevise ?? ""} onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setEditForm(f => ({ ...f, montantDevise: val, montantMru: val && f.tauxChange ? Math.round(val * f.tauxChange * 100) / 100 : undefined }));
                }} />
              </div>
              <div className="space-y-2">
                <Label>Taux</Label>
                <Input readOnly value={editForm.tauxChange ?? "—"} className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>MRU</Label>
                <Input readOnly value={editForm.montantMru ? editForm.montantMru.toLocaleString("fr-FR") : "—"} className="bg-muted" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={editing || !editForm.reference || !editForm.intitule}>
              {editing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="h-5 w-5" /> Rejeter la convention
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Convention : <span className="font-medium text-foreground">{rejectConvention?.reference || rejectConvention?.intitule}</span>
            </p>
            <div className="space-y-2">
              <Label>Motif du rejet *</Label>
              <Textarea
                value={rejectMotif}
                onChange={(e) => setRejectMotif(e.target.value)}
                placeholder="Indiquer le motif du rejet..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting || !rejectMotif.trim()}>
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog (AC only) */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" /> Annuler la convention
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir annuler la convention <span className="font-medium text-foreground">{cancelConvention?.reference || cancelConvention?.intitule}</span> ? Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Non, garder</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
              Oui, annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Conventions;
