import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Loader2, Bot, Send, User, Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

import { AI_SERVICE_BASE } from "@/lib/apiConfig";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const AssistanceIA = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    if (!id) return;
    (async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch(`${AI_SERVICE_BASE}/api/fiscal-chat/${id}/history`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.history)) {
            const mapped: ChatMessage[] = data.history.map((m: any) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content || m.answer || m.question || "",
            }));
            setMessages(mapped);
          }
        }
      } catch {
        // No history available, start fresh
      } finally {
        setHistoryLoading(false);
      }
    })();
  }, [id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !id || loading) return;
    const question = input.trim();
    setInput("");
    
    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${AI_SERVICE_BASE}/api/fiscal-chat/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          uuid: id,
          question,
          provider: "gemini",
          model: "gemini-2.5-flash",
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Erreur ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = { role: "assistant", content: data.answer || "Pas de réponse." };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
      setInput(question);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    try {
      await fetch(`${AI_SERVICE_BASE}/api/fiscal-chat/${id}/history`, {
        method: "DELETE",
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      setMessages([]);
      toast({ title: "Historique effacé" });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'effacer l'historique", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/correction-douaniere/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Assistant IA — Demande #{id}
            </h1>
            <p className="text-muted-foreground text-xs">
              Posez vos questions sur les documents de cette demande de correction
            </p>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearHistory}>
              <Trash2 className="h-4 w-4 mr-1" /> Effacer
            </Button>
          )}
        </div>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {historyLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Chargement de l'historique…
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16">
                <Bot className="h-12 w-12 text-primary/40" />
                <p className="text-sm">Aucun message. Posez votre première question !</p>
                <div className="flex flex-wrap gap-2 mt-2 max-w-lg">
                  {[
                    "CORRESPONDANCE (DQE vs OFFRE)",
                    "Vérifie la cohérence des quantités (T, lots, unités)",
                    "Identifie les produits qui pourraient être considérés comme \"non éligibles\" dans un marché public",
                    "Identifie les libellés qui pourraient désigner les mêmes produits",
                    "Vérifie l'exactitude arithmétique de tous les calculs",
                  ].map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      className="text-xs text-left whitespace-normal h-auto py-2"
                      onClick={() => { setInput(q); }}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
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
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
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

          <Separator />

          {/* Input Area */}
          <div className="p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question sur la demande…"
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AssistanceIA;
