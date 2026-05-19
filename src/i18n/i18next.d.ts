import "i18next";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    returnNull: false;
    // Resources volontairement non-typés strictement pour autoriser t("...") avec n'importe quelle clé connue.
    // Le namespace courant est inféré via useTranslation(ns).
    resources: Record<string, Record<string, unknown>>;
  }
}
