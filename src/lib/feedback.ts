import { toast } from "sonner";
import i18n from "@/i18n";
import { formatApiErrorMessage, isApiError } from "@/lib/api";
import { emitErrorDialog } from "@/components/ErrorDialog";

/** Tente de traduire une erreur API via `errors.<code>`, sinon retombe sur le message brut. */
function translateApiError(err: unknown, fallback: string): string {
  if (isApiError(err)) {
    const code = err.code;
    if (code) {
      const key = `errors:${code.toLowerCase()}`;
      const tr = i18n.t(key, { defaultValue: "" });
      if (tr) return tr as string;
    }
  }
  return formatApiErrorMessage(err, fallback);
}

/**
 * Affiche une popup d'erreur centrée et large avec bouton de fermeture.
 */
export function showApiError(err: unknown, title?: string) {
  const resolvedTitle = title ?? (i18n.t("common:errors.generic_title") as string);
  const description = translateApiError(err, resolvedTitle);
  const code = isApiError(err) ? err.code : undefined;
  const status = isApiError(err) ? err.status : undefined;

  const fullDescription = code || status
    ? `${description}${code ? `\n\nCode: ${code}` : ""}${status ? ` · HTTP ${status}` : ""}`
    : description;

  emitErrorDialog({ title: resolvedTitle, description: fullDescription });
}

/** Toast de succès standardisé. */
export function showSuccess(title: string, description?: string) {
  toast.success(title, { description, duration: 4000 });
}

/** Toast d'information / avertissement. */
export function showWarning(title: string, description?: string) {
  toast.warning(title, { description, duration: 5000 });
}
