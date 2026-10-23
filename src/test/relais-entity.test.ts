import { describe, it, expect } from "vitest";
import { resolveEntityIds } from "@/contexts/AuthContext";

describe("resolveEntityIds — prise de relais", () => {
  it("en relais AC, l'autorité représentée devient l'autorité du compte", () => {
    expect(resolveEntityIds({ impersonating: true, actingAutoriteContractanteId: 10 }).autoriteContractanteId).toBe(10);
  });

  it("en relais entreprise, l'entreprise représentée devient l'entreprise du compte", () => {
    expect(resolveEntityIds({ impersonating: true, actingEntrepriseId: 7 }).entrepriseId).toBe(7);
  });

  it("hors relais, un identifiant acting* n'est jamais retenu", () => {
    expect(resolveEntityIds({ impersonating: false, actingAutoriteContractanteId: 10 }).autoriteContractanteId).toBeUndefined();
  });

  it("hors relais, l'autorité du compte est conservée", () => {
    expect(resolveEntityIds({ impersonating: false, autoriteContractanteId: 3 }).autoriteContractanteId).toBe(3);
  });
});
