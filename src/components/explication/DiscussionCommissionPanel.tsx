import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Loader2, Lock, Send, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  demandeExplicationApi,
  DemandeExplicationDto,
  ExplicationContexte,
  ExplicationRoleDestinataire,
  formatApiErrorMessage,
} from "@/lib/api";

const COMMISSION_ROLES: AppRole[] = ["DGD", "DGTCP", "DGI", "DGB", "PRESIDENT"];
const ROLES_DESTINATAIRE: ExplicationRoleDestinataire[] = ["DGD", "DGTCP", "DGI", "DGB", "PRESIDENT"];

interface Props {
  contexte: ExplicationContexte;
  dossierId?: number;
  /** Statut métier du dossier (utilisé pour activer / désactiver l'ouverture). */
  dossierStatut?: string;
  /** Si false, on n'autorise pas l'ouverture (mais on affiche les fils existants en lecture seule). */
  canOpen?: boolean;
}

const STATUTS_AUTORISES: Record<ExplicationContexte, (s: string | undefined) => boolean> = {
  CORRECTION: (s) => !!s && ["RECUE", "INCOMPLETE", "RECEVABLE", "EN_EVALUATION", "EN_VALIDATION"].includes(s),
  CERTIFICAT: (s) => !!s && ["EN_CONTROLE", "INCOMPLETE", "A_RECONTROLER"].includes(s),
  UTILISATION: (s) => !!s && !["LIQUIDEE", "APUREE", "REJETEE", "CLOTUREE"].includes(s),
};

function formatDateTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function DiscussionCommissionPanel({ contexte, dossierId, dossierStatut, canOpen = true }: Props) {
  const { t } = useTranslation(["explication", "roles"]);
  const { user, hasPermission } = useAuth();
  const [items, setItems] = useState<DemandeExplicationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [destinataire, setDestinataire] = useState<ExplicationRoleDestinataire>("DGD");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replying, setReplying] = useState<number | null>(null);
  const [closing, setClosing] = useState<number | null>(null);

  const isCommissionMember = useMemo(() => {
    if (!user) return false;
    if (hasPermission("demande.explication.view")) return true;
    return COMMISSION_ROLES.includes(user.role);
  }, [user, hasPermission]);

  const canCreateByRole = useMemo(() => {
    if (!isCommissionMember) return false;
    if (hasPermission("demande.explication.create")) return true;
    return COMMISSION_ROLES.includes(user!.role);
  }, [user, hasPermission, isCommissionMember]);

  const statutOk = STATUTS_AUTORISES[contexte](dossierStatut);
  const canOpenThread = canOpen && canCreateByRole && statutOk;

  const reload = async () => {
    if (!dossierId) return;
    setLoading(true);
    try {
      const data = await demandeExplicationApi.list(contexte, dossierId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      // 403 → masquer silencieusement, sinon toast
      const status = (e as any)?.status;
      if (status !== 403) {
        toast({ title: t("explication:error.load"), description: formatApiErrorMessage(e), variant: "destructive" });
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCommissionMember && dossierId) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contexte, dossierId, isCommissionMember]);

  if (!isCommissionMember || !dossierId) return null;

  const handleCreate = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await demandeExplicationApi.create({ contexte, dossierId, roleDestinataire: destinataire, message: message.trim() });
      toast({ title: t("explication:success.created") });
      setShowForm(false);
      setMessage("");
      setDestinataire("DGD");
      await reload();
    } catch (e) {
      toast({ title: t("explication:error.create"), description: formatApiErrorMessage(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (id: number) => {
    const draft = (replyDrafts[id] || "").trim();
    if (!draft) return;
    setReplying(id);
    try {
      await demandeExplicationApi.reply(id, draft);
      toast({ title: t("explication:success.replied") });
      setReplyDrafts((d) => ({ ...d, [id]: "" }));
      await reload();
    } catch (e) {
      toast({ title: t("explication:error.reply"), description: formatApiErrorMessage(e), variant: "destructive" });
    } finally {
      setReplying(null);
    }
  };

  const handleClose = async (id: number) => {
    setClosing(id);
    try {
      await demandeExplicationApi.fermer(id);
      toast({ title: t("explication:success.closed") });
      await reload();
    } catch (e) {
      toast({ title: t("explication:error.close"), description: formatApiErrorMessage(e), variant: "destructive" });
    } finally {
      setClosing(null);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              {t("explication:panel.title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{t("explication:panel.subtitle")}</p>
          </div>
          {canOpenThread && !showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 me-1" />
              {t("explication:action.ouvrir")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="grid sm:grid-cols-[200px_1fr] gap-3">
              <div>
                <Label className="text-xs">{t("explication:form.destinataire_label")}</Label>
                <Select value={destinataire} onValueChange={(v) => setDestinataire(v as ExplicationRoleDestinataire)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("explication:form.destinataire_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_DESTINATAIRE.map((r) => (
                      <SelectItem key={r} value={r}>{t(`roles:${r}`, r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("explication:form.message_label")}</Label>
                <Textarea
                  className="mt-1 min-h-[80px]"
                  maxLength={2000}
                  placeholder={t("explication:form.message_placeholder")}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setMessage(""); }}>
                {t("explication:action.annuler")}
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={submitting || !message.trim()}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1" /> : <Send className="h-3.5 w-3.5 me-1" />}
                {t("explication:action.envoyer")}
              </Button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("explication:panel.loading")}
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground italic">{t("explication:panel.empty")}</p>
        )}

        {items.map((thread) => {
          const isOpen = thread.statut === "OUVERTE";
          const canCloseThread = isOpen && !!user && (user.userId === thread.auteurId || user.role === "PRESIDENT");
          return (
            <div key={thread.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-start gap-3 p-3 border-b bg-muted/20">
                <MessageCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {t("explication:destinataire", { role: t(`roles:${thread.roleDestinataire}`, thread.roleDestinataire) })}
                    </Badge>
                    <Badge className={`text-[10px] ${isOpen ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>
                      {t(`explication:statut.${thread.statut}`)}
                    </Badge>
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{thread.messageInitial}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {t("explication:auteur_ouverture", { name: thread.auteurNom })}
                    {" · "}
                    {formatDateTime(thread.dateOuverture)}
                  </p>
                </div>
                {canCloseThread && (
                  <Button size="sm" variant="ghost" onClick={() => handleClose(thread.id)} disabled={closing === thread.id}>
                    {closing === thread.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                    <span className="ms-1 text-xs">{t("explication:action.fermer")}</span>
                  </Button>
                )}
              </div>

              {thread.messages?.length > 0 && (
                <div className="p-3 space-y-2">
                  {thread.messages.map((m) => (
                    <div key={m.id} className="rounded border border-muted bg-background p-2">
                      <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {m.auteurNom} ({t(`roles:${m.roleAuteur}`, m.roleAuteur)}) · {formatDateTime(m.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {isOpen && (
                <div className="p-3 border-t bg-muted/10 space-y-2">
                  <Textarea
                    placeholder={t("explication:form.reponse_placeholder")}
                    value={replyDrafts[thread.id] || ""}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [thread.id]: e.target.value }))}
                    className="min-h-[60px]"
                    maxLength={2000}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => handleReply(thread.id)} disabled={replying === thread.id || !(replyDrafts[thread.id] || "").trim()}>
                      {replying === thread.id ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1" /> : <Send className="h-3.5 w-3.5 me-1" />}
                      {t("explication:action.repondre")}
                    </Button>
                  </div>
                </div>
              )}

              {!isOpen && thread.dateFermeture && (
                <div className="px-3 py-2 border-t bg-muted/10 text-[10px] text-muted-foreground flex items-center gap-1">
                  <X className="h-3 w-3" /> {t("explication:ferme_le", { date: formatDateTime(thread.dateFermeture) })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default DiscussionCommissionPanel;
