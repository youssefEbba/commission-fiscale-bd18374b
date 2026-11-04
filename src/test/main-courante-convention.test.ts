import { describe, it, expect } from "vitest";
import { hrefFor } from "@/components/dashboard/MainCourante";
import { statutGroupForLigne, tStatutAny } from "@/i18n/enums";

describe("ligne « convention » de la main courante", () => {
  it("ouvre la fiche de la convention et traduit son statut", () => {
    const ligne = { type: "Convention", processus: "CONVENTION", id: 628 } as Parameters<typeof hrefFor>[0];
    expect(hrefFor(ligne)).toBe("/dashboard/conventions/628");
    expect(statutGroupForLigne("Convention", "CONVENTION")).toBe("statut_convention");
    expect(tStatutAny("EN_ATTENTE", "statut_convention")).toBe("En attente");
  });
});

describe("ligne « sous-traitance » de la main courante", () => {
  it("ouvre la liste des sous-traitances et traduit le statut", () => {
    const ligne = { type: "SousTraitance", processus: "SOUS_TRAITANCE", id: 1 } as Parameters<typeof hrefFor>[0];
    expect(hrefFor(ligne)).toBe("/dashboard/sous-traitance");
    expect(statutGroupForLigne("SousTraitance", "SOUS_TRAITANCE")).toBe("statut_sous_traitance");
  });
});
