import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StarRating } from "@/components/feedback/StarRating";
import { useAuth } from "@/contexts/AuthContext";
import { useSmartBack } from "@/hooks/useSmartBack";
import { usePageTitle } from "@/hooks/usePageTitle";
import { feedbackApi, formatApiErrorMessage, isApiError, type EnqueteDto } from "@/lib/api";
import { buildReponseRequest, invalidateEnquetesEnCours, questionsSansReponse, type ReponseSaisie } from "@/lib/enquetes";
import { formatDate } from "@/i18n/format";

type Etat = "loading" | "ready" | "unavailable" | "sent" | "already" | "forbidden";

/** Réponse à une enquête de satisfaction ouverte à mon profil (lien du bandeau et de la notification). */
const SatisfactionEnqueteReponse = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(["feedback", "common"]);
  usePageTitle("feedback:reponse.page_title");
  const { user } = useAuth();
  const smartBack = useSmartBack("/dashboard");
  const [enquete, setEnquete] = useState<EnqueteDto | null>(null);
  const [etat, setEtat] = useState<Etat>("loading");
  const [reponses, setReponses] = useState<Record<number, ReponseSaisie>>({});
  const [manquantes, setManquantes] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEtat("loading");
    // Les questions viennent de la liste « en cours » : une enquête absente est close, déjà répondue ou hors profil.
    feedbackApi.enquetesEnCours()
      .then((list) => {
        const found = (list || []).find((e) => String(e.id) === id) || null;
        setEnquete(found);
        setEtat(found ? "ready" : "unavailable");
      })
      .catch((e) => { setError(formatApiErrorMessage(e)); setEtat("unavailable"); });
  }, [id]);

  const setReponse = (questionId: number, r: ReponseSaisie) => {
    setReponses((cur) => ({ ...cur, [questionId]: { ...cur[questionId], ...r } }));
    setManquantes((cur) => cur.filter((q) => q !== questionId));
  };

  const submit = async () => {
    if (!enquete) return;
    const questions = [...enquete.questions].sort((a, b) => a.ordre - b.ordre);
    const missing = questionsSansReponse(questions, reponses);
    setManquantes(missing);
    if (missing.length) return;
    setSending(true);
    setError(null);
    try {
      await feedbackApi.repondre(enquete.id, buildReponseRequest(questions, reponses));
      invalidateEnquetesEnCours(user?.userId);
      setEtat("sent");
    } catch (e) {
      if (isApiError(e) && e.status === 409) { invalidateEnquetesEnCours(user?.userId); setEtat("already"); }
      else if (isApiError(e) && e.status === 403) setEtat("forbidden");
      else setError(formatApiErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const message = (key: string) => (
    <Card><CardContent className="p-8 text-center space-y-3">
      {etat === "sent" ? <CheckCircle2 className="h-10 w-10 text-primary mx-auto" /> : <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto" />}
      <p className="font-medium">{t(key)}</p>
      {error && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
      <Button variant="outline" onClick={smartBack}><ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />{t("common:actions.back")}</Button>
    </CardContent></Card>
  );

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {etat === "loading" && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {etat === "unavailable" && message("feedback:reponse.unavailable")}
        {etat === "sent" && message("feedback:reponse.sent")}
        {etat === "already" && message("feedback:reponse.already")}
        {etat === "forbidden" && message("feedback:reponse.forbidden")}
        {etat === "ready" && enquete && (
          <>
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" onClick={smartBack} aria-label={t("common:actions.back")}><ArrowLeft className="h-5 w-5 rtl:rotate-180" /></Button>
              <div>
                <h1 className="text-2xl font-bold">{enquete.titre}</h1>
                <p className="text-sm text-muted-foreground">{t("feedback:reponse.periode", { debut: formatDate(enquete.dateDebut), fin: formatDate(enquete.dateFin) })}</p>
                {enquete.description && <p className="text-sm mt-2 whitespace-pre-wrap">{enquete.description}</p>}
              </div>
            </div>
            {[...enquete.questions].sort((a, b) => a.ordre - b.ordre).map((q, i) => {
              const missing = manquantes.includes(q.id);
              return (
                <Card key={q.id} className={missing ? "border-destructive" : undefined}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">
                      {i + 1}. {q.libelle}{q.obligatoire && <span className="text-destructive"> *</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {q.type === "NOTE" && <StarRating value={reponses[q.id]?.note} onChange={(n) => setReponse(q.id, { note: n })} label={q.libelle} />}
                    {q.type === "TEXTE" && (
                      <Textarea rows={3} maxLength={2000} aria-label={q.libelle} value={reponses[q.id]?.texte ?? ""} onChange={(e) => setReponse(q.id, { texte: e.target.value })} />
                    )}
                    {q.type === "CHOIX" && (
                      <RadioGroup value={reponses[q.id]?.texte ?? ""} onValueChange={(v) => setReponse(q.id, { texte: v })} aria-label={q.libelle}>
                        {(q.options || []).map((o, oi) => (
                          <div key={o} className="flex items-center gap-2">
                            <RadioGroupItem id={`q${q.id}-o${oi}`} value={o} />
                            <Label htmlFor={`q${q.id}-o${oi}`} className="font-normal">{o}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                    {missing && <p className="text-xs text-destructive">{t("feedback:reponse.required")}</p>}
                  </CardContent>
                </Card>
              );
            })}
            {error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
            {manquantes.length > 0 && <p role="alert" className="text-sm text-destructive">{t("feedback:reponse.missing", { count: manquantes.length })}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={smartBack} disabled={sending}>{t("common:actions.cancel")}</Button>
              <Button onClick={submit} disabled={sending}>
                {sending && <Loader2 className="h-4 w-4 animate-spin me-2" />}{t("feedback:reponse.send")}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SatisfactionEnqueteReponse;
