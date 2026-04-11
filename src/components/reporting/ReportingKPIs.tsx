import { Card, CardContent } from "@/components/ui/card";
import { FileText, Award, Activity, ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { ReportingSummaryDto } from "@/lib/api";
import { showPresidentValidation } from "./ReportingRoleConfig";
import { AppRole } from "@/contexts/AuthContext";

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0 MRU";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MRU", maximumFractionDigits: 0 }).format(n);
}

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

interface ReportingKPIsProps {
  summary: ReportingSummaryDto;
  role?: AppRole;
}

const ReportingKPIs = ({ summary, role }: ReportingKPIsProps) => {
  const showValidation = showPresidentValidation(role);

  return (
    <>
      {/* Volume KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard icon={FileText} label="Demandes" value={summary.demandes.total} color="text-primary" />
        <KPICard
          icon={Award}
          label="Certificats"
          value={summary.certificatsTotal}
          color="text-accent"
          subtext={showValidation && summary.certificatsEnValidationPresident > 0
            ? `${summary.certificatsEnValidationPresident} en validation Président`
            : undefined}
        />
        <KPICard icon={Activity} label="Utilisations" value={summary.utilisationsTotal} color="text-green-600" />
        <KPICard
          icon={ArrowRightLeft}
          label="Transferts"
          value={summary.transfertsTotal}
          color="text-blue-500"
          subtext={`${summary.sousTraitancesTotal} sous-traitance(s)`}
        />
      </div>

      {/* Rates & Financial KPIs */}
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
              {formatCurrency(summary.certificatFinancials.sumSoldeCordon)}
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
              {formatCurrency(summary.certificatFinancials.sumSoldeTva)}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ReportingKPIs;
