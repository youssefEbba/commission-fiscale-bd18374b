import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  transfertCreditApi, TransfertCreditDto, StatutTransfert,
  TRANSFERT_DOCUMENT_TYPES,
  TypeDocumentTransfert, DocumentTransfertCreditDto,
  DecisionCorrectionDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutTransfert, tTypeDocument, tRejetTempStatus } from "@/i18n/enums";
import { formatAmount, formatDate, formatDateTime } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle, Ban,
  MessageSquare, FileText, RefreshCw,
} from "lucide-react";
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

const TERMINAL_STATUTS: StatutTransfert[] = ["TRANSFERE", "REJETE", "ANNULEE"];
const UPLOAD_STATUTS: StatutTransfert[] = ["DEMANDE", "EN_COURS", "VALIDE", "INCOMPLETE", "A_RECONTROLER"];
const VALIDATE_STATUTS: StatutTransfert[] = ["DEMANDE", "EN_COURS", "VALIDE", "A_RECONTROLER"];

const TransfertDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(["transferts", "common", "enums"]);
  usePageTitle("transferts:detail.title", { id: id ?? "" });
  const { user, hasPermission } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();

  const [transfert, setTransfert] = useState<TransfertCreditDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  const [docs, setDocs] = useState<DocumentTransfertCreditDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [gedOpen, setGedOpen] = useState(false);

  const [rejetOpen, setRejetOpen] = useState(false);
  const [rejetMotif, setRejetMotif] = useState("");
  const [rejetDocs, setRejetDocs] = useState<string[]>([]);
  const [rejetLoading, setRejetLoading] = useState(false);

  const [respondDecision, setRespondDecision] = useState<DecisionCorrectionDto | null>(null);
  const [responseMsg, setResponseMsg] = useState("");
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [responseDocType, setResponseDocType] = useState<string>("");
  const [responding, setResponding] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);

  const errToast = (e: any) => toast({ title: t("common:error", { defaultValue: "Erreur" }), description: e?.message || String(e), variant: "destructive" });
  const okToast = (description: string) => toast({ title: t("common:success", { defaultValue: "Succès" }), description });

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const tr = await transfertCreditApi.getById(Number(id));
      setTransfert(tr);
    } catch {
      toast({ title: t("common:error", { defaultValue: "Erreur" }), description: t("transferts:toasts.load_error_one"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
    loadDecisions();
    loadDocs();
  };

  const loadDecisions = async () => {
    if (!id) return;
    setDecisionsLoading(true);
    try { setDecisions(await transfertCreditApi.getDecisions(Number(id))); }
    catch { setDecisions([]); }
    finally { setDecisionsLoading(false); }
  };

  const loadDocs = async () => {
    if (!id) return;
    setDocsLoading(true);
    try { setDocs(await transfertCreditApi.getDocuments(Number(id))); }
    catch { setDocs([]); }
    finally { setDocsLoading(false); }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [id]);

  const canValider = hasPermission("transfert.dgtcp.update") || hasPermission("transfert.president.validate");
  const canRejeter = hasPermission("transfert.dgtcp.update") || hasPermission("transfert.president.reject");
  const canRejetTemp = hasPermission("transfert.dgtcp.update")
    || hasPermission("transfert.president.validate")
    || hasPermission("transfert.president.reject");
  const canRespondRejet = role === "ENTREPRISE" && hasPermission("transfert.entreprise.rejet.repondre");
  const canAnnuler = role === "ENTREPRISE" && hasPermission("transfert.annuler");
  const canUpload = !!transfert && role === "ENTREPRISE" && UPLOAD_STATUTS.includes(transfert.statut);

  const hasOpenRejetTemp = decisions.some(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT");

  const handleValider = async () => {
    if (!transfert) return;
    setActionLoading(true);
    try { await transfertCreditApi.valider(transfert.id); okToast(t("transferts:toasts.valid_success_short")); loadAll(); }
    catch (e: any) { errToast(e); } finally { setActionLoading(false); }
  };

  const handleRejeter = async () => {
    if (!transfert) return;
    setActionLoading(true);
    try { await transfertCreditApi.rejeter(transfert.id); okToast(t("transferts:toasts.reject_success")); loadAll(); }
    catch (e: any) { errToast(e); } finally { setActionLoading(false); }
  };

  const handleAnnuler = async () => {
    if (!transfert) return;
    setActionLoading(true);
    try {
      await transfertCreditApi.annuler(transfert.id);
      okToast(t("transferts:toasts.cancel_success"));
      setCancelOpen(false);
      loadAll();
    } catch (e: any) { errToast(e); } finally { setActionLoading(false); }
  };

  const handleRejetTemp = async () => {
    if (!transfert || !rejetMotif.trim() || rejetDocs.length === 0) return;
    setRejetLoading(true);
    try {
      await transfertCreditApi.postDecision(transfert.id, "REJET_TEMP", rejetMotif.trim(), rejetDocs);
      okToast(t("transferts:toasts.rejet_temp_sent_short"));
      setRejetOpen(false);
      setRejetMotif(""); setRejetDocs([]);
      loadAll();
    } catch (e: any) { errToast(e); } finally { setRejetLoading(false); }
  };

  const handleRespond = async () => {
    if (!respondDecision || !responseMsg.trim()) return;
    const demanded = respondDecision.documentsDemandes || [];
    if (demanded.length > 0 && (!responseFile || !responseDocType)) {
      toast({ title: t("transferts:toasts.response_missing_piece_title"), description: t("transferts:toasts.response_missing_piece"), variant: "destructive" });
      return;
    }
    setResponding(true);
    try {
      await transfertCreditApi.postRejetTempResponse(
        respondDecision.id,
        responseMsg.trim(),
        responseFile || undefined,
        responseDocType || undefined,
      );
      okToast(responseFile ? t("transferts:rejet_temp.response.versioned") : t("transferts:toasts.response_sent"));
      setRespondDecision(null);
      setResponseMsg("");
      setResponseFile(null);
      setResponseDocType("");
      loadDecisions();
      loadDocs();
    } catch (e: any) { errToast(e); } finally { setResponding(false); }
  };

  const handleResolve = async (decisionId: number) => {
    try {
      await transfertCreditApi.resolveRejetTemp(decisionId);
      okToast(t("transferts:toasts.rejet_resolved"));
      loadDecisions();
      loadAll();
    } catch (e: any) { errToast(e); }
  };

  const handleGEDUpload = async (dossierId: number, type: string, file: File) => {
    await transfertCreditApi.uploadDocument(dossierId, type as TypeDocumentTransfert, file);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  if (!transfert) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 space-y-4">
          <p className="text-muted-foreground">{t("transferts:detail.not_found")}</p>
          <Button variant="outline" onClick={() => navigate("/dashboard/transferts")}>
            <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t("transferts:detail.back_to_list")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/transferts")}>
              <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t("transferts:detail.back")}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t("transferts:detail.title", { id: transfert.id })}</h1>
              <p className="text-muted-foreground text-sm">{t("transferts:detail.subtitle")}</p>
            </div>
          </div>
          <Button variant="outline" onClick={loadAll}>
            <RefreshCw className="h-4 w-4 me-2" /> {t("transferts:detail.refresh")}
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("transferts:detail.info_title")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("transferts:detail.certificat")}</span>
                <p className="font-medium">{transfert.certificatNumero || `#${transfert.certificatCreditId}`}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("transferts:detail.montant")}</span>
                <p className="font-medium">{formatAmount(transfert.montant)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("transferts:detail.statut")}</span>
                <p><Badge className={`text-xs ${STATUT_COLORS[transfert.statut]}`}>{tStatutTransfert(transfert.statut)}</Badge></p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("transferts:detail.ops_cloturees")}</span>
                <p className="font-medium">{transfert.operationsDouaneCloturees ? t("transferts:detail.yes") : t("transferts:detail.no")}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("transferts:detail.date_demande")}</span>
                <p className="font-medium">{formatDate(transfert.dateDemande)}</p>
              </div>
            </div>

            {!TERMINAL_STATUTS.includes(transfert.statut) && (canValider || canRejetTemp || canRejeter || canAnnuler) && (
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                {VALIDATE_STATUTS.includes(transfert.statut) && canValider && (
                  <Button size="sm" disabled={actionLoading || hasOpenRejetTemp} onClick={handleValider}
                    title={hasOpenRejetTemp ? t("transferts:actions.validate_blocked_tooltip") : ""}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <CheckCircle2 className="h-4 w-4 me-1" />}
                    {t("transferts:actions.valider")}
                  </Button>
                )}
                {transfert.statut !== "INCOMPLETE" && canRejetTemp && (
                  <Button variant="outline" size="sm" onClick={() => { setRejetOpen(true); setRejetMotif(""); setRejetDocs([]); }}>
                    <AlertTriangle className="h-4 w-4 me-1" /> {t("transferts:actions.rejet_temp_short")}
                  </Button>
                )}
                {canRejeter && (
                  <Button variant="destructive" size="sm" disabled={actionLoading} onClick={handleRejeter}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <XCircle className="h-4 w-4 me-1" />}
                    {t("transferts:actions.rejeter")}
                  </Button>
                )}
                {canAnnuler && (
                  <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                    <Ban className="h-4 w-4 me-1" /> {t("transferts:actions.annuler")}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> {t("transferts:documents.title")}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setGedOpen(true)}>
              {t("transferts:documents.manage")}
            </Button>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : docs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t("transferts:documents.empty")}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {(() => {
                  const groups = new Map<string, DocumentTransfertCreditDto[]>();
                  docs.forEach(d => {
                    const arr = groups.get(d.type) || [];
                    arr.push(d);
                    groups.set(d.type, arr);
                  });
                  const ordered = Array.from(groups.entries()).map(([type, arr]) => {
                    const sorted = [...arr].sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
                    const current = sorted.find(d => d.actif !== false) ?? sorted[0];
                    const previous = sorted.filter(d => d.id !== current.id);
                    return { type, current, previous };
                  });
                  return ordered.map(({ type, current, previous }) => {
                    const typeLabel = tTypeDocument(type) || TRANSFERT_DOCUMENT_TYPES.find(tt => tt.value === type)?.label || type;
                    const expanded = expandedVersions.has(type);
                    return (
                      <li key={type} className="py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{typeLabel}</p>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {t("transferts:documents.current", { n: current.version ?? 1 })}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{current.nomFichier}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">{formatDate(current.dateUpload)}</Badge>
                            {previous.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setExpandedVersions(prev => {
                                    const next = new Set(prev);
                                    next.has(type) ? next.delete(type) : next.add(type);
                                    return next;
                                  });
                                }}
                              >
                                {expanded ? t("transferts:documents.hide") : t("transferts:documents.history", { count: previous.length })}
                              </Button>
                            )}
                          </div>
                        </div>
                        {expanded && previous.length > 0 && (
                          <ul className="mt-2 ms-4 ps-3 border-s border-border space-y-1.5">
                            {previous.map(p => (
                              <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                                <div className="min-w-0 flex-1 flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] shrink-0">v{p.version ?? "—"}</Badge>
                                  <span className="text-muted-foreground truncate">{p.nomFichier}</span>
                                </div>
                                <span className="text-muted-foreground shrink-0">{formatDate(p.dateUpload)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  });
                })()}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> {t("transferts:decisions.title_ops", { count: decisions.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {decisionsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : decisions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t("transferts:decisions.empty_ops")}</p>
            ) : (
              <div className="space-y-4">
                {decisions.map((d) => {
                  const isOuvert = d.rejetTempStatus === "OUVERT";
                  const responses = d.rejetTempResponses || [];
                  return (
                    <div key={d.id} className={`relative border rounded-lg overflow-hidden bg-card ${isOuvert ? "border-amber-300" : "border-border"}`}>
                      <div className={`flex items-center justify-between gap-2 px-4 py-2 border-b ${isOuvert ? "bg-amber-50 border-amber-200" : "bg-muted/40 border-border"}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <AlertTriangle className={`h-4 w-4 ${isOuvert ? "text-amber-600" : "text-muted-foreground"}`} />
                          <span className="text-sm font-semibold">{t("transferts:rejet_temp.history.title")}</span>
                          <Badge variant="outline" className="text-[10px]">{d.role}</Badge>
                          {d.rejetTempStatus && (
                            <Badge className={`text-[10px] ${isOuvert ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>
                              {tRejetTempStatus(d.rejetTempStatus)}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(d.dateDecision)}</span>
                      </div>

                      <div className="p-4 space-y-3">
                        {d.motifRejet && (
                          <div className="text-sm">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t("transferts:rejet_temp.history.motif")}</div>
                            <p className="text-foreground">{d.motifRejet}</p>
                          </div>
                        )}
                        {d.documentsDemandes && d.documentsDemandes.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t("transferts:rejet_temp.history.pieces_demandees")}</div>
                            <div className="flex flex-wrap gap-1">
                              {d.documentsDemandes.map((doc) => (
                                <Badge key={doc} variant="secondary" className="text-[10px]">{tTypeDocument(doc) || doc}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {responses.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              {t("transferts:rejet_temp.history.responses", { count: responses.length })}
                            </div>
                            <div className="space-y-2">
                              {responses.map((r) => (
                                <div key={r.id} className="flex gap-3 p-3 rounded-md bg-muted/40 border border-border">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                    {(r.auteurNom || r.utilisateurNom || "?").slice(0, 1).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold">{r.auteurNom || r.utilisateurNom || "—"}</span>
                                      {r.createdAt && (
                                        <span className="text-[10px] text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                                      )}
                                      {r.documentType && (
                                        <Badge variant="outline" className="text-[10px]">{tTypeDocument(r.documentType) || r.documentType}</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm mt-1 break-words">{r.message}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {isOuvert && (canRespondRejet || canValider) && (
                        <div className="flex gap-2 px-4 py-2 border-t bg-muted/20 justify-end">
                          {canRespondRejet && (
                            <Button size="sm" variant="outline" onClick={() => { setRespondDecision(d); setResponseMsg(""); }}>
                              {t("transferts:actions.repondre")}
                            </Button>
                          )}
                          {canValider && (
                            <Button size="sm" onClick={() => handleResolve(d.id)}>{t("transferts:actions.marquer_resolu")}</Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DocumentGED
        open={gedOpen}
        onOpenChange={setGedOpen}
        title={t("transferts:documents.dialog_title", { id: transfert.id })}
        dossierId={transfert.id}
        documentTypes={TRANSFERT_DOCUMENT_TYPES}
        documents={docs}
        loading={docsLoading}
        canUpload={canUpload}
        onUpload={handleGEDUpload}
        onRefresh={async () => { await loadDocs(); await loadAll(); }}
      />

      <Dialog open={rejetOpen} onOpenChange={setRejetOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("transferts:rejet_temp.dialog_title", { id: transfert.id })}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("transferts:rejet_temp.motif_label")} <span className="text-destructive">*</span></Label>
              <Textarea value={rejetMotif} onChange={(e) => setRejetMotif(e.target.value)} rows={3} placeholder={t("transferts:rejet_temp.motif_placeholder")} />
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
            <Button variant="outline" onClick={() => setRejetOpen(false)}>{t("transferts:rejet_temp.btn_cancel")}</Button>
            <Button onClick={handleRejetTemp} disabled={rejetLoading || !rejetMotif.trim() || rejetDocs.length === 0}>
              {rejetLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("transferts:rejet_temp.btn_send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!respondDecision} onOpenChange={(o) => { if (!o) { setRespondDecision(null); setResponseMsg(""); setResponseFile(null); setResponseDocType(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("transferts:rejet_temp.response.dialog_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {respondDecision?.motifRejet && (
              <div className="p-3 rounded-md bg-muted/50 border border-border text-xs">
                <span className="text-muted-foreground">{t("transferts:rejet_temp.response.motif_recall")}</span> {respondDecision.motifRejet}
              </div>
            )}
            {respondDecision?.documentsDemandes && respondDecision.documentsDemandes.length > 0 && (
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs">
                <span className="text-muted-foreground">{t("transferts:rejet_temp.response.pieces_demanded")}</span>{" "}
                <span className="font-medium">{respondDecision.documentsDemandes.map(dt => tTypeDocument(dt) || dt).join(", ")}</span>
              </div>
            )}
            <div>
              <Label>{t("transferts:rejet_temp.response.message_label")} <span className="text-destructive">*</span></Label>
              <Textarea value={responseMsg} onChange={(e) => setResponseMsg(e.target.value)} rows={4} placeholder={t("transferts:rejet_temp.response.message_placeholder")} />
            </div>
            {respondDecision?.documentsDemandes && respondDecision.documentsDemandes.length > 0 && (
              <>
                <div>
                  <Label>{t("transferts:rejet_temp.response.type_label")} <span className="text-destructive">*</span></Label>
                  <Select value={responseDocType} onValueChange={setResponseDocType}>
                    <SelectTrigger><SelectValue placeholder={t("transferts:rejet_temp.response.type_placeholder")} /></SelectTrigger>
                    <SelectContent>
                      {(respondDecision.documentsDemandes || []).map((dt) => (
                        <SelectItem key={dt} value={dt}>{tTypeDocument(dt) || dt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("transferts:rejet_temp.response.file_label")} <span className="text-destructive">*</span></Label>
                  <Input type="file" accept="application/pdf,image/*" onChange={(e) => setResponseFile(e.target.files?.[0] || null)} />
                  {responseFile && <p className="text-xs text-muted-foreground mt-1">{responseFile.name}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{t("transferts:rejet_temp.response.versioned")}</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDecision(null)}>{t("transferts:rejet_temp.response.btn_cancel")}</Button>
            <Button
              onClick={handleRespond}
              disabled={
                responding ||
                !responseMsg.trim() ||
                ((respondDecision?.documentsDemandes?.length || 0) > 0 && (!responseFile || !responseDocType))
              }
            >
              {responding && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("transferts:rejet_temp.response.btn_send_short")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("transferts:cancel.dialog_title")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("transferts:cancel.confirm_short", { id: transfert.id })}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>{t("transferts:cancel.btn_back")}</Button>
            <Button variant="destructive" onClick={handleAnnuler} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("transferts:cancel.btn_confirm_short")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TransfertDetail;
