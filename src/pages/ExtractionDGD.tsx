import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { demandeCorrectionApi, DocumentDto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, CheckCircle, XCircle, Play, RefreshCw, Zap, Bot, ArrowRight,
} from "lucide-react";

import { AI_SERVICE_BASE } from "@/lib/apiConfig";

interface ExtractionFile {
  name: string;
  extracted: boolean;
  path?: string;
}

const ExtractionDGD = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionFile[]>([]);
  const [extractionChecked, setExtractionChecked] = useState(false);
  const allExtracted = extractionStatus.length > 0 && extractionStatus.every(f => f.extracted);

  const [pageFrom, setPageFrom] = useState<string>("");
  const [pageTo, setPageTo] = useState<string>("");

  const aiFetch = async (path: string, options: RequestInit = {}) => {
    return fetch(`${AI_SERVICE_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(options.headers || {}),
      },
    });
  };

  const checkExtractionStatus = async () => {
    if (!id) return;
    try {
      const res = await aiFetch(`/api/context/extract-status/${id}?names=dqe,dqe_offre,ofrefiscale`);
      if (res.ok) {
        const data = await res.json();
        setExtractionStatus(data.files || []);
      }
    } catch { /* ignore */ }
    setExtractionChecked(true);
  };

  useEffect(() => { checkExtractionStatus(); }, [id]);

  const handleExtract = async () => {
    if (!id) return;

    // Validate page range is provided
    const from = parseInt(pageFrom);
    const to = parseInt(pageTo);
    if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
      toast({ title: "Périmètre requis", description: "Veuillez préciser les pages de début et de fin du DQE dans l'offre financière.", variant: "destructive" });
      return;
    }

    setExtracting(true);
    try {
      const docs: DocumentDto[] = await demandeCorrectionApi.getDocuments(Number(id));
      const AI_DOC_TYPES = ["OFFRE_FISCALE", "OFFRE_FINANCIERE", "DQE", "DAO_DQE"];
      const relevantDocs = docs.filter((d: any) =>
        d.chemin && AI_DOC_TYPES.some(t => (d.type || d.typeDocument || "").includes(t))
      );

      const documents: { name: string; url: string; pageRange?: { from: number; to: number } }[] = [];

      for (const d of relevantDocs) {
        const type = (d.type || "").toUpperCase();
        const url = d.chemin!.replace(/\\/g, "/");
        if (type.includes("DQE") && !type.includes("OFFRE")) {
          documents.push({ name: "dqe", url });
        } else if (type.includes("FINANCIERE")) {
          documents.push({ name: "dqe_offre", url, pageRange: { from, to } });
        } else if (type.includes("FISCALE")) {
          documents.push({ name: "ofrefiscale", url });
        }
      }

      const seen = new Set<string>();
      const uniqueDocs = documents.filter(d => {
        if (seen.has(d.name)) return false;
        seen.add(d.name);
        return true;
      });

      // Check all 3 required files are present
      const requiredNames = ["dqe", "dqe_offre", "ofrefiscale"];
      const missingNames = requiredNames.filter(n => !uniqueDocs.some(d => d.name === n));
      if (missingNames.length > 0) {
        toast({
          title: "Documents manquants",
          description: `Les documents suivants sont introuvables dans le dossier : ${missingNames.join(", ")}. Les 3 fichiers (DQE, Offre Financière, Offre Fiscale) sont requis.`,
          variant: "destructive",
        });
        setExtracting(false);
        return;
      }

      let successCount = 0;
      for (const doc of uniqueDocs) {
        try {
          const res = await aiFetch("/api/context/extract", {
            method: "POST",
            body: JSON.stringify({ correctionId: id, documents: [doc] }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const errorMsg = errorData.message || errorData.error || `Erreur ${res.status}`;
            toast({ title: `Erreur: ${doc.name}`, description: errorMsg, variant: "destructive" });
            continue;
          }
          const data = await res.json();
          if (!data.success) {
            toast({ title: `Échec: ${doc.name}`, description: "Extraction échouée", variant: "destructive" });
            continue;
          }
          successCount++;
          toast({ title: `Extrait: ${doc.name}`, description: `Document "${doc.name}" extrait avec succès.` });
          await checkExtractionStatus();
        } catch (e: any) {
          toast({ title: `Erreur: ${doc.name}`, description: e.message, variant: "destructive" });
        }
      }

      if (successCount === uniqueDocs.length) {
        toast({ title: "Extraction terminée", description: "Tous les documents ont été extraits avec succès." });
      } else {
        toast({ title: "Extraction partielle", description: `${successCount}/${uniqueDocs.length} documents extraits.`, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/correction-douaniere/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Extraction des documents — Demande #{id}
            </h1>
            <p className="text-muted-foreground text-xs">
              Étape 1 : Extraire les documents avant d'accéder aux chatbots IA
            </p>
          </div>
        </div>

        {/* Extraction Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Statut de l'extraction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status badges */}
            <div className="flex items-center gap-3 flex-wrap">
              {extractionStatus.map((f) => (
                <Badge
                  key={f.name}
                  variant={f.extracted ? "default" : "outline"}
                  className={`text-xs py-1 px-3 ${f.extracted ? "bg-green-100 text-green-800 border-green-200" : ""}`}
                >
                  {f.extracted ? <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> : <XCircle className="h-3.5 w-3.5 mr-1.5" />}
                  {f.name}
                </Badge>
              ))}
              {!extractionChecked && (
                <p className="text-xs text-muted-foreground">Vérification en cours...</p>
              )}
            </div>

            <Separator />

            {/* Page range for dqe_offre */}
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-medium text-muted-foreground">
                Périmètre DQE dans l'offre financière (dqe_offre) :
              </p>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Page de</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="ex: 10"
                  value={pageFrom}
                  onChange={(e) => setPageFrom(e.target.value)}
                  className="w-24 h-9"
                />
                <label className="text-sm text-muted-foreground">à</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="ex: 15"
                  value={pageTo}
                  onChange={(e) => setPageTo(e.target.value)}
                  className="w-24 h-9"
                />
              </div>
              <p className="text-xs text-muted-foreground/70">
                (Optionnel — max 30 pages. Laissez vide pour extraire tout le document)
              </p>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleExtract}
                disabled={extracting}
                variant={allExtracted ? "outline" : "default"}
                size="lg"
              >
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {allExtracted ? "Ré-extraire les documents" : "Lancer l'extraction"}
              </Button>
              <Button variant="ghost" onClick={checkExtractionStatus}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {allExtracted && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Tous les documents sont extraits ✓</p>
                  <p className="text-xs text-green-700 mt-1">Vous pouvez maintenant accéder aux chatbots IA pour l'analyse.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action: Go to chatbots */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={() => navigate(`/dashboard/chatbot-dgd/${id}`)}
            disabled={!allExtracted}
            className="gap-2"
          >
            <Bot className="h-5 w-5" />
            Accéder aux Chatbots IA
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ExtractionDGD;
