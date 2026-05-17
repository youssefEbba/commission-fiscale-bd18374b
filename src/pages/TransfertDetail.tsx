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
              <div className="space-y-3">
                {decisions.map((d) => (
                  <div key={d.id} className="border border-border rounded-md p-3 bg-muted/20">
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
                    <div className="flex gap-2 mt-2 justify-end">
                      {canRespondRejet && d.rejetTempStatus === "OUVERT" && (
                        <Button size="sm" variant="outline" onClick={() => { setRespondDecision(d); setResponseMsg(""); }}>
                          Répondre
                        </Button>
                      )}
                      {d.rejetTempStatus === "OUVERT" && canValider && (
                        <Button size="sm" onClick={() => handleResolve(d.id)}>Marquer résolu</Button>
                      )}
                    </div>
                  </div>
                ))}
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
              <Textarea value={responseMsg} onChange={(e) => setResponseMsg(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDecision(null)}>Annuler</Button>
            <Button onClick={handleRespond} disabled={responding || !responseMsg.trim()}>
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
