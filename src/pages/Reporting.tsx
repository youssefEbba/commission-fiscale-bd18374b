import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  reportingApi, ReportingSummaryDto, TimeSeriesPointDto, ReportingParams,
  autoriteContractanteApi, entrepriseApi, AutoriteContractanteDto, EntrepriseDto,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Activity, Award } from "lucide-react";
import { isNationalRole, getRoleLabel } from "@/components/reporting/ReportingRoleConfig";
import ReportingFilters from "@/components/reporting/ReportingFilters";
import ReportingKPIs from "@/components/reporting/ReportingKPIs";
import ReportingCharts from "@/components/reporting/ReportingCharts";
import { formatAmount } from "@/i18n/format";
import { usePageTitle } from "@/hooks/usePageTitle";

const Reporting = () => {
  const { t } = useTranslation();
  usePageTitle("reporting:page.title");
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const isNational = isNationalRole(role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportingSummaryDto | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeriesPointDto[]>([]);

  // Filters
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const [fromDate, setFromDate] = useState(oneYearAgo.toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(now.toISOString().slice(0, 10));
  const [selectedAC, setSelectedAC] = useState("");
  const [selectedEnt, setSelectedEnt] = useState("");

  // Reference data for national filters
  const [autorites, setAutorites] = useState<AutoriteContractanteDto[]>([]);
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);

  useEffect(() => {
    if (isNational) {
      autoriteContractanteApi.getAll().then(setAutorites).catch(() => {});
      entrepriseApi.getAll().then(setEntreprises).catch(() => {});
    }
  }, [isNational]);

  const buildParams = (): ReportingParams => {
    const params: ReportingParams = {};
    if (fromDate) params.from = `${fromDate}T00:00:00Z`;
    if (toDate) params.to = `${toDate}T23:59:59Z`;
    if (isNational && selectedAC && selectedAC !== "all") params.autoriteContractanteId = Number(selectedAC);
    if (isNational && selectedEnt && selectedEnt !== "all") params.entrepriseId = Number(selectedEnt);
    return params;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      const [s, ts] = await Promise.all([
        reportingApi.getSummary(params),
        reportingApi.getDemandesTimeseries(params),
      ]);
      setSummary(s);
      setTimeseries(ts);
    } catch (e: any) {
      console.error("Reporting load error", e);
      setError(e?.message || (t("reporting:page.load_error_fallback") as string));
      setSummary(null);
      setTimeseries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading && !summary) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with role context */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("reporting:page.header")}</h1>
            <p className="text-sm text-muted-foreground">
              {getRoleLabel(role)}
              {isNational && summary?.filtersApplied && (
                <Badge variant="outline" className="ms-2 text-xs">{t("reporting:page.filters_applied")}</Badge>
              )}
            </p>
          </div>
        </div>

        {/* Filters */}
        <ReportingFilters
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
          isNational={isNational}
          selectedAC={selectedAC}
          selectedEnt={selectedEnt}
          onACChange={setSelectedAC}
          onEntChange={setSelectedEnt}
          autorites={autorites}
          entreprises={entreprises}
          loading={loading}
          onApply={loadData}
        />

        {/* Error state */}
        {error && !loading && (
          <Card className="border-destructive/50">
            <CardContent className="p-6 text-center">
              <p className="text-destructive font-medium mb-2">{t("reporting:page.load_error_title")}</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={loadData}>{t("reporting:page.retry")}</Button>
            </CardContent>
          </Card>
        )}

        {summary && (
          <Tabs defaultValue="app" className="space-y-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="app">
                <Activity className="h-4 w-4 me-1" />
                {t("reporting:tabs.app", { defaultValue: "Reporting applicatif" })}
              </TabsTrigger>
              <TabsTrigger value="stats">
                <Award className="h-4 w-4 me-1" />
                {t("reporting:tabs.stats", { defaultValue: "Statistiques crédits d'impôt" })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="app" className="space-y-6">
              <ReportingKPIs summary={summary} role={role} />
              <ReportingCharts summary={summary} timeseries={timeseries} role={role} />
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{t("reporting:kpis.certificats")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{summary.certificatsTotal}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{t("reporting:charts.montant_cordon")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{formatAmount(summary.certificatFinancials.sumMontantCordon)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{t("reporting:charts.montant_tva_int")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{formatAmount(summary.certificatFinancials.sumMontantTvaInterieure)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{t("reporting:kpis.solde_cordon")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{formatAmount(summary.certificatFinancials.sumSoldeCordon)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{t("reporting:kpis.solde_tva")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{formatAmount(summary.certificatFinancials.sumSoldeTva)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{t("reporting:kpis.taux_adoption")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{summary.demandes.tauxAdoptionPct != null ? `${summary.demandes.tauxAdoptionPct.toFixed(1)}%` : "—"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{t("reporting:kpis.taux_rejet")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{summary.demandes.tauxRejetPct != null ? `${summary.demandes.tauxRejetPct.toFixed(1)}%` : "—"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{t("reporting:kpis.utilisations")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{summary.utilisationsTotal}</p>
                  </CardContent>
                </Card>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {t("reporting:charts.certificats_count", { count: summary.certificatFinancials.certificatCount })}
              </p>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reporting;
