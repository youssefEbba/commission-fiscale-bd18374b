import { toast } from "sonner";
import { formatApiErrorMessage, isApiError } from "@/lib/api";

/**
 * Affiche un toast d'erreur clair, large et persistant à l'utilisateur.
 * Utilisé en remplacement des `toast.error(...)` simples pour rendre les erreurs API lisibles.
 */
export function showApiError(err: unknown, title = "Une erreur est survenue") {
  const description = formatApiErrorMessage(err, title);
  const code = isApiError(err) ? err.code : undefined;
  const status = isApiError(err) ? err.status : undefined;

  toast.error(title, {
    description: code || status
      ? `${description}${code ? `\n\nCode: ${code}` : ""}${status ? ` · HTTP ${status}` : ""}`
      : description,
    duration: 8000,
  });
}

/** Toast de succès standardisé. */
export function showSuccess(title: string, description?: string) {
  toast.success(title, { description, duration: 4000 });
}

/** Toast d'information / avertissement. */
export function showWarning(title: string, description?: string) {
  toast.warning(title, { description, duration: 5000 });
}
