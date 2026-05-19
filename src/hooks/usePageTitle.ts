import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Met à jour document.title à partir d'une clé i18n.
 * Exemple: usePageTitle("certificats:list.title")
 */
export function usePageTitle(key: string, options?: Record<string, unknown>) {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    const titlePart = t(key, options as any);
    const app = t("common:app.title", { defaultValue: "Commission Fiscale" });
    document.title = titlePart ? `${titlePart} · ${app}` : app;
  }, [key, i18n.language, t, options]);
}
