import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@fontsource/noto-sans-arabic/400.css";
import "@fontsource/noto-sans-arabic/600.css";
import "@fontsource/noto-sans-arabic/700.css";

/**
 * Synchronise <html lang/dir> + persiste la langue active.
 * À monter le plus haut possible dans l'arbre.
 */
export function I18nBootstrap({ children }: { children?: React.ReactNode }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    const apply = (lng: string) => {
      const lang = lng?.startsWith("ar") ? "ar" : "fr";
      const dir = lang === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
      try {
        localStorage.setItem("app.lang", lang);
      } catch {
        /* noop */
      }
    };
    apply(i18n.language);
    i18n.on("languageChanged", apply);
    return () => {
      i18n.off("languageChanged", apply);
    };
  }, [i18n]);

  return <>{children}</>;
}
