import { describe, expect, it } from "vitest";
import {
  buildUpdateConventionRequest, canEditConvention, canManageConventionAutorites, conventionAutorites,
  conventionBailleurs, conventionCancelMode, conventionDateError, conventionToEditForm, marcheConventionIds,
} from "@/lib/conventionEditability";
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
  it("refuse un compte avec la permission mais sans autorité rattachée ni administration (DGB)", () => {
    expect(canEditConvention(conv(), undefined, true)).toBe(false);
  });
  it("refuse une autorité tierce", () => {
    expect(canEditConvention(conv(), 99, true)).toBe(false);
  });
  it("envoie tout le formulaire, vides à null, sans autorité contractante", () => {
    const form = conventionToEditForm(conv({ reference: " CONV-1 ", intitule: "Intitulé", projectReference: "", dateFin: "2027-03-31" }));
    const body = buildUpdateConventionRequest(form);
    expect(body).toEqual({
      reference: "CONV-1", intitule: "Intitulé", projectReference: null, bailleurId: null, bailleurIds: [],
      dateSignature: null, dateFin: "2027-03-31", deviseOrigine: null,
      montantDevise: null, tauxChange: null, montantMru: null,
    });
    expect("autoriteContractanteId" in body).toBe(false);
  });
});

describe("Modification par le Président et l'administrateur", () => {
  it.each(["EN_ATTENTE", "VALIDE", "REJETE"] as const)("autorisée en %s", statut => {
    expect(canEditConvention(conv({ statut }), undefined, true, true)).toBe(true);
  });
  it("refusée sur une convention annulée", () => {
    expect(canEditConvention(conv({ statut: "ANNULEE" }), undefined, true, true)).toBe(false);
  });
  it("refusée sans la permission convention.update", () => {
    expect(canEditConvention(conv({ statut: "VALIDE" }), undefined, false, true)).toBe(false);
  });
  it("l'autorité garde son droit actuel : convention validée non modifiable", () => {
    expect(canEditConvention(conv({ statut: "VALIDE" }), 10, true, false)).toBe(false);
  });
});

describe("Bailleurs multiples", () => {
  it("le premier bailleur choisi devient le principal et la liste complète est envoyée", () => {
    const form = conventionToEditForm(conv({ reference: "C", intitule: "I", bailleurs: [{ id: 3, nom: "BM" }, { id: 7, nom: "BAD" }] }));
    form.bailleurIds = [7, 3];
    const body = buildUpdateConventionRequest(form);
    expect(body.bailleurId).toBe(7);
    expect(body.bailleurIds).toEqual([7, 3]);
  });
  it("prérempli depuis le seul bailleur principal si la liste est absente", () => {
    expect(conventionToEditForm(conv({ bailleurId: 5, bailleurNom: "AFD" })).bailleurIds).toEqual([5]);
    expect(conventionBailleurs(conv({ bailleurId: 5, bailleurNom: "AFD" }))).toEqual([{ id: 5, nom: "AFD" }]);
  });
});

describe("Autorités reliées et conventions d'un marché", () => {
  it("liste des autorités dans l'ordre serveur, repli sur l'autorité principale", () => {
    expect(conventionAutorites(conv({ autorites: [{ id: 10, nom: "A" }, { id: 30, nom: "B" }] })).map(a => a.id)).toEqual([10, 30]);
    expect(conventionAutorites(conv({ autoriteContractanteNom: "A" }))).toEqual([{ id: 10, nom: "A" }]);
  });
  it("relier/délier : Président ou administrateur avec convention.update, pas une autorité", () => {
    expect(canManageConventionAutorites(conv({ statut: "VALIDE" }), true, true)).toBe(true);
    expect(canManageConventionAutorites(conv(), true, false)).toBe(false);
    expect(canManageConventionAutorites(conv({ statut: "ANNULEE" }), true, true)).toBe(false);
  });
  it("conventions d'un marché : liste serveur, repli sur la convention principale", () => {
    expect(marcheConventionIds({ conventionId: 4, conventionIds: [4, 9] })).toEqual([4, 9]);
    expect(marcheConventionIds({ conventionId: 4 })).toEqual([4]);
    expect(marcheConventionIds({})).toEqual([]);
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
