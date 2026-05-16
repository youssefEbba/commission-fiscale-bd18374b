import { toast } from "sonner";
import { formatApiErrorMessage, isApiError } from "@/lib/api";
import { emitErrorDialog } from "@/components/ErrorDialog";

/**
 * Affiche une popup d'erreur centrée et large avec bouton de fermeture.
 */
export function showApiError(err: unknown, title = "Une erreur est survenue") {
  const description = formatApiErrorMessage(err, title);
  const code = isApiError(err) ? err.code : undefined;
  const status = isApiError(err) ? err.status : undefined;

  const fullDescription = code || status
    ? `${description}${code ? `\n\nCode: ${code}` : ""}${status ? ` · HTTP ${status}` : ""}`
    : description;

  emitErrorDialog({ title, description: fullDescription });
}

/** Toast de succès standardisé. */
export function showSuccess(title: string, description?: string) {
  toast.success(title, { description, duration: 4000 });
}

/** Toast d'information / avertissement. */
export function showWarning(title: string, description?: string) {
  toast.warning(title, { description, duration: 5000 });
}
