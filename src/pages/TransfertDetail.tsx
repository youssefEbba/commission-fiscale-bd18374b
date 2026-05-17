import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  transfertCreditApi, TransfertCreditDto, StatutTransfert,
  TRANSFERT_STATUT_LABELS, TRANSFERT_DOCUMENT_TYPES,
  TypeDocumentTransfert, DocumentTransfertCreditDto,
  DecisionCorrectionDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

  const f = (v: any) => v != null ? Number(v).toLocaleString("fr-FR") : "—";

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const t = await transfertCreditApi.getById(Number(id));
      setTransfert(t);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger le transfert", variant: "destructive" });
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
    try {
      await transfertCreditApi.valider(transfert.id);
      toast({ title: "Succès", description: "Transfert validé" });
      loadAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const handleRejeter = async () => {
    if (!transfert) return;
    setActionLoading(true);
    try {
      await transfertCreditApi.rejeter(transfert.id);
      toast({ title: "Succès", description: "Transfert rejeté" });
      loadAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const handleAnnuler = async () => {
    if (!transfert) return;
    setActionLoading(true);
    try {
      await transfertCreditApi.annuler(transfert.id);
      toast({ title: "Succès", description: "Demande annulée" });
      setCancelOpen(false);
      loadAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const handleRejetTemp = async () => {
    if (!transfert || !rejetMotif.trim() || rejetDocs.length === 0) return;
    setRejetLoading(true);
    try {
      await transfertCreditApi.postDecision(transfert.id, "REJET_TEMP", rejetMotif.trim(), rejetDocs);
      toast({ title: "Succès", description: "Rejet temporaire envoyé" });
      setRejetOpen(false);
      setRejetMotif(""); setRejetDocs([]);
      loadAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setRejetLoading(false); }
  };

  const handleRespond = async () => {
    if (!respondDecision || !responseMsg.trim()) return;
    const demanded = respondDecision.documentsDemandes || [];
    if (demanded.length > 0 && (!responseFile || !responseDocType)) {
      toast({ title: "Pièce requise", description: "Veuillez joindre la pièce demandée et préciser son type.", variant: "destructive" });
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
      toast({ title: "Succès", description: "Réponse envoyée" });
      setRespondDecision(null);
      setResponseMsg("");
      setResponseFile(null);
      setResponseDocType("");
      loadDecisions();
      loadDocs();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setResponding(false); }
  };

  const handleResolve = async (decisionId: number) => {
    try {
      await transfertCreditApi.resolveRejetTemp(decisionId);
      toast({ title: "Succès", description: "Rejet temporaire résolu" });
      loadDecisions();
      loadAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
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
          <p className="text-muted-foreground">Transfert introuvable.</p>
          <Button variant="outline" onClick={() => navigate("/dashboard/transferts")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour à la liste
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const activeDocs = docs.filter(d => d.actif !== false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/transferts")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Transfert #{transfert.id}</h1>
              <p className="text-muted-foreground text-sm">Renonciation aux importations — transfert vers TVA déductible sur cordon douanier</p>
            </div>
          </div>
          <Button variant="outline" onClick={loadAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
          </Button>
        </div>

        {/* Informations */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informations</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Certificat</span>
                <p className="font-medium">{transfert.certificatNumero || `#${transfert.certificatCreditId}`}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Montant transféré</span>
                <p className="font-medium">{f(transfert.montant)} MRU</p>
              </div>
              <div>
                <span className="text-muted-foreground">Statut</span>
                <p><Badge className={`text-xs ${STATUT_COLORS[transfert.statut]}`}>{TRANSFERT_STATUT_LABELS[transfert.statut]}</Badge></p>
              </div>
              <div>
                <span className="text-muted-foreground">Ops douane clôturées</span>
                <p className="font-medium">{transfert.operationsDouaneCloturees ? "Oui" : "Non"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date demande</span>
                <p className="font-medium">{transfert.dateDemande ? new Date(transfert.dateDemande).toLocaleDateString("fr-FR") : "—"}</p>
              </div>
            </div>

            {/* Actions */}
            {!TERMINAL_STATUTS.includes(transfert.statut) && (canValider || canRejetTemp || canRejeter || canAnnuler) && (
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                {VALIDATE_STATUTS.includes(transfert.statut) && canValider && (
                  <Button size="sm" disabled={actionLoading || hasOpenRejetTemp} onClick={handleValider}
                    title={hasOpenRejetTemp ? "Un rejet temporaire est encore ouvert" : ""}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Valider le transfert
                  </Button>
                )}
                {transfert.statut !== "INCOMPLETE" && canRejetTemp && (
                  <Button variant="outline" size="sm" onClick={() => { setRejetOpen(true); setRejetMotif(""); setRejetDocs([]); }}>
                    <AlertTriangle className="h-4 w-4 mr-1" /> Rejet temporaire
                  </Button>
                )}
                {canRejeter && (
                  <Button variant="destructive" size="sm" disabled={actionLoading} onClick={handleRejeter}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                    Rejeter définitivement
                  </Button>
                )}
                {canAnnuler && (
                  <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                    <Ban className="h-4 w-4 mr-1" /> Annuler la demande
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* GED Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Documents (GED)
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setGedOpen(true)}>
              Gérer les documents
            </Button>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : activeDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun document déposé.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {activeDocs.map((d) => {
                  const typeLabel = TRANSFERT_DOCUMENT_TYPES.find(t => t.value === d.type)?.label || d.type;
                  return (
                    <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{typeLabel}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.nomFichier}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {d.dateUpload ? new Date(d.dateUpload).toLocaleDateString("fr-FR") : "—"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Opérations (décisions) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Opérations ({decisions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {decisionsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : decisions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucune opération enregistrée.</p>
            ) : (
              <div className="space-y-4">
                {decisions.map((d) => {
                  const isOuvert = d.rejetTempStatus === "OUVERT";
                  const responses = d.rejetTempResponses || [];
                  return (
                    <div key={d.id} className={`relative border rounded-lg overflow-hidden bg-card ${isOuvert ? "border-amber-300" : "border-border"}`}>
                      {/* Bandeau d'entête */}
                      <div className={`flex items-center justify-between gap-2 px-4 py-2 border-b ${isOuvert ? "bg-amber-50 border-amber-200" : "bg-muted/40 border-border"}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <AlertTriangle className={`h-4 w-4 ${isOuvert ? "text-amber-600" : "text-muted-foreground"}`} />
                          <span className="text-sm font-semibold">Rejet temporaire</span>
                          <Badge variant="outline" className="text-[10px]">{d.role}</Badge>
                          {d.rejetTempStatus && (
                            <Badge className={`text-[10px] ${isOuvert ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>
                              {isOuvert ? "Ouvert" : "Résolu"}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {d.dateDecision ? new Date(d.dateDecision).toLocaleString("fr-FR") : ""}
                        </span>
                      </div>

                      {/* Corps */}
                      <div className="p-4 space-y-3">
                        {d.motifRejet && (
                          <div className="text-sm">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Motif</div>
                            <p className="text-foreground">{d.motifRejet}</p>
                          </div>
                        )}
                        {d.documentsDemandes && d.documentsDemandes.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pièces demandées</div>
                            <div className="flex flex-wrap gap-1">
                              {d.documentsDemandes.map((doc) => (
                                <Badge key={doc} variant="secondary" className="text-[10px]">{doc}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Réponses */}
                        {responses.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              Réponses ({responses.length})
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
                                        <span className="text-[10px] text-muted-foreground">
                                          {new Date(r.createdAt).toLocaleString("fr-FR")}
                                        </span>
                                      )}
                                      {r.documentType && (
                                        <Badge variant="outline" className="text-[10px]">{r.documentType}</Badge>
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

                      {/* Actions */}
                      {isOuvert && (canRespondRejet || canValider) && (
                        <div className="flex gap-2 px-4 py-2 border-t bg-muted/20 justify-end">
                          {canRespondRejet && (
                            <Button size="sm" variant="outline" onClick={() => { setRespondDecision(d); setResponseMsg(""); }}>
                              Répondre
                            </Button>
                          )}
                          {canValider && (
                            <Button size="sm" onClick={() => handleResolve(d.id)}>Marquer résolu</Button>
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

      {/* GED Dialog */}
      <DocumentGED
        open={gedOpen}
        onOpenChange={setGedOpen}
        title={`Documents — Transfert #${transfert.id}`}
        dossierId={transfert.id}
        documentTypes={TRANSFERT_DOCUMENT_TYPES}
        documents={docs}
        loading={docsLoading}
        canUpload={canUpload}
        onUpload={handleGEDUpload}
        onRefresh={async () => { await loadDocs(); await loadAll(); }}
      />

      {/* Rejet temp dialog */}
      <Dialog open={rejetOpen} onOpenChange={setRejetOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Rejet temporaire — Transfert #{transfert.id}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motif <span className="text-destructive">*</span></Label>
              <Textarea value={rejetMotif} onChange={(e) => setRejetMotif(e.target.value)} rows={3} />
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
            <Button variant="outline" onClick={() => setRejetOpen(false)}>Annuler</Button>
            <Button onClick={handleRejetTemp} disabled={rejetLoading || !rejetMotif.trim() || rejetDocs.length === 0}>
              {rejetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respond dialog */}
      <Dialog open={!!respondDecision} onOpenChange={(o) => { if (!o) { setRespondDecision(null); setResponseMsg(""); setResponseFile(null); setResponseDocType(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Répondre au rejet temporaire</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {respondDecision?.motifRejet && (
              <div className="p-3 rounded-md bg-muted/50 border border-border text-xs">
                <span className="text-muted-foreground">Motif :</span> {respondDecision.motifRejet}
              </div>
            )}
            {respondDecision?.documentsDemandes && respondDecision.documentsDemandes.length > 0 && (
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs">
                <span className="text-muted-foreground">Pièces demandées :</span>{" "}
                <span className="font-medium">{respondDecision.documentsDemandes.join(", ")}</span>
              </div>
            )}
            <div>
              <Label>Message <span className="text-destructive">*</span></Label>
              <Textarea value={responseMsg} onChange={(e) => setResponseMsg(e.target.value)} rows={4} />
            </div>
            {respondDecision?.documentsDemandes && respondDecision.documentsDemandes.length > 0 && (
              <>
                <div>
                  <Label>Type de pièce <span className="text-destructive">*</span></Label>
                  <Select value={responseDocType} onValueChange={setResponseDocType}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner le type de pièce" /></SelectTrigger>
                    <SelectContent>
                      {(respondDecision.documentsDemandes || []).map((dt) => {
                        const meta = TRANSFERT_DOCUMENT_TYPES.find(t => t.value === dt);
                        return <SelectItem key={dt} value={dt}>{meta?.label || dt}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pièce justificative <span className="text-destructive">*</span></Label>
                  <Input type="file" accept="application/pdf,image/*" onChange={(e) => setResponseFile(e.target.files?.[0] || null)} />
                  {responseFile && <p className="text-xs text-muted-foreground mt-1">{responseFile.name}</p>}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDecision(null)}>Annuler</Button>
            <Button
              onClick={handleRespond}
              disabled={
                responding ||
                !responseMsg.trim() ||
                ((respondDecision?.documentsDemandes?.length || 0) > 0 && (!responseFile || !responseDocType))
              }
            >
              {responding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Annuler la demande de transfert</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirmez l'annulation du transfert <strong>#{transfert.id}</strong>.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Retour</Button>
            <Button variant="destructive" onClick={handleAnnuler} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TransfertDetail;
