import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// FR namespaces
import frCommon from "./locales/fr/common.json";
import frNav from "./locales/fr/nav.json";
import frAuth from "./locales/fr/auth.json";
import frLanding from "./locales/fr/landing.json";
import frDashboard from "./locales/fr/dashboard.json";
import frNotifications from "./locales/fr/notifications.json";
import frValidation from "./locales/fr/validation.json";
import frConventions from "./locales/fr/conventions.json";
import frMarches from "./locales/fr/marches.json";
import frDemandes from "./locales/fr/demandes.json";
import frCertificats from "./locales/fr/certificats.json";
import frUtilisations from "./locales/fr/utilisations.json";
import frTransferts from "./locales/fr/transferts.json";
import frCloture from "./locales/fr/cloture.json";
import frModifications from "./locales/fr/modifications.json";
import frGed from "./locales/fr/ged.json";
import frUsers from "./locales/fr/users.json";
import frRoles from "./locales/fr/roles.json";
import frAudit from "./locales/fr/audit.json";
import frReferentiel from "./locales/fr/referentiel.json";
import frErrors from "./locales/fr/errors.json";
import frEnums from "./locales/fr/enums.json";

// AR namespaces
import arCommon from "./locales/ar/common.json";
import arNav from "./locales/ar/nav.json";
import arAuth from "./locales/ar/auth.json";
import arLanding from "./locales/ar/landing.json";
import arDashboard from "./locales/ar/dashboard.json";
import arNotifications from "./locales/ar/notifications.json";
import arValidation from "./locales/ar/validation.json";
import arConventions from "./locales/ar/conventions.json";
import arMarches from "./locales/ar/marches.json";
import arDemandes from "./locales/ar/demandes.json";
import arCertificats from "./locales/ar/certificats.json";
import arUtilisations from "./locales/ar/utilisations.json";
import arTransferts from "./locales/ar/transferts.json";
import arCloture from "./locales/ar/cloture.json";
import arModifications from "./locales/ar/modifications.json";
import arGed from "./locales/ar/ged.json";
import arUsers from "./locales/ar/users.json";
import arRoles from "./locales/ar/roles.json";
import arAudit from "./locales/ar/audit.json";
import arReferentiel from "./locales/ar/referentiel.json";
import arErrors from "./locales/ar/errors.json";
import arEnums from "./locales/ar/enums.json";

export const SUPPORTED_LANGS = ["fr", "ar"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "landing",
  "dashboard",
  "notifications",
  "validation",
  "conventions",
  "marches",
  "demandes",
  "certificats",
  "utilisations",
  "transferts",
  "cloture",
  "modifications",
  "ged",
  "users",
  "roles",
  "audit",
  "referentiel",
  "errors",
  "enums",
] as const;

const resources = {
  fr: {
    common: frCommon,
    nav: frNav,
    auth: frAuth,
    landing: frLanding,
    dashboard: frDashboard,
    notifications: frNotifications,
    validation: frValidation,
    conventions: frConventions,
    marches: frMarches,
    demandes: frDemandes,
    certificats: frCertificats,
    utilisations: frUtilisations,
    transferts: frTransferts,
    cloture: frCloture,
    modifications: frModifications,
    ged: frGed,
    users: frUsers,
    roles: frRoles,
    audit: frAudit,
    referentiel: frReferentiel,
    errors: frErrors,
    enums: frEnums,
  },
  ar: {
    common: arCommon,
    nav: arNav,
    auth: arAuth,
    landing: arLanding,
    dashboard: arDashboard,
    notifications: arNotifications,
    validation: arValidation,
    conventions: arConventions,
    marches: arMarches,
    demandes: arDemandes,
    certificats: arCertificats,
    utilisations: arUtilisations,
    transferts: arTransferts,
    cloture: arCloture,
    modifications: arModifications,
    ged: arGed,
    users: arUsers,
    roles: arRoles,
    audit: arAudit,
    referentiel: arReferentiel,
    errors: arErrors,
    enums: arEnums,
  },
} as const;

const STORAGE_KEY = "app.lang";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    ns: NAMESPACES as unknown as string[],
    defaultNS: "common",
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, ns, key) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing key "${ns}:${key}" for ${lngs.join(",")}`);
      }
    },
  });

export default i18n;
