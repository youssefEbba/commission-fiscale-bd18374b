import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  transfertCreditApi, TransfertCreditDto, StatutTransfert,
  CreateTransfertCreditRequest, TRANSFERT_STATUT_LABELS,
  TRANSFERT_DOCUMENT_TYPES, TypeDocumentTransfert, DocumentTransfertCreditDto,
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
import { ArrowRightLeft, Search, RefreshCw, Loader2, Plus, Eye, Filter, Upload, FileText, CheckCircle2, XCircle } from "lucide-react";
import DocumentGED from "@/components/ged/DocumentGED";

const STATUT_COLORS: Record<StatutTransfert, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_COURS: "bg-yellow-100 text-yellow-800",
  VALIDE: "bg-emerald-100 text-emerald-800",
  TRANSFERE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
};

const Transferts = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [data, setData] = useState<TransfertCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [form, setForm] = useState<Partial<CreateTransfertCreditRequest>>({});
  const [creating, setCreating] = useState(false);

  // Detail dialog
  const [selected, setSelected] = useState<TransfertCreditDto | null>(null);

  // Document dialog
  const [docDialog, setDocDialog] = useState<number | null>(null);
  const [docs, setDocs] = useState<DocumentTransfertCreditDto[]>([]);
  const [docType, setDocType] = useState<TypeDocumentTransfert>("DEMANDE_MOTIVEE_TRANSFERT");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try { setData(await transfertCreditApi.getAll()); }
    catch { toast({ title: "Erreur", description: "Impossible de charger les transferts", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = async () => {
    setForm({ operationsDouaneCloturees: true });
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
    if (!form.certificatCreditId || !form.entrepriseDestinataireId || !form.montant) {
      toast({ title: "Erreur", description: "Tous les champs sont requis", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await transfertCreditApi.create(form as CreateTransfertCreditRequest);
      toast({ title: "Succès", description: "Demande de transfert créée" });
      setShowCreate(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleValider = async (id: number) => {
    setActionLoading(id);
    try {
      await transfertCreditApi.valider(id);
      toast({ title: "Succès", description: "Transfert validé et exécuté" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleRejeter = async (id: number) => {
    setActionLoading(id);
    try {
      await transfertCreditApi.rejeter(id);
      toast({ title: "Succès", description: "Transfert rejeté" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const openDocs = async (id: number) => {
    setDocDialog(id);
    setDocsLoading(true);
    try { setDocs(await transfertCreditApi.getDocuments(id)); } catch { setDocs([]); }
    finally { setDocsLoading(false); }
  };

  const refreshDocs = async (id: number) => {
    try { setDocs(await transfertCreditApi.getDocuments(id)); } catch { /* ignore */ }
  };

  const handleGEDUpload = async (dossierId: number, type: string, file: File) => {
    await transfertCreditApi.uploadDocument(dossierId, type as TypeDocumentTransfert, file);
  };

  const filtered = data.filter((t) => {
    const ms = (t.certificatNumero || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.entrepriseDestinataireNom || "").toLowerCase().includes(search.toLowerCase()) ||
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
              <ArrowRightLeft className="h-6 w-6 text-primary" />
              Transferts de crédit
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Transfert de solde douanier entre entreprises</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nouveau transfert</Button>
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
              {Object.entries(TRANSFERT_STATUT_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
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
                    <TableHead>Certificat source</TableHead>
                    <TableHead>Entreprise dest.</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Douane clôturée</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun transfert</TableCell></TableRow>
                  ) : filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">#{t.id}</TableCell>
                      <TableCell className="text-muted-foreground">{t.certificatNumero || `Cert #${t.certificatCreditId}`}</TableCell>
                      <TableCell>{t.entrepriseDestinataireNom || `Ent #${t.entrepriseDestinataireId}`}</TableCell>
                      <TableCell>{f(t.montant)} MRU</TableCell>
                      <TableCell>
                        <Badge variant={t.operationsDouaneCloturees ? "default" : "outline"} className="text-xs">
                          {t.operationsDouaneCloturees ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[t.statut]}`}>{TRANSFERT_STATUT_LABELS[t.statut]}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.dateDemande ? new Date(t.dateDemande).toLocaleDateString("fr-FR") : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(t)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openDocs(t.id)}><FileText className="h-4 w-4" /></Button>
                          {canValidate && (t.statut === "DEMANDE" || t.statut === "EN_COURS") && (
                            <>
                              <Button size="sm" disabled={actionLoading === t.id} onClick={() => handleValider(t.id)}>
                                {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                Valider
                              </Button>
                              <Button variant="destructive" size="sm" disabled={actionLoading === t.id} onClick={() => handleRejeter(t.id)}>
                                {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                                Rejeter
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
          <DialogHeader><DialogTitle>Transfert #{selected?.id}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Certificat source</span><p className="font-medium">{selected.certificatNumero || `#${selected.certificatCreditId}`}</p></div>
                <div><span className="text-muted-foreground">Entreprise dest.</span><p className="font-medium">{selected.entrepriseDestinataireNom || `#${selected.entrepriseDestinataireId}`}</p></div>
                <div><span className="text-muted-foreground">Montant</span><p className="font-medium">{f(selected.montant)} MRU</p></div>
                <div><span className="text-muted-foreground">Statut</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{TRANSFERT_STATUT_LABELS[selected.statut]}</Badge></p></div>
                <div><span className="text-muted-foreground">Ops douane clôturées</span><p className="font-medium">{selected.operationsDouaneCloturees ? "Oui" : "Non"}</p></div>
                <div><span className="text-muted-foreground">Date demande</span><p className="font-medium">{selected.dateDemande ? new Date(selected.dateDemande).toLocaleDateString("fr-FR") : "—"}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle demande de transfert</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Certificat source (OUVERT)</Label>
              <Select value={form.certificatCreditId ? String(form.certificatCreditId) : ""} onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un certificat" /></SelectTrigger>
                <SelectContent>
                  {certificats.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.reference || c.numero || `Cert #${c.id}`} — Solde Cordon: {f(c.soldeCordon)} MRU
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entreprise destinataire</Label>
              <Select value={form.entrepriseDestinataireId ? String(form.entrepriseDestinataireId) : ""} onValueChange={(v) => setForm({ ...form, entrepriseDestinataireId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une entreprise" /></SelectTrigger>
                <SelectContent>
                  {entreprises.filter(e => e.id !== (user as any)?.entrepriseId).map((e) => (
                    <SelectItem key={e.id} value={String(e.id!)}>
                      {e.raisonSociale} ({e.nif})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Montant à transférer (MRU)</Label>
              <Input type="number" min={1} value={form.montant ?? ""} onChange={(e) => setForm({ ...form, montant: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.operationsDouaneCloturees ?? false} onCheckedChange={(v) => setForm({ ...form, operationsDouaneCloturees: v })} />
              <Label>Opérations douanières clôturées</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GED Document dialog */}
      <DocumentGED
        open={docDialog !== null}
        onOpenChange={() => setDocDialog(null)}
        title={`Documents — Transfert #${docDialog}`}
        dossierId={docDialog}
        documentTypes={TRANSFERT_DOCUMENT_TYPES}
        documents={docs}
        loading={docsLoading}
        canUpload={role === "ENTREPRISE"}
        onUpload={handleGEDUpload}
        onRefresh={refreshDocs}
      />
    </DashboardLayout>
  );
};

export default Transferts;
