import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Loader2 } from "lucide-react";
import { AutoriteContractanteDto, EntrepriseDto } from "@/lib/api";

interface ReportingFiltersProps {
  fromDate: string;
  toDate: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  isNational: boolean;
  selectedAC: string;
  selectedEnt: string;
  onACChange: (v: string) => void;
  onEntChange: (v: string) => void;
  autorites: AutoriteContractanteDto[];
  entreprises: EntrepriseDto[];
  loading: boolean;
  onApply: () => void;
}

const ReportingFilters = ({
  fromDate, toDate, onFromChange, onToChange,
  isNational, selectedAC, selectedEnt, onACChange, onEntChange,
  autorites, entreprises, loading, onApply,
}: ReportingFiltersProps) => {
  const { t } = useTranslation();
  const allLabel = t("reporting:filters.all_f_plural") as string;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("reporting:filters.from")}</Label>
            <Input type="date" value={fromDate} onChange={e => onFromChange(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("reporting:filters.to")}</Label>
            <Input type="date" value={toDate} onChange={e => onToChange(e.target.value)} className="w-40" />
          </div>
          {isNational && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">{t("reporting:filters.autorite")}</Label>
                <Select value={selectedAC} onValueChange={onACChange}>
                  <SelectTrigger className="w-52"><SelectValue placeholder={allLabel} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{allLabel}</SelectItem>
                    {autorites.map(ac => (
                      <SelectItem key={ac.id} value={String(ac.id)}>{ac.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("reporting:filters.entreprise")}</Label>
                <Select value={selectedEnt} onValueChange={onEntChange}>
                  <SelectTrigger className="w-52"><SelectValue placeholder={allLabel} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{allLabel}</SelectItem>
                    {entreprises.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.raisonSociale}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <Button onClick={onApply} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Filter className="h-4 w-4 me-1" />}
            {t("reporting:filters.apply")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportingFilters;
