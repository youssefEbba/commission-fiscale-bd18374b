import { describe, expect, it } from "vitest";
import {
  avenantActions, avenantDepotErrors, buildApplicationRequest, buildCreateAvenantRequest,
  canDeposerAvenant, canUploadAvenantPieces, checkAvenantRecap, previewSoldesApresAvenant,
  type AvenantDepotForm, type AvenantRecapForm,
} from "@/lib/avenants";

const perms = (...p: string[]) => (x: string) => p.includes(x);

const depot = (o: Partial<AvenantDepotForm> = {}): AvenantDepotForm => ({
  certificatCreditId: "7", type: "JURIDIQUE", motif: "Prolongation", dateSignature: "2026-10-01",
  creditExterieurPropose: "", creditInterieurPropose: "", ...o,
});

const recap = (o: Partial<AvenantRecapForm> = {}): AvenantRecapForm => ({
  a: "1000", b: "100", c: "20", d: "30", f: "5000", g: "530",
  montantCordon: "150", montantTVAInterieure: "500", ...o,
});

describe("dépôt d'un avenant", () => {
  it("n'est proposé que sur un crédit OUVERT ou MODIFIE avec modification.submit", () => {
    const has = perms("modification.submit");
    expect(canDeposerAvenant("OUVERT", has)).toBe(true);
    expect(canDeposerAvenant("MODIFIE", has)).toBe(true);
    expect(canDeposerAvenant("CLOTURE", has)).toBe(false);
    expect(canDeposerAvenant("OUVERT", perms())).toBe(false);
  });

  it("exige les deux crédits proposés pour un avenant FINANCIER", () => {
    expect(avenantDepotErrors(depot({ type: "FINANCIER", creditExterieurPropose: "10" }), "2026-10-30")).toContain("credits_required");
    expect(avenantDepotErrors(depot({ type: "FINANCIER", creditExterieurPropose: "10", creditInterieurPropose: "0" }), "2026-10-30")).toEqual([]);
  });

  it("envoie des crédits nuls pour un avenant non financier et une date au format Instant", () => {
    const body = buildCreateAvenantRequest(depot({ creditExterieurPropose: "99" }));
    expect(body.creditExterieurPropose).toBeNull();
    expect(body.dateSignature).toBe("2026-10-01T00:00:00Z");
  });

  it("refuse une date de signature future", () => {
    expect(avenantDepotErrors(depot({ dateSignature: "2026-11-01" }), "2026-10-30")).toContain("date_signature_future");
  });

  it("n'autorise les pièces que tant que l'avenant est DEPOSE", () => {
    const has = perms("modification.document.upload");
    expect(canUploadAvenantPieces({ statut: "DEPOSE" }, has)).toBe(true);
    expect(canUploadAvenantPieces({ statut: "EN_COURS_TRAITEMENT" }, has)).toBe(false);
  });
});

describe("gestes du circuit", () => {
  it("DGTCP : prise en charge et rejet au statut DEPOSE", () => {
    const a = avenantActions({ statut: "DEPOSE" }, perms("modification.dgtcp.analyze"));
    expect(a.priseEnCharge).toBe("direct");
    expect(a.rejet).toBe("direct");
  });

  it("administrateur : prise en charge par substitution, sans rejet à l'examen", () => {
    const a = avenantActions({ statut: "DEPOSE" }, perms("modification.admin_override"));
    expect(a.priseEnCharge).toBe("admin");
    expect(a.rejet).toBeNull();
  });

  it("Président : valider/rejeter en cours de traitement sans demande de correction", () => {
    const has = perms("modification.president.validate", "modification.president.reject");
    expect(avenantActions({ statut: "EN_COURS_TRAITEMENT" }, has)).toMatchObject({ validation: "direct", rejet: "direct" });
    expect(avenantActions({ statut: "EN_COURS_TRAITEMENT", demandeCorrectionId: 12 }, has)).toMatchObject({ validation: null, rejet: null });
  });

  it("DGTCP : appliquer seulement au statut ADOPTE", () => {
    const has = perms("modification.dgtcp.propose");
    expect(avenantActions({ statut: "ADOPTE" }, has).application).toBe(true);
    expect(avenantActions({ statut: "APPLIQUE" }, has).application).toBe(false);
  });
});

describe("récapitulatif d'application", () => {
  it("accepte e = b + c + d et h = g − d", () => {
    expect(checkAvenantRecap(recap()).errors).toEqual([]);
  });

  it("tolère un écart de 1 MRU et signale l'écart signé au-delà", () => {
    expect(checkAvenantRecap(recap({ montantCordon: "151" })).errors).toEqual([]);
    const r = checkAvenantRecap(recap({ montantCordon: "152.5" }));
    expect(r.errors).toContain("cordon_mismatch");
    expect(r.ecartCordon).toBeCloseTo(2.5);
  });

  it("exige b et d quand le crédit extérieur est positif ; c facultatif", () => {
    expect(checkAvenantRecap(recap({ b: "" })).errors).toContain("bd_required");
    expect(checkAvenantRecap(recap({ c: "", montantCordon: "130" })).errors).toEqual([]);
  });

  it("envoie d sous tvaImportationDouaneAccordee", () => {
    expect(buildApplicationRequest(recap()).tvaImportationDouaneAccordee).toBe(30);
  });

  it("aperçu : consommé conservé, restant remplacé, signale un montant inférieur au consommé", () => {
    const cert = { montantCordon: 200, soldeCordon: 120, montantTVAInterieure: 600, soldeTVA: 600, tvaImportationDouaneAccordee: 30, tvaImportationDouane: 30 };
    const [cordon] = previewSoldesApresAvenant(cert, recap({ montantCordon: "150" }));
    expect(cordon.consomme).toBe(80);
    expect(cordon.soldeApres).toBe(70);
    expect(previewSoldesApresAvenant(cert, recap({ montantCordon: "50" }))[0].insuffisant).toBe(true);
  });
});
