import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ClipboardList, Loader2, Lock, MoreHorizontal, Pencil, Plus, RefreshCw, Repeat, Send, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { RowNumberHead, RowNumberCell } from "@/components/ui/row-number";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";
import { showApiError, showSuccess } from "@/lib/feedback";
import {
  feedbackApi, formatApiErrorMessage, PROFILS_CIBLES,
  type EnqueteDto, type EnqueteRequest, type EnqueteQuestionRequest, type EnqueteStatut, type ProfilCible, type QuestionEnqueteType,
} from "@/lib/api";
import { buildEnqueteRequest, enqueteFormError } from "@/lib/enquetes";
import { formatDate } from "@/i18n/format";

const QUESTION_TYPES: QuestionEnqueteType[] = ["NOTE", "TEXTE", "CHOIX"];
const STATUT_VARIANT: Record<EnqueteStatut, "secondary" | "default" | "outline"> = { BROUILLON: "outline", PUBLIEE: "default", CLOTUREE: "secondary" };

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const emptyQuestion = (): EnqueteQuestionRequest => ({ libelle: "", type: "NOTE", categorie: "", options: [], obligatoire: true });
const emptyEnquete = (): EnqueteRequest => ({ titre: "", description: "", dateDebut: today(), dateFin: inDays(30), profilsCibles: [], questions: [emptyQuestion()] });

/** Gestion des enquêtes de satisfaction (feedback.enquete.manage). */
const SatisfactionEnquetes = () => {
  const { t } = useTranslation(["feedback", "common"]);
  usePageTitle("feedback:enquetes.title");
  const [items, setItems] = useState<EnqueteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EnqueteDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EnqueteRequest>(emptyEnquete);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<EnqueteDto | null>(null);
  const [relance, setRelance] = useState<{ enquete: EnqueteDto; dateDebut: string; dateFin: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await feedbackApi.list();
      setItems([...list].sort((a, b) => (b.dateDebut || "").localeCompare(a.dateDebut || "")));
    } catch (e) {
      showApiError(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openForm = (e: EnqueteDto | null) => {
    setEditing(e);
    setForm(e ? {
      titre: e.titre, description: e.description ?? "", dateDebut: e.dateDebut?.slice(0, 10), dateFin: e.dateFin?.slice(0, 10),
      profilsCibles: [...e.profilsCibles],
      questions: [...e.questions].sort((a, b) => a.ordre - b.ordre).map((q) => ({ libelle: q.libelle, type: q.type, categorie: q.categorie ?? "", options: q.options ?? [], obligatoire: !!q.obligatoire })),
    } : emptyEnquete());
    setFormError(null);
    setFormOpen(true);
  };

  const setQuestion = (i: number, patch: Partial<EnqueteQuestionRequest>) =>
    setForm((f) => ({ ...f, questions: f.questions.map((q, qi) => (qi === i ? { ...q, ...patch } : q)) }));
  const moveQuestion = (i: number, d: -1 | 1) =>
    setForm((f) => {
      const qs = [...f.questions];
      const j = i + d;
      if (j < 0 || j >= qs.length) return f;
      [qs[i], qs[j]] = [qs[j], qs[i]];
      return { ...f, questions: qs };
    });
  const toggleProfil = (p: ProfilCible) =>
    setForm((f) => ({ ...f, profilsCibles: f.profilsCibles.includes(p) ? f.profilsCibles.filter((x) => x !== p) : [...f.profilsCibles, p] }));

  const errorText = (err: ReturnType<typeof enqueteFormError>) => {
    if (!err) return null;
    if (typeof err === "string") return t(`feedback:enquetes.errors.${err}`);
    return t(`feedback:enquetes.errors.question_${err.error}`, { n: err.question + 1 });
  };

  const save = async () => {
    const err = enqueteFormError(form);
    if (err) { setFormError(errorText(err)); return; }
    setSaving(true);
    setFormError(null);
    try {
      const body = buildEnqueteRequest(form);
      if (editing) await feedbackApi.update(editing.id, body);
      else await feedbackApi.create(body);
      showSuccess(t("feedback:enquetes.saved"));
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(formatApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const run = async (e: EnqueteDto, action: () => Promise<unknown>, successKey: string) => {
    setBusyId(e.id);
    try {
      await action();
      showSuccess(t(successKey));
      await load();
    } catch (err) {
      showApiError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6 text-primary" />{t("feedback:enquetes.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("feedback:enquetes.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openForm(null)}><Plus className="h-4 w-4 me-1" />{t("feedback:enquetes.new")}</Button>
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 me-1 ${loading ? "animate-spin" : ""}`} />{t("common:actions.refresh")}</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <RowNumberHead />
                  <TableHead>{t("feedback:enquetes.titre")}</TableHead>
                  <TableHead>{t("feedback:enquetes.periode")}</TableHead>
                  <TableHead>{t("feedback:enquetes.profils")}</TableHead>
                  <TableHead>{t("feedback:enquetes.statut")}</TableHead>
                  <TableHead className="text-end">{t("feedback:enquetes.reponses")}</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{t("feedback:enquetes.empty")}</TableCell></TableRow>
                ) : items.map((e, i) => (
                  <TableRow key={e.id}>
                    <RowNumberCell n={i + 1} />
                    <TableCell>
                      <div className="font-medium">{e.titre}</div>
                      <div className="text-xs text-muted-foreground">{t("feedback:enquetes.nb_questions", { count: e.questions?.length ?? 0 })}{e.enqueteOrigineId ? ` · ${t("feedback:enquetes.relance_de", { id: e.enqueteOrigineId })}` : ""}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(e.dateDebut)} → {formatDate(e.dateFin)}</TableCell>
                    <TableCell className="text-xs">{e.profilsCibles.map((p) => t(`feedback:profils.${p}`)).join(", ")}</TableCell>
                    <TableCell>
                      <Badge variant={STATUT_VARIANT[e.statut]}>{t(`feedback:statuts.${e.statut}`)}</Badge>
                      {e.statut === "PUBLIEE" && e.ouverte === false && <span className="ms-1 text-xs text-muted-foreground">({t("feedback:enquetes.hors_periode")})</span>}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{e.nbReponses ?? "—"}</TableCell>
                    <TableCell className="text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={busyId === e.id} aria-label={t("feedback:enquetes.actions")}>
                            {busyId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {e.statut === "BROUILLON" && (
                            <>
                              <DropdownMenuItem onClick={() => openForm(e)}><Pencil className="h-4 w-4 me-2" />{t("common:actions.edit")}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => run(e, () => feedbackApi.publier(e.id), "feedback:enquetes.published")}><Send className="h-4 w-4 me-2" />{t("feedback:enquetes.publier")}</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(e)}><Trash2 className="h-4 w-4 me-2" />{t("common:actions.delete")}</DropdownMenuItem>
                            </>
                          )}
                          {e.statut === "PUBLIEE" && (
                            <DropdownMenuItem onClick={() => run(e, () => feedbackApi.cloturer(e.id), "feedback:enquetes.closed")}><Lock className="h-4 w-4 me-2" />{t("feedback:enquetes.cloturer")}</DropdownMenuItem>
                          )}
                          {e.statut !== "BROUILLON" && (
                            <DropdownMenuItem onClick={() => setRelance({ enquete: e, dateDebut: today(), dateFin: inDays(30) })}><Repeat className="h-4 w-4 me-2" />{t("feedback:enquetes.relancer")}</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Création / modification (brouillon) */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!saving) setFormOpen(o); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t("feedback:enquetes.edit") : t("feedback:enquetes.new")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="enq-titre">{t("feedback:enquetes.titre")} *</Label>
              <Input id="enq-titre" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="enq-desc">{t("feedback:enquetes.description")}</Label>
              <Textarea id="enq-desc" rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="enq-debut">{t("feedback:enquetes.date_debut")} *</Label>
                <Input id="enq-debut" type="date" value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="enq-fin">{t("feedback:enquetes.date_fin")} *</Label>
                <Input id="enq-fin" type="date" value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("feedback:enquetes.profils")} *</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PROFILS_CIBLES.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.profilsCibles.includes(p)} onCheckedChange={() => toggleProfil(p)} />
                    {t(`feedback:profils.${p}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t("feedback:enquetes.questions")} *</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, questions: [...f.questions, emptyQuestion()] }))}>
                  <Plus className="h-4 w-4 me-1" />{t("feedback:enquetes.add_question")}
                </Button>
              </div>
              {form.questions.map((q, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold w-6">{i + 1}.</span>
                    <Input aria-label={t("feedback:enquetes.libelle")} placeholder={t("feedback:enquetes.libelle")} value={q.libelle} onChange={(e) => setQuestion(i, { libelle: e.target.value })} />
                    <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => moveQuestion(i, -1)} aria-label={t("feedback:enquetes.move_up")}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" disabled={i === form.questions.length - 1} onClick={() => moveQuestion(i, 1)} aria-label={t("feedback:enquetes.move_down")}><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" disabled={form.questions.length === 1} onClick={() => setForm((f) => ({ ...f, questions: f.questions.filter((_, qi) => qi !== i) }))} aria-label={t("common:actions.remove")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 ps-8">
                    <Select value={q.type} onValueChange={(v) => setQuestion(i, { type: v as QuestionEnqueteType })}>
                      <SelectTrigger aria-label={t("feedback:enquetes.type")}><SelectValue /></SelectTrigger>
                      <SelectContent>{QUESTION_TYPES.map((ty) => <SelectItem key={ty} value={ty}>{t(`feedback:question_types.${ty}`)}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input aria-label={t("feedback:enquetes.categorie")} placeholder={t("feedback:enquetes.categorie")} value={q.categorie ?? ""} onChange={(e) => setQuestion(i, { categorie: e.target.value })} />
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={!!q.obligatoire} onCheckedChange={(v) => setQuestion(i, { obligatoire: v })} />
                      {t("feedback:enquetes.obligatoire")}
                    </label>
                  </div>
                  {q.type === "CHOIX" && (
                    <div className="ps-8 space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("feedback:enquetes.options_hint")}</Label>
                      <Textarea rows={3} value={(q.options || []).join("\n")} onChange={(e) => setQuestion(i, { options: e.target.value.split("\n") })} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {formError && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>{t("common:actions.cancel")}</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}{t("common:actions.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relance : nouvelle période */}
      <Dialog open={!!relance} onOpenChange={(o) => { if (!o && busyId == null) setRelance(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("feedback:enquetes.relancer")} — {relance?.enquete.titre}</DialogTitle></DialogHeader>
          {relance && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rel-debut">{t("feedback:enquetes.date_debut")}</Label>
                <Input id="rel-debut" type="date" value={relance.dateDebut} onChange={(e) => setRelance({ ...relance, dateDebut: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rel-fin">{t("feedback:enquetes.date_fin")}</Label>
                <Input id="rel-fin" type="date" value={relance.dateFin} onChange={(e) => setRelance({ ...relance, dateFin: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelance(null)}>{t("common:actions.cancel")}</Button>
            <Button
              disabled={!relance || !relance.dateDebut || !relance.dateFin || relance.dateFin < relance.dateDebut || busyId != null}
              onClick={() => { if (!relance) return; const r = relance; setRelance(null); run(r.enquete, () => feedbackApi.relancer(r.enquete.id, { dateDebut: r.dateDebut, dateFin: r.dateFin }), "feedback:enquetes.relaunched"); }}
            >
              {t("feedback:enquetes.relancer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("feedback:enquetes.delete_title", { titre: toDelete?.titre ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("feedback:enquetes.delete_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const e = toDelete; setToDelete(null); if (e) run(e, () => feedbackApi.delete(e.id), "feedback:enquetes.deleted"); }}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default SatisfactionEnquetes;
