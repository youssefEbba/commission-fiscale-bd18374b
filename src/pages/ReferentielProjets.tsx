import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  referentielProjetApi, ReferentielProjetDto, ReferentielStatut,
  REFERENTIEL_STATUT_LABELS, REFERENTIEL_DOCUMENT_TYPES,
  DocumentDto, autoriteContractanteApi, AutoriteContractanteDto,
  CreateReferentielProjetRequest, TypeDocumentProjet,
  conventionApi, ConventionDto,
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
  FolderOpen, Search, RefreshCw, Plus, Eye, Upload, Loader2,
  CheckCircle, XCircle, Filter, FileText, AlertTriangle,
} from "lucide-react";

const STATUT_COLORS: Record<ReferentielStatut, string> = {
  EN_ATTENTE: "bg-orange-100 text-orange-800",
  VALIDE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
};

const ReferentielProjets = () => {
  const { user, hasRole } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();

  const [projets, setProjets] = useState<ReferentielProjetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [autorites, setAutorites] = useState<AutoriteContractanteDto[]>([]);
  const [form, setForm] = useState<CreateReferentielProjetRequest>({ autoriteContractanteId: 0, nomProjet: "", administrateurProjet: "", referenceBciSecteur: "" });
  const [creating, setCreating] = useState(false);
  const [validConventions, setValidConventions] = useState<ConventionDto[]>([]);
  const [selectedConventionId, setSelectedConventionId] = useState<string>("");

  // Detail dialog
  const [selected, setSelected] = useState<ReferentielProjetDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Upload dialog (detail)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<TypeDocumentProjet | "">("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectMotif, setRejectMotif] = useState("");

  // Convention documents in detail
  const [convDocs, setConvDocs] = useState<DocumentDto[]>([]);
  const [convDocsLoading, setConvDocsLoading] = useState(false);


  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isDGB = hasRole(["DGB"]);
  const isAdmin = hasRole(["ADMIN_SI", "PRESIDENT"]);

  const fetchProjets = async () => {
    setLoading(true);
    try {
      const data = await referentielProjetApi.getAll();
      setProjets(data);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les projets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchAutorites = async () => {
    try {
      const data = await autoriteContractanteApi.getAll();
      setAutorites(data);
    } catch { /* ignore */ }
  };

  const fetchValidConventions = async () => {
    try {
      const data = await conventionApi.getByStatut("VALIDE");
      setValidConventions(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchProjets();
    if (isAdmin) fetchAutorites();
  }, []);

  const openDetail = async (p: ReferentielProjetDto) => {
    setSelected(p);
    setDocsLoading(true);
    setConvDocsLoading(true);
    try {
      const documents = await referentielProjetApi.getDocuments(p.id);
      setDocs(documents);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
    // Fetch convention documents
    if (p.conventionId) {
      try {
        const cDocs = await conventionApi.getDocuments(p.conventionId);
        setConvDocs(cDocs);
      } catch {
        setConvDocs([]);
      } finally {
        setConvDocsLoading(false);
      }
    } else {
      setConvDocs([]);
      setConvDocsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.autoriteContractanteId && !isAC) {
      toast({ title: "Erreur", description: "Sélectionnez une Autorité Contractante", variant: "destructive" });
      return;
    }
    if (!selectedConventionId) {
      toast({ title: "Erreur", description: "Sélectionnez une convention validée", variant: "destructive" });
      return;
    }
    if (isAC && user) {
      form.autoriteContractanteId = user.autoriteContractanteId || null;
    }
    setCreating(true);
    try {
      await referentielProjetApi.create({
        ...form,
        conventionId: Number(selectedConventionId),
      });
      toast({ title: "Succès", description: "Projet créé avec succès" });
      setCreateOpen(false);
      setForm({ autoriteContractanteId: 0, nomProjet: "", administrateurProjet: "", referenceBciSecteur: "" });
      setSelectedConventionId("");
      fetchProjets();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleStatutChange = async (id: number, statut: "VALIDE" | "REJETE", motifRejet?: string) => {
    setActionLoading(id);
    try {
      await referentielProjetApi.updateStatut(id, statut, motifRejet);
      toast({ title: "Succès", description: `Statut mis à jour: ${REFERENTIEL_STATUT_LABELS[statut]}` });
      fetchProjets();
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, statut, motifRejet: motifRejet || prev.motifRejet } : null);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (id: number) => {
    setRejectId(id);
    setRejectMotif("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectId || !rejectMotif.trim()) {
      toast({ title: "Erreur", description: "Le motif de rejet est obligatoire", variant: "destructive" });
      return;
    }
    await handleStatutChange(rejectId, "REJETE", rejectMotif.trim());
    setRejectOpen(false);
    setRejectId(null);
    setRejectMotif("");
  };

  const handleUpload = async () => {
    if (!selected || !uploadFile || !uploadType) return;
    setUploading(true);
    try {
      await referentielProjetApi.uploadDocument(selected.id, uploadType as TypeDocumentProjet, uploadFile);
      toast({ title: "Succès", description: "Document déposé" });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadType("");
      const documents = await referentielProjetApi.getDocuments(selected.id);
      setDocs(documents);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const filtered = projets.filter((p) => {
    const matchSearch =
      (p.reference || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.intitule || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.autoriteContractanteNom || "").toLowerCase().includes(search.toLowerCase()) ||
      String(p.id).includes(search);
    const matchStatut = filterStatut === "ALL" || p.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const pageTitle: Record<string, string> = {
    AUTORITE_CONTRACTANTE: "Mes projets / Référentiels",
    DGB: "Référentiels à valider (Budget)",
    PRESIDENT: "Tous les référentiels",
    ADMIN_SI: "Tous les référentiels (Admin)",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" />
              {pageTitle[role] || "Référentiel Projet"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Création du référentiel projet / convention / don
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchProjets} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
            {(isAC || isAdmin) && (
              <Button onClick={() => { if (isAdmin) fetchAutorites(); fetchValidConventions(); setCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nouveau projet
              </Button>
            )}
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
              {Object.entries(REFERENTIEL_STATUT_LABELS).map(([k, v]) => (
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
                    <TableHead>Réf.</TableHead>
                    <TableHead>Nom du projet</TableHead>
                    <TableHead>Autorité Contractante</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun projet</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.reference || `#${p.id}`}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.nomProjet || p.intitule || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{p.autoriteContractanteNom || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.montantTotal ? `${p.montantTotal.toLocaleString("fr-FR")} ${p.deviseOrigine || ""}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUT_COLORS[p.statut] || ""}`}>
                            {REFERENTIEL_STATUT_LABELS[p.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {p.dateCreation ? new Date(p.dateCreation).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(p)}>
                            <Eye className="h-4 w-4 mr-1" /> Voir
                          </Button>
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FolderOpen className="h-5 w-5 text-primary" />
              Nouveau Référentiel Projet
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Associez une convention validée</p>
          </DialogHeader>
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">

            {/* Section 1: Autorité Contractante */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">1. Autorité Contractante</h3>
              {isAC ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user?.nomComplet}</p>
                    <p className="text-xs text-muted-foreground">Projet créé en votre nom</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Autorité Contractante *</Label>
                  <Select value={form.autoriteContractanteId ? String(form.autoriteContractanteId) : ""} onValueChange={(v) => setForm({ autoriteContractanteId: Number(v) })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner une autorité" /></SelectTrigger>
                    <SelectContent>
                      {autorites.map((a) => (
                        <SelectItem key={a.id} value={String(a.id!)}>{a.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Section 2: Informations du projet */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">2. Informations du projet</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">Nom du projet *</Label>
                <Input placeholder="Ex: Projet X" value={form.nomProjet || ""} onChange={(e) => setForm({ ...form, nomProjet: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Administrateur du projet</Label>
                <Input placeholder="Ex: DG Budget" value={form.administrateurProjet || ""} onChange={(e) => setForm({ ...form, administrateurProjet: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Référence BCI secteur</Label>
                <Input placeholder="Ex: BCI-SEC-2026-001" value={form.referenceBciSecteur || ""} onChange={(e) => setForm({ ...form, referenceBciSecteur: e.target.value })} />
              </div>
            </div>

            {/* Section 3: Convention */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">3. Convention associée</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">Convention validée *</Label>
                <Select value={selectedConventionId} onValueChange={setSelectedConventionId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une convention validée" /></SelectTrigger>
                  <SelectContent>
                    {validConventions.length === 0 ? (
                      <SelectItem value="_none" disabled>Aucune convention validée disponible</SelectItem>
                    ) : (
                      validConventions.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.reference} — {c.intitule}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {validConventions.length === 0 && (
                  <p className="text-xs text-destructive">Aucune convention validée. Créez et faites valider une convention d'abord.</p>
                )}
              </div>

              {/* Convention preview */}
              {selectedConventionId && (() => {
                const conv = validConventions.find(c => String(c.id) === selectedConventionId);
                if (!conv) return null;
                return (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">{conv.reference}</span>
                      <Badge className="bg-green-100 text-green-800 text-[10px]">Validée</Badge>
                    </div>
                    <p className="text-muted-foreground">{conv.intitule}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-border/50">
                      <p><span className="text-muted-foreground">Bailleur:</span> {conv.bailleur || "—"}</p>
                      <p><span className="text-muted-foreground">Devise:</span> {conv.deviseOrigine || "—"}</p>
                      {conv.montantDevise != null && <p><span className="text-muted-foreground">Montant:</span> {conv.montantDevise.toLocaleString("fr-FR")} {conv.deviseOrigine}</p>}
                      {conv.montantMru != null && <p><span className="text-muted-foreground">MRU:</span> {conv.montantMru.toLocaleString("fr-FR")}</p>}
                      {conv.dateDebut && <p><span className="text-muted-foreground">Début:</span> {conv.dateDebut}</p>}
                      {conv.dateFin && <p><span className="text-muted-foreground">Fin:</span> {conv.dateFin}</p>}
                      {conv.tauxChange != null && <p><span className="text-muted-foreground">Taux:</span> {conv.tauxChange}</p>}
                    </div>
                  </div>
                );
              })()}
            </div>


          </div>
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating || !selectedConventionId || !form.nomProjet?.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Créer le projet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Projet {selected?.reference || `#${selected?.id}`}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selected.nomProjet && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Nom du projet</span>
                    <p className="font-medium">{selected.nomProjet}</p>
                  </div>
                )}
                {selected.administrateurProjet && (
                  <div>
                    <span className="text-muted-foreground">Administrateur</span>
                    <p className="font-medium">{selected.administrateurProjet}</p>
                  </div>
                )}
                {selected.referenceBciSecteur && (
                  <div>
                    <span className="text-muted-foreground">Réf. BCI Secteur</span>
                    <p className="font-medium">{selected.referenceBciSecteur}</p>
                  </div>
                )}
                {selected.intitule && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Intitulé</span>
                    <p className="font-medium">{selected.intitule}</p>
                  </div>
                )}
                {selected.conventionReference && (
                  <div className="col-span-2 rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1">
                    <span className="text-muted-foreground text-xs">Convention</span>
                    <p className="font-medium text-sm">{selected.conventionReference} — {selected.conventionIntitule}</p>
                    {selected.conventionBailleur && <p className="text-xs text-muted-foreground">Bailleur: {selected.conventionBailleur}</p>}
                    {selected.conventionBailleurDetails && <p className="text-xs text-muted-foreground">Détails: {selected.conventionBailleurDetails}</p>}
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      {selected.conventionDateSignature && <p><span className="text-muted-foreground">Signature:</span> {selected.conventionDateSignature}</p>}
                      {selected.conventionDateDebut && <p><span className="text-muted-foreground">Début:</span> {selected.conventionDateDebut}</p>}
                      {selected.conventionDateFin && <p><span className="text-muted-foreground">Fin:</span> {selected.conventionDateFin}</p>}
                      {selected.conventionMontantDevise != null && <p><span className="text-muted-foreground">Montant:</span> {selected.conventionMontantDevise.toLocaleString("fr-FR")} {selected.conventionDeviseOrigine || ""}</p>}
                      {selected.conventionMontantMru != null && <p><span className="text-muted-foreground">MRU:</span> {selected.conventionMontantMru.toLocaleString("fr-FR")} MRU</p>}
                      {selected.conventionTauxChange != null && <p><span className="text-muted-foreground">Taux:</span> {selected.conventionTauxChange}</p>}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Autorité Contractante</span>
                  <p className="font-medium">{selected.autoriteContractanteNom || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{REFERENTIEL_STATUT_LABELS[selected.statut]}</Badge></p>
                </div>
                {selected.bailleurFonds && (
                  <div>
                    <span className="text-muted-foreground">Bailleur de fonds</span>
                    <p className="font-medium">{selected.bailleurFonds}</p>
                  </div>
                )}
                {selected.deviseOrigine && (
                  <div>
                    <span className="text-muted-foreground">Devise</span>
                    <p className="font-medium">{selected.deviseOrigine}</p>
                  </div>
                )}
                {selected.montantTotal != null && (
                  <div>
                    <span className="text-muted-foreground">Montant total</span>
                    <p className="font-medium">{selected.montantTotal.toLocaleString("fr-FR")} {selected.deviseOrigine || ""}</p>
                  </div>
                )}
                {selected.equivalentMRU != null && (
                  <div>
                    <span className="text-muted-foreground">Équivalent MRU</span>
                    <p className="font-medium">{selected.equivalentMRU.toLocaleString("fr-FR")} MRU</p>
                  </div>
                )}
                {selected.tauxChange != null && (
                  <div>
                    <span className="text-muted-foreground">Taux de change</span>
                    <p className="font-medium">{selected.tauxChange}</p>
                  </div>
                )}
                {(selected.dateSignature || selected.dateDebut || selected.dateFinPrevue) && (
                  <div>
                    <span className="text-muted-foreground">Dates</span>
                    <p className="text-xs">
                      {selected.dateSignature && <>Signature: {selected.dateSignature}<br /></>}
                      {selected.dateDebut && <>Début: {selected.dateDebut}<br /></>}
                      {selected.dateFinPrevue && <>Fin: {selected.dateFinPrevue}</>}
                    </p>
                  </div>
                )}
              </div>

              {selected.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Description</span>
                  <p className="text-sm mt-1">{selected.description}</p>
                </div>
              )}

              {/* Motif de rejet */}
              {selected.statut === "REJETE" && selected.motifRejet && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Motif de rejet
                  </div>
                  <p className="text-sm text-foreground">{selected.motifRejet}</p>
                </div>
              )}

              {/* Convention Documents */}
              {selected.conventionId && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Documents de la convention</h3>
                  {convDocsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : convDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun document associé à la convention</p>
                  ) : (
                    <div className="space-y-1">
                      {convDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="flex-1 truncate">{doc.nomFichier}</span>
                          <Badge variant="secondary" className="text-[10px]">{doc.type.replace(/_/g, " ")}</Badge>
                          {doc.chemin && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                              <a href={doc.chemin} target="_blank" rel="noopener noreferrer">Ouvrir</a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Documents du projet (upload pour AC uniquement) */}
              {(isAC || isAdmin) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Documents du projet</h3>
                    <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                      <Upload className="h-4 w-4 mr-1" /> Déposer un document
                    </Button>
                  </div>
                  {docsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : docs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun document déposé</p>
                  ) : (
                    <div className="space-y-1">
                      {docs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="flex-1 truncate">{doc.nomFichier}</span>
                          <Badge variant="secondary" className="text-[10px]">{doc.type.replace(/_/g, " ")}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Workflow Actions in detail (DGB only) */}
              {isDGB && selected.statut === "EN_ATTENTE" && (
                <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
                  <Button disabled={actionLoading === selected.id} onClick={() => handleStatutChange(selected.id, "VALIDE")}>
                    {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Valider le référentiel
                  </Button>
                  <Button variant="destructive" disabled={actionLoading === selected.id} onClick={() => openRejectDialog(selected.id)}>
                    <XCircle className="h-4 w-4 mr-1" /> Rejeter
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Déposer un document projet</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de document</Label>
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as TypeDocumentProjet)}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez le type" /></SelectTrigger>
                <SelectContent>
                  {REFERENTIEL_DOCUMENT_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fichier</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Annuler</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadType}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Déposer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Rejeter le référentiel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motif de rejet *</Label>
            <Textarea
              placeholder="Indiquez la raison du rejet..."
              value={rejectMotif}
              onChange={(e) => setRejectMotif(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectMotif.trim() || actionLoading !== null}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ReferentielProjets;
