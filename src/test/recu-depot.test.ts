import { describe, it, expect, vi, beforeEach } from "vitest";

const sonner = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: sonner }));
vi.mock("@/lib/openDocument", () => ({
  presentBlob: vi.fn(),
  trackDocumentTask: (_k: string, _m: string, _l: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/recuDepotPdf", async (orig) => ({
  ...(await orig<typeof import("@/lib/recuDepotPdf")>()),
  generateRecuPdf: vi.fn(async () => new Blob(["%PDF"], { type: "application/pdf" })),
}));

import i18n from "@/i18n";
import { presentBlob } from "@/lib/openDocument";
import {
  recuAvenant, recuCorrection, recuFileName, recuMiseEnPlace, recuSections, recuSousTraitance, recuTransfert, recuUtilisation,
} from "@/lib/recuDepotPdf";
import { emettreRecuDepot, peutVoirRecu, recuVersions, soumisDepuis, type RecuCible } from "@/lib/recuDepot";
import { NAV_ENTRIES, isGroup } from "@/components/dashboard/navEntries";
import type {
  AvenantDto, CertificatCreditDto, DemandeCorrectionDto, SousTraitanceDto, TransfertCreditDto, UtilisationCreditDto,
} from "@/lib/api";

const labels = (rows: { label: string; value?: string | null }[]) => Object.fromEntries(rows.map((r) => [r.label, r.value]));

describe("reçu de dépôt générique : adaptateurs", () => {
  beforeEach(async () => { await i18n.changeLanguage("fr"); });

  it("un sous-titre et une référence par processus", () => {
    const cases = [
      recuCorrection({ id: 1, reference: "DC-0001-11-2026", statut: "RECUE" } as DemandeCorrectionDto),
      recuMiseEnPlace({ id: 2, reference: "MP-0002-11-2026", statut: "EN_CONTROLE" } as CertificatCreditDto),
      recuUtilisation({ id: 3, reference: "DU-0003", type: "DOUANIER", statut: "DEMANDEE", certificatCreditId: 9 } as UtilisationCreditDto),
      recuUtilisation({ id: 4, type: "TVA_INTERIEURE", statut: "DEMANDEE", certificatCreditId: 9 } as UtilisationCreditDto),
      recuTransfert({ id: 5, reference: "TR-0005-11-2026", statut: "DEMANDE", montant: "100", certificatCreditId: 9 } as TransfertCreditDto),
      recuAvenant({ id: 6, numero: "AV-6", type: "FINANCIER", statut: "DEPOSE", certificatCreditId: 9 } as AvenantDto),
      recuSousTraitance({ id: 7, statut: "DEMANDE", certificatCreditId: 9 } as SousTraitanceDto),
    ];
    expect(cases.map((m) => m.processus)).toEqual(["CORRECTION", "MISE_EN_PLACE", "UTILISATION_DOUANE", "UTILISATION_TVA", "TRANSFERT", "AVENANT", "SOUS_TRAITANCE"]);
    expect(cases.map((m) => m.reference)).toEqual(["DC-0001-11-2026", "MP-0002-11-2026", "DU-0003", "—", "TR-0005-11-2026", "AV-6", "—"]);
    for (const m of cases) expect(i18n.t(`demandes:recu.subtitle_processus.${m.processus}`)).not.toContain("subtitle_processus");
  });

  it("date de dépôt = date de soumission renvoyée ; sans date, celle de l'édition ; reconstitué : statut omis", () => {
    const now = new Date("2026-11-17T10:00:00Z");
    const m = recuMiseEnPlace({ id: 2, reference: "MP-2", statut: "EN_CONTROLE", dateEmission: "2026-11-10T08:30:00Z" } as CertificatCreditDto);
    const depot = labels(recuSections(m, false, now)[0].rows);
    expect(depot["Date et heure de dépôt"]).toMatch(/10\/11\/2026/);
    expect(depot["Statut à l'issue du dépôt"]).toBeTruthy();

    const st = recuSousTraitance({ id: 7, statut: "DEMANDE", certificatCreditId: 9 } as SousTraitanceDto);
    expect(labels(recuSections(st, false, now)[0].rows)["Date et heure de dépôt"]).toMatch(/17\/11\/2026/);
    const regen = labels(recuSections(st, true, now)[0].rows);
    expect(regen["Date et heure de dépôt"]).toBeNull();
    expect("Statut à l'issue du dépôt" in regen).toBe(false);
  });

  it("lignes facultatives vides et sections vides retirées", () => {
    const tr = recuTransfert({ id: 5, statut: "DEMANDE", montant: 100, certificatCreditId: 9, certificatReference: "CI-9" } as TransfertCreditDto);
    const keys = recuSections(tr, true).map((s) => s.key);
    expect(keys).not.toContain("section_titulaire");
    const av = recuAvenant({ id: 6, type: "JURIDIQUE", statut: "DEPOSE", certificatCreditId: 9 } as AvenantDto);
    expect(recuSections(av, true).map((s) => s.key)).not.toContain("section_montants");
  });

  it("utilisation d'un sous-traitant : titulaire du crédit et sous-traitant", () => {
    const m = recuUtilisation({ id: 3, type: "DOUANIER", statut: "DEMANDEE", certificatCreditId: 9, demandeurEstSousTraitant: true, certificatTitulaireRaisonSociale: "TITULAIRE", entrepriseNom: "ST SARL" } as UtilisationCreditDto);
    expect(labels(m.titulaire)).toEqual({ "Titulaire du crédit": "TITULAIRE", "Sous-traitant": "ST SARL" });
  });

  it("nom de fichier par processus (correction inchangée)", () => {
    expect(recuFileName({ processus: "CORRECTION", reference: "DC-0001-11-2026" })).toBe("recu-depot-DC-0001-11-2026.pdf");
    expect(recuFileName({ processus: "UTILISATION_TVA", reference: "DU-0004-11-2026" })).toBe("recu-depot-utilisation-tva-DU-0004-11-2026.pdf");
  });
});

describe("reçu de dépôt : émission et affichage", () => {
  beforeEach(() => { sonner.success.mockReset(); sonner.warning.mockReset(); vi.mocked(presentBlob).mockReset(); });

  const cible = (upload: RecuCible["upload"]): RecuCible => ({
    id: 3,
    modele: recuTransfert({ id: 3, reference: "TR-3", statut: "DEMANDE", montant: 1, certificatCreditId: 9 } as TransfertCreditDto),
    getDocuments: async () => [],
    upload,
  });

  it("génère, télécharge puis téléverse le reçu", async () => {
    const upload = vi.fn(async () => ({}));
    expect(await emettreRecuDepot(cible(upload))).toBe(true);
    expect(presentBlob).toHaveBeenCalledWith(expect.any(Blob), "recu-depot-transfert-TR-3.pdf", "download");
    expect((upload.mock.calls[0] as unknown as [File])[0].name).toBe("recu-depot-transfert-TR-3.pdf");
    expect(sonner.success).toHaveBeenCalled();
  });

  it("un échec du téléversement avertit sans lever, le PDF reste téléchargé", async () => {
    const upload = vi.fn(async () => { throw new Error("Stockage indisponible"); });
    expect(await emettreRecuDepot(cible(upload))).toBe(false);
    expect(presentBlob).toHaveBeenCalled();
    expect(sonner.warning).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ description: expect.stringContaining("Stockage indisponible") }));
  });

  it("la référence imprimée est celle du dossier relu, pas celle de la réponse de soumission", async () => {
    const generate = vi.mocked((await import("@/lib/recuDepotPdf")).generateRecuPdf);
    generate.mockClear();
    const upload = vi.fn(async () => ({}));
    const soumise = { id: 828, reference: "DU-0825-11-2026", type: "DOUANIER", statut: "DEMANDEE", certificatCreditId: 9 } as UtilisationCreditDto;
    const c: RecuCible = {
      id: 828,
      modele: recuUtilisation(soumise),
      relire: async () => recuUtilisation({ ...soumise, reference: "DU-0828-11-2026" }),
      getDocuments: async () => [],
      upload,
    };
    expect(await emettreRecuDepot(c)).toBe(true);
    expect(generate.mock.calls[0][0].reference).toBe("DU-0828-11-2026");
    expect((upload.mock.calls[0] as unknown as [File])[0].name).toBe("recu-depot-utilisation-douane-DU-0828-11-2026.pdf");
  });

  it("relecture impossible : repli sur la réponse de soumission", async () => {
    const generate = vi.mocked((await import("@/lib/recuDepotPdf")).generateRecuPdf);
    generate.mockClear();
    const soumise = { id: 5, reference: "DU-0005", type: "DOUANIER", statut: "DEMANDEE", certificatCreditId: 9 } as UtilisationCreditDto;
    const c: RecuCible = { id: 5, modele: recuUtilisation(soumise), relire: async () => { throw new Error("réseau"); }, getDocuments: async () => [], upload: async () => ({}) };
    expect(await emettreRecuDepot(c)).toBe(true);
    expect(generate.mock.calls[0][0].reference).toBe("DU-0005");
  });

  it("reçu émis seulement pour un dossier réellement soumis", () => {
    expect(soumisDepuis({ kind: "submitted", result: { statut: "RECUE" } })).toEqual({ statut: "RECUE" });
    expect(soumisDepuis({ kind: "already_sent", result: { statut: "DEMANDE" } })).toEqual({ statut: "DEMANDE" });
    expect(soumisDepuis({ kind: "submitted", result: { statut: "BROUILLON" } })).toBeNull();
    expect(soumisDepuis({ kind: "missing_documents", result: { statut: "BROUILLON" }, codes: ["X"] })).toBeNull();
    expect(soumisDepuis({ kind: "route_unavailable", result: { statut: "BROUILLON" } })).toBeNull();
  });

  it("versions : une par dépôt, la plus récente en tête", () => {
    const docs = [
      { id: 1, type: "RECU_DEPOT", version: 1, actif: false },
      { id: 2, type: "AUTRE", version: 1 },
      { id: 3, type: "X", codeDocument: "RECU_DEPOT", version: 2, actif: true },
    ];
    expect(recuVersions(docs).map((d) => d.id)).toEqual([3, 1]);
  });

  it("carte visible du déposant (entreprise comprise) hors brouillon", () => {
    expect(peutVoirRecu("ENTREPRISE", "DEMANDE")).toBe(true);
    expect(peutVoirRecu("AUTORITE_CONTRACTANTE", "EN_CONTROLE")).toBe(true);
    expect(peutVoirRecu("ENTREPRISE", "BROUILLON")).toBe(false);
    expect(peutVoirRecu("DGD", "DEMANDE")).toBe(false);
  });
});

describe("menu : groupe « Demandes »", () => {
  it("contient correction, mise en place, utilisations et transferts (mêmes rôles)", () => {
    const demandes = NAV_ENTRIES.find((e) => isGroup(e) && e.labelKey === "demandes");
    expect(demandes && isGroup(demandes) ? demandes.children.map((c) => c.href) : []).toEqual([
      "/dashboard/demandes", "/dashboard/mise-en-place", "/dashboard/utilisations", "/dashboard/transferts",
    ]);
    const children = demandes && isGroup(demandes) ? demandes.children : [];
    expect(children.find((c) => c.href === "/dashboard/utilisations")?.roles).toEqual(["ENTREPRISE", "DGD", "DGTCP", "DGI", "PRESIDENT", "ADMIN_SI"]);
    expect(children.find((c) => c.href === "/dashboard/transferts")?.roles).toEqual(["ENTREPRISE", "DGD", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"]);
    const hrefs = NAV_ENTRIES.flatMap((e) => (isGroup(e) ? e.children.map((c) => c.href) : [e.href]));
    expect(hrefs.filter((h) => h === "/dashboard/utilisations" || h === "/dashboard/transferts")).toHaveLength(2);
  });
});
