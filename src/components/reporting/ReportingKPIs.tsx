import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Award, Activity, ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { ReportingSummaryDto } from "@/lib/api";
import { showPresidentValidation } from "./ReportingRoleConfig";
import { AppRole } from "@/contexts/AuthContext";
import { formatAmount, formatNumber } from "@/i18n/format";

function KPICard({ icon: Icon, label, value, color, subtext, children }: {
  icon: React.ElementType; label: string; value: number; color: string; subtext?: string; children?: React.ReactNode;
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
        {children}
      </CardContent>
    </Card>
  );
}

interface ReportingKPIsProps {
  summary: ReportingSummaryDto;
  role?: AppRole;
}

const ReportingKPIs = ({ summary, role }: ReportingKPIsProps) => {
  const { t } = useTranslation();
  const showValidation = showPresidentValidation(role);
  // Détail du total par processus, dans l'ordre du serveur.
  const parProcessus = summary.demandes.parProcessus ?? [];

  return (
    <>
      {/* Volume KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard icon={FileText} label={t("reporting:kpis.demandes")} value={summary.demandes.total} color="text-primary">
          {parProcessus.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground" aria-label={t("reporting:kpis.demandes_par_processus")}>
              {parProcessus.map((kc) => (
                <li key={kc.key} className="flex justify-between gap-2">
                  <span>{t(`reporting:kpis.processus.${kc.key}`, { defaultValue: kc.key })}</span>
                  <span className="tabular-nums font-medium text-foreground">{formatNumber(kc.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </KPICard>
        <KPICard
          icon={Award}
          label={t("reporting:kpis.certificats")}
          value={summary.certificatsTotal}
          color="text-accent"
          subtext={showValidation && summary.certificatsEnValidationPresident > 0
            ? (t("reporting:kpis.en_validation_president", { count: summary.certificatsEnValidationPresident }) as string)
            : undefined}
        />
        <KPICard icon={Activity} label={t("reporting:kpis.utilisations")} value={summary.utilisationsTotal} color="text-green-600" />
        <KPICard
          icon={ArrowRightLeft}
          label={t("reporting:kpis.transferts")}
          value={summary.transfertsTotal}
          color="text-blue-500"
          subtext={t("reporting:kpis.sous_traitances", { count: summary.sousTraitancesTotal }) as string}
        />
      </div>

      {/* Rates & Financial KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm text-muted-foreground">{t("reporting:kpis.taux_adoption")}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {summary.demandes.tauxAdoptionPct != null ? `${formatNumber(Number(summary.demandes.tauxAdoptionPct.toFixed(1)))}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              <span className="text-sm text-muted-foreground">{t("reporting:kpis.taux_rejet")}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {summary.demandes.tauxRejetPct != null ? `${formatNumber(Number(summary.demandes.tauxRejetPct.toFixed(1)))}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">{t("reporting:kpis.solde_cordon")}</span>
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">
              {formatAmount(summary.certificatFinancials.sumSoldeCordon)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-accent" />
              <span className="text-sm text-muted-foreground">{t("reporting:kpis.solde_tva")}</span>
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">
              {formatAmount(summary.certificatFinancials.sumSoldeTva)}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ReportingKPIs;
