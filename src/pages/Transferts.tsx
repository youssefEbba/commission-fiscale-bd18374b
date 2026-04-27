import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  transfertCreditApi, TransfertCreditDto, StatutTransfert,
  CreateTransfertCreditRequest, TRANSFERT_STATUT_LABELS,
  TRANSFERT_DOCUMENT_TYPES, TypeDocumentTransfert, DocumentTransfertCreditDto,
  certificatCreditApi, CertificatCreditDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ArrowRightLeft, Search, RefreshCw, Loader2, Plus, Eye, Filter, FileText, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import DocumentGED from "@/components/ged/DocumentGED";

const STATUT_COLORS: Record<StatutTransfert, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_COURS: "bg-yellow-100 text-yellow-800",
  VALIDE: "bg-emerald-100 text-emerald-800",
  TRANSFERE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
};

/** Visible statuses in filter dropdown (VALIDE is not used by backend) */
const VISIBLE_STATUTS: StatutTransfert[] = ["DEMANDE", "EN_COURS", "TRANSFERE", "REJETE"];

const Transferts = () => {
  const { user, hasPermission } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [data, setData] = useState<TransfertCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Create / re-submit dialog
  const [showCreate, setShowCreate] = useState(false);
  const [resubmitTarget, setResubmitTarget] = useState<TransfertCreditDto | null>(null);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [form, setForm] = useState<Partial<CreateTransfertCreditRequest>>({});
  const [creating, setCreating] = useState(false);

  // Detail dialog
  const [selected, setSelected] = useState<TransfertCreditDto | null>(null);

  // Document dialog
  const [docDialog, setDocDialog] = useState<TransfertCreditDto | null>(null);
  const [docs, setDocs] = useState<DocumentTransfertCreditDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try { setData(await transfertCreditApi.getAll()); }
    catch { toast({ title: "Erreur", description: "Impossible de charger les transferts", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // Re-submit cert detail (to know remaining TVA déductible cordon = d')
  const [resubmitCert, setResubmitCert] = useState<CertificatCreditDto | null>(null);

  /** Montant transféré = totalité du reste de TVA déductible sur cordon douanier (d' = tvaImportationDouane) */
  const getMontantRenonciation = (c: CertificatCreditDto | null | undefined): number => {
    if (!c) return 0;
    // d' = restant de TVA importation (diminue à chaque liquidation douanière)
    const reste = c.tvaImportationDouane ?? 0;
    // Borné par le solde Cordon disponible (sécurité)
    return Math.min(reste, c.soldeCordon ?? reste);
  };

  // ---------- Create new ----------
  const openCreate = async () => {
    setResubmitTarget(null);
    setResubmitCert(null);
    setForm({ operationsDouaneCloturees: true });
    try {
      const certs = role === "ENTREPRISE" && user?.entrepriseId
        ? await certificatCreditApi.getByEntreprise(user.entrepriseId)
        : await certificatCreditApi.getAll();
      // Filter out certs that already have an active (non-REJETE) transfert
      const activeCertIds = new Set(
        data.filter(t => t.statut !== "REJETE").map(t => t.certificatCreditId)
      );
      setCertificats(certs.filter(c => c.statut === "OUVERT" && !activeCertIds.has(c.id)));
    } catch { /* ignore */ }
    setShowCreate(true);
  };

  // ---------- Re-submit after REJETE ----------
  const openResubmit = async (t: TransfertCreditDto) => {
    setResubmitTarget(t);
    setForm({
      certificatCreditId: t.certificatCreditId,
      operationsDouaneCloturees: true,
    });
    setCertificats([]);
    setResubmitCert(null);
    try {
      const cert = await certificatCreditApi.getById(t.certificatCreditId);
      setResubmitCert(cert);
    } catch { /* ignore */ }
    setShowCreate(true);
  };

  const selectedCert = resubmitTarget ? resubmitCert : certificats.find(c => c.id === form.certificatCreditId);
  const montantAuto = getMontantRenonciation(selectedCert);

  const handleCreate = async () => {
    const certId = resubmitTarget ? resubmitTarget.certificatCreditId : form.certificatCreditId;
    if (!certId) {
      toast({ title: "Erreur", description: "Certificat requis", variant: "destructive" });
      return;
    }
    if (!selectedCert || montantAuto <= 0) {
      toast({ title: "Erreur", description: "Aucune TVA déductible cordon restante à transférer", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await transfertCreditApi.create({
        certificatCreditId: certId,
        montant: montantAuto,
        operationsDouaneCloturees: form.operationsDouaneCloturees,
      });
      toast({
        title: "Succès",
        description: resubmitTarget
          ? "Demande renvoyée — les anciennes pièces sont désactivées, veuillez re-déposer les 3 documents"
          : "Demande de renonciation créée",
      });
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
      toast({ title: "Succès", description: "Transfert validé — TVA importation transférée vers le solde TVA intérieure ; utilisations douanières en cours clôturées" });
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

  const openDocs = async (t: TransfertCreditDto) => {
    setDocDialog(t);
    setDocsLoading(true);
    try { setDocs(await transfertCreditApi.getDocuments(t.id)); } catch { setDocs([]); }
    finally { setDocsLoading(false); }
  };

  const refreshDocs = async (id: number) => {
    try { setDocs(await transfertCreditApi.getDocuments(id)); } catch { /* ignore */ }
    // Refresh main list to catch DEMANDE→EN_COURS transition after upload
    fetchData();
  };

  const handleGEDUpload = async (dossierId: number, type: string, file: File) => {
    await transfertCreditApi.uploadDocument(dossierId, type as TypeDocumentTransfert, file);
  };

  const filtered = data.filter((t) => {
    const ms = (t.certificatNumero || "").toLowerCase().includes(search.toLowerCase()) ||
      String(t.id).includes(search);
    const matchStatut = filterStatut === "ALL" || t.statut === filterStatut;
    return ms && matchStatut;
  });

  const canCreate = role === "ENTREPRISE";
  const canValider = hasPermission("transfert.dgtcp.update") || hasPermission("transfert.president.validate");
  const canRejeter = hasPermission("transfert.dgtcp.update") || hasPermission("transfert.president.reject");
  const f = (v: any) => v != null ? Number(v).toLocaleString("fr-FR") : "—";

  /** Upload allowed only in DEMANDE or EN_COURS */
  const canUploadDocs = (t: TransfertCreditDto) =>
    role === "ENTREPRISE" && (t.statut === "DEMANDE" || t.statut === "EN_COURS");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
              Transfert Douane → Intérieur
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Renonciation aux importations — transfert du solde Cordon vers TVA intérieure</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nouvelle renonciation</Button>
            )}
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par certificat..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {VISIBLE_STATUTS.map((k) => (<SelectItem key={k} value={k}>{TRANSFERT_STATUT_LABELS[k]}</SelectItem>))}
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
                    <TableHead>Montant transféré</TableHead>
                    <TableHead>Ops douane clôturées</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun transfert</TableCell></TableRow>
                  ) : filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">#{t.id}</TableCell>
                      <TableCell className="text-muted-foreground">{t.certificatNumero || `Cert #${t.certificatCreditId}`}</TableCell>
                      <TableCell className="font-medium">{f(t.montant)} MRU</TableCell>
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
                          <Button variant="ghost" size="sm" onClick={() => openDocs(t)}><FileText className="h-4 w-4" /></Button>
                          {/* Re-submit after REJETE */}
                          {canCreate && t.statut === "REJETE" && (
                            <Button variant="outline" size="sm" onClick={() => openResubmit(t)}>
                              <RotateCcw className="h-4 w-4 mr-1" /> Renvoyer
                            </Button>
                          )}
                          {/* DGTCP / Président validate/reject */}
                          {(canValider || canRejeter) && (t.statut === "DEMANDE" || t.statut === "EN_COURS") && (
                            <>
                              {canValider && (
                                <Button size="sm" disabled={actionLoading === t.id} onClick={() => handleValider(t.id)}>
                                  {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                  Valider
                                </Button>
                              )}
                              {canRejeter && (
                                <Button variant="destructive" size="sm" disabled={actionLoading === t.id} onClick={() => handleRejeter(t.id)}>
                                  {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                                  Rejeter
                                </Button>
                              )}
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
          <DialogHeader><DialogTitle>Transfert #{selected?.id} — Douane → Intérieur</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Certificat</span><p className="font-medium">{selected.certificatNumero || `#${selected.certificatCreditId}`}</p></div>
                <div><span className="text-muted-foreground">Montant (Cordon → TVA)</span><p className="font-medium">{f(selected.montant)} MRU</p></div>
                <div><span className="text-muted-foreground">Statut</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{TRANSFERT_STATUT_LABELS[selected.statut]}</Badge></p></div>
                <div><span className="text-muted-foreground">Ops douane clôturées</span><p className="font-medium">{selected.operationsDouaneCloturees ? "Oui" : "Non"}</p></div>
                <div><span className="text-muted-foreground">Date demande</span><p className="font-medium">{selected.dateDemande ? new Date(selected.dateDemande).toLocaleDateString("fr-FR") : "—"}</p></div>
              </div>
              {selected.statut === "EN_COURS" && (
                <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
                  📄 Dossier en cours de constitution — au moins une pièce a été déposée. Déposez les 3 documents obligatoires pour permettre la validation.
                </div>
              )}
              {selected.statut === "TRANSFERE" && (
                <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
                  ✅ Transfert exécuté : {f(selected.montant)} MRU débité du solde Cordon et crédité au solde TVA intérieure du même certificat.
                </div>
              )}
              {selected.statut === "REJETE" && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  ❌ Demande rejetée par la DGTCP. Vous pouvez renvoyer une nouvelle demande avec un montant corrigé — les anciennes pièces seront désactivées.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / re-submit dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{resubmitTarget ? "Renvoyer la demande" : "Renonciation aux importations"}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {resubmitTarget
                ? `Certificat ${resubmitTarget.certificatNumero || `#${resubmitTarget.certificatCreditId}`} — les anciennes pièces seront désactivées, vous devrez re-déposer les 3 documents.`
                : "Transférer un montant du solde Cordon (douane) vers le solde TVA intérieure du même certificat."}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {!resubmitTarget && (
              <div>
                <Label>Certificat (OUVERT)</Label>
                <SearchableSelect
                  value={form.certificatCreditId ? String(form.certificatCreditId) : ""}
                  onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}
                  placeholder="Sélectionner un certificat"
                  searchPlaceholder="Rechercher un certificat..."
                  options={certificats.map((c) => ({
                    value: String(c.id),
                    label: `${c.numero || `Cert #${c.id}`} — d′ restant: ${f(c.tvaImportationDouane)} MRU`,
                    keywords: `${c.numero || ""}`,
                  }))}
                />
              </div>
            )}
            {!resubmitTarget && selectedCert && (
              <div className="p-3 rounded-md bg-muted/50 border border-border text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Solde Cordon (douane)</span><span className="font-medium">{f(selectedCert.soldeCordon)} MRU</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Solde TVA (intérieur)</span><span className="font-medium">{f(selectedCert.soldeTVA)} MRU</span></div>
                <div className="flex justify-between border-t border-border pt-1 mt-1">
                  <span className="text-muted-foreground">TVA déductible cordon restante (d′)</span>
                  <span className="font-medium">{f(selectedCert.tvaImportationDouane)} MRU</span>
                </div>
              </div>
            )}
            {resubmitTarget && resubmitCert && (
              <div className="p-3 rounded-md bg-muted/50 border border-border text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Solde Cordon (douane)</span><span className="font-medium">{f(resubmitCert.soldeCordon)} MRU</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA déductible cordon restante (d′)</span><span className="font-medium">{f(resubmitCert.tvaImportationDouane)} MRU</span></div>
              </div>
            )}
            <div>
              <Label>Montant à transférer (Cordon → TVA)</Label>
              <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/30 text-sm font-semibold">
                {selectedCert ? `${f(montantAuto)} MRU` : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Renonciation totale : la totalité de la TVA déductible cordon restante (d′) est transférée vers la TVA intérieure.
              </p>
              {selectedCert && montantAuto <= 0 && (
                <p className="text-xs text-destructive mt-1">Aucune TVA déductible cordon restante à transférer.</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.operationsDouaneCloturees ?? false} onCheckedChange={(v) => setForm({ ...form, operationsDouaneCloturees: v })} />
              <Label>Opérations douanières clôturées</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating || !form.operationsDouaneCloturees || montantAuto <= 0}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {resubmitTarget ? "Renvoyer la demande" : "Soumettre la renonciation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GED Document dialog — upload only if DEMANDE/EN_COURS */}
      <DocumentGED
        open={docDialog !== null}
        onOpenChange={() => setDocDialog(null)}
        title={`Documents — Transfert #${docDialog?.id}`}
        dossierId={docDialog?.id ?? null}
        documentTypes={TRANSFERT_DOCUMENT_TYPES}
        documents={docs}
        loading={docsLoading}
        canUpload={docDialog ? canUploadDocs(docDialog) : false}
        onUpload={handleGEDUpload}
        onRefresh={refreshDocs}
      />
    </DashboardLayout>
  );
};

export default Transferts;
