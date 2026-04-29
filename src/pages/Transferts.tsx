import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  transfertCreditApi, TransfertCreditDto, StatutTransfert,
  CreateTransfertCreditRequest, TRANSFERT_STATUT_LABELS,
  TRANSFERT_DOCUMENT_TYPES, TypeDocumentTransfert, DocumentTransfertCreditDto,
  certificatCreditApi, CertificatCreditDto,
  DecisionCorrectionDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ArrowRightLeft, Search, RefreshCw, Loader2, Plus, Eye, Filter, FileText, CheckCircle2, XCircle, RotateCcw, Ban, AlertTriangle, MessageSquare } from "lucide-react";
import DocumentGED from "@/components/ged/DocumentGED";

const STATUT_COLORS: Record<StatutTransfert, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_COURS: "bg-yellow-100 text-yellow-800",
  VALIDE: "bg-emerald-100 text-emerald-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  TRANSFERE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
  ANNULEE: "bg-slate-200 text-slate-700",
};

/** Visible statuses in filter dropdown (VALIDE is not used by backend) */
const VISIBLE_STATUTS: StatutTransfert[] = ["DEMANDE", "EN_COURS", "INCOMPLETE", "A_RECONTROLER", "TRANSFERE", "REJETE", "ANNULEE"];

/** Statuts terminaux : aucune action métier possible. */
const TERMINAL_STATUTS: StatutTransfert[] = ["TRANSFERE", "REJETE", "ANNULEE"];

/** Statuts qui acceptent encore le dépôt de pièces. */
const UPLOAD_STATUTS: StatutTransfert[] = ["DEMANDE", "EN_COURS", "VALIDE", "INCOMPLETE", "A_RECONTROLER"];

/** Statuts qui autorisent la validation finale (DGTCP / Président). */
const VALIDATE_STATUTS: StatutTransfert[] = ["DEMANDE", "EN_COURS", "VALIDE", "A_RECONTROLER"];

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
  const [selectedDecisions, setSelectedDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  // Cancel confirm
  const [cancelTarget, setCancelTarget] = useState<TransfertCreditDto | null>(null);

  // Rejet temp dialog (DGTCP / Président)
  const [rejetTarget, setRejetTarget] = useState<TransfertCreditDto | null>(null);
  const [rejetMotif, setRejetMotif] = useState("");
  const [rejetDocs, setRejetDocs] = useState<string[]>([]);
  const [rejetLoading, setRejetLoading] = useState(false);

  // Réponse entreprise à un rejet temporaire
  const [respondDecision, setRespondDecision] = useState<DecisionCorrectionDto | null>(null);
  const [responseMsg, setResponseMsg] = useState("");
  const [responding, setResponding] = useState(false);

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
      // Exclure les certificats avec une demande encore en cours (non-terminale).
      const activeCertIds = new Set(
        data.filter(t => !TERMINAL_STATUTS.includes(t.statut)).map(t => t.certificatCreditId)
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

  const handleAnnuler = async () => {
    if (!cancelTarget) return;
    setActionLoading(cancelTarget.id);
    try {
      await transfertCreditApi.annuler(cancelTarget.id);
      toast({ title: "Succès", description: "Demande annulée" });
      setCancelTarget(null);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleRejetTemp = async () => {
    if (!rejetTarget || !rejetMotif.trim() || rejetDocs.length === 0) return;
    setRejetLoading(true);
    try {
      await transfertCreditApi.postDecision(rejetTarget.id, "REJET_TEMP", rejetMotif.trim(), rejetDocs);
      toast({ title: "Succès", description: "Rejet temporaire envoyé — la demande passe en INCOMPLETE" });
      setRejetTarget(null);
      setRejetMotif("");
      setRejetDocs([]);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setRejetLoading(false); }
  };

  const handleRespond = async () => {
    if (!respondDecision || !responseMsg.trim()) return;
    setResponding(true);
    try {
      await transfertCreditApi.postRejetTempResponse(respondDecision.id, responseMsg.trim());
      toast({ title: "Succès", description: "Réponse envoyée" });
      setRespondDecision(null);
      setResponseMsg("");
      if (selected) loadDecisions(selected.id);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setResponding(false); }
  };

  const handleResolve = async (decisionId: number) => {
    try {
      await transfertCreditApi.resolveRejetTemp(decisionId);
      toast({ title: "Succès", description: "Rejet temporaire résolu" });
      if (selected) loadDecisions(selected.id);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const loadDecisions = async (id: number) => {
    setDecisionsLoading(true);
    try { setSelectedDecisions(await transfertCreditApi.getDecisions(id)); }
    catch { setSelectedDecisions([]); }
    finally { setDecisionsLoading(false); }
  };

  const openSelected = (t: TransfertCreditDto) => {
    setSelected(t);
    setSelectedDecisions([]);
    loadDecisions(t.id);
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
  /** Décision finale (REJET_TEMP) : DGTCP ou Président. */
  const canRejetTemp = hasPermission("transfert.dgtcp.update")
    || hasPermission("transfert.president.validate")
    || hasPermission("transfert.president.reject");
  const canRespondRejet = role === "ENTREPRISE" && hasPermission("transfert.entreprise.rejet.repondre");
  const canAnnuler = role === "ENTREPRISE" && hasPermission("transfert.annuler");
  const f = (v: any) => v != null ? Number(v).toLocaleString("fr-FR") : "—";

  /** Upload allowed in non-terminal states. */
  const canUploadDocs = (t: TransfertCreditDto) =>
    role === "ENTREPRISE" && UPLOAD_STATUTS.includes(t.statut);

  /** Au moins un rejet temp encore OUVERT pour ce transfert (depuis la liste de décisions chargée). */
  const hasOpenRejetTemp = (decisions: DecisionCorrectionDto[]) =>
    decisions.some(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT");

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
                          <Button variant="ghost" size="sm" onClick={() => openSelected(t)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openDocs(t)}><FileText className="h-4 w-4" /></Button>
                          {/* Re-submit after REJETE / ANNULEE */}
                          {canCreate && (t.statut === "REJETE" || t.statut === "ANNULEE") && (
                            <Button variant="outline" size="sm" onClick={() => openResubmit(t)}>
                              <RotateCcw className="h-4 w-4 mr-1" /> Renvoyer
                            </Button>
                          )}
                          {/* Annulation entreprise (tant que non terminal) */}
                          {canAnnuler && !TERMINAL_STATUTS.includes(t.statut) && (
                            <Button variant="outline" size="sm" disabled={actionLoading === t.id} onClick={() => setCancelTarget(t)}>
                              <Ban className="h-4 w-4 mr-1" /> Annuler
                            </Button>
                          )}
                          {/* DGTCP / Président : valider / rejet temp / rejet définitif */}
                          {VALIDATE_STATUTS.includes(t.statut) && canValider && (
                            <Button size="sm" disabled={actionLoading === t.id} onClick={() => handleValider(t.id)}>
                              {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                              Valider
                            </Button>
                          )}
                          {!TERMINAL_STATUTS.includes(t.statut) && t.statut !== "INCOMPLETE" && canRejetTemp && (
                            <Button variant="outline" size="sm" onClick={() => { setRejetTarget(t); setRejetMotif(""); setRejetDocs([]); }}>
                              <AlertTriangle className="h-4 w-4 mr-1" /> Rejet temp.
                            </Button>
                          )}
                          {!TERMINAL_STATUTS.includes(t.statut) && canRejeter && (
                            <Button variant="destructive" size="sm" disabled={actionLoading === t.id} onClick={() => handleRejeter(t.id)}>
                              {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                              Rejeter
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
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setSelectedDecisions([]); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transfert #{selected?.id} — Douane → Intérieur</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Certificat</span><p className="font-medium">{selected.certificatNumero || `#${selected.certificatCreditId}`}</p></div>
                <div><span className="text-muted-foreground">Montant (Cordon → TVA)</span><p className="font-medium">{f(selected.montant)} MRU</p></div>
                <div><span className="text-muted-foreground">Statut</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{TRANSFERT_STATUT_LABELS[selected.statut]}</Badge></p></div>
                <div><span className="text-muted-foreground">Ops douane clôturées</span><p className="font-medium">{selected.operationsDouaneCloturees ? "Oui" : "Non"}</p></div>
                <div><span className="text-muted-foreground">Date demande</span><p className="font-medium">{selected.dateDemande ? new Date(selected.dateDemande).toLocaleDateString("fr-FR") : "—"}</p></div>
              </div>
              {selected.statut === "EN_COURS" && (
                <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
                  Dossier en cours de constitution — au moins une pièce a été déposée. Déposez les 3 documents obligatoires pour permettre la validation.
                </div>
              )}
              {selected.statut === "INCOMPLETE" && (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-300 text-xs text-amber-900">
                  Rejet temporaire ouvert — l'entreprise doit répondre via message et/ou déposer les pièces demandées (un message est obligatoire à l'upload sous rejet temporaire).
                </div>
              )}
              {selected.statut === "A_RECONTROLER" && (
                <div className="p-3 rounded-md bg-cyan-50 border border-cyan-300 text-xs text-cyan-900">
                  Tous les rejets temporaires ont été résolus — le dossier peut être validé ou recevoir une nouvelle décision.
                </div>
              )}
              {selected.statut === "TRANSFERE" && (
                <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
                  Transfert exécuté : {f(selected.montant)} MRU débité du solde Cordon et crédité au solde TVA intérieure du même certificat.
                </div>
              )}
              {selected.statut === "REJETE" && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  Demande rejetée définitivement. Vous pouvez renvoyer une nouvelle demande — les anciennes pièces seront désactivées.
                </div>
              )}
              {selected.statut === "ANNULEE" && (
                <div className="p-3 rounded-md bg-slate-100 border border-slate-300 text-xs text-slate-700">
                  Demande annulée par l'entreprise. Une nouvelle demande peut être créée sur le même certificat.
                </div>
              )}

              {/* Décisions */}
              <div className="border-t border-border pt-3">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Décisions ({selectedDecisions.length})
                </h3>
                {decisionsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : selectedDecisions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucune décision enregistrée.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedDecisions.map((d) => (
                      <div key={d.id} className="border border-border rounded-md p-3 bg-muted/20">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{d.role}</Badge>
                              <Badge className="text-xs bg-amber-100 text-amber-800">Rejet temporaire</Badge>
                              {d.rejetTempStatus && (
                                <Badge className={`text-xs ${d.rejetTempStatus === "OUVERT" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>
                                  {d.rejetTempStatus === "OUVERT" ? "Ouvert" : "Résolu"}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">{d.dateDecision ? new Date(d.dateDecision).toLocaleDateString("fr-FR") : ""}</span>
                            </div>
                            {d.motifRejet && <p className="text-xs mt-2"><span className="text-muted-foreground">Motif :</span> {d.motifRejet}</p>}
                            {d.documentsDemandes && d.documentsDemandes.length > 0 && (
                              <p className="text-xs mt-1"><span className="text-muted-foreground">Pièces demandées :</span> {d.documentsDemandes.join(", ")}</p>
                            )}
                            {d.rejetTempResponses && d.rejetTempResponses.length > 0 && (
                              <div className="mt-2 space-y-1 pl-2 border-l-2 border-border">
                                {d.rejetTempResponses.map((r) => (
                                  <div key={r.id} className="text-xs">
                                    <span className="font-medium">{r.auteurNom || r.utilisateurNom || "—"} :</span> {r.message}
                                    {r.documentType && <span className="text-muted-foreground"> ({r.documentType})</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2 justify-end">
                          {canRespondRejet && d.rejetTempStatus === "OUVERT" && (
                            <Button size="sm" variant="outline" onClick={() => { setRespondDecision(d); setResponseMsg(""); }}>
                              Répondre
                            </Button>
                          )}
                          {d.rejetTempStatus === "OUVERT" && (canValider || hasPermission("transfert.president.validate")) && (
                            <Button size="sm" onClick={() => handleResolve(d.id)}>
                              Marquer résolu
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirm dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Annuler la demande de transfert</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirmez l'annulation du transfert <strong>#{cancelTarget?.id}</strong> sur le certificat{" "}
            <strong>{cancelTarget?.certificatNumero || `#${cancelTarget?.certificatCreditId}`}</strong>.
            Vous pourrez créer une nouvelle demande sur le même certificat après l'annulation.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Retour</Button>
            <Button variant="destructive" onClick={handleAnnuler} disabled={actionLoading === cancelTarget?.id}>
              {actionLoading === cancelTarget?.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejet temporaire dialog (DGTCP / Président) */}
      <Dialog open={!!rejetTarget} onOpenChange={(o) => { if (!o) setRejetTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Rejet temporaire — Transfert #{rejetTarget?.id}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motif du rejet temporaire <span className="text-destructive">*</span></Label>
              <Textarea value={rejetMotif} onChange={(e) => setRejetMotif(e.target.value)} placeholder="Précisez ce qu'il manque ou ce qui doit être corrigé" rows={3} />
            </div>
            <div>
              <Label>Pièces à fournir <span className="text-destructive">*</span></Label>
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto border border-border rounded-md p-3">
                {TRANSFERT_DOCUMENT_TYPES.map((d) => (
                  <div key={d.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`rt-${d.value}`}
                      checked={rejetDocs.includes(d.value)}
                      onCheckedChange={(c) => setRejetDocs((prev) => c ? [...prev, d.value] : prev.filter(x => x !== d.value))}
                    />
                    <label htmlFor={`rt-${d.value}`} className="text-sm cursor-pointer">{d.label}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejetTarget(null)}>Annuler</Button>
            <Button onClick={handleRejetTemp} disabled={rejetLoading || !rejetMotif.trim() || rejetDocs.length === 0}>
              {rejetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Envoyer le rejet temporaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Réponse entreprise au rejet temp */}
      <Dialog open={!!respondDecision} onOpenChange={(o) => { if (!o) { setRespondDecision(null); setResponseMsg(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Répondre au rejet temporaire</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {respondDecision?.motifRejet && (
              <div className="p-3 rounded-md bg-muted/50 border border-border text-xs">
                <span className="text-muted-foreground">Motif :</span> {respondDecision.motifRejet}
              </div>
            )}
            <div>
              <Label>Message <span className="text-destructive">*</span></Label>
              <Textarea value={responseMsg} onChange={(e) => setResponseMsg(e.target.value)} rows={4} placeholder="Votre réponse à l'administration" />
              <p className="text-xs text-muted-foreground mt-1">
                Pour joindre des pièces, utilisez l'icône Documents sur la ligne concernée — un message sera demandé à l'upload sous rejet temporaire ouvert.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDecision(null)}>Annuler</Button>
            <Button onClick={handleRespond} disabled={responding || !responseMsg.trim()}>
              {responding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Envoyer la réponse
            </Button>
          </DialogFooter>
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
