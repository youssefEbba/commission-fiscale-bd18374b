import { forwardRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { documentTaskKey, downloadDocument, openDocument, type OpenableDoc } from "@/lib/openDocument";
import { useDocumentTaskPending } from "@/hooks/useDocumentTasks";
import { showApiError } from "@/lib/feedback";

interface DocumentButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  doc: OpenableDoc;
  mode?: "open" | "download";
  icon?: LucideIcon;
  iconClassName?: string;
  children?: ReactNode;
  /** Remplace l'affichage d'erreur par défaut (popup avec le message serveur). */
  onError?: (error: unknown) => void;
}

/**
 * Bouton d'ouverture / de téléchargement d'un document : affiche une attente
 * (icône animée, bouton inactif) jusqu'à l'arrivée du fichier ou du refus serveur.
 */
export const DocumentButton = forwardRef<HTMLButtonElement, DocumentButtonProps>(
  ({ doc, mode = "open", icon: Icon, iconClassName = "h-3.5 w-3.5 me-1", children, onError, disabled, ...rest }, ref) => {
    const { t } = useTranslation();
    const pending = useDocumentTaskPending(documentTaskKey(doc, mode));
    const handle = () => {
      if (pending) return;
      (mode === "open" ? openDocument(doc) : downloadDocument(doc)).catch((e) => {
        if (onError) onError(e);
        else showApiError(e, t(mode === "open" ? "common:documents.open_error" : "common:documents.download_error") as string);
      });
    };
    return (
      <Button ref={ref} type="button" {...rest} disabled={disabled || pending} aria-busy={pending || undefined} onClick={handle}>
        {pending ? <Loader2 className={`${iconClassName} animate-spin`} /> : Icon ? <Icon className={iconClassName} /> : null}
        {pending ? t(mode === "open" ? "common:documents.opening_short" : "common:documents.downloading_short") : children}
      </Button>
    );
  },
);
DocumentButton.displayName = "DocumentButton";
