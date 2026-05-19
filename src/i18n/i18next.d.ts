import "i18next";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    returnNull: false;
    // Pas de typage strict des clés : t() accepte n'importe quelle string.
    resources: {
      common: Record<string, unknown>;
      nav: Record<string, unknown>;
      auth: Record<string, unknown>;
      conventions: Record<string, unknown>;
      marches: Record<string, unknown>;
      demandes: Record<string, unknown>;
      certificats: Record<string, unknown>;
      utilisations: Record<string, unknown>;
      transferts: Record<string, unknown>;
      cloture: Record<string, unknown>;
      modifications: Record<string, unknown>;
      ged: Record<string, unknown>;
      users: Record<string, unknown>;
      roles: Record<string, unknown>;
      audit: Record<string, unknown>;
      referentiel: Record<string, unknown>;
      errors: Record<string, unknown>;
      enums: Record<string, unknown>;
    };
  }
}
