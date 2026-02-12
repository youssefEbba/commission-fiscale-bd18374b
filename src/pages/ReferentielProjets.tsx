import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  referentielProjetApi, ReferentielProjetDto, ReferentielStatut,
  REFERENTIEL_STATUT_LABELS, REFERENTIEL_DOCUMENT_TYPES,
  DocumentDto, autoriteContractanteApi, AutoriteContractanteDto,
  CreateReferentielProjetRequest,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FolderOpen, Search, RefreshCw, Plus, Eye, Upload, Loader2,
  CheckCircle, XCircle, Send, Filter, FileText,
} from "lucide-react";

const STATUT_COLORS: Record<ReferentielStatut, string> = {
  BROUILLON: "bg-muted text-muted-foreground",
  EN_CONTROLE_DGB: "bg-orange-100 text-orange-800",
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
  const [form, setForm] = useState<CreateReferentielProjetRequest>({
    intitule: "",
    autoriteContractanteId: 0,
    bailleurFonds: "",
    dateSignature: "",
    dateDebut: "",
    dateFinPrevue: "",
    montantTotal: 0,
    deviseOrigine: "",
    equivalentMRU: 0,
    tauxChange: 0,
    description: "",
  });
  const [creating, setCreating] = useState(false);

  // Detail dialog
  const [selected, setSelected] = useState<ReferentielProjetDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  useEffect(() => {
    fetchProjets();
    if (isAC || isAdmin) fetchAutorites();
  }, []);

  const openDetail = async (p: ReferentielProjetDto) => {
    setSelected(p);
    setDocsLoading(true);
    try {
      const documents = await referentielProjetApi.getDocuments(p.id);
      setDocs(documents);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.intitule || !form.autoriteContractanteId) {
      toast({ title: "Erreur", description: "Intitulé et Autorité Contractante obligatoires", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await referentielProjetApi.create(form);
      toast({ title: "Succès", description: "Projet créé avec succès" });
      setCreateOpen(false);
      setForm({ intitule: "", autoriteContractanteId: 0, bailleurFonds: "", dateSignature: "", dateDebut: "", dateFinPrevue: "", montantTotal: 0, deviseOrigine: "", equivalentMRU: 0, tauxChange: 0, description: "" });
      fetchProjets();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleStatutChange = async (id: number, statut: ReferentielStatut) => {
    setActionLoading(id);
    try {
      await referentielProjetApi.updateStatut(id, statut);
      toast({ title: "Succès", description: `Statut mis à jour: ${REFERENTIEL_STATUT_LABELS[statut]}` });
      fetchProjets();
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, statut } : null);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSoumettre = async (id: number) => {
    setActionLoading(id);
    try {
      await referentielProjetApi.soumettre(id);
      toast({ title: "Succès", description: "Projet soumis au contrôle DGB" });
      fetchProjets();
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, statut: "EN_CONTROLE_DGB" as ReferentielStatut } : null);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpload = async () => {
    if (!selected || !uploadFile || !uploadType) return;
    setUploading(true);
    try {
      await referentielProjetApi.uploadDocument(selected.id, uploadType, uploadFile);
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
              Processus P1 – Création du référentiel projet / convention / don
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchProjets} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
            {(isAC || isAdmin) && (
              <Button onClick={() => { fetchAutorites(); setCreateOpen(true); }}>
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
                    <TableHead>Intitulé</TableHead>
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
                        <TableCell className="max-w-[200px] truncate">{p.intitule}</TableCell>
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
                          <div className="flex gap-1 justify-end flex-wrap">
                            <Button variant="ghost" size="sm" onClick={() => openDetail(p)}>
                              <Eye className="h-4 w-4 mr-1" /> Détail
                            </Button>
                            {/* AC: Soumettre au DGB */}
                            {isAC && p.statut === "BROUILLON" && (
                              <Button size="sm" disabled={actionLoading === p.id} onClick={() => handleSoumettre(p.id)}>
                                {actionLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                                Soumettre
                              </Button>
                            )}
                            {/* DGB: Valider ou Rejeter */}
                            {isDGB && p.statut === "EN_CONTROLE_DGB" && (
                              <>
                                <Button size="sm" disabled={actionLoading === p.id} onClick={() => handleStatutChange(p.id, "VALIDE")}>
                                  {actionLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                  Valider
                                </Button>
                                <Button variant="destructive" size="sm" disabled={actionLoading === p.id} onClick={() => handleStatutChange(p.id, "REJETE")}>
                                  <XCircle className="h-4 w-4 mr-1" /> Rejeter
                                </Button>
                              </>
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau Référentiel Projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Intitulé du projet *</Label>
                <Input value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })} placeholder="Nom du projet / convention" />
              </div>
              <div className="space-y-2">
                <Label>Autorité Contractante *</Label>
                <Select value={form.autoriteContractanteId ? String(form.autoriteContractanteId) : ""} onValueChange={(v) => setForm({ ...form, autoriteContractanteId: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {autorites.map((a) => (
                      <SelectItem key={a.id} value={String(a.id!)}>{a.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bailleur de fonds</Label>
                <Input value={form.bailleurFonds} onChange={(e) => setForm({ ...form, bailleurFonds: e.target.value })} placeholder="Nom du bailleur" />
              </div>
              <div className="space-y-2">
                <Label>Date de signature</Label>
                <Input type="date" value={form.dateSignature} onChange={(e) => setForm({ ...form, dateSignature: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input type="date" value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date de fin prévue</Label>
                <Input type="date" value={form.dateFinPrevue} onChange={(e) => setForm({ ...form, dateFinPrevue: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Devise d'origine</Label>
                <Input value={form.deviseOrigine} onChange={(e) => setForm({ ...form, deviseOrigine: e.target.value })} placeholder="EUR, USD..." />
              </div>
              <div className="space-y-2">
                <Label>Montant total</Label>
                <Input type="number" value={form.montantTotal || ""} onChange={(e) => setForm({ ...form, montantTotal: Number(e.target.value) })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Taux de change</Label>
                <Input type="number" step="0.0001" value={form.tauxChange || ""} onChange={(e) => setForm({ ...form, tauxChange: Number(e.target.value) })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Équivalent en MRU</Label>
                <Input type="number" value={form.equivalentMRU || ""} onChange={(e) => setForm({ ...form, equivalentMRU: Number(e.target.value) })} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description du projet..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>
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
                <div className="col-span-2">
                  <span className="text-muted-foreground">Intitulé</span>
                  <p className="font-medium">{selected.intitule}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Autorité Contractante</span>
                  <p className="font-medium">{selected.autoriteContractanteNom || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{REFERENTIEL_STATUT_LABELS[selected.statut]}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bailleur de fonds</span>
                  <p className="font-medium">{selected.bailleurFonds || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Devise</span>
                  <p className="font-medium">{selected.deviseOrigine || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant total</span>
                  <p className="font-medium">{selected.montantTotal?.toLocaleString("fr-FR") || "—"} {selected.deviseOrigine || ""}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Équivalent MRU</span>
                  <p className="font-medium">{selected.equivalentMRU?.toLocaleString("fr-FR") || "—"} MRU</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Taux de change</span>
                  <p className="font-medium">{selected.tauxChange || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Dates</span>
                  <p className="text-xs">
                    Signature: {selected.dateSignature || "—"}<br />
                    Début: {selected.dateDebut || "—"}<br />
                    Fin: {selected.dateFinPrevue || "—"}
                  </p>
                </div>
              </div>

              {selected.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Description</span>
                  <p className="text-sm mt-1">{selected.description}</p>
                </div>
              )}

              {/* Documents */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Documents du projet</h3>
                  {(isAC || isAdmin) && (
                    <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                      <Upload className="h-4 w-4 mr-1" /> Déposer un document
                    </Button>
                  )}
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

              {/* Workflow Actions in detail */}
              <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
                {isAC && selected.statut === "BROUILLON" && (
                  <Button disabled={actionLoading === selected.id} onClick={() => handleSoumettre(selected.id)}>
                    {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Soumettre au DGB
                  </Button>
                )}
                {isDGB && selected.statut === "EN_CONTROLE_DGB" && (
                  <>
                    <Button disabled={actionLoading === selected.id} onClick={() => handleStatutChange(selected.id, "VALIDE")}>
                      {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      Valider le référentiel
                    </Button>
                    <Button variant="destructive" disabled={actionLoading === selected.id} onClick={() => handleStatutChange(selected.id, "REJETE")}>
                      <XCircle className="h-4 w-4 mr-1" /> Rejeter
                    </Button>
                  </>
                )}
              </div>
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
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez le type" /></SelectTrigger>
                <SelectContent>
                  {REFERENTIEL_DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
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
    </DashboardLayout>
  );
};

export default ReferentielProjets;
