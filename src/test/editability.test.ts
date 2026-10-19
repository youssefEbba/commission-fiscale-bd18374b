import { describe, expect, it } from "vitest";
import { certificatAmountRestriction, canCorrectCertificatField, canManuallySetCertificatStatus } from "@/lib/certificatEditability";
import { canEditMarche } from "@/lib/marcheEditability";
import { canSetConventionActivation } from "@/lib/conventionEditability";
import { ApiRequestError, formatApiErrorMessage } from "@/lib/api";

describe("Restrictions des écritures annoncées par le serveur", () => {
  it.each(["OUVERT", "MODIFIE", "CLOTURE", "ANNULE"] as const)("verrouille la saisie des montants en %s", statut => {
    expect(certificatAmountRestriction(statut, "none")).toBe("amounts_locked");
  });
  it.each(["EN_CONTROLE", "INCOMPLETE", "A_RECONTROLER", "EN_VALIDATION_PRESIDENT", "VALIDE_PRESIDENT", "EN_OUVERTURE_DGTCP"] as const)("verrouille les montants en %s avec une utilisation", statut => {
    expect(certificatAmountRestriction(statut, "present")).toBe("amounts_used");
    expect(certificatAmountRestriction(statut, "none")).toBeNull();
  });
  it("ne confond pas un échec de chargement avec une absence d'utilisations", () => {
    expect(certificatAmountRestriction("EN_CONTROLE", "unknown")).toBe("usage_unknown");
    expect(canCorrectCertificatField("tvaImportationDouane", "unknown")).toBe(false);
  });
  it("interdit uniquement les transitions manuelles MODIFIE et CLOTURE", () => {
    expect(canManuallySetCertificatStatus("MODIFIE")).toBe(false);
    expect(canManuallySetCertificatStatus("CLOTURE")).toBe(false);
    expect(canManuallySetCertificatStatus("ANNULE")).toBe(true);
    expect(canManuallySetCertificatStatus("OUVERT")).toBe(true);
  });
  it.each(["CLOTURE", "ANNULE"])("interdit la modification d'un marché %s", statut => {
    expect(canEditMarche(statut)).toBe(false);
    expect(canEditMarche("EN_COURS")).toBe(true);
  });
  it("interdit la réactivation annulée mais permet sa fermeture", () => {
    expect(canSetConventionActivation("ANNULEE", true)).toBe(false);
    expect(canSetConventionActivation("ANNULEE", false)).toBe(true);
  });
  it("permet de réactiver une convention simplement désactivée", () => {
    expect(canSetConventionActivation("VALIDE", true)).toBe(true);
  });
  it("interdit de corriger le quota restant après une utilisation", () => {
    expect(canCorrectCertificatField("tvaImportationDouane", "present")).toBe(false);
    expect(canCorrectCertificatField("tvaImportationDouane", "none")).toBe(true);
  });
  it.each(["dateValidite", "montantMarcheHt", "tvaCollecteeTravaux"])("préserve la correction descriptive %s même avec utilisations", key => {
    expect(canCorrectCertificatField(key, "present")).toBe(true);
    expect(canCorrectCertificatField(key, "unknown")).toBe(true);
  });
  it("conserve le refus 403 documents sans le transformer en liste vide", () => {
    const error = new ApiRequestError({ status: 403, code: "ACCESS_DENIED", message: "Accès refusé : marché hors périmètre" });
    expect(formatApiErrorMessage(error)).toBe("Accès refusé : marché hors périmètre");
  });
  it("préserve le message chiffré de récapitulatif incohérent", () => {
    const message = "Récapitulatif incohérent : écart de 12,50 MRU";
    expect(formatApiErrorMessage(new ApiRequestError({ status: 400, code: "BUSINESS_RULE_VIOLATION", message }))).toBe(message);
  });
});