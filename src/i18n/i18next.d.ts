import "i18next";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    returnNull: false;
    // Désactive le typage strict des clés : t("any.key") est autorisé.
    // Le namespace courant est inféré via useTranslation(ns).
    jsonFormat: "v4";
    allowObjectInHTMLChildren: true;
    resources: never;
  }
}
