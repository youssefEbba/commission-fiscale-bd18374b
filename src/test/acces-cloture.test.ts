import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// L'administrateur n'a pas de droit de clôture côté serveur : sans « cloture.queue.view »,
// la page ouvrait sur un refus 403 et un message d'erreur. Menu et route exigent ce droit.
const lire = (f: string) => readFileSync(resolve(__dirname, "..", f), "utf8");

describe("accès à la page Clôture", () => {
  it("la route exige le droit de consulter les clôtures", () => {
    expect(lire("App.tsx")).toMatch(/path="\/dashboard\/cloture" element=\{\s*<ProtectedRoute[^>]*permission="cloture\.queue\.view"/);
  });

  it("l'entrée du menu exige le même droit", () => {
    expect(lire("components/dashboard/DashboardLayout.tsx")).toMatch(/href: "\/dashboard\/cloture"[^}]*permission: "cloture\.queue\.view"/);
  });
});
