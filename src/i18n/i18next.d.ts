import "i18next";
import type common from "./locales/fr/common.json";
import type nav from "./locales/fr/nav.json";
import type auth from "./locales/fr/auth.json";
import type conventions from "./locales/fr/conventions.json";
import type marches from "./locales/fr/marches.json";
import type demandes from "./locales/fr/demandes.json";
import type certificats from "./locales/fr/certificats.json";
import type utilisations from "./locales/fr/utilisations.json";
import type transferts from "./locales/fr/transferts.json";
import type cloture from "./locales/fr/cloture.json";
import type modifications from "./locales/fr/modifications.json";
import type ged from "./locales/fr/ged.json";
import type users from "./locales/fr/users.json";
import type roles from "./locales/fr/roles.json";
import type audit from "./locales/fr/audit.json";
import type referentiel from "./locales/fr/referentiel.json";
import type errors from "./locales/fr/errors.json";
import type enums from "./locales/fr/enums.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      nav: typeof nav;
      auth: typeof auth;
      conventions: typeof conventions;
      marches: typeof marches;
      demandes: typeof demandes;
      certificats: typeof certificats;
      utilisations: typeof utilisations;
      transferts: typeof transferts;
      cloture: typeof cloture;
      modifications: typeof modifications;
      ged: typeof ged;
      users: typeof users;
      roles: typeof roles;
      audit: typeof audit;
      referentiel: typeof referentiel;
      errors: typeof errors;
      enums: typeof enums;
    };
  }
}
