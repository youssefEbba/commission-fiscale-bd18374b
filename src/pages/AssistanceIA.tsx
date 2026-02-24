import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { demandeCorrectionApi, DocumentDto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, Bot, AlertTriangle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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

      if (!offreDoc?.chemin) {
        throw new Error("L'offre financière est requise pour l'assistance IA");
      }

      const offreUrl = offreDoc.chemin.replace(/\\/g, "/");
      const dqeUrl = dqeDoc?.chemin ? dqeDoc.chemin.replace(/\\/g, "/") : undefined;

      const token = localStorage.getItem("auth_token");
      const AI_SERVICE_BASE = "https://superelegant-irretraceably-liv.ngrok-free.dev";
      const res = await fetch(`${AI_SERVICE_BASE}/api/audit-fiscale/correct-by-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          offreUrl,
          dqeUrl,
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
      toast({ title: "Analyse IA terminée", description: "Les corrections ont été générées avec succès" });
    } catch (e: any) {
      setAiError(e.message);
      toast({ title: "Erreur IA", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/correction-douaniere/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              Assistance IA — Demande #{id}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Analyse automatique des corrections douanières via l'offre financière et le DQE
            </p>
          </div>
        </div>

        {/* Launch Card */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Lancer l'analyse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              L'IA va analyser l'offre financière et le DQE pour détecter les erreurs de calcul dans les droits et taxes douaniers.
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
              {aiLoading ? "Analyse en cours..." : "Lancer l'assistance IA"}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Résumé Audit */}
            {aiResult.resumeAudit && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Résumé de l'audit</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Erreurs détectées</span>
                      <Badge variant="secondary">{aiResult.resumeAudit.nombreErreursDetectees}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Gravité</span>
                      <Badge className={
                        aiResult.resumeAudit.graviteGlobale === "élevée" || aiResult.resumeAudit.graviteGlobale === "elevee" || aiResult.resumeAudit.graviteGlobale === "Critique"
                          ? "bg-destructive/10 text-destructive"
                          : aiResult.resumeAudit.graviteGlobale === "moyenne"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-emerald-100 text-emerald-800"
                      }>{aiResult.resumeAudit.graviteGlobale}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Risque fiscal</span>
                      <span className="font-medium">{aiResult.resumeAudit.risqueFiscal}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Écart Global */}
            {aiResult.ecartGlobal && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Écart global</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Crédit déclaré</span>
                      <span className="font-medium">{Number(aiResult.ecartGlobal.creditDeclare).toLocaleString("fr-FR")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Crédit corrigé</span>
                      <span className="font-medium">{Number(aiResult.ecartGlobal.creditCorrige).toLocaleString("fr-FR")}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Différence</span>
                      <span className="font-bold text-destructive">{Number(aiResult.ecartGlobal.difference).toLocaleString("fr-FR")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Crédit Impôt Corrigé */}
            {aiResult.creditImpôtCorrige && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-lg">Crédit d'impôt corrigé</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {aiResult.creditImpôtCorrige.creditDouanier && (
                      <div className="space-y-2">
                        <p className="font-medium text-sm text-muted-foreground">Douanier</p>
                        {Object.entries(aiResult.creditImpôtCorrige.creditDouanier).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-sm pl-2">
                            <span>{k}</span>
                            <span className="font-medium">{Number(v).toLocaleString("fr-FR")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiResult.creditImpôtCorrige.creditInterieur && (
                      <div className="space-y-2">
                        <p className="font-medium text-sm text-muted-foreground">Intérieur</p>
                        {Object.entries(aiResult.creditImpôtCorrige.creditInterieur).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-sm pl-2">
                            <span>{k}</span>
                            <span className="font-medium">{Number(v).toLocaleString("fr-FR")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between text-sm font-bold">
                    <span>Crédit total corrigé</span>
                    <span>{Number(aiResult.creditImpôtCorrige.creditTotalCorrige).toLocaleString("fr-FR")}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Corrections Douane */}
            {aiResult.correctionsDouane && aiResult.correctionsDouane.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-lg">Corrections douanières ({aiResult.correctionsDouane.length})</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-3">
                      {aiResult.correctionsDouane.map((c: any, i: number) => (
                        <div key={i} className="rounded-lg border border-border p-4 text-sm space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="font-medium">{c.produit}</p>
                            <Badge variant="secondary">{c.niveauErreur}</Badge>
                          </div>
                          {c.ecart && typeof c.ecart === "object" && Object.entries(c.ecart).map(([k, v]) => (
                            <div key={k} className="flex justify-between pl-2 text-xs">
                              <span className="text-muted-foreground">{k}</span>
                              <span>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Corrections Intérieure */}
            {aiResult.correctionsInterieure && aiResult.correctionsInterieure.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-lg">Corrections intérieures ({aiResult.correctionsInterieure.length})</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-3">
                      {aiResult.correctionsInterieure.map((c: any, i: number) => (
                        <div key={i} className="rounded-lg border border-border p-4 text-sm space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="font-medium">{c.produit}</p>
                            <Badge variant="secondary">{c.niveauErreur}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
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
