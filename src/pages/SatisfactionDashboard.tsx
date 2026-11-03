import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, MessageSquareQuote, Smile, Star } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportBlocButton } from "@/components/reporting/ReportingExport";
import { usePageTitle } from "@/hooks/usePageTitle";
import { feedbackApi, formatApiErrorMessage, type FeedbackTableauDeBordDto, type ReportingParams, type SatisfactionLigneDto } from "@/lib/api";
import { orNA } from "@/lib/reportingValues";
import { formatDate, formatNumber } from "@/i18n/format";

type N = number | null | undefined;

/** Tableau de bord de la satisfaction (feedback.dashboard.view) — commentaires sans nom d'auteur. */
const SatisfactionDashboard = () => {
  const { t } = useTranslation(["feedback", "reporting", "common"]);
  usePageTitle("feedback:dashboard.title");
  const nd = t("reporting:impact.nd") as string;
  const num = (v: N) => orNA(v, (n) => formatNumber(n), nd);
  const note = (v: N) => orNA(v, (n) => `${formatNumber(n, { maximumFractionDigits: 2 })} / 5`, nd);
  const pct = (v: N) => orNA(v, (n) => `${formatNumber(n, { maximumFractionDigits: 1 })} %`, nd);

  const now = new Date();
  const [fromDate, setFromDate] = useState(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(now.toISOString().slice(0, 10));
  const [params, setParams] = useState<ReportingParams>({});
  const [data, setData] = useState<FeedbackTableauDeBordDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const p: ReportingParams = {
      from: fromDate ? `${fromDate}T00:00:00Z` : undefined,
      to: toDate ? `${toDate}T23:59:59Z` : undefined,
    };
    setParams(p);
    setLoading(true);
    setError(null);
    try {
      setData(await feedbackApi.tableauDeBord(p.from, p.to));
    } catch (e) {
      setError(formatApiErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  /** Libellé traduit d'un code (processus, catégorie) ; un code inconnu reste affiché tel quel (A49). */
  const libelleLigne = (l: SatisfactionLigneDto, espace?: "categories" | "processus") =>
    espace ? t(`feedback:${espace}.${l.cle}`, { defaultValue: l.libelle || l.cle }) : l.libelle;

  const lignesTable = (title: string, lignes: SatisfactionLigneDto[] | null | undefined, espace?: "categories" | "processus") => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow>
              <TableHead>{t("feedback:dashboard.cle")}</TableHead>
              <TableHead className="text-end">{t("feedback:dashboard.nb_notes")}</TableHead>
              <TableHead className="text-end">{t("feedback:dashboard.note_moyenne")}</TableHead>
              <TableHead className="text-end">{t("feedback:dashboard.satisfaits")}</TableHead>
              <TableHead>{t("feedback:dashboard.distribution")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!lignes?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>
            ) : lignes.map((l) => {
              const total = (l.distribution || []).reduce((s, n) => s + (n || 0), 0);
              return (
                <TableRow key={l.cle}>
                  <TableCell className="font-medium">{libelleLigne(l, espace)}</TableCell>
                  <TableCell className="text-end tabular-nums">{num(l.nbNotes)}</TableCell>
                  <TableCell className="text-end tabular-nums">{note(l.noteMoyenne)}</TableCell>
                  <TableCell className="text-end tabular-nums">{pct(l.satisfaitsPct)}</TableCell>
                  <TableCell>
                    {total > 0 ? (
                      <div className="flex h-2.5 w-36 overflow-hidden rounded-full bg-muted" dir="ltr" title={(l.distribution || []).map((n, i) => `${i + 1}★ : ${n}`).join(" · ")}>
                        {(l.distribution || []).map((n, i) => (
                          <div key={i} style={{ width: `${(100 * (n || 0)) / total}%`, opacity: 0.35 + i * 0.16 }} className="bg-primary" />
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground text-xs">{nd}</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Smile className="h-6 w-6 text-primary" />{t("feedback:dashboard.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("feedback:dashboard.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="sat-from" className="text-xs">{t("feedback:dashboard.from")}</Label>
              <Input id="sat-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sat-to" className="text-xs">{t("feedback:dashboard.to")}</Label>
              <Input id="sat-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
            </div>
            <Button onClick={load} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin me-1" />}{t("feedback:dashboard.apply")}</Button>
            <ExportBlocButton params={params} bloc="SATISFACTION" />
          </div>
        </div>

        {loading && !data && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {error && (
          <Card className="border-destructive/50"><CardContent className="p-6 text-center space-y-3">
            <p className="text-destructive font-medium">{t("reporting:page.load_error_title")}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{error}</p>
            <Button variant="outline" onClick={load}>{t("reporting:page.retry")}</Button>
          </CardContent></Card>
        )}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">{t("feedback:dashboard.nb_avis")}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold tabular-nums">{num(data.nbAvis)}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-1"><Star className="h-4 w-4" />{t("feedback:dashboard.note_moyenne")}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold tabular-nums">{note(data.noteMoyenne)}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">{t("feedback:dashboard.satisfaits")}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold tabular-nums">{pct(data.satisfaitsPct)}</p><p className="text-xs text-muted-foreground">{t("feedback:dashboard.satisfaits_hint")}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("feedback:dashboard.evolution")}</CardTitle></CardHeader>
              <CardContent>
                {!data.evolution?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t("reporting:charts.empty")}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data.evolution} margin={{ left: 0, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="periode" />
                      <YAxis yAxisId="note" domain={[0, 5]} />
                      <YAxis yAxisId="nb" orientation="right" allowDecimals={false} />
                      <Tooltip formatter={(v: number) => formatNumber(v, { maximumFractionDigits: 2 })} />
                      <Legend />
                      <Line yAxisId="note" type="monotone" dataKey="noteMoyenne" name={t("feedback:dashboard.note_moyenne") as string} stroke="hsl(153, 60%, 28%)" strokeWidth={2} />
                      <Line yAxisId="nb" type="monotone" dataKey="nbNotes" name={t("feedback:dashboard.nb_notes") as string} stroke="hsl(43, 90%, 55%)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              {lignesTable(t("feedback:dashboard.par_profil"), data.parProfil)}
              {lignesTable(t("feedback:dashboard.par_categorie"), data.parCategorie, "categories")}
              {lignesTable(t("feedback:dashboard.par_processus"), data.parProcessus, "processus")}
              <div className="space-y-4">
                {lignesTable(t("feedback:dashboard.points_forts"), data.pointsForts, "categories")}
                {lignesTable(t("feedback:dashboard.difficultes"), data.difficultes, "categories")}
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("feedback:dashboard.enquetes")}</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[680px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("feedback:enquetes.titre")}</TableHead>
                      <TableHead>{t("feedback:enquetes.periode")}</TableHead>
                      <TableHead>{t("feedback:enquetes.statut")}</TableHead>
                      <TableHead className="text-end">{t("feedback:dashboard.taux_reponse")}</TableHead>
                      <TableHead className="text-end">{t("feedback:dashboard.note_moyenne")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!data.enquetes?.length ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>
                    ) : data.enquetes.map((e) => (
                      <TableRow key={e.enqueteId}>
                        <TableCell className="font-medium">{e.titre}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(e.dateDebut)} → {formatDate(e.dateFin)}</TableCell>
                        <TableCell><Badge variant="outline">{t(`feedback:statuts.${e.statut}`)}</Badge></TableCell>
                        <TableCell className="text-end tabular-nums">
                          {pct(e.tauxReponsePct)}
                          <span className="block text-xs text-muted-foreground">{t("feedback:dashboard.reponses_sur", { n: num(e.nbReponses), total: num(e.nbCibles) })}</span>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{note(e.noteMoyenne)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><MessageSquareQuote className="h-4 w-4" />{t("feedback:dashboard.commentaires")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("feedback:dashboard.commentaires_hint")}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {!data.commentaires?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("reporting:charts.empty")}</p>
                ) : data.commentaires.map((c, i) => (
                  <div key={i} className="rounded-md border border-border p-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {c.profil && <Badge variant="secondary">{t(`feedback:profils.${c.profil}`, { defaultValue: c.profil })}</Badge>}
                      {c.categorie && <Badge variant="outline">{t(`feedback:categories.${c.categorie}`, { defaultValue: c.categorie })}</Badge>}
                      {c.note != null && <span dir="ltr">{"★".repeat(c.note)}{"☆".repeat(Math.max(0, 5 - c.note))}</span>}
                      {c.source && <span>{t(`feedback:sources.${c.source}`, { defaultValue: c.source })}</span>}
                      {c.date && <span>{formatDate(c.date)}</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.texte}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SatisfactionDashboard;
