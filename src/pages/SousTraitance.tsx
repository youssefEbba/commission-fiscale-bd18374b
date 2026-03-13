import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  sousTraitanceApi, SousTraitanceDto, StatutSousTraitance,
  SousTraitanceOnboardingRequest, SOUS_TRAITANCE_STATUT_LABELS,
  SOUS_TRAITANCE_DOCUMENT_TYPES, TypeDocumentSousTraitance, DocumentSousTraitanceDto,
  certificatCreditApi, CertificatCreditDto,
  entrepriseApi, EntrepriseDto,
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
import { Switch } from "@/components/ui/switch";
import { Handshake, Search, RefreshCw, Loader2, Plus, Eye, Filter, Upload, FileText, CheckCircle2, XCircle, UserPlus, Building2 } from "lucide-react";

const STATUT_COLORS: Record<StatutSousTraitance, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_COURS: "bg-yellow-100 text-yellow-800",
  AUTORISEE: "bg-green-100 text-green-800",
  REFUSEE: "bg-red-100 text-red-800",
};

const SousTraitance = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [data, setData] = useState<SousTraitanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Onboarding dialog
  const [showCreate, setShowCreate] = useState(false);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [createNewEntreprise, setCreateNewEntreprise] = useState(false);
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<SousTraitanceOnboardingRequest>>({});
  const [creating, setCreating] = useState(false);

  // Detail dialog
  const [selected, setSelected] = useState<SousTraitanceDto | null>(null);

  // Document dialog
  const [docDialog, setDocDialog] = useState<number | null>(null);
  const [docs, setDocs] = useState<DocumentSousTraitanceDto[]>([]);
  const [docType, setDocType] = useState<TypeDocumentSousTraitance>("CONTRAT_SOUS_TRAITANCE_ENREGISTRE");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try { setData(await sousTraitanceApi.getAll()); }
    catch { toast({ title: "Erreur", description: "Impossible de charger les sous-traitances", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = async () => {
    setForm({ contratEnregistre: true });
    setCreateNewEntreprise(false);
    setSelectedEntrepriseId(null);
    try {
      const [certs, ents] = await Promise.all([
        role === "ENTREPRISE" && (user as any)?.entrepriseId
          ? certificatCreditApi.getByEntreprise((user as any).entrepriseId)
          : certificatCreditApi.getAll(),
        entrepriseApi.getAll(),
      ]);
      setCertificats(certs.filter(c => c.statut === "OUVERT"));
      setEntreprises(ents);
    } catch { /* ignore */ }
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const f2 = { ...form };
    // If selecting existing enterprise, fill enterprise fields from selection
    if (!createNewEntreprise && selectedEntrepriseId) {
      const ent = entreprises.find(e => e.id === selectedEntrepriseId);
      if (ent) {
        f2.sousTraitantEntrepriseRaisonSociale = ent.raisonSociale;
        f2.sousTraitantEntrepriseNif = ent.nif;
        f2.sousTraitantEntrepriseAdresse = ent.adresse;
        f2.sousTraitantEntrepriseSituationFiscale = ent.situationFiscale;
      }
    }
    const { certificatCreditId, sousTraitantEntrepriseRaisonSociale, sousTraitantEntrepriseNif, sousTraitantUsername, sousTraitantPassword } = f2;
    if (!certificatCreditId || !sousTraitantUsername || !sousTraitantPassword) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    if (createNewEntreprise && (!sousTraitantEntrepriseRaisonSociale || !sousTraitantEntrepriseNif)) {
      toast({ title: "Erreur", description: "Veuillez remplir la raison sociale et le NIF", variant: "destructive" });
      return;
    }
    if (!createNewEntreprise && !selectedEntrepriseId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une entreprise ou en créer une nouvelle", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await sousTraitanceApi.onboard(f2 as SousTraitanceOnboardingRequest);
      toast({ title: "Succès", description: "Sous-traitant créé et demande soumise" });
      setShowCreate(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleAutoriser = async (id: number) => {
    setActionLoading(id);
    try {
      await sousTraitanceApi.autoriser(id);
      toast({ title: "Succès", description: "Sous-traitance autorisée" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleRefuser = async (id: number) => {
    setActionLoading(id);
    try {
      await sousTraitanceApi.refuser(id);
      toast({ title: "Succès", description: "Sous-traitance refusée" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const openDocs = async (id: number) => {
    setDocDialog(id);
    setDocsLoading(true);
    try { setDocs(await sousTraitanceApi.getDocuments(id)); } catch { setDocs([]); }
    finally { setDocsLoading(false); }
  };

  const handleUpload = async () => {
    if (!docDialog || !docFile) return;
    setUploading(true);
    try {
      await sousTraitanceApi.uploadDocument(docDialog, docType, docFile);
      toast({ title: "Succès", description: "Document uploadé" });
      setDocFile(null);
      setDocs(await sousTraitanceApi.getDocuments(docDialog));
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const filtered = data.filter((t) => {
    const ms = (t.certificatNumero || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.sousTraitantUsername || "").toLowerCase().includes(search.toLowerCase()) ||
      String(t.id).includes(search);
    const matchStatut = filterStatut === "ALL" || t.statut === filterStatut;
    return ms && matchStatut;
  });

  const canCreate = role === "ENTREPRISE";
  const canValidate = role === "DGTCP";
  const f = (v: any) => v != null ? Number(v).toLocaleString("fr-FR") : "—";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Handshake className="h-6 w-6 text-primary" />
              Sous-traitance
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Gestion des autorisations de sous-traitance</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreate}><UserPlus className="h-4 w-4 mr-2" /> Nouvelle sous-traitance</Button>
            )}
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(SOUS_TRAITANCE_STATUT_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
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
                    <TableHead>Sous-traitant</TableHead>
                    <TableHead>Volumes</TableHead>
                    <TableHead>Quantités</TableHead>
                    <TableHead>Contrat enregistré</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date autorisation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune sous-traitance</TableCell></TableRow>
                  ) : filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">#{t.id}</TableCell>
                      <TableCell className="text-muted-foreground">{t.certificatNumero || `Cert #${t.certificatCreditId}`}</TableCell>
                      <TableCell>{t.sousTraitantUsername || `User #${t.sousTraitantUserId}`}</TableCell>
                      <TableCell>{f(t.volumes)}</TableCell>
                      <TableCell>{f(t.quantites)}</TableCell>
                      <TableCell>
                        <Badge variant={t.contratEnregistre ? "default" : "outline"} className="text-xs">
                          {t.contratEnregistre ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[t.statut]}`}>{SOUS_TRAITANCE_STATUT_LABELS[t.statut]}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.dateAutorisation ? new Date(t.dateAutorisation).toLocaleDateString("fr-FR") : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(t)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openDocs(t.id)}><FileText className="h-4 w-4" /></Button>
                          {canValidate && t.statut === "DEMANDE" && (
                            <>
                              <Button size="sm" disabled={actionLoading === t.id} onClick={() => handleAutoriser(t.id)}>
                                {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                Autoriser
                              </Button>
                              <Button variant="destructive" size="sm" disabled={actionLoading === t.id} onClick={() => handleRefuser(t.id)}>
                                {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                                Refuser
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
          </CardContent>
        </Card>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Sous-traitance #{selected?.id}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Certificat</span><p className="font-medium">{selected.certificatNumero || `#${selected.certificatCreditId}`}</p></div>
                <div><span className="text-muted-foreground">Sous-traitant</span><p className="font-medium">{selected.sousTraitantUsername || `#${selected.sousTraitantUserId}`}</p></div>
                <div><span className="text-muted-foreground">Volumes</span><p className="font-medium">{f(selected.volumes)}</p></div>
                <div><span className="text-muted-foreground">Quantités</span><p className="font-medium">{f(selected.quantites)}</p></div>
                <div><span className="text-muted-foreground">Contrat enregistré</span><p className="font-medium">{selected.contratEnregistre ? "Oui" : "Non"}</p></div>
                <div><span className="text-muted-foreground">Statut</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{SOUS_TRAITANCE_STATUT_LABELS[selected.statut]}</Badge></p></div>
                <div><span className="text-muted-foreground">Date autorisation</span><p className="font-medium">{selected.dateAutorisation ? new Date(selected.dateAutorisation).toLocaleDateString("fr-FR") : "—"}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Onboarding dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Nouvelle sous-traitance (onboarding)</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Certificat */}
            <div>
              <Label>Certificat source (OUVERT) *</Label>
              <Select value={form.certificatCreditId ? String(form.certificatCreditId) : ""} onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un certificat" /></SelectTrigger>
                <SelectContent>
                  {certificats.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.reference || c.numero || `Cert #${c.id}`} — Solde: {f(c.soldeCordon)} MRU
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entreprise sous-traitante */}
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm text-foreground">Entreprise sous-traitante</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Raison sociale *</Label>
                  <Input value={form.sousTraitantEntrepriseRaisonSociale ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseRaisonSociale: e.target.value })} />
                </div>
                <div>
                  <Label>NIF *</Label>
                  <Input value={form.sousTraitantEntrepriseNif ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseNif: e.target.value })} />
                </div>
                <div>
                  <Label>Adresse</Label>
                  <Input value={form.sousTraitantEntrepriseAdresse ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseAdresse: e.target.value })} />
                </div>
                <div>
                  <Label>Situation fiscale</Label>
                  <Select value={form.sousTraitantEntrepriseSituationFiscale ?? ""} onValueChange={(v) => setForm({ ...form, sousTraitantEntrepriseSituationFiscale: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REGULIERE">Régulière</SelectItem>
                      <SelectItem value="NON_REGULIERE">Non régulière</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Utilisateur sous-traitant */}
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm text-foreground">Utilisateur sous-traitant</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nom d'utilisateur *</Label>
                  <Input value={form.sousTraitantUsername ?? ""} onChange={(e) => setForm({ ...form, sousTraitantUsername: e.target.value })} />
                </div>
                <div>
                  <Label>Mot de passe *</Label>
                  <Input type="password" value={form.sousTraitantPassword ?? ""} onChange={(e) => setForm({ ...form, sousTraitantPassword: e.target.value })} />
                </div>
                <div>
                  <Label>Nom complet</Label>
                  <Input value={form.sousTraitantNomComplet ?? ""} onChange={(e) => setForm({ ...form, sousTraitantNomComplet: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.sousTraitantEmail ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEmail: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Détails sous-traitance */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Volumes</Label>
                <Input type="number" value={form.volumes ?? ""} onChange={(e) => setForm({ ...form, volumes: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <Label>Quantités</Label>
                <Input type="number" value={form.quantites ?? ""} onChange={(e) => setForm({ ...form, quantites: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.contratEnregistre ?? false} onCheckedChange={(v) => setForm({ ...form, contratEnregistre: v })} />
              <Label>Contrat enregistré</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Créer et soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document dialog */}
      <Dialog open={docDialog !== null} onOpenChange={() => setDocDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Documents — Sous-traitance #{docDialog}</DialogTitle></DialogHeader>
          {docsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun document</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Fichier</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.filter(d => d.actif !== false).map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs">{SOUS_TRAITANCE_DOCUMENT_TYPES.find(t => t.value === d.type)?.label || d.type}</TableCell>
                        <TableCell>
                          {d.chemin ? (
                            <a href={d.chemin} target="_blank" rel="noreferrer" className="text-primary underline text-xs">{d.nomFichier}</a>
                          ) : (
                            <span className="text-xs">{d.nomFichier}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">v{d.version || 1}</TableCell>
                        <TableCell className="text-xs">{d.dateUpload ? new Date(d.dateUpload).toLocaleDateString("fr-FR") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {role === "ENTREPRISE" && (
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Ajouter un document</h4>
                  <div className="flex flex-col gap-2">
                    <Select value={docType} onValueChange={(v) => setDocType(v as TypeDocumentSousTraitance)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SOUS_TRAITANCE_DOCUMENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                    <Button size="sm" onClick={handleUpload} disabled={uploading || !docFile}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      Uploader
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SousTraitance;
