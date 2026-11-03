import { describe, it, expect } from "vitest";
import { ApiRequestError, type ArchiveLotCreditDto, type ArchiveLotDto } from "@/lib/api";
import { chunk, commonValue, isDgiUnavailable, isProposed, mergeCredits, nifsInconnus, pretIds, soldeEcart } from "@/lib/archiveLots";

const credit = (over: Partial<ArchiveLotCreditDto>): ArchiveLotCreditDto => ({
  id: 1, ordre: 1, ligneDebut: 1, ligneFin: 10, numeroCredit: "C1", nif: "111",
  referenceMarche: null, numeroMarche: null, dateMarche: null, dureeMarche: null, dateCredit: null,
  montantMarche: null, montantCreditImpot: null, creditDouanier: null, creditInterieur: null, transfertCredit: null,
  soldeDouanierCalcule: null, soldeInterieurCalcule: null, soldeDouanierDeclare: null, soldeInterieurDeclare: null,
  nbUtilisations: 0, anomalies: [],
  entrepriseId: null, entrepriseRaisonSociale: null, sourceEntreprise: null,
  autoriteContractanteId: null, autoriteContractanteNom: null, sourceAutorite: null,
  conventionId: null, conventionIntitule: null, sourceConvention: null,
  marcheId: null, marcheNumero: null, sourceMarche: null,
  creerMarche: false, confirmerMalgreAnomalies: false,
  raisonSocialeDgi: null, nomCommercialDgi: null, etatDgi: null, inconnuDgi: false,
  dejaRepris: false, statut: "A_COMPLETER", manquants: [],
  certificatId: null, certificatReference: null, messageErreur: null, dateImport: null,
  ...over,
});

describe("Lots d'archive — règles d'écran", () => {
  it("découpe l'import en lots de 10", () => {
    const ids = Array.from({ length: 23 }, (_, i) => i + 1);
    expect(chunk(ids, 10).map((b) => b.length)).toEqual([10, 10, 3]);
    expect(chunk([], 10)).toEqual([]);
  });

  it("badge « proposé » pour toute source sauf MANUEL", () => {
    expect(isProposed("NIF")).toBe(true);
    expect(isProposed("CREE")).toBe(true);
    expect(isProposed("MANUEL")).toBe(false);
    expect(isProposed(null)).toBe(false);
  });

  it("écart de solde au-delà du centime, jamais sur une valeur absente", () => {
    expect(soldeEcart(100, 100.004)).toBe(false);
    expect(soldeEcart(100, 100.01)).toBe(true);
    expect(soldeEcart(null, 5)).toBe(false);
  });

  it("regroupe les NIF sans entreprise, hors crédits importés", () => {
    const list = nifsInconnus([
      credit({ id: 1, ordre: 2, nif: "222" }),
      credit({ id: 2, ordre: 1, nif: "111", raisonSocialeDgi: "ALPHA" }),
      credit({ id: 3, ordre: 3, nif: "111" }),
      credit({ id: 4, ordre: 4, nif: "333", entrepriseId: 9 }),
      credit({ id: 5, ordre: 5, nif: "444", statut: "IMPORTE" }),
      credit({ id: 6, ordre: 6, nif: "222", inconnuDgi: true }),
    ]);
    expect(list.map((n) => [n.nif, n.nbCredits])).toEqual([["111", 2], ["222", 2]]);
    expect(list[0].raisonSocialeDgi).toBe("ALPHA");
    expect(list[1].inconnuDgi).toBe(true);
  });

  it("crédits prêts dans l'ordre du fichier ; valeur commune de la sélection", () => {
    const cs = [credit({ id: 7, ordre: 2, statut: "PRET", autoriteContractanteId: 3 }), credit({ id: 8, ordre: 1, statut: "PRET", autoriteContractanteId: 3 }), credit({ id: 9, ordre: 3 })];
    expect(pretIds(cs)).toEqual([8, 7]);
    expect(commonValue(cs.slice(0, 2), "autoriteContractanteId")).toBe(3);
    expect(commonValue(cs, "autoriteContractanteId")).toBeNull();
  });

  it("remplace les crédits renvoyés par l'import", () => {
    const lot = { id: 1, credits: [credit({ id: 1 }), credit({ id: 2 })] } as ArchiveLotDto;
    const merged = mergeCredits(lot, [credit({ id: 2, statut: "IMPORTE" })]);
    expect(merged.credits?.map((c) => c.statut)).toEqual(["A_COMPLETER", "IMPORTE"]);
  });

  it("DGI indisponible : 503 DGI_SERVICE_UNAVAILABLE ou FEATURE_DISABLED", () => {
    expect(isDgiUnavailable(new ApiRequestError({ status: 503, message: "x", code: "DGI_SERVICE_UNAVAILABLE" }))).toBe(true);
    expect(isDgiUnavailable(new ApiRequestError({ status: 503, message: "x", code: "FEATURE_DISABLED" }))).toBe(true);
    expect(isDgiUnavailable(new ApiRequestError({ status: 500, message: "x", code: "INTERNAL" }))).toBe(false);
  });
});
