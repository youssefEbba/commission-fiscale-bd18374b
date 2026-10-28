import { useState } from "react";
import { useTranslation } from "react-i18next";
import { reportingApi, ReportingParams, ReportingBloc, ReportingExportFormat, REPORTING_BLOCS } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { trackDocumentTask } from "@/lib/openDocument";

const FORMATS: ReportingExportFormat[] = ["xlsx", "csv", "pdf"];

function useExport(params: ReportingParams) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const run = async (format: ReportingExportFormat, blocs?: ReportingBloc[]) => {
    setBusy(true);
    try {
      await trackDocumentTask(`download:reporting:${format}:${(blocs || []).join(",")}`, "download", `export.${format}`, () => reportingApi.downloadExport(format, params, blocs));
    } catch (e: any) {
      toast({ variant: "destructive", title: t("reporting:export.error") as string, description: e?.message });
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** Export du bloc courant — le fichier est construit par le serveur, en français. */
export function ExportBlocButton({ params, bloc }: { params: ReportingParams; bloc: ReportingBloc }) {
  const { t } = useTranslation();
  const { busy, run } = useExport(params);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Download className="h-4 w-4 me-1" />}
          {busy ? t("reporting:export.in_progress") : t("reporting:export.button")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground max-w-64">{t("reporting:export.fr_note")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FORMATS.map((f) => (
          <DropdownMenuItem key={f} onClick={() => run(f, [bloc])}>{t(`reporting:export.formats.${f}`)}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Export global avec choix des blocs (tous cochés = paramètre omis = tout). */
export function ExportGlobalButton({ params }: { params: ReportingParams }) {
  const { t } = useTranslation();
  const { busy, run } = useExport(params);
  const [blocs, setBlocs] = useState<ReportingBloc[]>([...REPORTING_BLOCS]);
  const toggle = (b: ReportingBloc) => setBlocs((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));
  const selected = blocs.length === REPORTING_BLOCS.length ? undefined : blocs;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Download className="h-4 w-4 me-1" />}
          {busy ? t("reporting:export.in_progress") : t("reporting:export.global")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">{t("reporting:export.fr_note")}</p>
        <div className="space-y-2">
          {REPORTING_BLOCS.map((b) => (
            <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={blocs.includes(b)} onCheckedChange={() => toggle(b)} />
              {t(`reporting:export.blocs.${b}`)}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          {FORMATS.map((f) => (
            <Button key={f} variant="outline" size="sm" disabled={busy || blocs.length === 0} onClick={() => run(f, selected)}>
              {f.toUpperCase()}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
