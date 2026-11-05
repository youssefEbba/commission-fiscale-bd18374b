import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { DROITS } from "@/lib/droitsActions";

// Un bouton d'action suit le droit du serveur. Droits réels des rôles (extrait de la base de recette) :
const ADMIN = ["certificat.admin_override", "certificat.visa.admin_override", "correction.admin_override",
  "correction.visa.admin_override", "utilisation.admin_override", "convention.create", "convention.update",
  "convention.validate", "convention.reject", "archivage.view", "marche.manage"];
const AC = ["correction.submit", "correction.offer.upload", "correction.complement.add", "mise_en_place.submit",
  "mise_en_place.document.upload", "convention.create", "convention.document.upload", "utilisation.entreprise.rejet.repondre"];
const ENTREPRISE = ["mise_en_place.submit", "mise_en_place.document.upload", "utilisation.douane.submit",
  "utilisation.douane.document.upload", "utilisation.interieur.document.upload", "utilisation.entreprise.rejet.repondre"];
const DGTCP = ["mise_en_place.dgtcp.queue.view", "mise_en_place.dgtcp.validate", "correction.dgtcp.visa"];
const avec = (l: string[]) => (p: string) => l.includes(p);

describe("boutons d'action selon les droits du serveur", () => {
  it("l'administrateur ne voit aucun bouton de dépôt, de pièce ou de réponse", () => {
    for (const [nom, regle] of Object.entries(DROITS)) expect(regle(avec(ADMIN)), nom).toBe(false);
  });

  it("l'autorité contractante dépose corrections et mises en place, complète et répond", () => {
    expect(DROITS.deposerCorrection(avec(AC))).toBe(true);
    expect(DROITS.completerCorrection(avec(AC))).toBe(true);
    expect(DROITS.deposerMiseEnPlace(avec(AC))).toBe(true);
    expect(DROITS.deposerPieceCredit(avec(AC))).toBe(true);
    expect(DROITS.repondreRejetUtilisation(avec(AC))).toBe(true);
  });

  it("l'entreprise dépose une mise en place et les pièces d'une utilisation, mais pas une correction", () => {
    expect(DROITS.deposerMiseEnPlace(avec(ENTREPRISE))).toBe(true);
    expect(DROITS.deposerPieceUtilisation(avec(ENTREPRISE))).toBe(true);
    expect(DROITS.deposerCorrection(avec(ENTREPRISE))).toBe(false);
  });

  it("la DGTCP ne modifie ni ne soumet un brouillon de mise en place", () => {
    expect(DROITS.deposerMiseEnPlace(avec(DGTCP))).toBe(false);
    expect(DROITS.deposerPieceCredit(avec(DGTCP))).toBe(false);
  });

  it("les pages n'ouvrent plus ces actions par le rôle ADMIN_SI", () => {
    const lire = (f: string) => readFileSync(resolve(__dirname, "..", f), "utf8");
    expect(lire("pages/Demandes.tsx")).not.toMatch(/hasRole\(\[[^\]]*"ADMIN_SI"\]\)/);
    expect(lire("pages/DemandesMiseEnPlace.tsx")).not.toMatch(/role === "ADMIN_SI"/);
    expect(lire("pages/CertificatDetail.tsx")).not.toMatch(/canUpload = role ===/);
    expect(lire("pages/DemandeDetail.tsx")).not.toMatch(/hasRole\(\["AUTORITE_CONTRACTANTE", "ADMIN_SI"\]\)/);
    expect(lire("pages/CorrectionDouaniere.tsx")).not.toMatch(/userRole === "ADMIN_SI"/);
    expect(lire("pages/UtilisationDetail.tsx")).not.toMatch(/canUploadDoc = role ===/);
    expect(lire("pages/Conventions.tsx")).not.toMatch(/\(isAC \|\| isAdmin\) &&/);
    expect(lire("pages/ConventionDetail.tsx")).not.toMatch(/canManage = \(isAC \|\| isAdmin\)/);
  });
});
