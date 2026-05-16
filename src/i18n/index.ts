import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import frCommon from "./locales/fr/common.json";
import frLanding from "./locales/fr/landing.json";
import frAuth from "./locales/fr/auth.json";
import arCommon from "./locales/ar/common.json";
import arLanding from "./locales/ar/landing.json";
import arAuth from "./locales/ar/auth.json";

export const SUPPORTED_LANGS = ["fr", "ar"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

export const RTL_LANGS: AppLang[] = ["ar"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { common: frCommon, landing: frLanding, auth: frAuth },
      ar: { common: arCommon, landing: arLanding, auth: arAuth },
    },
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    defaultNS: "common",
    ns: ["common", "landing", "auth"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
  });

const applyDir = (lng: string) => {
  const isRtl = RTL_LANGS.includes(lng as AppLang);
  document.documentElement.lang = lng;
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
};

applyDir(i18n.language || "fr");
i18n.on("languageChanged", applyDir);

export default i18n;
