import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  conventionApi, ConventionDto, ConventionStatut,
  CONVENTION_STATUT_LABELS, CreateConventionRequest,
  DocumentDto, TypeDocumentConvention, CONVENTION_DOCUMENT_TYPES,
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
import {
  FileText, Search, RefreshCw, Plus, Loader2,
  CheckCircle, XCircle, Filter, Upload, File, Paperclip,
} from "lucide-react";

const STATUT_COLORS: Record<ConventionStatut, string> = {
  EN_ATTENTE: "bg-orange-100 text-orange-800",
  VALIDE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
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

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateConventionRequest>({
    reference: "", intitule: "", bailleur: "", bailleurDetails: "",
    dateSignature: "", dateDebut: "", dateFin: "",
    montantDevise: undefined, deviseOrigine: "", montantMru: undefined, tauxChange: undefined,
  });
  const [creating, setCreating] = useState(false);

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

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isDGB = hasRole(["DGB"]);
  const isAdmin = hasRole(["ADMIN_SI", "PRESIDENT"]);

  const fetchConventions = async () => {
    setLoading(true);
    try {
      const data = await conventionApi.getAll();
      setConventions(data);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les conventions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConventions(); }, []);

  const addCreateDoc = (file: File) => {
    setCreateDocs(prev => [...prev, { type: createDocType, file }]);
  };

  const removeCreateDoc = (index: number) => {
    setCreateDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!form.reference || !form.intitule) {
      toast({ title: "Erreur", description: "Référence et intitulé sont obligatoires", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const created = await conventionApi.create(form);
      // Upload attached documents
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
        reference: "", intitule: "", bailleur: "", bailleurDetails: "",
        dateSignature: "", dateDebut: "", dateFin: "",
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

  const filtered = conventions.filter((c) => {
    const matchSearch =
      (c.reference || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.intitule || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.bailleur || "").toLowerCase().includes(search.toLowerCase());
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
            <Button variant="outline" onClick={fetchConventions} disabled={loading}>
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
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                        <TableCell className="font-medium">{c.reference || `#${c.id}`}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{c.intitule || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.bailleur || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.montantDevise ? `${c.montantDevise.toLocaleString("fr-FR")} ${c.deviseOrigine || ""}` : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.montantMru ? `${c.montantMru.toLocaleString("fr-FR")} MRU` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUT_COLORS[c.statut] || ""}`}>
                            {CONVENTION_STATUT_LABELS[c.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {c.dateCreation ? new Date(c.dateCreation).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => openDocuments(c)}>
                              <Paperclip className="h-4 w-4 mr-1" /> Documents
                            </Button>
                            {isDGB && c.statut === "EN_ATTENTE" && (
                              <>
                                <Button size="sm" disabled={actionLoading === c.id} onClick={() => handleStatutChange(c.id, "VALIDE")}>
                                  {actionLoading === c.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                  Valider
                                </Button>
                                <Button variant="destructive" size="sm" disabled={actionLoading === c.id} onClick={() => handleStatutChange(c.id, "REJETE")}>
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
            <div className="space-y-2">
              <Label>Bailleur de fonds *</Label>
              <Input value={form.bailleur} onChange={(e) => setForm(f => ({ ...f, bailleur: e.target.value }))} placeholder="Banque mondiale..." />
            </div>
            <div className="space-y-2">
              <Label>Détails bailleur</Label>
              <Input value={form.bailleurDetails} onChange={(e) => setForm(f => ({ ...f, bailleurDetails: e.target.value }))} placeholder="Siège, type de prêt..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Date signature</Label>
                <Input type="date" value={form.dateSignature} onChange={(e) => setForm(f => ({ ...f, dateSignature: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date début</Label>
                <Input type="date" value={form.dateDebut} onChange={(e) => setForm(f => ({ ...f, dateDebut: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input type="date" value={form.dateFin} onChange={(e) => setForm(f => ({ ...f, dateFin: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant devise</Label>
                <Input type="number" value={form.montantDevise ?? ""} onChange={(e) => setForm(f => ({ ...f, montantDevise: e.target.value ? Number(e.target.value) : undefined }))} placeholder="1200000" />
              </div>
              <div className="space-y-2">
                <Label>Devise d'origine</Label>
                <Input value={form.deviseOrigine} onChange={(e) => setForm(f => ({ ...f, deviseOrigine: e.target.value }))} placeholder="EUR" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant MRU</Label>
                <Input type="number" value={form.montantMru ?? ""} onChange={(e) => setForm(f => ({ ...f, montantMru: e.target.value ? Number(e.target.value) : undefined }))} placeholder="52000000" />
              </div>
              <div className="space-y-2">
                <Label>Taux de change</Label>
                <Input type="number" step="0.01" value={form.tauxChange ?? ""} onChange={(e) => setForm(f => ({ ...f, tauxChange: e.target.value ? Number(e.target.value) : undefined }))} placeholder="43.33" />
              </div>
            </div>

            {/* Documents section */}
            <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Documents joints
              </Label>
              {!createDocs.some(d => d.type === "CONVENTION_CONTRAT") && (
                <p className="text-xs text-destructive">Le document Convention/contrat est obligatoire.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={createDocType} onValueChange={(v) => setCreateDocType(v as TypeDocumentConvention)}>
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
                  className="flex-1"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      addCreateDoc(file);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
              {createDocs.length > 0 && (
                <div className="space-y-1">
                  {createDocs.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1.5">
                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Badge variant="outline" className="text-xs shrink-0">
                        {CONVENTION_DOCUMENT_TYPES.find(t => t.value === d.type)?.label || d.type}
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
            <Button onClick={handleCreate} disabled={creating || !form.reference || !form.intitule || !createDocs.some(d => d.type === "CONVENTION_CONTRAT")}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Créer
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
            {/* Upload section */}
            {(isAC || isAdmin) && (
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

            {/* Documents list */}
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
                        {doc.chemin && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={doc.chemin} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-4 w-4 mr-1" /> Ouvrir
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Conventions;
