import { describe, expect, it } from "vitest";
import { buildUpdateConventionRequest, canEditConvention, conventionCancelMode, conventionDateError, conventionToEditForm } from "@/lib/conventionEditability";
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

describe("Annulation d'une convention", () => {
  it("autorité titulaire ou créatrice en attente : route autorité", () => {
    expect(conventionCancelMode(conv(), 10, true, false)).toBe("autorite");
    expect(conventionCancelMode(conv(), 20, true, false)).toBe("autorite");
  });
  it("autorité tierce : aucun bouton", () => {
    expect(conventionCancelMode(conv(), 99, true, false)).toBeNull();
  });
  it.each(["VALIDE", "REJETE", "ANNULEE"] as const)("autorité : aucun bouton en %s", statut => {
    expect(conventionCancelMode(conv({ statut }), 10, true, false)).toBeNull();
  });
  it("autorité sans la permission convention.annuler : aucun bouton", () => {
    expect(conventionCancelMode(conv(), 10, false, false)).toBeNull();
  });
  it("Président (permission, sans autorité) : route de statut", () => {
    expect(conventionCancelMode(conv(), undefined, true, true)).toBe("statut");
  });
  it("administration : jamais sur une convention validée ou déjà annulée", () => {
    expect(conventionCancelMode(conv({ statut: "VALIDE" }), undefined, true, true)).toBeNull();
    expect(conventionCancelMode(conv({ statut: "ANNULEE" }), undefined, true, true)).toBeNull();
  });
});

describe("Contrôle des dates", () => {
  const today = "2026-10-24";
  it("modification : date de fin déjà passée et inchangée, enregistrement autorisé", () => {
    expect(conventionDateError({ dateFin: "2026-01-31" }, today, { dateFin: "2026-01-31" })).toBeNull();
  });
  it("modification : date de fin changée vers le passé, refusée", () => {
    expect(conventionDateError({ dateFin: "2026-02-28" }, today, { dateFin: "2026-01-31" })).toBe("date_fin_past");
  });
  it("modification : date de signature changée vers le futur, refusée", () => {
    expect(conventionDateError({ dateSignature: "2026-11-01" }, today, { dateSignature: "2026-10-01" })).toBe("date_signature_future");
  });
  it("création : date de fin passée refusée", () => {
    expect(conventionDateError({ dateFin: "2026-01-31" }, today)).toBe("date_fin_past");
  });
});
