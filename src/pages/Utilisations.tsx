import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  utilisationCreditApi, UtilisationCreditDto, UtilisationStatut, UtilisationType,
  CreateUtilisationCreditRequest, UTILISATION_STATUT_LABELS,
  certificatCreditApi, CertificatCreditDto,
  UTILISATION_DOCUMENT_TYPES, TypeDocumentUtilisation, DocumentDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Landmark, Search, RefreshCw, Loader2, Plus, Eye, Filter, Upload, FileText } from "lucide-react";

const STATUT_COLORS: Record<UtilisationStatut, string> = {
  DEMANDEE: "bg-blue-100 text-blue-800",
  EN_VERIFICATION: "bg-yellow-100 text-yellow-800",
  VISE: "bg-purple-100 text-purple-800",
  VALIDEE: "bg-emerald-100 text-emerald-800",
  LIQUIDEE: "bg-green-100 text-green-800",
  APUREE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
};

const ROLE_TRANSITIONS: Record<string, { from: UtilisationStatut[]; to: UtilisationStatut; label: string }[]> = {
  DGD: [
    { from: ["DEMANDEE"], to: "EN_VERIFICATION", label: "Vérifier" },
    { from: ["EN_VERIFICATION"], to: "VISE", label: "Viser" },
    { from: ["DEMANDEE", "EN_VERIFICATION"], to: "REJETEE", label: "Rejeter" },
  ],
  DGTCP: [
    { from: ["VISE"], to: "LIQUIDEE", label: "Liquider" },
    { from: ["VISE"], to: "APUREE", label: "Apurer" },
    { from: ["DEMANDEE", "EN_VERIFICATION", "VISE"], to: "REJETEE", label: "Rejeter" },
  ],
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

  // Document upload
  const [docDialog, setDocDialog] = useState<number | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docType, setDocType] = useState<TypeDocumentUtilisation>("DECLARATION_DOUANE");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);

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
    try { setCertificats(await certificatCreditApi.getAll()); } catch { /* ignore */ }
    setShowCreate(true);
  };

  const handleCreateTypeChange = (t: UtilisationType) => {
    setCreateType(t);
    setForm({ ...(t === "DOUANIER" ? emptyDouane : emptyTVA), certificatCreditId: form.certificatCreditId, entrepriseId: form.entrepriseId });
  };

  const handleCreate = async () => {
    if (!form.certificatCreditId || !form.montant) {
      toast({ title: "Erreur", description: "Certificat et montant requis", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await utilisationCreditApi.create(form as CreateUtilisationCreditRequest);
      toast({ title: "Succès", description: "Utilisation créée" });
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

  const transitions = ROLE_TRANSITIONS[role] || [];

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
                          <Button variant="ghost" size="sm" onClick={() => setSelected(u)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openDocs(u.id)}><FileText className="h-4 w-4" /></Button>
                          {transitions.map((t) =>
                            t.from.includes(u.statut) ? (
                              <Button key={t.to} variant={t.to === "REJETEE" ? "destructive" : "default"} size="sm" disabled={actionLoading === u.id} onClick={() => handleStatut(u.id, t.to)}>
                                {actionLoading === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t.label}
                              </Button>
                            ) : null
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

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Certificat de crédit *</Label>
                <Select value={form.certificatCreditId ? String(form.certificatCreditId) : ""} onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un certificat" /></SelectTrigger>
                  <SelectContent>
                    {certificats.filter(c => c.statut === "OUVERT").map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.reference || `#${c.id}`} — {c.entrepriseNom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Montant (MRU) *</Label>
                <Input type="number" value={form.montant || ""} onChange={(e) => setForm({ ...form, montant: Number(e.target.value) || undefined })} />
              </div>

              {createType === "DOUANIER" && (
                <>
                  <div>
                    <Label>N° Déclaration</Label>
                    <Input value={form.numeroDeclaration || ""} onChange={(e) => setForm({ ...form, numeroDeclaration: e.target.value })} />
                  </div>
                  <div>
                    <Label>N° Bulletin</Label>
                    <Input value={form.numeroBulletin || ""} onChange={(e) => setForm({ ...form, numeroBulletin: e.target.value })} />
                  </div>
                  <div>
                    <Label>Date déclaration</Label>
                    <Input type="datetime-local" value={form.dateDeclaration || ""} onChange={(e) => setForm({ ...form, dateDeclaration: e.target.value })} />
                  </div>
                  <div>
                    <Label>Montant Droits</Label>
                    <Input type="number" value={form.montantDroits || ""} onChange={(e) => setForm({ ...form, montantDroits: Number(e.target.value) || undefined })} />
                  </div>
                  <div>
                    <Label>Montant TVA Douane</Label>
                    <Input type="number" value={form.montantTVA || ""} onChange={(e) => setForm({ ...form, montantTVA: Number(e.target.value) || undefined })} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch checked={form.enregistreeSYDONIA || false} onCheckedChange={(v) => setForm({ ...form, enregistreeSYDONIA: v })} />
                    <Label>Enregistrée SYDONIA</Label>
                  </div>
                </>
              )}

              {createType === "TVA_INTERIEURE" && (
                <>
                  <div>
                    <Label>Type d'achat</Label>
                    <Select value={form.typeAchat || ""} onValueChange={(v) => setForm({ ...form, typeAchat: v })}>
                      <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACHAT_LOCAL">Achat local</SelectItem>
                        <SelectItem value="SERVICE">Service</SelectItem>
                        <SelectItem value="TRAVAUX">Travaux</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>N° Facture</Label>
                    <Input value={form.numeroFacture || ""} onChange={(e) => setForm({ ...form, numeroFacture: e.target.value })} />
                  </div>
                  <div>
                    <Label>Date facture</Label>
                    <Input type="datetime-local" value={form.dateFacture || ""} onChange={(e) => setForm({ ...form, dateFacture: e.target.value })} />
                  </div>
                  <div>
                    <Label>Montant TVA Intérieure</Label>
                    <Input type="number" value={form.montantTVAInterieure || ""} onChange={(e) => setForm({ ...form, montantTVAInterieure: Number(e.target.value) || undefined })} />
                  </div>
                  <div>
                    <Label>N° Décompte</Label>
                    <Input value={form.numeroDecompte || ""} onChange={(e) => setForm({ ...form, numeroDecompte: e.target.value })} />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Créer
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
                  {UTILISATION_DOCUMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
    </DashboardLayout>
  );
};

export default Utilisations;
