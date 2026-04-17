import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  marcheApi, MarcheDto, CreateMarcheRequest, StatutMarche, MARCHE_STATUT_LABELS,
  delegueApi, DelegueDto,
  conventionApi, ConventionDto,
  DocumentDto, MARCHE_DOCUMENT_TYPES, TypeDocumentMarche,
  formatApiErrorMessage,
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
import { Gavel, Plus, RefreshCw, Loader2, Search, Edit, UserPlus, UserRoundPlus, X, FileText, Ban } from "lucide-react";
import { CreateDelegueRequest, ROLE_LABELS } from "@/lib/api";
import DocumentGED from "@/components/ged/DocumentGED";

const STATUT_COLORS: Record<StatutMarche, string> = {
  EN_COURS: "bg-blue-100 text-blue-800",
  AVENANT: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

const Marches = () => {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [marches, setMarches] = useState<MarcheDto[]>([]);
  const [conventions, setConventions] = useState<ConventionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarcheDto | null>(null);
  const [form, setForm] = useState<CreateMarcheRequest>({ conventionId: 0, numeroMarche: "", intitule: "", dateSignature: "", montantContratHt: undefined, statut: "EN_COURS" });
  const [submitting, setSubmitting] = useState(false);

  // Assign delegate dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMarche, setAssignMarche] = useState<MarcheDto | null>(null);
  const [delegues, setDelegues] = useState<DelegueDto[]>([]);
  const [selectedDelegue, setSelectedDelegue] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Inline create delegate
  const [showCreateDelegue, setShowCreateDelegue] = useState(false);
  const [delegueForm, setDelegueForm] = useState<CreateDelegueRequest>({ username: "", password: "", role: "AUTORITE_UPM", nomComplet: "", email: "" });
  const [creatingDelegue, setCreatingDelegue] = useState(false);

  // GED Documents
  const [gedOpen, setGedOpen] = useState(false);
  const [gedMarche, setGedMarche] = useState<MarcheDto | null>(null);
  const [gedDocs, setGedDocs] = useState<DocumentDto[]>([]);
  const [gedLoading, setGedLoading] = useState(false);

  // Cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMarche, setCancelMarche] = useState<MarcheDto | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchMarches = async (q?: string) => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        marcheApi.getAll(q),
        conventionApi.getAll(),
      ]);
      setMarches(results[0].status === "fulfilled" ? results[0].value : []);
      setConventions(results[1].status === "fulfilled" ? results[1].value : []);
      if (results[0].status === "rejected") {
        toast({ title: "Erreur", description: "Impossible de charger les marchés", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  // Recherche serveur (debounce léger) — la recherche locale reste comme filet
  useEffect(() => {
    const t = setTimeout(() => { fetchMarches(search.trim() || undefined); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => { fetchMarches(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ conventionId: 0, numeroMarche: "", intitule: "", dateSignature: "", montantContratHt: undefined, statut: "EN_COURS" });
    setDialogOpen(true);
  };

  const openEdit = (m: MarcheDto) => {
    setEditing(m);
    setForm({
      conventionId: m.conventionId || 0,
      numeroMarche: m.numeroMarche || "",
      intitule: m.intitule || "",
      dateSignature: m.dateSignature || "",
      montantContratHt: m.montantContratHt ?? m.montantContratTtc,
      statut: m.statut,
    });
    setDialogOpen(true);
  };

  const openAssign = async (m: MarcheDto) => {
    setAssignMarche(m);
    setSelectedDelegue("");
    setShowCreateDelegue(false);
    setAssignOpen(true);
    try {
      const d = await delegueApi.getAll();
      setDelegues(d.filter(x => x.actif));
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les délégués", variant: "destructive" });
    }
  };

  const handleCreateDelegueInline = async () => {
    if (!delegueForm.username.trim() || !delegueForm.password.trim() || !delegueForm.nomComplet.trim()) {
      toast({ title: "Erreur", description: "Nom complet, identifiant et mot de passe sont requis", variant: "destructive" });
      return;
    }
    setCreatingDelegue(true);
    try {
      const created = await delegueApi.create(delegueForm);
      toast({ title: "Succès", description: "Délégué créé" });
      setDelegueForm({ username: "", password: "", role: "AUTORITE_UPM", nomComplet: "", email: "" });
      setShowCreateDelegue(false);
      // Refresh list and auto-select
      const d = await delegueApi.getAll();
      setDelegues(d.filter(x => x.actif));
      setSelectedDelegue(String(created.id));
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCreatingDelegue(false);
    }
  };

  const handleAssign = async () => {
    if (!assignMarche || !selectedDelegue) return;
    setAssigning(true);
    try {
      await marcheApi.addDelegue(assignMarche.id, parseInt(selectedDelegue));
      toast({ title: "Succès", description: "Délégué ajouté au marché" });
      setSelectedDelegue("");
      fetchMarches();
      // Refresh assignMarche
      const updated = await marcheApi.getById(assignMarche.id);
      setAssignMarche(updated);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveDelegue = async (delegueId: number) => {
    if (!assignMarche) return;
    try {
      await marcheApi.removeDelegue(assignMarche.id, delegueId);
      toast({ title: "Succès", description: "Délégué retiré du marché" });
      fetchMarches();
      const updated = await marcheApi.getById(assignMarche.id);
      setAssignMarche(updated);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const openGed = async (m: MarcheDto) => {
    setGedMarche(m);
    setGedOpen(true);
    setGedLoading(true);
    try {
      const docs = await marcheApi.getDocuments(m.id);
      setGedDocs(docs);
    } catch {
      setGedDocs([]);
    } finally {
      setGedLoading(false);
    }
  };

  const handleGedUpload = async (marcheId: number, type: string, file: File) => {
    await marcheApi.uploadDocument(marcheId, type as TypeDocumentMarche, file);
  };

  const handleGedRefresh = async (marcheId: number) => {
    const docs = await marcheApi.getDocuments(marcheId);
    setGedDocs(docs);
  };

  const handleGedDelete = async (marcheId: number, docId: number) => {
    await marcheApi.deleteDocument(marcheId, docId);
  };

  const handleGedReplace = async (marcheId: number, docId: number, file: File) => {
    await marcheApi.replaceDocument(marcheId, docId, file);
  };

  const openCancelMarche = (m: MarcheDto) => {
    setCancelMarche(m);
    setCancelOpen(true);
  };

  const handleCancelMarche = async () => {
    if (!cancelMarche) return;
    setCancelling(true);
    try {
      await marcheApi.updateStatut(cancelMarche.id, "ANNULE");
      toast({ title: "Succès", description: "Marché annulé" });
      setCancelOpen(false);
      setCancelMarche(null);
      fetchMarches();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.numeroMarche?.trim()) {
      toast({ title: "Erreur", description: "Le numéro de marché est requis", variant: "destructive" });
      return;
    }
    // Préparer payload : envoyer montantContratHt (alias TTC accepté côté back)
    const payload: CreateMarcheRequest = { ...form };
    if (payload.montantContratHt == null) {
      delete payload.montantContratHt;
      delete payload.montantContratTtc;
    } else {
      // alias rétro-compat
      payload.montantContratTtc = payload.montantContratHt;
    }
    if (!payload.conventionId) {
      delete payload.conventionId;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await marcheApi.update(editing.id, payload);
        toast({ title: "Succès", description: "Marché mis à jour" });
      } else {
        await marcheApi.create(payload);
        toast({ title: "Succès", description: "Marché créé" });
      }
      setDialogOpen(false);
      fetchMarches();
    } catch (e: unknown) {
      toast({ title: "Erreur", description: formatApiErrorMessage(e, "Échec de l'opération"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = marches.filter(m => {
    const s = search.toLowerCase();
    if (!s) return true;
    return (
      (m.numeroMarche || "").toLowerCase().includes(s) ||
      (m.intitule || "").toLowerCase().includes(s) ||
      String(m.id).includes(s)
    );
  });

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isDelegate = hasRole(["AUTORITE_UPM", "AUTORITE_UEP"]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Gavel className="h-6 w-6 text-primary" />
              Attributions / Marchés
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Gestion des attributions et marchés publics</p>
          </div>
          <div className="flex gap-2">
            {isAC && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle attribution
              </Button>
            )}
            <Button variant="outline" onClick={() => fetchMarches(search.trim() || undefined)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher (n° ou intitulé)..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                      <TableHead>ID</TableHead>
                      <TableHead>N° Attribution / Marché</TableHead>
                      <TableHead>Intitulé</TableHead>
                      <TableHead>Date signature</TableHead>
                      <TableHead>Montant HT</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Représentant</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun marché</TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">#{m.id}</TableCell>
                          <TableCell className="whitespace-nowrap">{m.numeroMarche || "—"}</TableCell>
                          <TableCell className="max-w-[220px] truncate" title={m.intitule || ""}>{m.intitule || "—"}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {m.dateSignature ? new Date(m.dateSignature).toLocaleDateString("fr-FR") : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{(m.montantContratHt ?? m.montantContratTtc)?.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) || "—"}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${STATUT_COLORS[m.statut]}`}>
                              {MARCHE_STATUT_LABELS[m.statut]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {m.demandeCorrectionId ? (
                              <Badge className="text-xs bg-green-100 text-green-800">Marché / Contrat</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Attribution / Adjudication</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {m.delegueIds && m.delegueIds.length > 0
                              ? m.delegueIds.map(id => `#${id}`).join(", ")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end flex-wrap">
                              <Button variant="ghost" size="sm" onClick={() => openGed(m)}>
                                <FileText className="h-4 w-4 mr-1" /> GED
                              </Button>
                              {isAC && m.statut !== "CLOTURE" && m.statut !== "ANNULE" && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                                    <Edit className="h-4 w-4 mr-1" /> Modifier
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => openAssign(m)}>
                                    <UserPlus className="h-4 w-4 mr-1" /> Affecter
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => openCancelMarche(m)}>
                                    <Ban className="h-4 w-4 mr-1" /> Annuler
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Nouvelle attribution / adjudication"}</DialogTitle>
            <DialogDescription>
              {editing ? "Modifiez les informations du marché." : "Renseignez les informations du nouveau marché."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <div className="space-y-2">
                <Label>Convention <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
                <Select value={form.conventionId ? String(form.conventionId) : ""} onValueChange={v => setForm(f => ({ ...f, conventionId: Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Aucune convention rattachée" /></SelectTrigger>
                  <SelectContent>
                    {conventions.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.reference || `#${c.id}`} — {c.intitule || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Numéro d'attribution *</Label>
              <Input value={form.numeroMarche} onChange={e => setForm(f => ({ ...f, numeroMarche: e.target.value }))} placeholder="MARC-2026-001" />
            </div>
            <div className="space-y-2">
              <Label>Intitulé du marché</Label>
              <Input value={form.intitule || ""} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder="Ex : Construction d'une école..." />
            </div>
            <div className="space-y-2">
              <Label>Date de signature <span className="text-muted-foreground text-xs">(optionnelle)</span></Label>
              <Input type="date" value={form.dateSignature || ""} onChange={e => setForm(f => ({ ...f, dateSignature: e.target.value }))} />
            </div>
             <div className="space-y-2">
              <Label>Montant contrat HT <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
              <Input type="number" value={form.montantContratHt ?? ""} onChange={e => setForm(f => ({ ...f, montantContratHt: e.target.value ? parseFloat(e.target.value) : undefined }))} placeholder="Laisser vide si non applicable" />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={v => setForm(f => ({ ...f, statut: v as StatutMarche }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MARCHE_STATUT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Delegate Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gérer les représentants</DialogTitle>
            <DialogDescription>
              Ajoutez ou retirez des représentants du marché #{assignMarche?.id}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current delegates */}
            {assignMarche?.delegueIds && assignMarche.delegueIds.length > 0 && (
              <div className="space-y-2">
                <Label>Représentants affectés</Label>
                <div className="flex flex-wrap gap-2">
                  {assignMarche.delegueIds.map(dId => {
                    const d = delegues.find(x => x.id === dId);
                    return (
                      <Badge key={dId} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                        {d ? `${d.nomComplet} (${d.role === "AUTORITE_UPM" ? "UPM" : "UEP"})` : `#${dId}`}
                        <button onClick={() => handleRemoveDelegue(dId)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {!showCreateDelegue ? (
              <>
                <div className="space-y-2">
                  <Label>Ajouter un représentant</Label>
                  <Select value={selectedDelegue} onValueChange={setSelectedDelegue}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un représentant" /></SelectTrigger>
                    <SelectContent>
                      {delegues
                        .filter(d => !(assignMarche?.delegueIds || []).includes(d.id))
                        .map(d => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.nomComplet} ({d.role === "AUTORITE_UPM" ? "UPM" : "UEP"})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {delegues.filter(d => !(assignMarche?.delegueIds || []).includes(d.id)).length === 0 && (
                  <p className="text-sm text-muted-foreground">Tous les représentants sont déjà affectés.</p>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowCreateDelegue(true)}>
                  <UserRoundPlus className="h-4 w-4 mr-2" /> Créer un nouveau représentant
                </Button>
              </>
            ) : (
              <div className="space-y-3 border rounded-lg p-4">
                <p className="text-sm font-medium">Nouveau représentant</p>
                <div className="space-y-2">
                  <Label>Nom complet *</Label>
                  <Input value={delegueForm.nomComplet} onChange={e => setDelegueForm(f => ({ ...f, nomComplet: e.target.value }))} placeholder="Nom Prénom" />
                </div>
                <div className="space-y-2">
                  <Label>Identifiant *</Label>
                  <Input value={delegueForm.username} onChange={e => setDelegueForm(f => ({ ...f, username: e.target.value }))} placeholder="upm1" />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe *</Label>
                  <Input type="password" value={delegueForm.password} onChange={e => setDelegueForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={delegueForm.email} onChange={e => setDelegueForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Rôle *</Label>
                  <Select value={delegueForm.role} onValueChange={v => setDelegueForm(f => ({ ...f, role: v as "AUTORITE_UPM" | "AUTORITE_UEP" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTORITE_UPM">Autorité UPM</SelectItem>
                      <SelectItem value="AUTORITE_UEP">Autorité UEP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCreateDelegue(false)} className="flex-1">Retour</Button>
                  <Button size="sm" onClick={handleCreateDelegueInline} disabled={creatingDelegue} className="flex-1">
                    {creatingDelegue && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Créer
                  </Button>
                </div>
              </div>
            )}
          </div>
          {!showCreateDelegue && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Fermer</Button>
              <Button onClick={handleAssign} disabled={assigning || !selectedDelegue}>
                {assigning && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Ajouter
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* GED Documents Dialog */}
      <DocumentGED
        open={gedOpen}
        onOpenChange={setGedOpen}
        title={`Documents — Marché ${gedMarche?.numeroMarche || `#${gedMarche?.id}`}`}
        dossierId={gedMarche?.id || null}
        documentTypes={MARCHE_DOCUMENT_TYPES}
        documents={gedDocs}
        loading={gedLoading}
        canUpload={(isAC || isDelegate) && gedMarche?.statut !== "CLOTURE" && gedMarche?.statut !== "ANNULE"}
        canManageDocuments={(isAC || isDelegate) && gedMarche?.statut !== "CLOTURE" && gedMarche?.statut !== "ANNULE"}
        onUpload={handleGedUpload}
        onRefresh={handleGedRefresh}
        onDeleteDocument={handleGedDelete}
        onReplaceDocument={handleGedReplace}
      />

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" /> Annuler le marché
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler ce marché ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Non, garder</Button>
            <Button variant="destructive" onClick={handleCancelMarche} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
              Oui, annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Marches;
