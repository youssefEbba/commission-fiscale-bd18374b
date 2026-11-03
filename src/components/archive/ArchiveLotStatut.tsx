import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ARCHIVE_LOT_STATUTS, type ArchiveLotCreditStatut, type ArchiveLotSource } from "@/lib/api";
import { isProposed } from "@/lib/archiveLots";

const STATUT_CLASS: Record<ArchiveLotCreditStatut, string> = {
  A_COMPLETER: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  PRET: "border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  IMPORTE: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  ERREUR: "border-destructive/40 bg-destructive/10 text-destructive",
  IGNORE: "border-border bg-muted text-muted-foreground",
};

export function ArchiveLotStatutBadge({ statut, count }: { statut: ArchiveLotCreditStatut; count?: number }) {
  const { t } = useTranslation("archive");
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-normal", STATUT_CLASS[statut])}>
      {t(`lots.statut.${statut}`)}{count != null && <span className="ms-1 font-semibold tabular-nums">{count}</span>}
    </Badge>
  );
}

/** Compteurs par statut (statuts à zéro masqués). */
export function ArchiveLotCounters({ parStatut }: { parStatut: Partial<Record<ArchiveLotCreditStatut, number>> | null | undefined }) {
  const shown = ARCHIVE_LOT_STATUTS.filter((s) => (parStatut?.[s] ?? 0) > 0);
  if (!shown.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => <ArchiveLotStatutBadge key={s} statut={s} count={parStatut?.[s]} />)}
    </div>
  );
}

/** Badge « proposé » quand le rattachement ne vient pas d'un choix manuel. */
export function SourceBadge({ source }: { source: ArchiveLotSource | null | undefined }) {
  const { t } = useTranslation("archive");
  if (!isProposed(source)) return null;
  return (
    <Badge variant="outline" className="ms-1 px-1 py-0 text-[10px] font-normal text-muted-foreground" title={t(`lots.source.${source}`)}>
      {t("lots.propose")}
    </Badge>
  );
}
