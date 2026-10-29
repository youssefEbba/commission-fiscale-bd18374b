import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ProcessusType } from "@/lib/api";
import { useGedPieces } from "@/hooks/useGedPieces";

interface Props {
  processus: ProcessusType | null | undefined;
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

/** Sélection multiple des pièces à réclamer, limitée aux pièces actives de la GED du processus. */
export function GedPiecesChecklist({ processus, value, onChange, className }: Props) {
  const { t } = useTranslation();
  const { options, isLoading, error, refetch } = useGedPieces(processus);

  const box = `grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-lg border border-border p-3 ${className ?? ""}`;

  if (isLoading) {
    return (
      <div className={box}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common:documents.ged_pieces.loading")}
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className={box}>
        <p className="text-sm text-destructive">{t("common:documents.ged_pieces.error", { message: error.message })}</p>
        <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => refetch()}>
          {t("common:documents.ged_pieces.retry")}
        </Button>
      </div>
    );
  }
  if (options.length === 0) {
    return (
      <div className={box}>
        <p className="text-sm text-muted-foreground">{t("common:documents.ged_pieces.empty")}</p>
      </div>
    );
  }
  return (
    <div className={box}>
      {options.map((o) => (
        <label key={o.code} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5">
          <Checkbox
            checked={value.includes(o.code)}
            onCheckedChange={(checked) => onChange(checked ? [...value, o.code] : value.filter((v) => v !== o.code))}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export default GedPiecesChecklist;
