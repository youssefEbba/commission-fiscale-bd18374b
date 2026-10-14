import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { reportingApi, ReportingParams, ProductionGranularite, ProductionReportDto } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Info } from "lucide-react";
import { formatAmount } from "@/i18n/format";
import { orNA } from "@/lib/reportingValues";

const NS = "reporting:production";
type N = number | null | undefined;

export function ProductionSection({ params }: { params: ReportingParams }) {
  const { t } = useTranslation();
  const na = t("reporting:analyses.na") as string;
  const money = (v: N) => orNA(v, (n) => formatAmount(n), na);
  const num = (v: N) => orNA(v, (n) => String(n), na);
  const pct = (v: N) => orNA(v, (n) => `${n > 0 ? "+" : ""}${formatAmount(n, { currency: "", minimumFractionDigits: 0, maximumFractionDigits: 2 }).trim()} %`, na);

  const [gran, setGran] = useState<ProductionGranularite>("MOIS");
  const [data, setData] = useState<ProductionReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setLoading(true); setError(null);
    reportingApi.getProduction(params, gran).then(setData).catch((e) => { setError(e?.message || "error"); setData(null); }).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [params, gran]);

  // Les périodes vides envoyées par le serveur sont conservées telles quelles.
  const points = data?.points ?? [];

  const Kpi = ({ label, value, prev, variation }: { label: string; value: string; prev: string; variation: string }) => (
    <Card><CardContent className="p-4 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{t(`${NS}.precedent`)} : {prev} · {t(`${NS}.variation`)} : {variation}</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t(`${NS}.granularite`)}</Label>
          <Select value={gran} onValueChange={(v) => setGran(v as ProductionGranularite)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MOIS">{t(`${NS}.gran.MOIS`)}</SelectItem>
              <SelectItem value="TRIMESTRE">{t(`${NS}.gran.TRIMESTRE`)}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : error ? (
        <Card className="border-destructive/50"><CardContent className="p-6 text-center space-y-3">
          <p className="text-destructive font-medium">{t("reporting:page.load_error_title")}</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={load}>{t("reporting:page.retry")}</Button>
        </CardContent></Card>
      ) : data && (
        <>
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span><strong>{t(`${NS}.cle_datation`)} :</strong> {data.cleDatation || na}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi label={t(`${NS}.demandes`)} value={num(data.totalDemandes)} prev={num(data.precedentDemandes)} variation={pct(data.variationDemandesPct)} />
            <Kpi label={t(`${NS}.certificats`)} value={num(data.totalCertificats)} prev={num(data.precedentCertificats)} variation={pct(data.variationCertificatsPct)} />
            <Kpi label={t(`${NS}.masse`)} value={money(data.totalMasseAccordee)} prev={money(data.precedentMasseAccordee)} variation={pct(data.variationMassePct)} />
            <Card><CardContent className="p-4 space-y-1">
              <p className="text-sm text-muted-foreground">{t(`${NS}.utilisations`)}</p>
              <p className="text-xl font-bold">{num(data.totalUtilisations)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 space-y-1">
              <p className="text-sm text-muted-foreground">{t(`${NS}.consomme_mvt`)}</p>
              <p className="text-xl font-bold">{money(data.totalConsommeMouvements)}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t(`${NS}.chart_volumes`)}</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="nbDemandes" name={t(`${NS}.demandes`) as string} fill="hsl(var(--primary))" />
                  <Bar dataKey="nbCertificats" name={t(`${NS}.certificats`) as string} fill="hsl(var(--gold, var(--accent)))" />
                  <Bar dataKey="nbUtilisations" name={t(`${NS}.utilisations`) as string} fill="hsl(var(--muted-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t(`${NS}.masse`)}</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Line type="monotone" dataKey="masseAccordee" name={t(`${NS}.masse`) as string} stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t(`${NS}.consomme_mvt`)}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Line type="monotone" dataKey="consommeMouvementsPeriode" name={t(`${NS}.consomme_mvt`) as string} stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground">{t(`${NS}.note_consomme`)}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
