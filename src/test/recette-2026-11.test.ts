import { describe, it, expect, vi, afterEach } from "vitest";
import "@/i18n";
import i18n from "@/i18n";
import { miseEnPlaceRowAction } from "@/lib/miseEnPlaceRowAction";
import { isUtilisationAControler } from "@/lib/utilisationQueues";
import { isStockTvaEpuise } from "@/lib/tvaStock";
import { utilisationsEnCours } from "@/lib/avenants";
import { canDecideConvention } from "@/lib/conventionEditability";
import { tStatutAny, statutGroupForLigne, tUtilisationStatutContextualise, tTypeDecision, tTypeDocument } from "@/i18n/enums";
import { apiFetch } from "@/lib/api";

describe("A18 — « Traiter » sur la liste des mises en place", () => {
  const attendues = new Set([7]);
  it("une demande annulée n'offre que « Voir », même à une direction", () => {
    expect(miseEnPlaceRowAction({ role: "DGD", statut: "ANNULE", attendues, id: 7 })).toBe("view");
  });
  it("« Traiter » seulement si la demande attend la direction connectée", () => {
    expect(miseEnPlaceRowAction({ role: "DGI", statut: "EN_CONTROLE", attendues, id: 7 })).toBe("process");
    expect(miseEnPlaceRowAction({ role: "DGI", statut: "EN_CONTROLE", attendues, id: 8 })).toBe("view");
  });
});

describe("A25 — « Dossiers à contrôler » (DGTCP)", () => {
  it("compte TVA Demandée / À recontrôler et douane Chèque saisi", () => {
    expect(isUtilisationAControler({ type: "TVA_INTERIEURE", statut: "DEMANDEE" })).toBe(true);
    expect(isUtilisationAControler({ type: "TVA_INTERIEURE", statut: "A_RECONTROLER" })).toBe(true);
    expect(isUtilisationAControler({ type: "DOUANIER", statut: "CHEQUE_SAISI" })).toBe(true);
  });
  it("n'inclut pas une douane Demandée", () => {
    expect(isUtilisationAControler({ type: "DOUANIER", statut: "DEMANDEE" })).toBe(false);
  });
});

describe("A40 — stock TVA « Épuisé »", () => {
  it("épuisé seulement quand le restant vaut 0", () => {
    expect(isStockTvaEpuise({ montantRestant: 0 })).toBe(true);
    expect(isStockTvaEpuise({ montantRestant: 1500 })).toBe(false);
  });
});

describe("A36 — utilisation en cours bloque « Appliquer »", () => {
  it("une utilisation Demandée est en cours, une Clôturée non", () => {
    const list = [{ id: 1, statut: "DEMANDEE" }, { id: 2, statut: "CLOTUREE" }];
    expect(utilisationsEnCours(list).map((u) => u.id)).toEqual([1]);
  });
});

describe("A27 — Valider / Rejeter une convention", () => {
  it("DGB ou DGI, convention En attente seulement", () => {
    expect(canDecideConvention({ statut: "EN_ATTENTE" }, true)).toBe(true);
    expect(canDecideConvention({ statut: "VALIDE" }, true)).toBe(false);
    expect(canDecideConvention({ statut: "EN_ATTENTE" }, false)).toBe(false);
  });
});

describe("A03 — statuts traduits dans la main courante", () => {
  it("traduit un statut de transfert et une ligne d'avenant", () => {
    i18n.changeLanguage("fr");
    expect(tStatutAny("TRANSFERE", statutGroupForLigne("TransfertCredit", "TRANSFERT"))).not.toBe("TRANSFERE");
    expect(tStatutAny("DEPOSE", statutGroupForLigne("Avenant", "AVENANT"))).toBe("Déposé");
  });
});

describe("A38 / A23 / A04 — libellés", () => {
  it("CLOTUREE s'affiche « Clôturée » sans mention de transfert par défaut", () => {
    i18n.changeLanguage("fr");
    expect(tUtilisationStatutContextualise("CLOTUREE")).toBe("Clôturée");
  });
  it("REJET_TEMP se lit « Demande de pièces »", () => {
    i18n.changeLanguage("fr");
    expect(tTypeDecision("REJET_TEMP")).toBe("Demande de pièces");
  });
  it("MANDAT_REPRESENTATION et OFFRE_FISCALE ont un libellé", () => {
    i18n.changeLanguage("fr");
    expect(tTypeDocument("MANDAT_REPRESENTATION")).toBe("Mandat de représentation");
    expect(tTypeDocument("OFFRE_FISCALE")).toBe("Offre fiscale");
  });
});

describe("A31 — échec d'envoi de document en 503", () => {
  afterEach(() => vi.restoreAllMocks());
  it("affiche « dépôt momentanément indisponible »", async () => {
    i18n.changeLanguage("fr");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: 503, message: "MinIO down" }), { status: 503 }));
    const fd = new FormData();
    await expect(apiFetch("/x/documents", { method: "POST", rawBody: fd })).rejects.toThrow(
      "Le dépôt des documents est momentanément indisponible, réessayez plus tard.",
    );
  });
});
