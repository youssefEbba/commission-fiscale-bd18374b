import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { demandeCorrectionApi, DocumentDto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft, Loader2, Bot, Send, User, FileSpreadsheet,
  CheckCircle, XCircle, Play, Download, RefreshCw, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const AI_SERVICE_BASE = "https://f7c6-197-231-9-128.ngrok-free.app";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ExtractionFile {
  name: string;
  extracted: boolean;
  path?: string;
}

const ChatbotDGD = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Extraction state
  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionFile[]>([]);
  const [extractionChecked, setExtractionChecked] = useState(false);
  const allExtracted = extractionStatus.length > 0 && extractionStatus.every(f => f.extracted);

  // Page range for dqe_offre
  const [pageFrom, setPageFrom] = useState<string>("");
  const [pageTo, setPageTo] = useState<string>("");

  // Phase 1 - DQE
  const [dqeMessages, setDqeMessages] = useState<ChatMessage[]>([]);
  const [dqeInput, setDqeInput] = useState("");
  const [dqeLoading, setDqeLoading] = useState(false);
  const [dqeAnalyzing, setDqeAnalyzing] = useState(false);
  const [dqeAnalyzed, setDqeAnalyzed] = useState(false);
  const [dqeGenerating, setDqeGenerating] = useState(false);
  const [dqeGenerated, setDqeGenerated] = useState<any>(null);
  const [dqeExporting, setDqeExporting] = useState(false);
  const dqeScrollRef = useRef<HTMLDivElement>(null);

  // Phase 2 - Offre Fiscale
  const [ofMessages, setOfMessages] = useState<ChatMessage[]>([]);
  const [ofInput, setOfInput] = useState("");
  const [ofLoading, setOfLoading] = useState(false);
  const [ofAnalyzing, setOfAnalyzing] = useState(false);
  const [ofAnalyzed, setOfAnalyzed] = useState(false);
  const [ofGenerating, setOfGenerating] = useState(false);
  const [ofGenerated, setOfGenerated] = useState<any>(null);
  const [ofExporting, setOfExporting] = useState(false);
  const ofScrollRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState("dqe");

  // ─── Helpers ───
  const aiFetch = async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${AI_SERVICE_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(options.headers || {}),
      },
    });
    return res;
  };

  // ─── 0) Check extraction status ───
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

  // ─── 1) Extract documents ───
  const handleExtract = async () => {
    if (!id) return;
    setExtracting(true);
    try {
      // Get documents from the correction request
      const docs: DocumentDto[] = await demandeCorrectionApi.getDocuments(Number(id));
      const AI_DOC_TYPES = ["OFFRE_FISCALE", "OFFRE_FINANCIERE", "DQE", "DAO_DQE"];
      const relevantDocs = docs.filter((d: any) =>
        d.chemin && AI_DOC_TYPES.some(t => (d.type || d.typeDocument || "").includes(t))
      );

      if (relevantDocs.length === 0) {
        toast({ title: "Aucun document", description: "Aucun document DQE ou Offre Fiscale trouvé dans le dossier.", variant: "destructive" });
        setExtracting(false);
        return;
      }

      // Map docs to extraction format
      const documents: { name: string; url: string; pageRange?: { from: number; to: number } }[] = [];
      let offreFinanciereUrl: string | null = null;

      // First pass: find the OFFRE_FINANCIERE URL for dqe_offre
      for (const d of relevantDocs) {
        const type = (d.type || "").toUpperCase();
        if (type.includes("FINANCIERE")) {
          offreFinanciereUrl = d.chemin!.replace(/\\/g, "/");
        }
      }

      for (const d of relevantDocs) {
        const type = (d.type || "").toUpperCase();
        const url = d.chemin!.replace(/\\/g, "/");
        if (type.includes("DQE") && !type.includes("OFFRE")) {
          documents.push({ name: "dqe", url });
        } else if (type.includes("FINANCIERE")) {
          // dqe_offre = pages from OFFRE_FINANCIERE (PDF)
          const dqeOffreDoc: { name: string; url: string; pageRange?: { from: number; to: number } } = { name: "dqe_offre", url };
          const from = parseInt(pageFrom);
          const to = parseInt(pageTo);
          if (!isNaN(from) && !isNaN(to) && from >= 1 && to >= from) {
            dqeOffreDoc.pageRange = { from, to };
          }
          documents.push(dqeOffreDoc);
        } else if (type.includes("FISCALE")) {
          documents.push({ name: "ofrefiscale", url });
        }
      }

      // Deduplicate by name
      const seen = new Set<string>();
      const uniqueDocs = documents.filter(d => {
        if (seen.has(d.name)) return false;
        seen.add(d.name);
        return true;
      });

      // Extract documents one by one
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
          // Refresh status after each successful extraction
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

  // ─── Phase 1: DQE ───

  const loadDqeHistory = async () => {
    if (!id) return;
    try {
      const res = await aiFetch(`/api/dqe/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setDqeMessages(data.history.map((m: any) => ({
            role: m.role === "user" ? "user" as const : "assistant" as const,
            content: m.content || "",
          })));
          if (data.history.length > 0) setDqeAnalyzed(true);
        }
      }
    } catch { /* fresh */ }
  };

  const handleDqeAnalyze = async () => {
    if (!id) return;
    setDqeAnalyzing(true);
    try {
      const res = await aiFetch("/api/dqe/analyze", {
        method: "POST",
        body: JSON.stringify({ correctionId: id }),
      });
      if (!res.ok) throw new Error(`Erreur: ${res.status}`);
      const data = await res.json();
      console.log("DQE analyze response:", data);
      if (!data.success) throw new Error("Analyse échouée");

      let content: string;
      if (typeof data.analysis === "string") {
        content = data.analysis;
      } else if (data.analysis && typeof data.analysis === "object") {
        // Format structured analysis as readable markdown
        const parts: string[] = [];
        if (data.analysis.resume) {
          parts.push(data.analysis.resume);
        }
        if (Array.isArray(data.analysis.points_de_verification)) {
          parts.push("\n### Points de vérification\n");
          data.analysis.points_de_verification.forEach((p: string, i: number) => {
            parts.push(`${i + 1}. ${p}`);
          });
        }
        content = parts.join("\n");
      } else {
        content = JSON.stringify(data.analysis, null, 2);
      }
      setDqeMessages([{ role: "assistant", content: `## Analyse initiale DQE\n\n${content}` }]);
      setDqeAnalyzed(true);
      toast({ title: "Analyse DQE terminée" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setDqeAnalyzing(false);
    }
  };

  const handleDqeChat = async () => {
    if (!dqeInput.trim() || !id || dqeLoading) return;
    const question = dqeInput.trim();
    setDqeInput("");
    setDqeMessages(prev => [...prev, { role: "user", content: question }]);
    setDqeLoading(true);
    try {
      const res = await aiFetch("/api/dqe/chat", {
        method: "POST",
        body: JSON.stringify({
          correctionId: id,
          messages: [{ role: "user", content: question }],
        }),
      });
      if (!res.ok) throw new Error(`Erreur: ${res.status}`);
      const data = await res.json();
      setDqeMessages(prev => [...prev, { role: "assistant", content: data.answer || "Pas de réponse." }]);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
      setDqeMessages(prev => prev.slice(0, -1));
      setDqeInput(question);
    } finally {
      setDqeLoading(false);
    }
  };

  const handleDqeGenerate = async () => {
    if (!id) return;
    setDqeGenerating(true);
    try {
      const res = await aiFetch("/api/dqe/generate", {
        method: "POST",
        body: JSON.stringify({ correctionId: id }),
      });
      if (!res.ok) throw new Error(`Erreur: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error("Génération échouée");
      setDqeGenerated(data.dqe);
      toast({ title: "DQE Standard généré" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setDqeGenerating(false);
    }
  };

  const handleDqeExport = async () => {
    if (!dqeGenerated) return;
    setDqeExporting(true);
    try {
      const res = await aiFetch("/api/dqe/export-xlsx", {
        method: "POST",
        body: JSON.stringify({ dqe: dqeGenerated }),
      });
      if (!res.ok) throw new Error(`Erreur: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DQE_Standard_${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export DQE téléchargé" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setDqeExporting(false);
    }
  };

  // ─── Phase 2: Offre Fiscale ───

  const loadOfHistory = async () => {
    if (!id) return;
    try {
      const res = await aiFetch(`/api/of/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setOfMessages(data.history.map((m: any) => ({
            role: m.role === "user" ? "user" as const : "assistant" as const,
            content: m.content || "",
          })));
          if (data.history.length > 0) setOfAnalyzed(true);
        }
      }
    } catch { /* fresh */ }
  };

  const handleOfAnalyze = async () => {
    if (!id) return;
    setOfAnalyzing(true);
    try {
      const res = await aiFetch("/api/of/analyze", {
        method: "POST",
        body: JSON.stringify({ correctionId: id }),
      });
      if (!res.ok) throw new Error(`Erreur: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error("Analyse échouée");

      // Display answer as markdown
      const content = data.answer || (typeof data.analysis === "string" ? data.analysis : JSON.stringify(data.analysis, null, 2));
      setOfMessages([{ role: "assistant", content }]);
      setOfAnalyzed(true);
      toast({ title: "Diagnostic Offre Fiscale terminé" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setOfAnalyzing(false);
    }
  };

  const handleOfChat = async () => {
    if (!ofInput.trim() || !id || ofLoading) return;
    const question = ofInput.trim();
    setOfInput("");
    setOfMessages(prev => [...prev, { role: "user", content: question }]);
    setOfLoading(true);
    try {
      const res = await aiFetch("/api/of/chat", {
        method: "POST",
        body: JSON.stringify({
          correctionId: id,
          messages: [{ role: "user", content: question }],
        }),
      });
      if (!res.ok) throw new Error(`Erreur: ${res.status}`);
      const data = await res.json();
      setOfMessages(prev => [...prev, { role: "assistant", content: data.answer || "Pas de réponse." }]);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
      setOfMessages(prev => prev.slice(0, -1));
      setOfInput(question);
    } finally {
      setOfLoading(false);
    }
  };

  const handleOfGenerate = async () => {
    if (!id) return;
    setOfGenerating(true);
    try {
      const res = await aiFetch("/api/of/generate", {
        method: "POST",
        body: JSON.stringify({ correctionId: id }),
      });
      if (!res.ok) throw new Error(`Erreur: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error("Génération échouée");
      setOfGenerated(data.offre_fiscale);
      toast({ title: "Offre Fiscale générée" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setOfGenerating(false);
    }
  };

  const handleOfExport = async () => {
    if (!ofGenerated) return;
    setOfExporting(true);
    try {
      const res = await aiFetch("/api/of/export-xlsx", {
        method: "POST",
        body: JSON.stringify({ offre_fiscale: ofGenerated }),
      });
      if (!res.ok) throw new Error(`Erreur: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Offre_Fiscale_${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export Offre Fiscale téléchargé" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setOfExporting(false);
    }
  };

  // Load histories on mount
  useEffect(() => { loadDqeHistory(); loadOfHistory(); }, [id]);

  // Auto-scroll
  useEffect(() => {
    if (dqeScrollRef.current) dqeScrollRef.current.scrollTop = dqeScrollRef.current.scrollHeight;
  }, [dqeMessages]);
  useEffect(() => {
    if (ofScrollRef.current) ofScrollRef.current.scrollTop = ofScrollRef.current.scrollHeight;
  }, [ofMessages]);

  // ─── Chat message renderer ───
  const renderMessages = (
    messages: ChatMessage[],
    scrollRef: React.RefObject<HTMLDivElement>,
    loading: boolean,
    emptyText: string
  ) => (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16">
          <Bot className="h-12 w-12 text-primary/40" />
          <p className="text-sm">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-1">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      )}
    </ScrollArea>
  );

  // ─── JSON table renderer for generated data (collapsible) ───
  const [dqeJsonOpen, setDqeJsonOpen] = useState(false);
  const [ofJsonOpen, setOfJsonOpen] = useState(false);

  const renderJsonTable = (data: any, title: string, isOpen: boolean, setOpen: (v: boolean) => void) => {
    if (!data) return null;
    return (
      <Collapsible open={isOpen} onOpenChange={setOpen} className="mt-3">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between text-xs">
            {title}
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-1 border-border/50">
            <CardContent className="p-3">
              <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-60 whitespace-pre-wrap">
                {JSON.stringify(data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/correction-douaniere/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Chatbots DGD — Demande #{id}
            </h1>
            <p className="text-muted-foreground text-xs">
              Phase 1 : Analyse DQE → Phase 2 : Offre Fiscale corrigée
            </p>
          </div>
        </div>

        {/* Extraction Status Banner */}
        <Card className="mb-4">
          <CardContent className="py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Extraction des documents</p>
                  <p className="text-xs text-muted-foreground">
                    {!extractionChecked
                      ? "Vérification..."
                      : allExtracted
                      ? "Tous les documents sont extraits ✓"
                      : "Certains documents n'ont pas été extraits"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {extractionStatus.map((f) => (
                  <Badge
                    key={f.name}
                    variant={f.extracted ? "default" : "outline"}
                    className={`text-[10px] ${f.extracted ? "bg-green-100 text-green-800 border-green-200" : ""}`}
                  >
                    {f.extracted ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {f.name}
                  </Badge>
                ))}
                <Button
                  size="sm"
                  variant={allExtracted ? "outline" : "default"}
                  onClick={handleExtract}
                  disabled={extracting}
                >
                  {extracting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  {allExtracted ? "Ré-extraire" : "Extraire"}
                </Button>
                <Button size="sm" variant="ghost" onClick={checkExtractionStatus}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Page range for dqe_offre */}
            <Separator />
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs font-medium text-muted-foreground">
                Périmètre DQE dans l'offre financière (dqe_offre) :
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Page de</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="ex: 10"
                  value={pageFrom}
                  onChange={(e) => setPageFrom(e.target.value)}
                  className="w-20 h-7 text-xs"
                />
                <label className="text-xs text-muted-foreground">à</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="ex: 15"
                  value={pageTo}
                  onChange={(e) => setPageTo(e.target.value)}
                  className="w-20 h-7 text-xs"
                />
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                (Optionnel — max 30 pages. Laissez vide pour extraire tout le document)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Phase 1 (DQE) / Phase 2 (Offre Fiscale) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dqe" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Phase 1 — DQE
              {dqeGenerated && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
            </TabsTrigger>
            <TabsTrigger value="offre" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Phase 2 — Offre Fiscale
              {ofGenerated && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
            </TabsTrigger>
          </TabsList>

          {/* ═══ Phase 1: DQE ═══ */}
          <TabsContent value="dqe" className="flex-1 flex flex-col overflow-hidden mt-2">
            <div className="flex gap-2 mb-2">
              <Button
                size="sm"
                onClick={handleDqeAnalyze}
                disabled={dqeAnalyzing || !allExtracted}
                variant={dqeAnalyzed ? "outline" : "default"}
              >
                {dqeAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {dqeAnalyzed ? "Ré-analyser" : "1. Analyser DQE"}
              </Button>
              <Button
                size="sm"
                onClick={handleDqeGenerate}
                disabled={dqeGenerating || !dqeAnalyzed}
                variant={dqeGenerated ? "outline" : "secondary"}
              >
                {dqeGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                {dqeGenerated ? "Ré-générer" : "2. Générer DQE Standard"}
              </Button>
              {dqeGenerated && (
                <Button size="sm" variant="outline" onClick={handleDqeExport} disabled={dqeExporting}>
                  {dqeExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  Export Excel
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={loadDqeHistory}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
              {renderMessages(dqeMessages, dqeScrollRef, dqeLoading, "Lancez l'analyse DQE pour commencer")}
              <Separator />
              <div className="p-3 flex gap-2">
                <Input
                  value={dqeInput}
                  onChange={(e) => setDqeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleDqeChat(); } }}
                  placeholder="Posez une question sur le DQE…"
                  disabled={dqeLoading || !dqeAnalyzed}
                  className="flex-1"
                />
                <Button onClick={handleDqeChat} disabled={dqeLoading || !dqeInput.trim() || !dqeAnalyzed} size="icon">
                  {dqeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </Card>

            {renderJsonTable(dqeGenerated, "DQE Standard généré (JSON)", dqeJsonOpen, setDqeJsonOpen)}
          </TabsContent>

          {/* ═══ Phase 2: Offre Fiscale ═══ */}
          <TabsContent value="offre" className="flex-1 flex flex-col overflow-hidden mt-2">
            <div className="flex gap-2 mb-2">
              <Button
                size="sm"
                onClick={handleOfAnalyze}
                disabled={ofAnalyzing || !allExtracted || !dqeGenerated}
                variant={ofAnalyzed ? "outline" : "default"}
              >
                {ofAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {ofAnalyzed ? "Ré-diagnostiquer" : "1. Diagnostic OF"}
              </Button>
              <Button
                size="sm"
                onClick={handleOfGenerate}
                disabled={ofGenerating || !ofAnalyzed}
                variant={ofGenerated ? "outline" : "secondary"}
              >
                {ofGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                {ofGenerated ? "Ré-générer" : "2. Générer Offre Fiscale"}
              </Button>
              {ofGenerated && (
                <Button size="sm" variant="outline" onClick={handleOfExport} disabled={ofExporting}>
                  {ofExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  Export Excel (3 feuilles)
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={loadOfHistory}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {!dqeGenerated && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 mb-2">
                ⚠️ Vous devez d'abord générer le DQE Standard (Phase 1) avant de lancer le diagnostic de l'Offre Fiscale.
              </div>
            )}

            <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
              {renderMessages(ofMessages, ofScrollRef, ofLoading, "Lancez le diagnostic pour commencer la Phase 2")}
              <Separator />
              <div className="p-3 flex gap-2">
                <Input
                  value={ofInput}
                  onChange={(e) => setOfInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleOfChat(); } }}
                  placeholder="Ajustements sur l'offre fiscale…"
                  disabled={ofLoading || !ofAnalyzed}
                  className="flex-1"
                />
                <Button onClick={handleOfChat} disabled={ofLoading || !ofInput.trim() || !ofAnalyzed} size="icon">
                  {ofLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </Card>

            {renderJsonTable(ofGenerated, "Offre Fiscale générée (JSON multi-tables)")}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ChatbotDGD;
