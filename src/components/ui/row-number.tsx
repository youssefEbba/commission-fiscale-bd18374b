import { useTranslation } from "react-i18next";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** En-tête de la colonne « N° » des listes. */
export function RowNumberHead({ className }: { className?: string }) {
  const { t } = useTranslation();
  return <TableHead className={cn("w-12 text-center", className)}>{t("common:fields.row_number")}</TableHead>;
}

/** Numéro de ligne affiché : `offset + index + 1` pour une liste paginée. */
export function RowNumberCell({ n, className }: { n: number; className?: string }) {
  return <TableCell className={cn("w-12 text-center text-muted-foreground tabular-nums", className)}>{n}</TableCell>;
}
