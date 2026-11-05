import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { peutSoumettreUtilisation } from "@/lib/droitsUtilisation";

// Le bouton « Nouvelle utilisation » suit le droit du serveur, pas le rôle : l'administrateur ne l'a pas.
const avec = (...droits: string[]) => (p: string) => droits.includes(p);

describe("créer une utilisation", () => {
  it("est proposé à qui peut soumettre (douane ou TVA intérieure)", () => {
    expect(peutSoumettreUtilisation(avec("utilisation.douane.submit"))).toBe(true);
    expect(peutSoumettreUtilisation(avec("utilisation.interieur.submit"))).toBe(true);
  });

  it("n'est pas proposé à l'administrateur, qui n'a que la correction après coup", () => {
    expect(peutSoumettreUtilisation(avec("utilisation.admin_override", "archivage.view"))).toBe(false);
  });

  it("les pages ne décident plus par le rôle ADMIN_SI", () => {
    const lire = (f: string) => readFileSync(resolve(__dirname, "..", f), "utf8");
    expect(lire("pages/Utilisations.tsx")).not.toMatch(/canCreate = role ===/);
    expect(lire("pages/CertificatDetail.tsx")).not.toMatch(/\(role === "ENTREPRISE" \|\| role === "ADMIN_SI"\)/);
  });
});
