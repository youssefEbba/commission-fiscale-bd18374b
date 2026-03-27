import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft, ArrowRight, Loader2, Bot, Send, User, FileSpreadsheet,
  CheckCircle, Play, Download, RefreshCw, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { apiFetch } from "@/lib/api";

const AI_SERVICE_BASE = "https://f7c6-197-231-9-128.ngrok-free.app";
const API_BASE = "https://edf0-197-231-3-222.ngrok-free.app/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CorrigeStatus {
  dqe_corrige: { exists: boolean; valid: boolean; path?: string; payload?: any };
  offre_fiscale_corrigee: { exists: boolean; valid: boolean; path?: string; payload?: any };
}

const ChatbotDGD = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // DQE corrigé status
  const [dqeCorrigeValid, setDqeCorrigeValid] = useState(false);
  const [corrigeStatus, setCorrigeStatus] = useState<CorrigeStatus | null>(null);

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
  const [dqeJsonOpen, setDqeJsonOpen] = useState(false);
  const [ofJsonOpen, setOfJsonOpen] = useState(false);

  // ─── Helpers ───
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

  const checkDqeCorrigeStatus = async (correctionId: string) => {
    try {
      console.log("[ChatbotDGD] Checking corrige-status for:", correctionId);
      const res = await aiFetch(`/api/correction/corrige-status/${correctionId}?includePayload=true`);
      if (!res.ok) {
        console.warn("[ChatbotDGD] corrige-status error:", res.status);
        return;
      }
      const data: CorrigeStatus = await res.json();
      console.log("[ChatbotDGD] corrige-status response:", data);
      setCorrigeStatus(data);
      setDqeCorrigeValid(data.dqe_corrige?.valid === true);
      if (data.dqe_corrige?.valid) {
        setDqeAnalyzed(true);
        // Store the actual payload if available, otherwise just mark as valid
        if (data.dqe_corrige.payload) {
          setDqeGenerated(data.dqe_corrige.payload);
        }
      }
      if (data.offre_fiscale_corrigee?.valid) {
        setOfAnalyzed(true);
        if (data.offre_fiscale_corrigee.payload) {
          setOfGenerated(data.offre_fiscale_corrigee.payload);
        }
      }
    } catch (err) {
      console.error("[ChatbotDGD] corrige-status fetch failed:", err);
    }
  };

  useEffect(() => {
    if (id) {
      checkDqeCorrigeStatus(id);
    }
  }, [id]);

  // ─── Phase 1: DQE ───

  const loadDqeHistory = async () => {
    if (!id) return;
    try {
      const res = await aiFetch(`/api/dqe/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        const messages = data.history?.messages || (Array.isArray(data.history) ? data.history : []);
        if (data.success && messages.length > 0) {
          setDqeMessages(messages.map((m: any) => ({
            role: m.role === "user" ? "user" as const : "assistant" as const,
            content: m.content || "",
          })));
          setDqeAnalyzed(true);
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
      if (!data.success) throw new Error("Analyse échouée");

      let content: string;
      if (typeof data.analysis === "string") {
        content = data.analysis;
      } else if (data.analysis && typeof data.analysis === "object") {
        const parts: string[] = [];
        if (data.analysis.resume) {
          parts.push(data.analysis.resume);
        }
        if (Array.isArray(data.analysis.points_de_verification)) {
          parts.push("\n---\n\n### 📋 Points de vérification\n");
          data.analysis.points_de_verification.forEach((p: string, i: number) => {
            parts.push(`${i + 1}. ${p}\n`);
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
        body: JSON.stringify({ correctionId: id, messages: [{ role: "user", content: question }] }),
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
      await checkDqeCorrigeStatus(id!);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setDqeGenerating(false);
    }
  };

  const handleDqeExport = async () => {
    setDqeExporting(true);
    try {
      let dqePayload = dqeGenerated;
      // If we don't have the actual DQE payload in memory, fetch it from the server
      if (!dqePayload && corrigeStatus?.dqe_corrige?.valid) {
        const statusRes = await aiFetch(`/api/correction/corrige-status/${id}?includePayload=true`);
        if (!statusRes.ok) throw new Error(`Erreur chargement DQE: ${statusRes.status}`);
        const statusData = await statusRes.json();
        dqePayload = statusData.dqe_corrige?.payload;
        if (dqePayload) setDqeGenerated(dqePayload);
      }
      if (!dqePayload) throw new Error("Aucun DQE disponible pour l'export");
      const res = await aiFetch("/api/dqe/export-xlsx", {
        method: "POST",
        body: JSON.stringify({ dqe: dqePayload }),
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
        const messages = data.history?.messages || (Array.isArray(data.history) ? data.history : []);
        if (data.success && messages.length > 0) {
          setOfMessages(messages.map((m: any) => ({
            role: m.role === "user" ? "user" as const : "assistant" as const,
            content: m.content || "",
          })));
          setOfAnalyzed(true);
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
        body: JSON.stringify({ correctionId: id, messages: [{ role: "user", content: question }] }),
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
    setOfExporting(true);
    try {
      let ofPayload = ofGenerated;
      if (!ofPayload && corrigeStatus?.offre_fiscale_corrigee?.valid) {
        const statusRes = await aiFetch(`/api/correction/corrige-status/${id}?includePayload=true`);
        if (!statusRes.ok) throw new Error(`Erreur chargement OF: ${statusRes.status}`);
        const statusData = await statusRes.json();
        ofPayload = statusData.offre_fiscale_corrigee?.payload;
        if (ofPayload) setOfGenerated(ofPayload);
      }
      if (!ofPayload) throw new Error("Aucune Offre Fiscale disponible pour l'export");
      const res = await aiFetch("/api/of/export-xlsx", {
        method: "POST",
        body: JSON.stringify({ offre_fiscale: ofPayload }),
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
    emptyText: string,
    skipFirst: number = 1
  ) => (
    <div className="flex-1 min-h-0 overflow-auto p-4" ref={scrollRef}>
      {messages.length <= skipFirst ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16">
          <Bot className="h-12 w-12 text-primary/40" />
          <p className="text-sm">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.filter((_, i) => i >= skipFirst).map((msg, i) => (
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
    </div>
  );

  // ─── JSON table renderer ───
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
      <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 mb-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/extraction-dgd/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Extraction
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

        {/* Tabs: Phase 1 (DQE) / Phase 2 (Offre Fiscale) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dqe" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Phase 1 — DQE
              {(dqeGenerated || dqeCorrigeValid) && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
            </TabsTrigger>
            <TabsTrigger value="offre" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Phase 2 — Offre Fiscale
              {ofGenerated && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
            </TabsTrigger>
          </TabsList>

          {/* ═══ Phase 1: DQE ═══ */}
          <TabsContent value="dqe" className="flex-1 mt-2 min-h-0 overflow-hidden" style={{ display: activeTab === 'dqe' ? 'flex' : 'none', flexDirection: 'column' }}>
            <Card className="flex flex-col flex-1 border-border/50 min-h-0 overflow-hidden">
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

            {/* Action buttons below chat */}
            <div className="flex gap-2 mt-2 flex-wrap items-center">
              <Button
                size="sm"
                onClick={handleDqeAnalyze}
                disabled={dqeAnalyzing}
                variant={dqeAnalyzed ? "outline" : "default"}
              >
                {dqeAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {dqeAnalyzed ? "Ré-analyser" : "1. Analyser DQE"}
              </Button>
              <Button
                size="sm"
                onClick={handleDqeGenerate}
                disabled={dqeGenerating || !dqeAnalyzed}
                variant={dqeGenerated || corrigeStatus?.dqe_corrige?.valid ? "outline" : "secondary"}
              >
                {dqeGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                {dqeGenerated || corrigeStatus?.dqe_corrige?.valid ? "Ré-générer" : "2. Générer DQE Standard"}
              </Button>
              {(dqeGenerated || corrigeStatus?.dqe_corrige?.valid) && (
                <Button size="sm" variant="outline" onClick={handleDqeExport} disabled={dqeExporting}>
                  {dqeExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  Télécharger Excel
                </Button>
              )}
              {(dqeGenerated || corrigeStatus?.dqe_corrige?.valid) && (
                <Button size="sm" onClick={() => setActiveTab("offre")}>
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Passer à l'Offre Fiscale
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={loadDqeHistory}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {renderJsonTable(dqeGenerated, "DQE Standard généré (JSON)", dqeJsonOpen, setDqeJsonOpen)}
          </TabsContent>

          {/* ═══ Phase 2: Offre Fiscale ═══ */}
          <TabsContent value="offre" className="flex-1 mt-2 min-h-0 overflow-hidden" style={{ display: activeTab === 'offre' ? 'flex' : 'none', flexDirection: 'column' }}>
            {!dqeGenerated && !dqeCorrigeValid && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 mb-2">
                ⚠️ Vous devez d'abord générer le DQE Standard (Phase 1) avant de lancer le diagnostic de l'Offre Fiscale.
              </div>
            )}
            {dqeCorrigeValid && !dqeGenerated && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800 mb-2">
                ✅ DQE corrigé détecté et valide — vous pouvez lancer le diagnostic de l'Offre Fiscale.
              </div>
            )}

            <Card className="flex flex-col flex-1 border-border/50 min-h-0 overflow-hidden">
              {renderMessages(ofMessages, ofScrollRef, ofLoading, "Lancez le diagnostic pour commencer la Phase 2", 2)}
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

            {/* Action buttons below chat */}
            <div className="flex gap-2 mt-2 flex-wrap items-center">
              <Button
                size="sm"
                onClick={handleOfAnalyze}
                disabled={ofAnalyzing || (!dqeGenerated && !dqeCorrigeValid)}
                variant={ofAnalyzed ? "outline" : "default"}
              >
                {ofAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {ofAnalyzed ? "Ré-diagnostiquer" : "1. Diagnostic OF"}
              </Button>
              <Button
                size="sm"
                onClick={handleOfGenerate}
                disabled={ofGenerating || !ofAnalyzed}
                variant={ofGenerated || corrigeStatus?.offre_fiscale_corrigee?.valid ? "outline" : "secondary"}
              >
                {ofGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                {ofGenerated || corrigeStatus?.offre_fiscale_corrigee?.valid ? "Ré-générer" : "2. Générer Offre Fiscale"}
              </Button>
              {(ofGenerated || corrigeStatus?.offre_fiscale_corrigee?.valid) && (
                <Button size="sm" variant="outline" onClick={handleOfExport} disabled={ofExporting}>
                  {ofExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  Télécharger Excel (3 feuilles)
                </Button>
              )}
              {(ofGenerated || corrigeStatus?.offre_fiscale_corrigee?.valid) && (
                <Button size="sm" onClick={() => navigate(`/dashboard/correction-douaniere/${id}`)}>
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Passer à la correction
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={loadOfHistory}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {renderJsonTable(ofGenerated, "Offre Fiscale générée (JSON multi-tables)", ofJsonOpen, setOfJsonOpen)}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ChatbotDGD;
