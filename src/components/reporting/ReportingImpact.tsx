import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  reportingApi, formatApiErrorMessage,
  type ReportingParams, type ImpactReportDto, type ImpactAvantApresDto, type BeneficiairesReportDto,
  type BeneficiairesLigneDto, type ReportingReferenceDto,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAmount, formatDate, formatNumber } from "@/i18n/format";
import { orNA, arrangeLines, formatCivilDate } from "@/lib/reportingValues";
import { ExportBlocButton } from "./ReportingExport";

type N = number | null | undefined;
const COLORS = ["hsl(153, 60%, 28%)", "hsl(43, 90%, 55%)", "hsl(200, 70%, 50%)", "hsl(0, 70%, 55%)", "hsl(280, 50%, 55%)", "hsl(30, 80%, 55%)"];

/** Formateurs : une valeur nulle s'affiche « n/d », jamais « 0 ». */
function useNd() {
  const { t, i18n } = useTranslation();
  const nd = t("reporting:impact.nd") as string;
  return {
    nd,
    money: (v: N) => orNA(v, (n) => formatAmount(n), nd),
    num: (v: N) => orNA(v, (n) => formatNumber(n), nd),
    pct: (v: N) => orNA(v, (n) => `${formatNumber(n, { maximumFractionDigits: 1 })} %`, nd),
    jours: (v: N) => orNA(v, (n) => t("reporting:impact.jours", { n: formatNumber(n, { maximumFractionDigits: 1 }) }) as string, nd),
    civil: (s?: string | null) => formatCivilDate(s, i18n.language?.startsWith("ar") ? "ar" : "fr-FR", nd),
  };
}

function useReport<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setLoading(true);
    setError(null);
    loader()
      .then(setData)
      .catch((e) => { setError(formatApiErrorMessage(e)); setData(null); })
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps);
  return { data, loading, error, reload: run };
}

function State({ loading, error, onRetry, children }: { loading: boolean; error: string | null; onRetry: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return (
    <Card className="border-destructive/50"><CardContent className="p-6 text-center space-y-3">
      <p className="text-destructive font-medium">{t("reporting:page.load_error_title")}</p>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{error}</p>
      <Button variant="outline" onClick={onRetry}>{t("reporting:page.retry")}</Button>
    </CardContent></Card>
  );
  return <>{children}</>;
}

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">{label}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Definitions({ items }: { items?: string[] | null }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
      <p className="font-medium text-foreground flex items-center gap-1"><Info className="h-3.5 w-3.5" />{t("reporting:impact.definitions")}</p>
      <ul className="list-disc ps-5 space-y-0.5">{items.map((d, i) => <li key={i}>{d}</li>)}</ul>
    </div>
  );
}

function TabHeader({ params, bloc, note }: { params: ReportingParams; bloc: "IMPACT" | "BENEFICIAIRES"; note?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="text-sm text-muted-foreground">{note}</div>
      <ExportBlocButton params={params} bloc={bloc} />
    </div>
  );
}

// ── Impact ──────────────────────────────────────────────

export function ImpactSection({ params }: { params: ReportingParams }) {
  const { t } = useTranslation();
  const f = useNd();
  const { data, loading, error, reload } = useReport(() => reportingApi.getImpact(params), [JSON.stringify(params)]);
  const montants = data?.montants;
  const montantsData = montants
    ? (["demandes", "retenus", "valides", "consommes", "ajustes", "annules", "clotures"] as const)
      .filter((k) => montants[k] != null)
      .map((k) => ({ name: t(`reporting:impact.montants.${k}`) as string, value: montants[k] as number }))
    : [];
  const taux = data?.tauxUtilisation;

  return (
    <div className="space-y-4">
      <TabHeader params={params} bloc="IMPACT" />
      <State loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.processus.map((p) => (
                <Card key={p.code}>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{p.libelle}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
                      <span className="text-muted-foreground">{t("reporting:impact.processus.deposes")}</span><span className="text-end font-medium">{f.num(p.deposes)}</span>
                      <span className="text-muted-foreground">{t("reporting:impact.processus.traites")}</span><span className="text-end font-medium">{f.num(p.traites)}</span>
                      <span className="text-muted-foreground">{t("reporting:impact.processus.valides")}</span><span className="text-end font-medium">{f.num(p.valides)}</span>
                      <span className="text-muted-foreground">{t("reporting:impact.processus.rejetes")}</span><span className="text-end font-medium">{f.num(p.rejetes)}</span>
                      <span className="text-muted-foreground">{t("reporting:impact.processus.avec_complements")}</span><span className="text-end font-medium">{f.num(p.avecComplements)}</span>
                    </div>
                    <div className="border-t border-border pt-2 grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
                      <span className="text-muted-foreground">{t("reporting:impact.processus.taux_validation")}</span><span className="text-end font-semibold text-primary">{f.pct(p.tauxValidationPct)}</span>
                      <span className="text-muted-foreground">{t("reporting:impact.processus.taux_rejet")}</span><span className="text-end font-semibold">{f.pct(p.tauxRejetPct)}</span>
                      <span className="text-muted-foreground">{t("reporting:impact.processus.taux_complements")}</span><span className="text-end font-semibold">{f.pct(p.tauxComplementsPct)}</span>
                      <span className="text-muted-foreground">{t("reporting:impact.processus.delai_complements")}</span><span className="text-end font-semibold">{f.jours(p.delaiReponseComplementsJours)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("reporting:impact.phases.title")}</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("reporting:impact.phases.processus")}</TableHead>
                      <TableHead>{t("reporting:impact.phases.phase")}</TableHead>
                      <TableHead className="text-end">{t("reporting:impact.phases.nb")}</TableHead>
                      <TableHead className="text-end">{t("reporting:impact.phases.moyenne")}</TableHead>
                      <TableHead className="text-end">{t("reporting:impact.phases.mediane")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.phases.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>
                    ) : data.phases.map((ph, i) => (
                      <TableRow key={`${ph.processus}-${ph.phase}-${i}`}>
                        <TableCell>{data.processus.find((p) => p.code === ph.processus)?.libelle || ph.processus}</TableCell>
                        <TableCell>{ph.phase}</TableCell>
                        <TableCell className="text-end tabular-nums">{f.num(ph.nbDossiers)}</TableCell>
                        <TableCell className="text-end tabular-nums">{f.jours(ph.moyenneJours)}</TableCell>
                        <TableCell className="text-end tabular-nums">{f.jours(ph.medianeJours)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">{t("reporting:impact.montants.title")}</CardTitle></CardHeader>
                <CardContent>
                  {montantsData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{f.nd}</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={montantsData} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => formatNumber(v, { maximumFractionDigits: 0 })} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => formatAmount(v)} />
                        <Bar dataKey="value" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">{t("reporting:impact.taux.title")}</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  {[
                    { key: "tva", pct: taux?.tvaInterieurePct, accorde: taux?.accordeTvaInterieure, consomme: taux?.consommeTvaInterieure },
                    { key: "douane", pct: taux?.douanePct, accorde: taux?.accordeDouane, consomme: taux?.consommeDouane },
                    { key: "global", pct: taux?.globalPct },
                  ].map((g) => (
                    <div key={g.key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{t(`reporting:impact.taux.${g.key}`)}</span>
                        <span className="tabular-nums font-semibold">{f.pct(g.pct)}</span>
                      </div>
                      <Progress value={g.pct == null ? 0 : Math.max(0, Math.min(100, g.pct))} aria-label={t(`reporting:impact.taux.${g.key}`) as string} />
                      {"accorde" in g && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {t("reporting:impact.taux.detail", { consomme: f.money(g.consomme), accorde: f.money(g.accorde) })}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Definitions items={data.definitions} />
          </>
        )}
      </State>
    </div>
  );
}

// ── Avant / après ───────────────────────────────────────

function formatWithUnit(v: N, unite: string | null | undefined, f: ReturnType<typeof useNd>) {
  const u = (unite || "").trim();
  if (/^(%|pct|pourcentage)$/i.test(u)) return f.pct(v);
  if (/^(jours?|j)$/i.test(u)) return f.jours(v);
  if (/^mru$/i.test(u)) return f.money(v);
  return orNA(v, (n) => `${formatNumber(n, { maximumFractionDigits: 2 })}${u ? ` ${u}` : ""}`, f.nd);
}

function ReferenceDialog({ reference, onClose, onSaved }: { reference: ReportingReferenceDto | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [valeur, setValeur] = useState("");
  const [periode, setPeriode] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValeur(reference?.valeur != null ? String(reference.valeur) : "");
    setPeriode(reference?.periodeSource || "");
    setCommentaire(reference?.commentaire || "");
    setError(null);
  }, [reference]);

  const save = async () => {
    if (!reference || valeur.trim() === "" || Number.isNaN(Number(valeur))) return;
    setSaving(true);
    setError(null);
    try {
      await reportingApi.saveReference({ code: reference.code, valeur: Number(valeur), periodeSource: periode.trim() || null, commentaire: commentaire.trim() || null });
      toast({ title: t("reporting:impact.references.saved") as string });
      onSaved();
    } catch (e) {
      setError(formatApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!reference} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{reference?.libelle}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ref-valeur">{t("reporting:impact.references.valeur")}{reference?.unite ? ` (${reference.unite})` : ""} *</Label>
            <Input id="ref-valeur" type="number" step="any" value={valeur} onChange={(e) => setValeur(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ref-periode">{t("reporting:impact.references.periode")}</Label>
            <Input id="ref-periode" value={periode} onChange={(e) => setPeriode(e.target.value)} placeholder={t("reporting:impact.references.periode_placeholder") as string} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ref-commentaire">{t("reporting:impact.references.commentaire")}</Label>
            <Textarea id="ref-commentaire" rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common:actions.cancel")}</Button>
          <Button onClick={save} disabled={saving || valeur.trim() === "" || Number.isNaN(Number(valeur))}>
            {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReferencesCard({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const f = useNd();
  const { data, loading, error, reload } = useReport(() => reportingApi.getReferences(), []);
  const [editing, setEditing] = useState<ReportingReferenceDto | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const remove = async (code: string) => {
    setDeleting(code);
    try {
      await reportingApi.deleteReference(code);
      toast({ title: t("reporting:impact.references.deleted") as string });
      reload();
      onChanged();
    } catch (e) {
      toast({ variant: "destructive", title: t("common:states.error") as string, description: formatApiErrorMessage(e) });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("reporting:impact.references.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("reporting:impact.references.hint")}</p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <State loading={loading} error={error} onRetry={reload}>
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("reporting:impact.avant_apres.indicateur")}</TableHead>
                <TableHead className="text-end">{t("reporting:impact.references.valeur")}</TableHead>
                <TableHead>{t("reporting:impact.references.periode")}</TableHead>
                <TableHead>{t("reporting:impact.references.date_saisie")}</TableHead>
                <TableHead className="text-end">{t("reporting:impact.references.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((r) => (
                <TableRow key={r.code}>
                  <TableCell>
                    <div className="font-medium">{r.libelle}</div>
                    {r.commentaire && <div className="text-xs text-muted-foreground">{r.commentaire}</div>}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{formatWithUnit(r.valeur, r.unite, f)}</TableCell>
                  <TableCell>{r.periodeSource || f.nd}</TableCell>
                  <TableCell>{r.dateSaisie ? formatDate(r.dateSaisie) : f.nd}</TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)} aria-label={t("reporting:impact.references.edit") as string}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {r.valeur != null && (
                      <Button size="sm" variant="ghost" disabled={deleting === r.code} onClick={() => remove(r.code)} aria-label={t("reporting:impact.references.delete") as string}>
                        {deleting === r.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </State>
      </CardContent>
      <ReferenceDialog reference={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); onChanged(); }} />
    </Card>
  );
}

export function AvantApresSection({ params }: { params: ReportingParams }) {
  const { t } = useTranslation();
  const f = useNd();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("reporting.reference.manage");
  const { data, loading, error, reload } = useReport(() => reportingApi.getImpact(params), [JSON.stringify(params)]);
  const rows: ImpactAvantApresDto[] = data?.avantApres || [];

  const note = data && (data.dateBascule
    ? t("reporting:impact.avant_apres.bascule", { date: f.civil(data.dateBascule) })
    : t("reporting:impact.avant_apres.bascule_absente"));

  return (
    <div className="space-y-4">
      <TabHeader params={params} bloc="IMPACT" note={note} />
      <State loading={loading} error={error} onRetry={reload}>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reporting:impact.avant_apres.indicateur")}</TableHead>
                  <TableHead className="text-end">{t("reporting:impact.avant_apres.avant")}</TableHead>
                  <TableHead className="text-end">{t("reporting:impact.avant_apres.apres")}</TableHead>
                  <TableHead className="text-end">{t("reporting:impact.avant_apres.variation")}</TableHead>
                  <TableHead>{t("reporting:impact.avant_apres.source")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.libelle}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatWithUnit(r.avant, r.unite, f)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatWithUnit(r.apres, r.unite, f)}</TableCell>
                    <TableCell className={`text-end tabular-nums font-semibold ${r.variationPct == null ? "" : r.variationPct < 0 ? "text-primary" : "text-foreground"}`}>
                      {r.variationPct == null ? f.nd : `${r.variationPct > 0 ? "+" : ""}${f.pct(r.variationPct)}`}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[r.sourceAvant, r.periodeAvant].filter(Boolean).join(" — ") || f.nd}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {data && <Definitions items={data.definitions} />}
      </State>
      {canManage && <ReferencesCard onChanged={reload} />}
    </div>
  );
}

// ── Bénéficiaires ───────────────────────────────────────

function RepartitionCard({ title, lignes, kind }: { title: string; lignes: BeneficiairesLigneDto[]; kind: "pie" | "bar" }) {
  const { t } = useTranslation();
  const f = useNd();
  const rows = arrangeLines(lignes);
  const chartData = rows.filter((l) => (l.nbBeneficiaires ?? 0) > 0).map((l) => ({ name: l.libelle, value: l.nbBeneficiaires as number }));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            {kind === "pie" ? (
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} label={({ value }) => formatNumber(value)}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Bar dataKey="value" name={t("reporting:beneficiaires.nb_beneficiaires") as string} fill={COLORS[2]} radius={[0, 4, 4, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
        <div className="overflow-x-auto">
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("reporting:beneficiaires.cle")}</TableHead>
                <TableHead className="text-end">{t("reporting:beneficiaires.nb_beneficiaires")}</TableHead>
                <TableHead className="text-end">{t("reporting:beneficiaires.nb_credits")}</TableHead>
                <TableHead className="text-end">{t("reporting:beneficiaires.accorde")}</TableHead>
                <TableHead className="text-end">{t("reporting:beneficiaires.consomme")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>
              ) : rows.map((l) => (
                <TableRow key={l.cle}>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell className="text-end tabular-nums">{f.num(l.nbBeneficiaires)}</TableCell>
                  <TableCell className="text-end tabular-nums">{f.num(l.nbCredits)}</TableCell>
                  <TableCell className="text-end tabular-nums">{f.money(l.montantAccorde)}</TableCell>
                  <TableCell className="text-end tabular-nums">{f.money(l.montantConsomme)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function BeneficiairesSection({ params }: { params: ReportingParams }) {
  const { t } = useTranslation();
  const f = useNd();
  const { data, loading, error, reload } = useReport<BeneficiairesReportDto>(() => reportingApi.getBeneficiaires(params), [JSON.stringify(params)]);
  const annees = (data?.parAnnee || []).map((a) => ({ ...a, label: String(a.annee) }));

  return (
    <div className="space-y-4">
      <TabHeader params={params} bloc="BENEFICIAIRES" />
      <State loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label={t("reporting:beneficiaires.total_beneficiaires")} value={f.num(data.totalBeneficiaires)} />
              <Tile label={t("reporting:beneficiaires.total_credits")} value={f.num(data.totalCredits)} />
              <Tile label={t("reporting:beneficiaires.accorde")} value={f.money(data.montantAccorde)} />
              <Tile label={t("reporting:beneficiaires.consomme")} value={f.money(data.montantConsomme)} />
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("reporting:beneficiaires.par_annee")}</CardTitle></CardHeader>
              <CardContent>
                {annees.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t("reporting:charts.empty")}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={annees} margin={{ left: 0, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="beneficiaires" name={t("reporting:beneficiaires.nb_beneficiaires") as string} stroke={COLORS[0]} strokeWidth={2} />
                      <Line type="monotone" dataKey="nouveauxBeneficiaires" name={t("reporting:beneficiaires.nouveaux") as string} stroke={COLORS[1]} strokeWidth={2} />
                      <Line type="monotone" dataKey="nbCredits" name={t("reporting:beneficiaires.nb_credits") as string} stroke={COLORS[2]} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <RepartitionCard title={t("reporting:beneficiaires.par_nature")} lignes={data.parNature || []} kind="pie" />
              <RepartitionCard title={t("reporting:beneficiaires.par_financement")} lignes={data.parFinancement || []} kind="pie" />
              <RepartitionCard title={t("reporting:beneficiaires.par_categorie")} lignes={data.parCategorie || []} kind="bar" />
              <RepartitionCard title={t("reporting:beneficiaires.par_secteur")} lignes={data.parSecteur || []} kind="bar" />
            </div>

            <Definitions items={data.definitions} />
          </>
        )}
      </State>
    </div>
  );
}
