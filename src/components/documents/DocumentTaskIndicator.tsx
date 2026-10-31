import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useDocumentTasks } from "@/hooks/useDocumentTasks";

/** Indicateur global : signale tout document en cours d'ouverture, de téléchargement ou de génération. */
export function DocumentTaskIndicator() {
  const { t } = useTranslation();
  const tasks = useDocumentTasks();
  if (tasks.length === 0) return null;
  const first = tasks[0];
  const title = tasks.length > 1
    ? t("common:documents.many_in_progress", { count: tasks.length })
    : t(`common:documents.${first.mode === "open" ? "opening" : first.mode === "download" ? "downloading" : "generating"}`);
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 start-1/2 z-[100] -translate-x-1/2 rtl:translate-x-1/2 flex max-w-[90vw] items-center gap-3 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-card-foreground shadow-lg"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
      <div className="min-w-0">
        <p className="font-medium leading-tight">{title}</p>
        {tasks.length === 1 && first.label && (
          <p className="truncate text-xs text-muted-foreground leading-tight">{first.label}</p>
        )}
      </div>
    </div>
  );
}
