import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DocumentDto,
  DEMANDE_STATUT_LABELS, DOCUMENT_TYPES_REQUIS, RejetDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  FileText, ArrowLeft, Loader2, CheckCircle, XCircle,
  Download, ExternalLink, Bot,
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
    if (normalized.match(/^[A-Za-z]:\//)) {
      return "file:///" + normalized;
    }
    return normalized;
  }
  return "";
}

const CorrectionDouaniere = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [demande, setDemande] = useState<DemandeCorrectionDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");


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

  useEffect(() => {
    fetchDemande();
    fetchDocs();
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
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
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

  const handleVisa = async () => {
    if (!demande) return;
    setActionLoading(true);
    try {
      const updated = await demandeCorrectionApi.updateStatut(demande.id, "ADOPTEE");
      toast({ title: "Succès", description: "Visa Douanes apposé avec succès" });
      setDemande(updated);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!demande || !rejectMotif.trim()) return;
    setRejectOpen(false);
    setActionLoading(true);
    try {
      const updated = await demandeCorrectionApi.updateStatut(demande.id, "REJETEE", rejectMotif.trim());
      toast({ title: "Succès", description: "Rejet enregistré" });
      setDemande(updated);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setRejectMotif("");
    }
  };


  const hasRejet = demande && ((demande.rejets && demande.rejets.length > 0) || demande.statut === "REJETEE");
  const alreadyValidated = demande?.validationDgd;

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
            <p className="text-muted-foreground text-sm mt-1">Évaluation et visa Douanes</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !demande ? (
          <p className="text-center text-muted-foreground py-8">Demande introuvable</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Infos demande */}
            <div className="lg:col-span-2 space-y-6">
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
                        <button
                          className="font-medium text-primary hover:underline cursor-pointer text-left"
                          onClick={() => openEntrepriseDetail(demande.entrepriseId)}
                        >
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
                    {(demande as any).conventionNumero && (
                      <div>
                        <span className="text-muted-foreground">Convention</span>
                        <p className="font-medium">{(demande as any).conventionNumero}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Historique des rejets */}
              {demande.rejets && demande.rejets.length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader><CardTitle className="text-lg text-destructive">Historique des rejets</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {demande.rejets.map((r: RejetDto) => (
                      <div key={r.id} className="rounded border border-destructive/20 bg-destructive/5 p-3 text-sm space-y-1">
                        <p className="font-medium">{r.motifRejet}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {r.utilisateurNom && <span>Par : {r.utilisateurNom}</span>}
                          {r.dateRejet && <span>Le : {new Date(r.dateRejet).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Statut par organisme */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Statut par organisme</CardTitle></CardHeader>
                <CardContent>
                  {(() => {
                    const rejets = demande.rejets || [];
                    const actors = [
                      { key: "DGD", label: "DGD – Douanes", done: demande.validationDgd, date: demande.validationDgdDate },
                      { key: "DGTCP", label: "DGTCP – Trésor", done: demande.validationDgtcp, date: demande.validationDgtcpDate },
                      { key: "DGI", label: "DGI – Impôts", done: demande.validationDgi, date: demande.validationDgiDate },
                    ];
                    const getActorRejets = (key: string) => {
                      const keywords: Record<string, string[]> = {
                        DGD: ["DGD", "Douane"],
                        DGTCP: ["DGTCP", "Trésor", "Tresor"],
                        DGI: ["DGI", "Impôt", "Impot"],
                      };
                      return rejets.filter(r =>
                        r.utilisateurNom && keywords[key]?.some(kw => r.utilisateurNom!.toUpperCase().includes(kw.toUpperCase()))
                      );
                    };
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        {actors.map((v) => {
                          const actorRejets = getActorRejets(v.key);
                          const rejected = actorRejets.length > 0 && !v.done;
                          const lastRejet = actorRejets[actorRejets.length - 1];
                          return (
                            <div key={v.key} className={`rounded-lg border p-3 text-center text-xs ${
                              v.done ? "border-green-300 bg-green-50" :
                              rejected ? "border-red-300 bg-red-50" :
                              "border-border bg-muted/30"
                            }`}>
                              {v.done ? (
                                <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                              ) : rejected ? (
                                <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />
                              )}
                              <p className="font-medium">{v.label}</p>
                              {v.done && v.date && <p className="text-muted-foreground mt-0.5">{new Date(v.date).toLocaleDateString("fr-FR")}</p>}
                              {v.done && <p className="text-green-700 font-medium mt-0.5">Validé</p>}
                              {rejected && lastRejet && (
                                <>
                                  <p className="text-red-700 font-medium mt-0.5">Rejeté</p>
                                  <p className="text-muted-foreground mt-1 italic truncate" title={lastRejet.motifRejet}>{lastRejet.motifRejet}</p>
                                </>
                              )}
                              {!v.done && !rejected && <p className="text-muted-foreground mt-0.5">En attente</p>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Pièces du dossier */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Pièces du dossier</CardTitle></CardHeader>
                <CardContent>
                  {docsLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="space-y-2">
                      {DOCUMENT_TYPES_REQUIS.map((dt) => {
                        const uploaded = docs.find((d) => d.type === dt.value);
                        const fileUrl = uploaded ? getDocFileUrl(uploaded) : null;
                        return (
                          <div key={dt.value} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                            {uploaded ? (
                              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${!uploaded ? "text-muted-foreground" : ""}`}>{dt.label}</p>
                              {uploaded && <p className="text-xs text-muted-foreground truncate">{uploaded.nomFichier}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {uploaded && fileUrl ? (
                                <>
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(fileUrl, "_blank")}>
                                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir
                                  </Button>
                                  <a href={fileUrl} download={uploaded.nomFichier || dt.label}>
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
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Actions */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-lg">Actions Douanes</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {alreadyValidated ? (
                    <div className="text-center py-4">
                      <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-2" />
                      <p className="font-semibold text-green-700">Visa Douanes apposé</p>
                      {demande.validationDgdDate && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Le {new Date(demande.validationDgdDate).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                  ) : hasRejet ? (
                    <div className="text-center py-4">
                      <XCircle className="h-10 w-10 text-red-600 mx-auto mb-2" />
                      <p className="font-semibold text-red-700">Rejet en cours</p>
                      <p className="text-sm text-muted-foreground mt-1">Impossible d'apposer un visa</p>
                    </div>
                  ) : (
                    <>
                      <Button className="w-full" onClick={handleVisa} disabled={actionLoading}>
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                        Apposer visa Douanes
                      </Button>
                      <Button variant="destructive" className="w-full" onClick={() => { setRejectMotif(""); setRejectOpen(true); }} disabled={actionLoading}>
                        <XCircle className="h-4 w-4 mr-2" /> Rejeter
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* AI Assistance Link */}
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Assistance IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Lancer l'analyse IA pour vérifier les corrections douanières à partir de l'offre financière et du DQE.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => navigate(`/dashboard/assistance-ia/${id}`)}
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Ouvrir l'assistance IA
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motif du rejet</DialogTitle>
            <DialogDescription>Veuillez indiquer le motif du rejet de cette demande.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Saisissez le motif du rejet..." value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button variant="destructive" disabled={!rejectMotif.trim()} onClick={handleRejectConfirm}>
              <XCircle className="h-4 w-4 mr-1" /> Confirmer le rejet
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
