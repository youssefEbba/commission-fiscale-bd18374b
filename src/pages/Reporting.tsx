import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  reportingApi, ReportingSummaryDto, TimeSeriesPointDto, ReportingParams,
  KeyCount, DEMANDE_STATUT_LABELS, CERTIFICAT_STATUT_LABELS, UTILISATION_STATUT_LABELS,
  CONVENTION_STATUT_LABELS, REFERENTIEL_STATUT_LABELS, MARCHE_STATUT_LABELS,
  autoriteContractanteApi, entrepriseApi, AutoriteContractanteDto, EntrepriseDto,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, FileText, Award, Activity, ScrollText, Gavel, ArrowRightLeft,
  Handshake, TrendingUp, TrendingDown, BarChart3, PieChart, Filter,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const COLORS = [
  "hsl(153, 60%, 28%)", "hsl(43, 90%, 55%)", "hsl(200, 70%, 50%)",
  "hsl(0, 70%, 55%)", "hsl(280, 50%, 55%)", "hsl(120, 40%, 45%)",
  "hsl(30, 80%, 55%)", "hsl(170, 50%, 40%)", "hsl(330, 60%, 50%)",
  "hsl(60, 70%, 45%)", "hsl(210, 60%, 60%)", "hsl(15, 75%, 50%)",
];

const NATIONAL_ROLES: AppRole[] = ["PRESIDENT", "ADMIN_SI", "DGD", "DGTCP", "DGI", "DGB"];

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MRU", maximumFractionDigits: 0 }).format(n);
}

function resolveLabel(key: string, labels: Record<string, string>): string {
  return labels[key] || key;
}

const Reporting = () => {
  const { user, hasRole } = useAuth();
  const isNational = hasRole(NATIONAL_ROLES);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportingSummaryDto | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeriesPointDto[]>([]);

  // Filters
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const [fromDate, setFromDate] = useState(oneYearAgo.toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(now.toISOString().slice(0, 10));
  const [selectedAC, setSelectedAC] = useState<string>("");
  const [selectedEnt, setSelectedEnt] = useState<string>("");

  // Reference data for filters
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
    if (isNational && selectedAC) params.autoriteContractanteId = Number(selectedAC);
    if (isNational && selectedEnt) params.entrepriseId = Number(selectedEnt);
    return params;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [s, ts] = await Promise.all([
        reportingApi.getSummary(params),
        reportingApi.getDemandesTimeseries(params),
      ]);
      setSummary(s);
      setTimeseries(ts);
    } catch (e) {
      console.error("Reporting load error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleApplyFilters = () => loadData();

  // Derived chart data
  const demandesChartData = useMemo(() =>
    summary?.demandes.byStatut.map(kc => ({
      name: resolveLabel(kc.key, DEMANDE_STATUT_LABELS), value: kc.count, key: kc.key,
    })) || [], [summary]);

  const certificatsChartData = useMemo(() =>
    summary?.certificatsByStatut.map(kc => ({
      name: resolveLabel(kc.key, CERTIFICAT_STATUT_LABELS), value: kc.count,
    })) || [], [summary]);

  const utilisationsChartData = useMemo(() =>
    summary?.utilisationsByStatut.map(kc => ({
      name: resolveLabel(kc.key, UTILISATION_STATUT_LABELS), value: kc.count,
    })) || [], [summary]);

  const utilisationsTypeData = useMemo(() =>
    summary?.utilisationsByType.map(kc => ({
      name: kc.key === "DOUANIER" ? "Douanier" : kc.key === "TVA_INTERIEURE" ? "TVA Intérieure" : kc.key,
      value: kc.count,
    })) || [], [summary]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reporting</h1>
            <p className="text-sm text-muted-foreground">
              Statistiques et indicateurs clés
              {summary?.filtersApplied && <Badge variant="outline" className="ml-2 text-xs">Filtres appliqués</Badge>}
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Du</Label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Au</Label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
              </div>
              {isNational && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Autorité Contractante</Label>
                    <Select value={selectedAC} onValueChange={setSelectedAC}>
                      <SelectTrigger className="w-52"><SelectValue placeholder="Toutes" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes</SelectItem>
                        {autorites.map(ac => (
                          <SelectItem key={ac.id} value={String(ac.id)}>{ac.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Entreprise</Label>
                    <Select value={selectedEnt} onValueChange={setSelectedEnt}>
                      <SelectTrigger className="w-52"><SelectValue placeholder="Toutes" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes</SelectItem>
                        {entreprises.map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.raisonSociale}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <Button onClick={handleApplyFilters} disabled={loading} size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Filter className="h-4 w-4 mr-1" />}
                Appliquer
              </Button>
            </div>
          </CardContent>
        </Card>

        {summary && (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard icon={FileText} label="Demandes" value={summary.demandes.total} color="text-primary" />
              <KPICard icon={Award} label="Certificats" value={summary.certificatsTotal} color="text-accent" subtext={summary.certificatsEnValidationPresident > 0 ? `${summary.certificatsEnValidationPresident} en validation` : undefined} />
              <KPICard icon={Activity} label="Utilisations" value={summary.utilisationsTotal} color="text-green-600" />
              <KPICard icon={ArrowRightLeft} label="Transferts" value={summary.transfertsTotal} color="text-blue-500" subtext={`${summary.sousTraitancesTotal} sous-traitance(s)`} />
            </div>

            {/* Taux */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-muted-foreground">Taux d'adoption</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {summary.demandes.tauxAdoptionPct != null ? `${summary.demandes.tauxAdoptionPct.toFixed(1)}%` : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    <span className="text-sm text-muted-foreground">Taux de rejet</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {summary.demandes.tauxRejetPct != null ? `${summary.demandes.tauxRejetPct.toFixed(1)}%` : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Solde Cordon</span>
                  </div>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {formatCurrency(summary.certificatFinancials.soldeCordon)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-accent" />
                    <span className="text-sm text-muted-foreground">Solde TVA</span>
                  </div>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {formatCurrency(summary.certificatFinancials.soldeTVA)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for charts */}
            <Tabs defaultValue="demandes" className="space-y-4">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="demandes"><FileText className="h-4 w-4 mr-1" />Demandes</TabsTrigger>
                <TabsTrigger value="certificats"><Award className="h-4 w-4 mr-1" />Certificats</TabsTrigger>
                <TabsTrigger value="utilisations"><Activity className="h-4 w-4 mr-1" />Utilisations</TabsTrigger>
                <TabsTrigger value="referentiel"><ScrollText className="h-4 w-4 mr-1" />Conv / Projets</TabsTrigger>
                {isNational && <TabsTrigger value="audit"><BarChart3 className="h-4 w-4 mr-1" />Audit</TabsTrigger>}
              </TabsList>

              {/* Demandes tab */}
              <TabsContent value="demandes" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Demandes par statut</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={demandesChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="value" fill="hsl(153, 60%, 28%)" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Évolution mensuelle des demandes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={timeseries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="count" stroke="hsl(153, 60%, 28%)" strokeWidth={2} dot={{ r: 4 }} name="Demandes" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {/* Detail table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Détail par statut</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {summary.demandes.byStatut.map(kc => (
                        <div key={kc.key} className="rounded-lg border border-border p-3 text-center">
                          <p className="text-xs text-muted-foreground">{resolveLabel(kc.key, DEMANDE_STATUT_LABELS)}</p>
                          <p className="text-lg font-bold text-foreground">{kc.count}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Certificats tab */}
              <TabsContent value="certificats" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Certificats par statut</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPie>
                            <Pie data={certificatsChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`} labelLine>
                              {certificatsChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                          </RechartsPie>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Montants certificats</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-xs text-muted-foreground">Montant Cordon</p>
                          <p className="text-lg font-bold">{formatCurrency(summary.certificatFinancials.montantCordon)}</p>
                        </div>
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-xs text-muted-foreground">Montant TVA Int.</p>
                          <p className="text-lg font-bold">{formatCurrency(summary.certificatFinancials.montantTVAInterieure)}</p>
                        </div>
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-xs text-muted-foreground">Solde Cordon</p>
                          <p className="text-lg font-bold">{formatCurrency(summary.certificatFinancials.soldeCordon)}</p>
                        </div>
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-xs text-muted-foreground">Solde TVA</p>
                          <p className="text-lg font-bold">{formatCurrency(summary.certificatFinancials.soldeTVA)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">{summary.certificatFinancials.certificatCount} certificat(s) dans le périmètre</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Utilisations tab */}
              <TabsContent value="utilisations" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Utilisations par statut</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={utilisationsChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Utilisations par type</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPie>
                            <Pie data={utilisationsTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                              {utilisationsTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </RechartsPie>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Conventions / Projets / Marchés tab */}
              <TabsContent value="referentiel" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <StatutBreakdownCard title="Conventions" data={summary.conventionsByStatut} labels={CONVENTION_STATUT_LABELS} icon={ScrollText} />
                  <StatutBreakdownCard title="Référentiels Projet" data={summary.referentielsByStatut} labels={REFERENTIEL_STATUT_LABELS} icon={FileText} />
                  <StatutBreakdownCard title="Marchés" data={summary.marchesByStatut} labels={MARCHE_STATUT_LABELS} icon={Gavel} />
                </div>
              </TabsContent>

              {/* Audit tab */}
              {isNational && (
                <TabsContent value="audit" className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Actions d'audit ({formatNumber(summary.audit.totalActions)})</CardTitle></CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={summary.audit.byAction.map(kc => ({ name: kc.key, value: kc.count }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="value" fill="hsl(280, 50%, 55%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Top entités modifiées</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {summary.audit.topEntityTypes.map((kc, i) => (
                            <div key={kc.key} className="flex items-center justify-between rounded-lg border border-border p-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono w-5">{i + 1}</span>
                                <span className="text-sm font-medium">{kc.key}</span>
                              </div>
                              <Badge variant="secondary">{kc.count}</Badge>
                            </div>
                          ))}
                          {summary.audit.topEntityTypes.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée d'audit</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

// Sub-components

function KPICard({ icon: Icon, label, value, color, subtext }: {
  icon: React.ElementType; label: string; value: number; color: string; subtext?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <p className="mt-2 text-2xl font-bold text-foreground">{formatNumber(value)}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function StatutBreakdownCard({ title, data, labels, icon: Icon }: {
  title: string; data: KeyCount[]; labels: Record<string, string>; icon: React.ElementType;
}) {
  const total = data.reduce((s, kc) => s + kc.count, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
          <Badge variant="secondary" className="ml-auto">{total}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>
        ) : (
          <div className="space-y-2">
            {data.map(kc => (
              <div key={kc.key} className="flex items-center justify-between">
                <span className="text-sm">{resolveLabel(kc.key, labels)}</span>
                <span className="text-sm font-bold">{kc.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Reporting;
