import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  transfertCreditApi, TransfertCreditDto, StatutTransfert,
  CreateTransfertCreditRequest,
  TRANSFERT_DOCUMENT_TYPES, TypeDocumentTransfert, DocumentTransfertCreditDto,
  certificatCreditApi, CertificatCreditDto,
  DecisionCorrectionDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutTransfert, tTypeDocument, tRejetTempStatus } from "@/i18n/enums";
import { formatAmount, formatDate } from "@/i18n/format";
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
import { ArrowRightLeft, Search, RefreshCw, Loader2, Plus, Eye, Filter, CheckCircle2, XCircle, RotateCcw, Ban, AlertTriangle, MessageSquare } from "lucide-react";
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

const VISIBLE_STATUTS: StatutTransfert[] = ["DEMANDE", "EN_COURS", "INCOMPLETE", "A_RECONTROLER", "TRANSFERE", "REJETE", "ANNULEE"];
const TERMINAL_STATUTS: StatutTransfert[] = ["TRANSFERE", "REJETE", "ANNULEE"];
const UPLOAD_STATUTS: StatutTransfert[] = ["DEMANDE", "EN_COURS", "VALIDE", "INCOMPLETE", "A_RECONTROLER"];
const VALIDATE_STATUTS: StatutTransfert[] = ["DEMANDE", "EN_COURS", "VALIDE", "A_RECONTROLER"];

const Transferts = () => {
  const { t } = useTranslation(["transferts", "common", "enums"]);
  usePageTitle("transferts:list.title");
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [data, setData] = useState<TransfertCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [resubmitTarget, setResubmitTarget] = useState<TransfertCreditDto | null>(null);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [form, setForm] = useState<Partial<CreateTransfertCreditRequest>>({});
  const [createFiles, setCreateFiles] = useState<Record<string, File | null>>({});
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<TransfertCreditDto | null>(null);
  const [selectedDecisions, setSelectedDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<TransfertCreditDto | null>(null);

  const [rejetTarget, setRejetTarget] = useState<TransfertCreditDto | null>(null);
  const [rejetMotif, setRejetMotif] = useState("");
  const [rejetDocs, setRejetDocs] = useState<string[]>([]);
  const [rejetLoading, setRejetLoading] = useState(false);

  const [respondDecision, setRespondDecision] = useState<DecisionCorrectionDto | null>(null);
  const [responseMsg, setResponseMsg] = useState("");
  const [responding, setResponding] = useState(false);

  const [docDialog, setDocDialog] = useState<TransfertCreditDto | null>(null);
  const [docs, setDocs] = useState<DocumentTransfertCreditDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const errToast = (e: any) => toast({ title: t("common:error", { defaultValue: "Erreur" }), description: e?.message || String(e), variant: "destructive" });
  const okToast = (description: string, title?: string) => toast({ title: title ?? t("common:success", { defaultValue: "Succès" }), description });

  const fetchData = async () => {
    setLoading(true);
    try { setData(await transfertCreditApi.getAll()); }
    catch { toast({ title: t("common:error", { defaultValue: "Erreur" }), description: t("transferts:toasts.load_error"), variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const [resubmitCert, setResubmitCert] = useState<CertificatCreditDto | null>(null);

  const getMontantRenonciation = (c: CertificatCreditDto | null | undefined): number => {
    if (!c) return 0;
    const reste = c.tvaImportationDouane ?? 0;
    return Math.min(reste, c.soldeCordon ?? reste);
  };

  const openCreate = async () => {
    setResubmitTarget(null);
    setResubmitCert(null);
    setForm({ operationsDouaneCloturees: true });
    setCreateFiles({});
    try {
      const certs = role === "ENTREPRISE" && user?.entrepriseId
        ? await certificatCreditApi.getByEntreprise(user.entrepriseId)
        : await certificatCreditApi.getAll();
      const activeCertIds = new Set(
        data.filter(t => !TERMINAL_STATUTS.includes(t.statut)).map(t => t.certificatCreditId)
      );
      setCertificats(certs.filter(c => c.statut === "OUVERT" && !activeCertIds.has(c.id)));
    } catch { /* ignore */ }
    setShowCreate(true);
  };

  const openResubmit = async (tr: TransfertCreditDto) => {
    setResubmitTarget(tr);
    setForm({ certificatCreditId: tr.certificatCreditId, operationsDouaneCloturees: true });
    setCreateFiles({});
    setCertificats([]);
    setResubmitCert(null);
    try {
      const cert = await certificatCreditApi.getById(tr.certificatCreditId);
      setResubmitCert(cert);
    } catch { /* ignore */ }
    setShowCreate(true);
  };

  const selectedCert = resubmitTarget ? resubmitCert : certificats.find(c => c.id === form.certificatCreditId);
  const montantAuto = getMontantRenonciation(selectedCert);

  const handleCreate = async () => {
    const certId = resubmitTarget ? resubmitTarget.certificatCreditId : form.certificatCreditId;
    if (!certId) { toast({ title: t("common:error", { defaultValue: "Erreur" }), description: t("transferts:toasts.certificat_required"), variant: "destructive" }); return; }
    if (!selectedCert || montantAuto <= 0) {
      toast({ title: t("common:error", { defaultValue: "Erreur" }), description: t("transferts:toasts.no_amount_err"), variant: "destructive" }); return;
    }
    const missing = TRANSFERT_DOCUMENT_TYPES.filter(d => !createFiles[d.value]);
    if (missing.length > 0) {
      toast({
        title: t("transferts:toasts.missing_pieces_title"),
        description: t("transferts:toasts.missing_pieces", { list: missing.map(m => tTypeDocument(m.value) || m.label).join(", ") }),
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const created = await transfertCreditApi.create({
        certificatCreditId: certId,
        montant: montantAuto,
        operationsDouaneCloturees: form.operationsDouaneCloturees,
      });
      const failures: string[] = [];
      for (const d of TRANSFERT_DOCUMENT_TYPES) {
        const file = createFiles[d.value];
        if (!file) continue;
        try { await transfertCreditApi.uploadDocument(created.id, d.value, file); }
        catch (e: any) {
          console.error(`[Transfert #${created.id}] Upload ${d.value} failed:`, e);
          failures.push(`${tTypeDocument(d.value) || d.label} : ${e?.message || "—"}`);
        }
      }
      if (failures.length > 0) {
        toast({ title: t("transferts:toasts.create_partial_title"), description: failures.join(" • "), variant: "destructive" });
      } else {
        okToast(t("transferts:toasts.create_success"));
      }
      setShowCreate(false);
      setCreateFiles({});
      await fetchData();
    } catch (e: any) { errToast(e); } finally { setCreating(false); }
  };

  const handleValider = async (id: number) => {
    setActionLoading(id);
    try { await transfertCreditApi.valider(id); okToast(t("transferts:toasts.valid_success")); fetchData(); }
    catch (e: any) { errToast(e); } finally { setActionLoading(null); }
  };

  const handleRejeter = async (id: number) => {
    setActionLoading(id);
    try { await transfertCreditApi.rejeter(id); okToast(t("transferts:toasts.reject_success")); fetchData(); }
    catch (e: any) { errToast(e); } finally { setActionLoading(null); }
  };

  const handleAnnuler = async () => {
    if (!cancelTarget) return;
    setActionLoading(cancelTarget.id);
    try {
      await transfertCreditApi.annuler(cancelTarget.id);
      okToast(t("transferts:toasts.cancel_success"));
      setCancelTarget(null);
      fetchData();
    } catch (e: any) { errToast(e); } finally { setActionLoading(null); }
  };

  const handleRejetTemp = async () => {
    if (!rejetTarget || !rejetMotif.trim() || rejetDocs.length === 0) return;
    setRejetLoading(true);
    try {
      await transfertCreditApi.postDecision(rejetTarget.id, "REJET_TEMP", rejetMotif.trim(), rejetDocs);
      okToast(t("transferts:toasts.rejet_temp_sent"));
      setRejetTarget(null); setRejetMotif(""); setRejetDocs([]);
      fetchData();
    } catch (e: any) { errToast(e); } finally { setRejetLoading(false); }
  };

  const handleRespond = async () => {
    if (!respondDecision || !responseMsg.trim()) return;
    setResponding(true);
    try {
      await transfertCreditApi.postRejetTempResponse(respondDecision.id, responseMsg.trim());
      okToast(t("transferts:toasts.response_sent"));
      setRespondDecision(null);
      setResponseMsg("");
      if (selected) loadDecisions(selected.id);
      fetchData();
    } catch (e: any) { errToast(e); } finally { setResponding(false); }
  };

  const handleResolve = async (decisionId: number) => {
    try {
      await transfertCreditApi.resolveRejetTemp(decisionId);
      okToast(t("transferts:toasts.rejet_resolved"));
      if (selected) loadDecisions(selected.id);
      fetchData();
    } catch (e: any) { errToast(e); }
  };

  const loadDecisions = async (id: number) => {
    setDecisionsLoading(true);
    try { setSelectedDecisions(await transfertCreditApi.getDecisions(id)); }
    catch { setSelectedDecisions([]); }
    finally { setDecisionsLoading(false); }
  };

  const openSelected = (tr: TransfertCreditDto) => {
    setSelected(tr);
    setSelectedDecisions([]);
    loadDecisions(tr.id);
  };

  const refreshDocs = async (id: number) => {
    try { setDocs(await transfertCreditApi.getDocuments(id)); } catch { /* ignore */ }
    fetchData();
  };

  const handleGEDUpload = async (dossierId: number, type: string, file: File) => {
    await transfertCreditApi.uploadDocument(dossierId, type as TypeDocumentTransfert, file);
  };

  const filtered = data.filter((tr) => {
    const ms = (tr.certificatNumero || "").toLowerCase().includes(search.toLowerCase()) || String(tr.id).includes(search);
    const matchStatut = filterStatut === "ALL" || tr.statut === filterStatut;
    return ms && matchStatut;
  });

  const canCreate = role === "ENTREPRISE";
  const canValider = hasPermission("transfert.dgtcp.update") || hasPermission("transfert.president.validate");
  const canRejeter = hasPermission("transfert.dgtcp.update") || hasPermission("transfert.president.reject");
  const canRejetTemp = hasPermission("transfert.dgtcp.update") || hasPermission("transfert.president.validate") || hasPermission("transfert.president.reject");
  const canRespondRejet = role === "ENTREPRISE" && hasPermission("transfert.entreprise.rejet.repondre");
  const canAnnuler = role === "ENTREPRISE" && hasPermission("transfert.annuler");

  const canUploadDocs = (tr: TransfertCreditDto) => role === "ENTREPRISE" && UPLOAD_STATUTS.includes(tr.statut);
  const hasOpenRejetTemp = (decisions: DecisionCorrectionDto[]) =>
    decisions.some(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
              {t("transferts:list.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("transferts:list.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreate}><Plus className="h-4 w-4 me-2" /> {t("transferts:list.new_renonciation")}</Button>
            )}
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} /> {t("transferts:list.refresh")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("transferts:list.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-56"><Filter className="h-4 w-4 me-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("transferts:list.all_statuses")}</SelectItem>
              {VISIBLE_STATUTS.map((k) => (<SelectItem key={k} value={k}>{tStatutTransfert(k)}</SelectItem>))}
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
                    <TableHead>{t("transferts:columns.id")}</TableHead>
                    <TableHead>{t("transferts:columns.certificat")}</TableHead>
                    <TableHead>{t("transferts:columns.montant")}</TableHead>
                    <TableHead>{t("transferts:columns.ops_cloturees")}</TableHead>
                    <TableHead>{t("transferts:columns.statut")}</TableHead>
                    <TableHead>{t("transferts:columns.date")}</TableHead>
                    <TableHead className="text-end">{t("transferts:columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("transferts:list.empty")}</TableCell></TableRow>
                  ) : filtered.map((tr) => (
                    <TableRow key={tr.id}>
                      <TableCell className="font-medium">#{tr.id}</TableCell>
                      <TableCell className="text-muted-foreground">{tr.certificatNumero || `Cert #${tr.certificatCreditId}`}</TableCell>
                      <TableCell className="font-medium">{formatAmount(tr.montant)}</TableCell>
                      <TableCell>
                        <Badge variant={tr.operationsDouaneCloturees ? "default" : "outline"} className="text-xs">
                          {tr.operationsDouaneCloturees ? t("transferts:list.yes") : t("transferts:list.no")}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[tr.statut]}`}>{tStatutTransfert(tr.statut)}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(tr.dateDemande)}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="default" size="sm" onClick={() => navigate(`/dashboard/transferts/${tr.id}`)}>
                            <Eye className="h-4 w-4 me-1" /> {t("transferts:list.open")}
                          </Button>
                          {canCreate && (tr.statut === "REJETE" || tr.statut === "ANNULEE") && (
                            <Button variant="outline" size="sm" onClick={() => openResubmit(tr)}>
                              <RotateCcw className="h-4 w-4 me-1" /> {t("transferts:list.resubmit")}
                            </Button>
                          )}
                          {canAnnuler && !TERMINAL_STATUTS.includes(tr.statut) && (
                            <Button variant="outline" size="sm" disabled={actionLoading === tr.id} onClick={() => setCancelTarget(tr)}>
                              <Ban className="h-4 w-4 me-1" /> {t("transferts:list.cancel")}
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
          <DialogHeader><DialogTitle>{t("transferts:detail.dialog_title", { id: selected?.id })}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{t("transferts:detail.certificat")}</span><p className="font-medium">{selected.certificatNumero || `#${selected.certificatCreditId}`}</p></div>
                <div><span className="text-muted-foreground">{t("transferts:detail.montant")}</span><p className="font-medium">{formatAmount(selected.montant)}</p></div>
                <div><span className="text-muted-foreground">{t("transferts:detail.statut")}</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{tStatutTransfert(selected.statut)}</Badge></p></div>
                <div><span className="text-muted-foreground">{t("transferts:detail.ops_cloturees")}</span><p className="font-medium">{selected.operationsDouaneCloturees ? t("transferts:detail.yes") : t("transferts:detail.no")}</p></div>
                <div><span className="text-muted-foreground">{t("transferts:detail.date_demande")}</span><p className="font-medium">{formatDate(selected.dateDemande)}</p></div>
              </div>
              {selected.statut === "EN_COURS" && <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">{t("transferts:banners.en_cours")}</div>}
              {selected.statut === "INCOMPLETE" && <div className="p-3 rounded-md bg-amber-50 border border-amber-300 text-xs text-amber-900">{t("transferts:banners.incomplete")}</div>}
              {selected.statut === "A_RECONTROLER" && <div className="p-3 rounded-md bg-cyan-50 border border-cyan-300 text-xs text-cyan-900">{t("transferts:banners.a_recontroler")}</div>}
              {selected.statut === "TRANSFERE" && <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">{t("transferts:banners.transfere", { montant: formatAmount(selected.montant) })}</div>}
              {selected.statut === "REJETE" && <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">{t("transferts:banners.rejete")}</div>}
              {selected.statut === "ANNULEE" && <div className="p-3 rounded-md bg-slate-100 border border-slate-300 text-xs text-slate-700">{t("transferts:banners.annulee")}</div>}

              {selected && !TERMINAL_STATUTS.includes(selected.statut) && (canValider || canRejetTemp || canRejeter) && (
                <div className="border-t border-border pt-3">
                  <h3 className="font-semibold text-sm mb-2">{t("transferts:actions.title")}</h3>
                  <div className="flex gap-2 flex-wrap">
                    {VALIDATE_STATUTS.includes(selected.statut) && canValider && (
                      <Button
                        size="sm"
                        disabled={actionLoading === selected.id || hasOpenRejetTemp(selectedDecisions)}
                        onClick={() => handleValider(selected.id)}
                        title={hasOpenRejetTemp(selectedDecisions) ? t("transferts:actions.validate_blocked_tooltip") : ""}
                      >
                        {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <CheckCircle2 className="h-4 w-4 me-1" />}
                        {t("transferts:actions.valider")}
                      </Button>
                    )}
                    {selected.statut !== "INCOMPLETE" && canRejetTemp && (
                      <Button variant="outline" size="sm" onClick={() => { setRejetTarget(selected); setRejetMotif(""); setRejetDocs([]); }}>
                        <AlertTriangle className="h-4 w-4 me-1" /> {t("transferts:actions.rejet_temp_emit")}
                      </Button>
                    )}
                    {canRejeter && (
                      <Button variant="destructive" size="sm" disabled={actionLoading === selected.id} onClick={() => handleRejeter(selected.id)}>
                        {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <XCircle className="h-4 w-4 me-1" />}
                        {t("transferts:actions.rejeter")}
                      </Button>
                    )}
                  </div>
                  {hasOpenRejetTemp(selectedDecisions) && (
                    <p className="text-xs text-amber-700 mt-2">{t("transferts:actions.validate_blocked_warning")}</p>
                  )}
                </div>
              )}

              <div className="border-t border-border pt-3">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  {t("transferts:decisions.title", { count: selectedDecisions.length })}
                </h3>
                {decisionsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : selectedDecisions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">{t("transferts:decisions.empty")}</p>
                ) : (
                  <div className="space-y-3">
                    {selectedDecisions.map((d) => (
                      <div key={d.id} className="border border-border rounded-md p-3 bg-muted/20">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{d.role}</Badge>
                              <Badge className="text-xs bg-amber-100 text-amber-800">{t("transferts:decisions.type_rejet_temp")}</Badge>
                              {d.rejetTempStatus && (
                                <Badge className={`text-xs ${d.rejetTempStatus === "OUVERT" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>
                                  {tRejetTempStatus(d.rejetTempStatus)}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">{formatDate(d.dateDecision)}</span>
                            </div>
                            {d.motifRejet && <p className="text-xs mt-2"><span className="text-muted-foreground">{t("transferts:rejet_temp.history.motif")} :</span> {d.motifRejet}</p>}
                            {d.documentsDemandes && d.documentsDemandes.length > 0 && (
                              <p className="text-xs mt-1"><span className="text-muted-foreground">{t("transferts:rejet_temp.history.pieces_demandees")} :</span> {d.documentsDemandes.map(dt => tTypeDocument(dt)).join(", ")}</p>
                            )}
                            {d.rejetTempResponses && d.rejetTempResponses.length > 0 && (
                              <div className="mt-2 space-y-1 ps-2 border-s-2 border-border">
                                {d.rejetTempResponses.map((r) => (
                                  <div key={r.id} className="text-xs">
                                    <span className="font-medium">{r.auteurNom || r.utilisateurNom || "—"} :</span> {r.message}
                                    {r.documentType && <span className="text-muted-foreground"> ({tTypeDocument(r.documentType)})</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2 justify-end">
                          {canRespondRejet && d.rejetTempStatus === "OUVERT" && (
                            <Button size="sm" variant="outline" onClick={() => { setRespondDecision(d); setResponseMsg(""); }}>
                              {t("transferts:actions.repondre")}
                            </Button>
                          )}
                          {d.rejetTempStatus === "OUVERT" && (canValider || hasPermission("transfert.president.validate")) && (
                            <Button size="sm" onClick={() => handleResolve(d.id)}>
                              {t("transferts:actions.marquer_resolu")}
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
          <DialogHeader><DialogTitle>{t("transferts:cancel.dialog_title")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("transferts:cancel.confirm_long", {
              id: cancelTarget?.id,
              cert: cancelTarget?.certificatNumero || `#${cancelTarget?.certificatCreditId}`,
            })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>{t("transferts:cancel.btn_back")}</Button>
            <Button variant="destructive" onClick={handleAnnuler} disabled={actionLoading === cancelTarget?.id}>
              {actionLoading === cancelTarget?.id && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("transferts:cancel.btn_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejet temporaire dialog */}
      <Dialog open={!!rejetTarget} onOpenChange={(o) => { if (!o) setRejetTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("transferts:rejet_temp.dialog_title", { id: rejetTarget?.id })}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("transferts:rejet_temp.motif_label_long")} <span className="text-destructive">*</span></Label>
              <Textarea value={rejetMotif} onChange={(e) => setRejetMotif(e.target.value)} placeholder={t("transferts:rejet_temp.motif_placeholder")} rows={3} />
            </div>
            <div>
              <Label>{t("transferts:rejet_temp.pieces_label")} <span className="text-destructive">*</span></Label>
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto border border-border rounded-md p-3">
                {TRANSFERT_DOCUMENT_TYPES.map((d) => (
                  <div key={d.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`rt-${d.value}`}
                      checked={rejetDocs.includes(d.value)}
                      onCheckedChange={(c) => setRejetDocs((prev) => c ? [...prev, d.value] : prev.filter(x => x !== d.value))}
                    />
                    <label htmlFor={`rt-${d.value}`} className="text-sm cursor-pointer">{tTypeDocument(d.value) || d.label}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejetTarget(null)}>{t("transferts:rejet_temp.btn_cancel")}</Button>
            <Button onClick={handleRejetTemp} disabled={rejetLoading || !rejetMotif.trim() || rejetDocs.length === 0}>
              {rejetLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("transferts:rejet_temp.btn_send_long")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Réponse entreprise (list dialog version, message-only) */}
      <Dialog open={!!respondDecision} onOpenChange={(o) => { if (!o) { setRespondDecision(null); setResponseMsg(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("transferts:rejet_temp.response.dialog_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {respondDecision?.motifRejet && (
              <div className="p-3 rounded-md bg-muted/50 border border-border text-xs">
                <span className="text-muted-foreground">{t("transferts:rejet_temp.response.motif_recall")}</span> {respondDecision.motifRejet}
              </div>
            )}
            <div>
              <Label>{t("transferts:rejet_temp.response.message_label")} <span className="text-destructive">*</span></Label>
              <Textarea value={responseMsg} onChange={(e) => setResponseMsg(e.target.value)} rows={4} placeholder={t("transferts:rejet_temp.response.message_placeholder")} />
              <p className="text-xs text-muted-foreground mt-1">{t("transferts:rejet_temp.response.message_help_upload")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDecision(null)}>{t("transferts:rejet_temp.response.btn_cancel")}</Button>
            <Button onClick={handleRespond} disabled={responding || !responseMsg.trim()}>
              {responding && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("transferts:rejet_temp.response.btn_send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / re-submit dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{resubmitTarget ? t("transferts:create.title_resubmit") : t("transferts:create.title_create")}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {resubmitTarget
                ? t("transferts:create.intro_resubmit", { cert: resubmitTarget.certificatNumero || `#${resubmitTarget.certificatCreditId}` })
                : t("transferts:create.intro_create")}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {!resubmitTarget && (
              <div>
                <Label>{t("transferts:create.certificat_label")}</Label>
                <SearchableSelect
                  value={form.certificatCreditId ? String(form.certificatCreditId) : ""}
                  onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}
                  placeholder={t("transferts:create.certificat_placeholder")}
                  searchPlaceholder={t("transferts:create.certificat_search")}
                  options={certificats.map((c) => ({
                    value: String(c.id),
                    label: t("transferts:create.certificat_option", {
                      numero: c.numero || `Cert #${c.id}`,
                      montant: formatAmount(c.tvaImportationDouane),
                    }),
                    keywords: `${c.numero || ""}`,
                  }))}
                />
              </div>
            )}
            {!resubmitTarget && selectedCert && (
              <div className="p-3 rounded-md bg-muted/50 border border-border text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("transferts:create.summary_solde_cordon")}</span><span className="font-medium">{formatAmount(selectedCert.soldeCordon)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("transferts:create.summary_solde_tva")}</span><span className="font-medium">{formatAmount(selectedCert.soldeTVA)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 mt-1">
                  <span className="text-muted-foreground">{t("transferts:create.summary_d_prime")}</span>
                  <span className="font-medium">{formatAmount(selectedCert.tvaImportationDouane)}</span>
                </div>
              </div>
            )}
            {resubmitTarget && resubmitCert && (
              <div className="p-3 rounded-md bg-muted/50 border border-border text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("transferts:create.summary_solde_cordon")}</span><span className="font-medium">{formatAmount(resubmitCert.soldeCordon)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("transferts:create.summary_d_prime")}</span><span className="font-medium">{formatAmount(resubmitCert.tvaImportationDouane)}</span></div>
              </div>
            )}
            <div>
              <Label>{t("transferts:create.montant_label")}</Label>
              <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/30 text-sm font-semibold">
                {selectedCert ? formatAmount(montantAuto) : "—"}
              </div>
              {(!selectedCert || montantAuto > 0) && (
                <p className="text-xs text-muted-foreground mt-1">{t("transferts:create.montant_help")}</p>
              )}
              {selectedCert && montantAuto <= 0 && (
                <p className="text-xs text-destructive mt-1">
                  {(selectedCert.tvaImportationDouane ?? 0) <= 0
                    ? t("transferts:create.no_d_prime")
                    : (selectedCert.soldeCordon ?? 0) <= 0
                      ? t("transferts:create.cordon_epuise")
                      : t("transferts:create.no_transferable")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.operationsDouaneCloturees ?? false} onCheckedChange={(v) => setForm({ ...form, operationsDouaneCloturees: v })} />
              <Label>{t("transferts:create.ops_label")}</Label>
            </div>
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <Label className="text-sm font-semibold">{t("transferts:create.pieces_title")}</Label>
                <p className="text-xs text-muted-foreground mt-1">{t("transferts:create.pieces_help")}</p>
              </div>
              {TRANSFERT_DOCUMENT_TYPES.map((d) => (
                <div key={d.value} className="space-y-1">
                  <Label className="text-xs">{tTypeDocument(d.value) || d.label} <span className="text-destructive">*</span></Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setCreateFiles({ ...createFiles, [d.value]: e.target.files?.[0] || null })}
                  />
                  {createFiles[d.value] && (
                    <p className="text-xs text-emerald-700 truncate">{createFiles[d.value]!.name}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("transferts:create.btn_cancel")}</Button>
            <Button onClick={handleCreate} disabled={creating || !form.operationsDouaneCloturees || montantAuto <= 0}>
              {creating && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {resubmitTarget ? t("transferts:create.btn_resubmit") : t("transferts:create.btn_create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GED Document dialog */}
      <DocumentGED
        open={docDialog !== null}
        onOpenChange={() => setDocDialog(null)}
        title={t("transferts:documents.dialog_title", { id: docDialog?.id })}
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
