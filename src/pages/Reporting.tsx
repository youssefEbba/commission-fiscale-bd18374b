import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  reportingApi, ReportingSummaryDto, TimeSeriesPointDto, ReportingParams,
  autoriteContractanteApi, entrepriseApi, AutoriteContractanteDto, EntrepriseDto,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { isNationalRole, getRoleLabel } from "@/components/reporting/ReportingRoleConfig";
import ReportingFilters from "@/components/reporting/ReportingFilters";
import ReportingKPIs from "@/components/reporting/ReportingKPIs";
import ReportingCharts from "@/components/reporting/ReportingCharts";

const Reporting = () => {
  const { user, hasRole } = useAuth();
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
      setError(e?.message || "Impossible de charger les données de reporting");
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
            <h1 className="text-2xl font-bold text-foreground">Reporting</h1>
            <p className="text-sm text-muted-foreground">
              {getRoleLabel(role)}
              {isNational && summary?.filtersApplied && (
                <Badge variant="outline" className="ml-2 text-xs">Filtres appliqués</Badge>
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
              <p className="text-destructive font-medium mb-2">Erreur de chargement</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={loadData}>Réessayer</Button>
            </CardContent>
          </Card>
        )}

        {summary && (
          <>
            <ReportingKPIs summary={summary} role={role} />
            <ReportingCharts summary={summary} timeseries={timeseries} role={role} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reporting;
