import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { feedbackApi, formatApiErrorMessage, FEEDBACK_CATEGORIES, type FeedbackCategorie } from "@/lib/api";
import { showSuccess } from "@/lib/feedback";
import { StarRating } from "./StarRating";

/** Processus proposés comme sujet facultatif d'un avis. */
const PROCESSUS = ["CORRECTION", "MISE_EN_PLACE", "UTILISATION", "TRANSFERT", "AVENANT", "CLOTURE"] as const;
const NONE = "__none__";

/** Bouton permanent « Donner mon avis » (feedback.submit) : note, sujet, commentaire, page courante. */
export function FeedbackButton({ compact }: { compact?: boolean }) {
  const { t } = useTranslation(["feedback", "common"]);
  const { hasPermission } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<number | null>(null);
  const [categorie, setCategorie] = useState<FeedbackCategorie | "">("");
  const [processus, setProcessus] = useState<string>(NONE);
  const [commentaire, setCommentaire] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasPermission("feedback.submit")) return null;

  const reset = () => { setNote(null); setCategorie(""); setProcessus(NONE); setCommentaire(""); setError(null); };

  const send = async () => {
    if (note == null || !categorie) return;
    setSending(true);
    setError(null);
    try {
      await feedbackApi.envoyerRetour({
        note,
        categorie,
        processus: processus === NONE ? null : processus,
        page: location.pathname,
        commentaire: commentaire.trim() || null,
      });
      showSuccess(t("feedback:dialog.sent"));
      setOpen(false);
      reset();
    } catch (e) {
      setError(formatApiErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button variant="outline" size={compact ? "icon" : "sm"} className={compact ? "h-8 w-8" : "gap-2"} onClick={() => setOpen(true)} aria-label={t("feedback:button")} title={t("feedback:button")}>
        <MessageSquareHeart className="h-4 w-4" />
        {!compact && <span>{t("feedback:button")}</span>}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!sending) setOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("feedback:dialog.title")}</DialogTitle>
            <DialogDescription>{t("feedback:dialog.intro")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("feedback:dialog.note")} *</Label>
              <StarRating value={note} onChange={setNote} label={t("feedback:dialog.note")} />
            </div>
            <div className="space-y-1">
              <Label>{t("feedback:dialog.categorie")} *</Label>
              <Select value={categorie || undefined} onValueChange={(v) => setCategorie(v as FeedbackCategorie)}>
                <SelectTrigger><SelectValue placeholder={t("feedback:dialog.categorie_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {FEEDBACK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`feedback:categories.${c}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("feedback:dialog.processus")}</Label>
              <Select value={processus} onValueChange={setProcessus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("feedback:dialog.processus_none")}</SelectItem>
                  {PROCESSUS.map((p) => <SelectItem key={p} value={p}>{t(`feedback:processus.${p}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="feedback-commentaire">{t("feedback:dialog.commentaire")}</Label>
              <Textarea id="feedback-commentaire" rows={4} maxLength={2000} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder={t("feedback:dialog.commentaire_placeholder")} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>{t("common:actions.cancel")}</Button>
            <Button onClick={send} disabled={sending || note == null || !categorie}>
              {sending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("feedback:dialog.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
