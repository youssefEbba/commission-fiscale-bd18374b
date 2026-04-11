import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Award, Activity, ScrollText, Gavel, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  ReportingSummaryDto, TimeSeriesPointDto, KeyCount,
  DEMANDE_STATUT_LABELS, CERTIFICAT_STATUT_LABELS, UTILISATION_STATUT_LABELS,
  CONVENTION_STATUT_LABELS, REFERENTIEL_STATUT_LABELS, MARCHE_STATUT_LABELS,
} from "@/lib/api";
import { AppRole } from "@/contexts/AuthContext";
import { showAuditSection } from "./ReportingRoleConfig";

const COLORS = [
  "hsl(153, 60%, 28%)", "hsl(43, 90%, 55%)", "hsl(200, 70%, 50%)",
  "hsl(0, 70%, 55%)", "hsl(280, 50%, 55%)", "hsl(120, 40%, 45%)",
  "hsl(30, 80%, 55%)", "hsl(170, 50%, 40%)", "hsl(330, 60%, 50%)",
  "hsl(60, 70%, 45%)", "hsl(210, 60%, 60%)", "hsl(15, 75%, 50%)",
];

function resolveLabel(key: string, labels: Record<string, string>): string {
  return labels[key] || key;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0 MRU";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MRU", maximumFractionDigits: 0 }).format(n);
}

function StatutBreakdownCard({ title, data, labels, icon: Icon, emptyMessage }: {
  title: string; data: KeyCount[]; labels: Record<string, string>; icon: React.ElementType; emptyMessage?: string;
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
          <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage || "Aucune donnée"}</p>
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

interface ReportingChartsProps {
  summary: ReportingSummaryDto;
  timeseries: TimeSeriesPointDto[];
  role?: AppRole;
}

const ReportingCharts = ({ summary, timeseries, role }: ReportingChartsProps) => {
  const showAudit = showAuditSection(role);

  const demandesChartData = useMemo(() =>
    summary.demandes.byStatut.map(kc => ({
      name: resolveLabel(kc.key, DEMANDE_STATUT_LABELS), value: kc.count, key: kc.key,
    })), [summary]);

  const certificatsChartData = useMemo(() =>
    summary.certificatsByStatut.map(kc => ({
      name: resolveLabel(kc.key, CERTIFICAT_STATUT_LABELS), value: kc.count,
    })), [summary]);

  const utilisationsChartData = useMemo(() =>
    summary.utilisationsByStatut.map(kc => ({
      name: resolveLabel(kc.key, UTILISATION_STATUT_LABELS), value: kc.count,
    })), [summary]);

  const utilisationsTypeData = useMemo(() =>
    summary.utilisationsByType.map(kc => ({
      name: kc.key === "DOUANIER" ? "Douanier" : kc.key === "TVA_INTERIEURE" ? "TVA Intérieure" : kc.key,
      value: kc.count,
    })), [summary]);

  const isEntrepriseOrST = role === "ENTREPRISE" || role === "SOUS_TRAITANT";

  return (
    <Tabs defaultValue="demandes" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="demandes"><FileText className="h-4 w-4 mr-1" />Demandes</TabsTrigger>
        <TabsTrigger value="certificats"><Award className="h-4 w-4 mr-1" />Certificats</TabsTrigger>
        <TabsTrigger value="utilisations"><Activity className="h-4 w-4 mr-1" />Utilisations</TabsTrigger>
        <TabsTrigger value="referentiel"><ScrollText className="h-4 w-4 mr-1" />Conv / Projets</TabsTrigger>
        {showAudit && <TabsTrigger value="audit"><BarChart3 className="h-4 w-4 mr-1" />Audit</TabsTrigger>}
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
                  <p className="text-lg font-bold">{formatCurrency(summary.certificatFinancials.sumMontantCordon)}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Montant TVA Int.</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.certificatFinancials.sumMontantTvaInterieure)}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Solde Cordon</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.certificatFinancials.sumSoldeCordon)}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Solde TVA</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.certificatFinancials.sumSoldeTva)}</p>
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
          <StatutBreakdownCard
            title="Marchés"
            data={summary.marchesByStatut}
            labels={MARCHE_STATUT_LABELS}
            icon={Gavel}
            emptyMessage={isEntrepriseOrST ? "Non applicable pour votre profil" : "Aucune donnée"}
          />
        </div>
      </TabsContent>

      {/* Audit tab — national roles only */}
      {showAudit && (
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
  );
};

export default ReportingCharts;
