import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { NOTIF_TYPE_ROUTES, ENTITY_TYPE_ROUTES } from "@/components/dashboard/NotificationBell";
import i18n from "@/i18n";
import { tNotificationType, tStatutAny } from "@/i18n/enums";

// Routes déclarées dans App.tsx, en expressions régulières (":id" → un segment).
const routes = [...readFileSync(resolve(__dirname, "../App.tsx"), "utf8").matchAll(/path="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((p) => p !== "*")
  .map((p) => new RegExp("^" + p.replace(/:[^/]+/g, "[^/]+") + "$"));

const existe = (url: string) => routes.some((r) => r.test(url.split("?")[0]));

describe("liens des notifications", () => {
  const tables = { ...NOTIF_TYPE_ROUTES, ...ENTITY_TYPE_ROUTES };
  for (const [type, lien] of Object.entries(tables)) {
    it(`${type} ouvre une page existante`, () => {
      expect(existe(lien()), lien()).toBe(true);
      expect(existe(lien(12)), lien(12)).toBe(true);
    });
  }
});


// Types émis par le backend (enum NotificationType de commission-fiscale-backend).
const TYPES_BACKEND = [
  "CORRECTION_STATUT_CHANGE", "CORRECTION_DECISION", "REFERENTIEL_STATUT_CHANGE", "CONVENTION_STATUT_CHANGE",
  "CERTIFICAT_STATUT_CHANGE", "UTILISATION_STATUT_CHANGE", "TRANSFERT_CREDIT", "SOUS_TRAITANCE",
  "DEMANDE_EXPLICATION", "CLOTURE_CERTIFICAT", "REJET_TEMP_DECISION", "REJET_TEMP_RESOLU", "REJET_TEMP_REPONSE",
  "PASSWORD_RESET_REQUEST", "PASSWORD_RESET_TRAITEE", "RATTACHEMENT_DEMANDE", "RATTACHEMENT_TRAITEE",
  "MODIFICATION_STATUT_CHANGE", "ENQUETE_SATISFACTION",
];

describe("libellés des notifications", () => {
  for (const lang of ["fr", "ar"]) {
    it(`chaque type du backend a un libellé (${lang})`, async () => {
      await i18n.changeLanguage(lang);
      for (const type of TYPES_BACKEND) {
        const libelle = tNotificationType(type);
        expect(libelle, type).not.toBe(type);
        expect(libelle, type).not.toMatch(/types\./);
      }
    });
  }

  it("une clé absente donne le code, jamais le chemin de la clé", async () => {
    await i18n.changeLanguage("fr");
    expect(tNotificationType("TYPE_INCONNU")).toBe("TYPE_INCONNU");
    expect(tStatutAny("STATUT_INCONNU")).toBe("STATUT_INCONNU");
  });
});
