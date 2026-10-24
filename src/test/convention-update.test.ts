import { describe, expect, it } from "vitest";
import { buildUpdateConventionRequest, canEditConvention, conventionToEditForm } from "@/lib/conventionEditability";
import type { ConventionDto } from "@/lib/api";

const conv = (over: Partial<ConventionDto> = {}): ConventionDto => ({
  id: 1, statut: "EN_ATTENTE", autoriteContractanteId: 10, creeParAutoriteContractanteId: 20, ...over,
});

describe("Modification d'une convention", () => {
  it("autorise l'autorité titulaire tant que la convention est en attente", () => {
    expect(canEditConvention(conv(), 10, true)).toBe(true);
  });
  it("autorise l'autorité créatrice", () => {
    expect(canEditConvention(conv(), 20, true)).toBe(true);
  });
  it.each(["VALIDE", "REJETE", "ANNULEE"] as const)("refuse la modification en %s", statut => {
    expect(canEditConvention(conv({ statut }), 10, true)).toBe(false);
  });
  it("refuse sans la permission convention.update", () => {
    expect(canEditConvention(conv(), 10, false)).toBe(false);
  });
  it("refuse un compte avec la permission mais sans autorité rattachée (Président, DGB, administrateur)", () => {
    expect(canEditConvention(conv(), undefined, true)).toBe(false);
  });
  it("refuse une autorité tierce", () => {
    expect(canEditConvention(conv(), 99, true)).toBe(false);
  });
  it("envoie tout le formulaire, vides à null, sans autorité contractante", () => {
    const form = conventionToEditForm(conv({ reference: " CONV-1 ", intitule: "Intitulé", projectReference: "", dateFin: "2027-03-31" }));
    const body = buildUpdateConventionRequest(form);
    expect(body).toEqual({
      reference: "CONV-1", intitule: "Intitulé", projectReference: null, bailleurId: null,
      dateSignature: null, dateFin: "2027-03-31", deviseOrigine: null,
      montantDevise: null, tauxChange: null, montantMru: null,
    });
    expect("autoriteContractanteId" in body).toBe(false);
  });
});
