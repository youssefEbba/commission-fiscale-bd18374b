import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { demandeCorrectionApi, DocumentDto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, Bot, AlertTriangle, CheckCircle, XCircle, Info,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const statusIcon = (statut: string) => {
  const s = statut?.toLowerCase() || "";
  if (s.includes("conforme") || s.includes("ok") || s.includes("valide")) return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  if (s.includes("non") || s.includes("erreur") || s.includes("anomal") || s.includes("incoh")) return <XCircle className="h-4 w-4 text-destructive" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
};

const riskBadge = (risk: string) => {
  const r = risk?.toLowerCase() || "";
  if (r.includes("élev") || r.includes("critique") || r.includes("fort")) return "bg-destructive/10 text-destructive";
  if (r.includes("moyen") || r.includes("modér")) return "bg-orange-100 text-orange-800";
  return "bg-emerald-100 text-emerald-800";
};

const DETAIL_LABELS: Record<string, string> = {
  correspondanceDesignation: "Correspondance désignation",
  correspondanceQuantite: "Correspondance quantité",
  correspondancePrixUnitaire: "Correspondance prix unitaire",
  coherenceMontantHT: "Cohérence montant HT",
  coherenceTaux: "Cohérence taux",
  baseTVA: "Base TVA",
  tvaNette: "TVA nette",
  doubleDeclaration: "Double déclaration",
  coherenceEconomique: "Cohérence économique",
};

const AssistanceIA = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setDocsLoading(true);
      try {
        const documents = await demandeCorrectionApi.getDocuments(Number(id));
        setDocs(documents);
      } catch {
        setDocs([]);
      } finally {
        setDocsLoading(false);
      }
    })();
  }, [id]);

  const handleAiAssistance = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const dqeDoc = docs.find(d => d.type === "DAO_DQE");
      const offreDoc = docs.find(d => d.type === "OFFRE_FINANCIERE");

      if (!offreDoc?.chemin || !dqeDoc?.chemin) {
        throw new Error("Les deux documents (DQE et Offre financière) sont requis pour l'évaluation IA. Veuillez les uploader depuis la page de correction.");
      }

      const offreUrl = offreDoc.chemin.replace(/\\/g, "/");
      const dqeUrl = dqeDoc.chemin.replace(/\\/g, "/");

      const token = localStorage.getItem("auth_token");
      const AI_SERVICE_BASE = "https://superelegant-irretraceably-liv.ngrok-free.dev";
      const res = await fetch(`${AI_SERVICE_BASE}/api/audit-fiscale/evaluate-by-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          dqeUrl,
          offreUrl,
          provider: "gemini",
          model: "gemini-2.5-flash",
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Erreur ${res.status}`);
      }

      const data = await res.json();
      setAiResult(data);
      toast({ title: "Évaluation IA terminée", description: "L'analyse a été générée avec succès" });
    } catch (e: any) {
      setAiError(e.message);
      toast({ title: "Erreur IA", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const renderDetailCard = (key: string, detail: any) => {
    if (!detail) return null;
    const label = DETAIL_LABELS[key] || key;

    return (
      <Card key={key}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {statusIcon(detail.statut || detail.analyse || "")}
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {detail.statut && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Statut</span>
              <Badge variant="outline" className="text-xs">{detail.statut}</Badge>
            </div>
          )}

          {/* Anomalies / ecarts / doublons arrays */}
          {detail.anomalies && detail.anomalies.length > 0 && (
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs">Anomalies :</span>
              {detail.anomalies.map((a: any, i: number) => (
                typeof a === "string" ? (
                  <p key={i} className="text-xs pl-2 text-destructive">• {a}</p>
                ) : (
                  <div key={i} className="rounded border border-destructive/20 bg-destructive/5 p-2 text-xs space-y-0.5">
                    {Object.entries(a).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-muted-foreground">
                        <span className="capitalize">{k}</span>
                        <span className="text-right max-w-[60%]">{typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "")}</span>
                      </div>
                    ))}
                  </div>
                )
              ))}
            </div>
          )}

          {detail.ecarts && detail.ecarts.length > 0 && (
            <div className="space-y-2">
              <span className="text-muted-foreground text-xs">Écarts :</span>
              {detail.ecarts.map((e: any, i: number) => (
                typeof e === "string" ? (
                  <p key={i} className="text-xs pl-2 text-destructive">• {e}</p>
                ) : (
                  <div key={i} className="rounded border border-destructive/20 bg-destructive/5 p-2 text-xs space-y-1">
                    {e.produit && <p className="font-medium text-destructive">{e.produit}</p>}
                    {e.designation && <p className="font-medium text-destructive">{e.designation}</p>}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                      {e.puDQE != null && <><span>PU DQE</span><span className="text-right">{Number(e.puDQE).toLocaleString("fr-FR")}</span></>}
                      {e.puFiscal != null && <><span>PU Fiscal</span><span className="text-right">{Number(e.puFiscal).toLocaleString("fr-FR")}</span></>}
                      {e.ecartAbsolu != null && <><span>Écart absolu</span><span className="text-right text-destructive">{Number(e.ecartAbsolu).toLocaleString("fr-FR")}</span></>}
                      {e.ecartPourcentage != null && <><span>Écart %</span><span className="text-right text-destructive">{e.ecartPourcentage}%</span></>}
                      {e.quantiteDQE != null && <><span>Qté DQE</span><span className="text-right">{Number(e.quantiteDQE).toLocaleString("fr-FR")}</span></>}
                      {e.quantiteFiscale != null && <><span>Qté Fiscale</span><span className="text-right">{Number(e.quantiteFiscale).toLocaleString("fr-FR")}</span></>}
                    </div>
                    {Object.entries(e).filter(([k]) => !["produit","designation","puDQE","puFiscal","ecartAbsolu","ecartPourcentage","quantiteDQE","quantiteFiscale"].includes(k)).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-muted-foreground">
                        <span>{k}</span>
                        <span className="text-right">{typeof v === "number" ? Number(v).toLocaleString("fr-FR") : String(v)}</span>
                      </div>
                    ))}
                  </div>
                )
              ))}
            </div>
          )}

          {detail.doublonsDetectes && detail.doublonsDetectes.length > 0 && (
            <div className="space-y-2">
              <span className="text-muted-foreground text-xs">Doublons :</span>
              {detail.doublonsDetectes.map((d: any, i: number) => (
                typeof d === "string" ? (
                  <p key={i} className="text-xs pl-2 text-destructive">• {d}</p>
                ) : (
                  <div key={i} className="rounded border border-orange-200 bg-orange-50 p-2 text-xs space-y-0.5">
                    {Object.entries(d).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-muted-foreground">
                        <span>{k}</span>
                        <span>{typeof v === "number" ? Number(v).toLocaleString("fr-FR") : String(v)}</span>
                      </div>
                    ))}
                  </div>
                )
              ))}
            </div>
          )}

          {detail.articlesDepassement && detail.articlesDepassement.length > 0 && (
            <div className="space-y-2">
              <span className="text-muted-foreground text-xs">Articles en dépassement :</span>
              {detail.articlesDepassement.map((a: any, i: number) => (
                typeof a === "string" ? (
                  <p key={i} className="text-xs pl-2 text-destructive">• {a}</p>
                ) : (
                  <div key={i} className="rounded border border-orange-200 bg-orange-50 p-2 text-xs space-y-0.5">
                    {a.produit && <p className="font-medium">{a.produit}</p>}
                    {a.designation && <p className="font-medium">{a.designation}</p>}
                    {Object.entries(a).filter(([k]) => !["produit","designation"].includes(k)).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-muted-foreground">
                        <span>{k}</span>
                        <span>{typeof v === "number" ? Number(v).toLocaleString("fr-FR") : String(v)}</span>
                      </div>
                    ))}
                  </div>
                )
              ))}
            </div>
          )}

          {/* Numeric fields */}
          {detail.montantDQERecalcule != null && (
            <>
              <Separator />
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Montant DQE recalculé</span><span>{Number(detail.montantDQERecalcule).toLocaleString("fr-FR")}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Montant fiscal recalculé</span><span>{Number(detail.montantFiscalRecalcule).toLocaleString("fr-FR")}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Montant DQE déclaré</span><span>{Number(detail.montantDQEDeclare).toLocaleString("fr-FR")}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Montant fiscal déclaré</span><span>{Number(detail.montantFiscalDeclare).toLocaleString("fr-FR")}</span></div>
              <div className="flex justify-between text-xs font-medium"><span className="text-muted-foreground">Différence</span><span className="text-destructive">{Number(detail.difference).toLocaleString("fr-FR")}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Écart %</span><span>{detail.ecartPourcentage}%</span></div>
            </>
          )}

          {detail.baseAttendue != null && (
            <>
              <Separator />
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Base attendue</span><span>{detail.baseAttendue != null ? Number(detail.baseAttendue).toLocaleString("fr-FR") : "N/A"}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Base déclarée</span><span>{detail.baseDeclaree != null ? Number(detail.baseDeclaree).toLocaleString("fr-FR") : "N/A"}</span></div>
              {detail.difference != null && <div className="flex justify-between text-xs font-medium"><span className="text-muted-foreground">Différence</span><span className="text-destructive">{Number(detail.difference).toLocaleString("fr-FR")}</span></div>}
            </>
          )}

          {detail.valeurAttendue != null && (
            <>
              <Separator />
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Valeur attendue</span><span>{detail.valeurAttendue != null ? Number(detail.valeurAttendue).toLocaleString("fr-FR") : "N/A"}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Valeur déclarée</span><span>{detail.valeurDeclaree != null ? Number(detail.valeurDeclaree).toLocaleString("fr-FR") : "N/A"}</span></div>
              {detail.ecart != null && <div className="flex justify-between text-xs font-medium"><span className="text-muted-foreground">Écart</span><span className="text-destructive">{Number(detail.ecart).toLocaleString("fr-FR")}</span></div>}
            </>
          )}

          {/* Text fields */}
          {detail.decision && <p className="text-xs text-muted-foreground">Décision : {detail.decision}</p>}
          {detail.impactEstime && <p className="text-xs text-muted-foreground">Impact estimé : {detail.impactEstime}</p>}
          {detail.impactBaseTaxable && <p className="text-xs text-muted-foreground">Impact base taxable : {detail.impactBaseTaxable}</p>}
          {detail.impactFinancier && <p className="text-xs text-muted-foreground">Impact financier : {detail.impactFinancier}</p>}
          {detail.incoherenceInterne && <p className="text-xs text-muted-foreground">Incohérence : {detail.incoherenceInterne}</p>}
          {detail.note && <p className="text-xs text-muted-foreground">Note : {detail.note}</p>}
          {detail.niveauRisque && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Risque</span>
              <Badge className={`text-xs ${riskBadge(detail.niveauRisque)}`}>{detail.niveauRisque}</Badge>
            </div>
          )}
          {detail.analyse && <p className="text-xs text-muted-foreground">{detail.analyse}</p>}
          {detail.niveauCohérence && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Cohérence</span>
              <Badge variant="outline" className="text-xs">{detail.niveauCohérence}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/correction-douaniere/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              Évaluation IA — Demande #{id}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Analyse automatique de conformité entre l'offre financière et le DQE
            </p>
          </div>
        </div>

        {/* Launch Card */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Lancer l'évaluation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              L'IA va comparer l'offre financière et le DQE pour détecter les incohérences de désignation, quantité, prix, taux et montants.
            </p>
            <Button
              onClick={handleAiAssistance}
              disabled={aiLoading || docsLoading}
              className="w-full sm:w-auto"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Bot className="h-4 w-4 mr-2" />
              )}
              {aiLoading ? "Évaluation en cours..." : "Lancer l'évaluation IA"}
            </Button>

            {aiError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                  <AlertTriangle className="h-4 w-4" /> Erreur
                </div>
                <p className="text-muted-foreground">{aiError}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {aiResult && (
          <div className="space-y-6">
            {/* Évaluation Globale */}
            {aiResult.evaluationGlobale && (
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg">Évaluation globale</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Statut global</span>
                      <Badge variant="outline">{aiResult.evaluationGlobale.statutGlobal}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Risque global</span>
                      <Badge className={riskBadge(aiResult.evaluationGlobale.niveauRisqueGlobal)}>
                        {aiResult.evaluationGlobale.niveauRisqueGlobal}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Score conformité</span>
                      <span className="font-bold text-lg">{aiResult.evaluationGlobale.scoreConformite}%</span>
                    </div>
                    {aiResult.evaluationGlobale.incoherenceLogiqueGlobale && (
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground text-xs">Incohérence logique :</span>
                        <p className="text-sm mt-1">{aiResult.evaluationGlobale.incoherenceLogiqueGlobale}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Details Grid */}
            {aiResult.details && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Détails de l'analyse</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(aiResult.details).map(([key, detail]) =>
                    renderDetailCard(key, detail)
                  )}
                </div>
              </div>
            )}

            {/* Recommandation */}
            {aiResult.recommandationFinale && (
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg">Recommandation finale</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line">{aiResult.recommandationFinale}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssistanceIA;
