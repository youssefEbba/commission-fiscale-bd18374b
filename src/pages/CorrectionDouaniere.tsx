import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DocumentDto, DecisionCorrectionDto,
  DEMANDE_STATUT_LABELS, DOCUMENT_TYPES_REQUIS,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  FileText, ArrowLeft, Loader2, CheckCircle, XCircle,
  Download, ExternalLink, Bot, Upload, History, RefreshCw,
} from "lucide-react";

const STATUT_COLORS: Record<string, string> = {
  RECUE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-yellow-100 text-yellow-800",
  RECEVABLE: "bg-emerald-100 text-emerald-800",
  EN_EVALUATION: "bg-orange-100 text-orange-800",
  EN_VALIDATION: "bg-purple-100 text-purple-800",
  ADOPTEE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
  NOTIFIEE: "bg-gray-100 text-gray-800",
};

const API_BASE = "https://74dd-197-231-1-0.ngrok-free.app/api";

function getDocFileUrl(doc: DocumentDto): string {
  if (doc.chemin) {
    const normalized = doc.chemin.replace(/\\/g, "/");
    if (normalized.match(/^[A-Za-z]:\//)) return "file:///" + normalized;
    return normalized;
  }
  return "";
}

const DECISION_ROLES = ["DGD", "DGTCP", "DGI", "DGB"];
const DECISION_ROLE_LABELS: Record<string, string> = {
  DGD: "DGD – Douanes",
  DGTCP: "DGTCP – Trésor",
  DGI: "DGI – Impôts",
  DGB: "DGB – Budget",
};

const CorrectionDouaniere = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [demande, setDemande] = useState<DemandeCorrectionDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject modal for temp decision
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");

  // Final decision modal
  const [finalOpen, setFinalOpen] = useState(false);
  const [finalType, setFinalType] = useState<"ADOPTEE" | "REJETEE">("ADOPTEE");
  const [finalMotif, setFinalMotif] = useState("");

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Entreprise detail
  const [entrepriseDetail, setEntrepriseDetail] = useState<any | null>(null);
  const [entrepriseLoading, setEntrepriseLoading] = useState(false);
  const [entrepriseDialogOpen, setEntrepriseDialogOpen] = useState(false);

  const fetchDemande = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await demandeCorrectionApi.getById(Number(id));
      setDemande(data);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger la demande", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      const documents = await demandeCorrectionApi.getDocuments(Number(id));
      setDocs(documents);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchDecisions = async () => {
    if (!id) return;
    try {
      const data = await demandeCorrectionApi.getDecisions(Number(id));
      setDecisions(data);
    } catch {
      setDecisions([]);
    }
  };

  useEffect(() => {
    fetchDemande();
    fetchDocs();
    fetchDecisions();
  }, [id]);

  const openEntrepriseDetail = async (entrepriseId: number) => {
    setEntrepriseDialogOpen(true);
    setEntrepriseLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/entreprises/${entrepriseId}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (!res.ok) throw new Error("Erreur");
      setEntrepriseDetail(await res.json());
    } catch {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${API_BASE}/entreprises`, {
          headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        });
        const list = await res.json();
        const found = list.find((e: any) => e.id === entrepriseId);
        setEntrepriseDetail(found || null);
      } catch {
        toast({ title: "Erreur", description: "Impossible de charger les informations de l'entreprise", variant: "destructive" });
      }
    } finally {
      setEntrepriseLoading(false);
    }
  };

  // ---- Décision temporaire (VISA / REJET_TEMP) ----
  const handleTempVisa = async () => {
    if (!demande) return;
    setActionLoading(true);
    try {
      await demandeCorrectionApi.postDecision(demande.id, "VISA");
      toast({ title: "Succès", description: "Visa temporaire apposé" });
      await fetchDecisions();
      await fetchDemande();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTempReject = async () => {
    if (!demande || !rejectMotif.trim()) return;
    setRejectOpen(false);
    setActionLoading(true);
    try {
      await demandeCorrectionApi.postDecision(demande.id, "REJET_TEMP", rejectMotif.trim());
      toast({ title: "Succès", description: "Rejet temporaire enregistré" });
      await fetchDecisions();
      await fetchDemande();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setRejectMotif("");
    }
  };

  // ---- Décision finale (DGTCP / PRESIDENT) ----
  const handleFinalDecision = async () => {
    if (!demande) return;
    setFinalOpen(false);
    setActionLoading(true);
    try {
      await demandeCorrectionApi.updateStatut(
        demande.id,
        finalType,
        finalType === "REJETEE" ? finalMotif.trim() || undefined : undefined,
        true
      );
      toast({ title: "Succès", description: finalType === "ADOPTEE" ? "Demande adoptée (décision finale)" : "Demande rejetée (décision finale)" });
      await fetchDemande();
      await fetchDecisions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setFinalMotif("");
    }
  };

  // ---- Upload document (nouvelle version) ----
  const handleUpload = async () => {
    if (!demande || !uploadType || !uploadFile) return;
    setUploadLoading(true);
    try {
      await demandeCorrectionApi.uploadDocument(demande.id, uploadType, uploadFile);
      toast({ title: "Succès", description: "Document uploadé (nouvelle version)" });
      await fetchDocs();
      setUploadOpen(false);
      setUploadFile(null);
      setUploadType("");
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setUploadLoading(false);
    }
  };

  const userRole = user?.role;
  const isDirection = userRole && DECISION_ROLES.includes(userRole);
  const canFinalDecision = userRole === "DGTCP" || userRole === "PRESIDENT";
  const isAC = userRole === "AUTORITE_CONTRACTANTE";
  const isFinal = demande?.statut === "ADOPTEE" || demande?.statut === "REJETEE";

  // Current user's decision
  const myDecision = decisions.find(d => d.role === userRole);
  const hasAnyRejet = decisions.some(d => d.decision === "REJET_TEMP");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/demandes")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Correction douanière — {demande?.numero || `#${id}`}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Évaluation et décisions</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !demande ? (
          <p className="text-center text-muted-foreground py-8">Demande introuvable</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left */}
            <div className="lg:col-span-2 space-y-6">
              {/* Infos demande */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Informations de la demande</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">N° Demande</span>
                      <p className="font-medium">{demande.numero || `#${demande.id}`}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Statut</span>
                      <p><Badge className={`text-xs ${STATUT_COLORS[demande.statut] || ""}`}>{DEMANDE_STATUT_LABELS[demande.statut]}</Badge></p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Autorité Contractante</span>
                      <p className="font-medium">{demande.autoriteContractanteNom || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entreprise</span>
                      {demande.entrepriseId ? (
                        <button className="font-medium text-primary hover:underline cursor-pointer text-left" onClick={() => openEntrepriseDetail(demande.entrepriseId)}>
                          {demande.entrepriseRaisonSociale || "—"}
                        </button>
                      ) : (
                        <p className="font-medium">{demande.entrepriseRaisonSociale || "—"}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date de dépôt</span>
                      <p>{demande.dateDepot ? new Date(demande.dateDepot).toLocaleDateString("fr-FR") : "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Décisions par organisme */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Décisions par organisme</CardTitle>
                    <Button variant="ghost" size="sm" onClick={fetchDecisions}><RefreshCw className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {DECISION_ROLES.map((role) => {
                      const dec = decisions.find(d => d.role === role);
                      const isVisa = dec?.decision === "VISA";
                      const isRejet = dec?.decision === "REJET_TEMP";
                      return (
                        <div key={role} className={`rounded-lg border p-3 text-center text-xs ${
                          isVisa ? "border-green-300 bg-green-50" :
                          isRejet ? "border-red-300 bg-red-50" :
                          "border-border bg-muted/30"
                        }`}>
                          {isVisa ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                          ) : isRejet ? (
                            <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />
                          )}
                          <p className="font-medium">{DECISION_ROLE_LABELS[role] || role}</p>
                          {isVisa && <p className="text-green-700 font-medium mt-0.5">Visa</p>}
                          {isRejet && (
                            <>
                              <p className="text-red-700 font-medium mt-0.5">Rejet temp.</p>
                              {dec.motifRejet && <p className="text-muted-foreground mt-1 italic truncate" title={dec.motifRejet}>{dec.motifRejet}</p>}
                            </>
                          )}
                          {!dec && <p className="text-muted-foreground mt-0.5">En attente</p>}
                          {dec?.dateDecision && (
                            <p className="text-muted-foreground mt-0.5 text-[10px]">{new Date(dec.dateDecision).toLocaleDateString("fr-FR")}</p>
                          )}
                          {dec?.utilisateurNom && (
                            <p className="text-muted-foreground text-[10px]">Par: {dec.utilisateurNom}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Pièces du dossier (avec versioning) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Pièces du dossier</CardTitle>
                    {isAC && !isFinal && (
                      <Button size="sm" onClick={() => setUploadOpen(true)}>
                        <Upload className="h-4 w-4 mr-1" /> Nouvelle version
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {docsLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="space-y-2">
                      {DOCUMENT_TYPES_REQUIS.map((dt) => {
                        // Get all versions for this type, sorted by version desc
                        const allVersions = docs
                          .filter(d => d.type === dt.value)
                          .sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
                        const activeDoc = allVersions.find(d => d.actif !== false) || allVersions[0];
                        const hasVersions = allVersions.length > 1;
                        const fileUrl = activeDoc ? getDocFileUrl(activeDoc) : null;

                        return (
                          <div key={dt.value} className="rounded-lg border border-border p-3 text-sm">
                            <div className="flex items-center gap-3">
                              {activeDoc ? (
                                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                              ) : (
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium truncate ${!activeDoc ? "text-muted-foreground" : ""}`}>
                                  {dt.label}
                                  {activeDoc?.version && activeDoc.version > 1 && (
                                    <Badge variant="outline" className="ml-2 text-[10px]">v{activeDoc.version}</Badge>
                                  )}
                                </p>
                                {activeDoc && <p className="text-xs text-muted-foreground truncate">{activeDoc.nomFichier}</p>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {activeDoc && fileUrl ? (
                                  <>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(fileUrl, "_blank")}>
                                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir
                                    </Button>
                                    <a href={fileUrl} download={activeDoc.nomFichier || dt.label}>
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                        <Download className="h-3.5 w-3.5 mr-1" /> Télécharger
                                      </Button>
                                    </a>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Non fourni</span>
                                )}
                              </div>
                            </div>
                            {/* Historique versions */}
                            {hasVersions && (
                              <div className="mt-2 ml-7 space-y-1">
                                <p className="text-xs text-muted-foreground flex items-center gap-1"><History className="h-3 w-3" /> Historique des versions</p>
                                {allVersions.filter(d => d.id !== activeDoc?.id).map(v => (
                                  <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-2 border-l border-border">
                                    <Badge variant="outline" className="text-[10px]">v{v.version ?? 1}</Badge>
                                    <span className="truncate">{v.nomFichier}</span>
                                    {v.dateUpload && <span>{new Date(v.dateUpload).toLocaleDateString("fr-FR")}</span>}
                                  </div>
                                ))}
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

            {/* Right: Actions */}
            <div className="space-y-4">
              {/* Actions pour les directions */}
              {isDirection && !isFinal && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Ma décision</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {myDecision ? (
                      <div className="text-center py-2">
                        {myDecision.decision === "VISA" ? (
                          <>
                            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-1" />
                            <p className="font-semibold text-green-700 text-sm">Visa apposé</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-8 w-8 text-red-600 mx-auto mb-1" />
                            <p className="font-semibold text-red-700 text-sm">Rejet temporaire</p>
                            {myDecision.motifRejet && <p className="text-xs text-muted-foreground italic mt-1">{myDecision.motifRejet}</p>}
                          </>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Vous pouvez changer votre décision</p>
                      </div>
                    ) : null}

                    <Button className="w-full" onClick={handleTempVisa} disabled={actionLoading}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      {myDecision?.decision === "VISA" ? "Confirmer visa" : myDecision ? "Changer en Visa" : "Apposer visa"}
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => { setRejectMotif(""); setRejectOpen(true); }} disabled={actionLoading}>
                      <XCircle className="h-4 w-4 mr-2" />
                      {myDecision?.decision === "REJET_TEMP" ? "Modifier rejet" : myDecision ? "Changer en Rejet" : "Rejeter temporairement"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Décision finale (DGTCP / PRESIDENT) */}
              {canFinalDecision && !isFinal && (
                <Card className="border-primary/30">
                  <CardHeader><CardTitle className="text-lg">Décision finale</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {hasAnyRejet && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
                        ⚠️ Un rejet temporaire est en cours. Vérifiez les décisions avant de trancher.
                      </div>
                    )}
                    <Button className="w-full" onClick={() => { setFinalType("ADOPTEE"); setFinalMotif(""); setFinalOpen(true); }} disabled={actionLoading}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Adopter (final)
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => { setFinalType("REJETEE"); setFinalMotif(""); setFinalOpen(true); }} disabled={actionLoading}>
                      <XCircle className="h-4 w-4 mr-2" /> Rejeter (final)
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Statut final affiché */}
              {isFinal && (
                <Card className={demande.statut === "ADOPTEE" ? "border-green-300" : "border-red-300"}>
                  <CardContent className="py-6 text-center">
                    {demande.statut === "ADOPTEE" ? (
                      <>
                        <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-2" />
                        <p className="font-bold text-green-700 text-lg">Demande Adoptée</p>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-10 w-10 text-red-600 mx-auto mb-2" />
                        <p className="font-bold text-red-700 text-lg">Demande Rejetée</p>
                        {demande.motifRejet && <p className="text-sm text-muted-foreground mt-2 italic">{demande.motifRejet}</p>}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI Assistance Link */}
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" /> Assistance intelligente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Lancer l'analyse IA pour vérifier les corrections douanières.
                  </p>
                  <Button className="w-full" onClick={() => navigate(`/dashboard/assistance-ia/${id}`)}>
                    <Bot className="h-4 w-4 mr-2" /> Ouvrir l'assistance intelligente
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Reject Temp Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejet temporaire</DialogTitle>
            <DialogDescription>Indiquez le motif du rejet. L'AC pourra corriger et resoumettre.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Motif du rejet temporaire..." value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button variant="destructive" disabled={!rejectMotif.trim()} onClick={handleTempReject}>
              <XCircle className="h-4 w-4 mr-1" /> Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Decision Dialog */}
      <Dialog open={finalOpen} onOpenChange={setFinalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Décision finale — {finalType === "ADOPTEE" ? "Adopter" : "Rejeter"}</DialogTitle>
            <DialogDescription>Cette action est définitive et changera le statut de la demande.</DialogDescription>
          </DialogHeader>
          {finalType === "REJETEE" && (
            <Textarea placeholder="Motif du rejet final..." value={finalMotif} onChange={(e) => setFinalMotif(e.target.value)} rows={3} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalOpen(false)}>Annuler</Button>
            <Button
              variant={finalType === "ADOPTEE" ? "default" : "destructive"}
              disabled={finalType === "REJETEE" && !finalMotif.trim()}
              onClick={handleFinalDecision}
            >
              {finalType === "ADOPTEE" ? <CheckCircle className="h-4 w-4 mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog (AC - nouvelle version) */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Uploader une nouvelle version</DialogTitle>
            <DialogDescription>L'ancien document deviendra inactif, le nouveau sera la version active.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Type de document</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue placeholder="Sélectionner le type" /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES_REQUIS.map(dt => (
                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fichier</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Annuler</Button>
            <Button disabled={!uploadType || !uploadFile || uploadLoading} onClick={handleUpload}>
              {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Uploader
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entreprise Detail Dialog */}
      <Dialog open={entrepriseDialogOpen} onOpenChange={setEntrepriseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Informations de l'entreprise</DialogTitle></DialogHeader>
          {entrepriseLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entrepriseDetail ? (
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">Raison sociale</span>
                <p className="font-medium">{entrepriseDetail.raisonSociale || "—"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">NIF</span>
                <p className="font-medium">{entrepriseDetail.nif || "—"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">Adresse</span>
                <p className="font-medium">{entrepriseDetail.adresse || "—"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <span className="text-muted-foreground text-xs">Situation fiscale</span>
                <p>
                  <Badge className={entrepriseDetail.situationFiscale === "REGULIERE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                    {entrepriseDetail.situationFiscale || "—"}
                  </Badge>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Aucune information disponible</p>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CorrectionDouaniere;
