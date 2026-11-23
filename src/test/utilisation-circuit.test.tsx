import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ modifierMontantsPresident: vi.fn() }));
vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, utilisationCreditApi: { ...actual.utilisationCreditApi, ...api } };
});

import i18n from "@/i18n";
import {
  buildMontantsPresidentBody, carteCertificatVisible, etapeSuivante, isAEmettre, isAncienOrdre, isUtilisationCloturable,
  mentionModificationPresident, montantsPresidentActuels, peutDeposerQuittanceDgi, peutEnvoyerTresor, peutEtreRejete,
  peutModifierMontantsPresident, peutTransmettrePresident, resultatDebitVisible, type CircuitUtilisation,
} from "@/lib/utilisationCircuit";
import { utilisationClotureMode } from "@/lib/utilisationCloture";
import { MontantsPresidentDialog } from "@/components/utilisations/MontantsPresidentDialog";
import type { UtilisationCreditDto } from "@/lib/api";

const D = (statut: string, over: Partial<CircuitUtilisation> = {}) => ({ type: "DOUANIER", statut, ...over }) as CircuitUtilisation;
const T = (statut: string, over: Partial<CircuitUtilisation> = {}) => ({ type: "TVA_INTERIEURE", statut, ...over }) as CircuitUtilisation;

describe("circuit : débit avant le certificat", () => {
  it("douane : Trésor après le chèque, transmission après la liquidation, clôture après l'émission", () => {
    expect(peutEnvoyerTresor(D("CHEQUE_SAISI"))).toBe(true);
    expect(peutEnvoyerTresor(D("TRANSMISE_AU_PRESIDENT"))).toBe(false);
    expect(peutTransmettrePresident(D("CHEQUE_SAISI"))).toBe(false);
    expect(peutTransmettrePresident(D("LIQUIDEE", { creditDebite: true }))).toBe(true);
    expect(peutModifierMontantsPresident(D("TRANSMISE_AU_PRESIDENT", { creditDebite: true }))).toBe(true);
    expect(isUtilisationCloturable(D("CERTIFICAT_EMIS", { creditDebite: true }))).toBe(true);
    expect(isUtilisationCloturable(D("LIQUIDEE", { creditDebite: true }))).toBe(false);
  });

  it("TVA : quittance DGI après validation, transmission après l'apurement", () => {
    expect(peutDeposerQuittanceDgi(T("VALIDEE"))).toBe(true);
    expect(peutDeposerQuittanceDgi(T("QUITTANCE_DGI_ENREGISTREE"))).toBe(true);
    expect(peutDeposerQuittanceDgi(T("APUREE", { creditDebite: true }))).toBe(false);
    expect(peutTransmettrePresident(T("APUREE", { creditDebite: true }))).toBe(true);
    expect(peutTransmettrePresident(D("APUREE", { creditDebite: true }))).toBe(false);
  });

  it("ancien ordre (non débité) : émission → Trésor / DGI → débit, puis clôture sans nouvelle transmission", () => {
    expect(isAncienOrdre(D("TRANSMISE_AU_PRESIDENT", { creditDebite: false }))).toBe(true);
    expect(peutModifierMontantsPresident(D("TRANSMISE_AU_PRESIDENT", { creditDebite: false }))).toBe(false);
    expect(peutEnvoyerTresor(D("CERTIFICAT_EMIS", { creditDebite: false }))).toBe(true);
    expect(peutDeposerQuittanceDgi(T("CERTIFICAT_EMIS", { creditDebite: false }))).toBe(true);
    expect(isUtilisationCloturable(D("CERTIFICAT_EMIS", { creditDebite: false }))).toBe(false);
    const liquideeEmise = D("LIQUIDEE", { creditDebite: true, numeroCertificatUtilisation: "CU-0001-2026" });
    expect(peutTransmettrePresident(liquideeEmise)).toBe(false);
    expect(isUtilisationCloturable(liquideeEmise)).toBe(true);
  });

  it("dossier débité : plus de rejet ; file du Président = TRANSMISE_AU_PRESIDENT pour les deux types", () => {
    expect(peutEtreRejete({ creditDebite: true })).toBe(false);
    expect(peutEtreRejete({ creditDebite: false })).toBe(true);
    expect(isAEmettre({ statut: "TRANSMISE_AU_PRESIDENT" })).toBe(true);
    expect(isAEmettre({ statut: "VALIDEE" })).toBe(false);
  });

  it("cartes : résultat du débit dès LIQUIDEE / APUREE, certificat à partir de la transmission", () => {
    expect(resultatDebitVisible(D("LIQUIDEE", { creditDebite: true }))).toBe(true);
    expect(resultatDebitVisible(T("TRANSMISE_AU_PRESIDENT", { creditDebite: true }))).toBe(true);
    expect(resultatDebitVisible(D("QUITTANCES_ENREGISTREES"))).toBe(false);
    expect(carteCertificatVisible(T("VALIDEE"))).toBe(false);
    expect(carteCertificatVisible(D("TRANSMISE_AU_PRESIDENT"))).toBe(true);
  });

  it("messages d'attente du nouvel ordre", () => {
    expect(etapeSuivante(D("CHEQUE_SAISI"))).toBe("attente_envoi_tresor_cheque");
    expect(etapeSuivante(D("LIQUIDEE", { creditDebite: true }))).toBe("attente_transmission_president");
    expect(etapeSuivante(D("TRANSMISE_AU_PRESIDENT", { creditDebite: true }))).toBe("attente_certificat_president_debite");
    expect(etapeSuivante(D("TRANSMISE_AU_PRESIDENT", { creditDebite: false }))).toBe("attente_certificat_president");
    expect(etapeSuivante(D("CERTIFICAT_EMIS", { creditDebite: true }))).toBe("attente_cloture");
    expect(etapeSuivante(D("CERTIFICAT_EMIS", { creditDebite: false }))).toBe("attente_envoi_tresor");
    expect(etapeSuivante(T("VALIDEE"))).toBe("attente_quittance_dgi_validee");
    expect(etapeSuivante(T("QUITTANCE_DGI_ENREGISTREE"))).toBe("attente_apurement");
    expect(etapeSuivante(T("CERTIFICAT_EMIS", { creditDebite: false }))).toBe("attente_quittance_dgi");
    for (const k of ["attente_envoi_tresor_cheque", "attente_transmission_president", "attente_certificat_president_debite", "attente_cloture", "attente_quittance_dgi_validee", "attente_apurement"]) {
      expect(i18n.t(`utilisations:next_step.${k}`)).not.toContain("next_step");
    }
  });

  it("clôture : DGTCP avec permission, ADMIN_SI avec motif", () => {
    const u = D("CERTIFICAT_EMIS", { creditDebite: true });
    expect(utilisationClotureMode("DGTCP", (p) => p === "utilisation.dgtcp.cloturer", u)).toBe("DGTCP");
    expect(utilisationClotureMode("ADMIN_SI", () => false, u)).toBe("ADMIN");
    expect(utilisationClotureMode("DGTCP", () => true, D("LIQUIDEE", { creditDebite: true }))).toBeNull();
  });
});

describe("correction des montants par le Président", () => {
  const douane = { type: "DOUANIER", totalPrisEnCharge: 1000, montantTVADouane: 300 } as UtilisationCreditDto;

  it("valeurs actuelles : douane droits = total − TVA ; TVA = montant et déductible", () => {
    expect(montantsPresidentActuels(douane)).toEqual({ a: 700, b: 300 });
    expect(montantsPresidentActuels({ type: "TVA_INTERIEURE", montantTVAInterieure: 500, tvaDeductibleUtilisee: 120 } as UtilisationCreditDto)).toEqual({ a: 500, b: 120 });
  });

  it("corps : seuls les champs modifiés, motif obligatoire, douane à la baisse seulement", () => {
    const act = { a: 700, b: 300 };
    expect(buildMontantsPresidentBody("DOUANIER", act, { a: 700, b: 300, motif: "x" }).erreur).toBe("inchange");
    expect(buildMontantsPresidentBody("DOUANIER", act, { a: 600, b: 300, motif: " " }).erreur).toBe("motif");
    expect(buildMontantsPresidentBody("DOUANIER", act, { a: 800, b: 300, motif: "x" }).erreur).toBe("hausse_douane");
    expect(buildMontantsPresidentBody("DOUANIER", act, { a: 600, b: 300, motif: " Erreur de taux " }).body).toEqual({ droitsImputes: 600, motif: "Erreur de taux" });
    expect(buildMontantsPresidentBody("TVA_INTERIEURE", act, { a: 900, b: 250, motif: "x" }).body).toEqual({ montantTVA: 900, tvaDeductibleUtilisee: 250, motif: "x" });
  });

  it("mention des PDF : « ramené » à la baisse, « porté » à la hausse, avec le motif", () => {
    const fmt = (n: number) => n.toFixed(2);
    expect(mentionModificationPresident({ montantImputeAvantModification: null }, 900, fmt)).toBeNull();
    expect(mentionModificationPresident({ montantImputeAvantModification: 1000, motifModificationPresident: "Taux erroné" }, 900, fmt))
      .toBe("Montant ramené par le Président de 1000.00 à 900.00 MRU — motif : Taux erroné");
    expect(mentionModificationPresident({ montantImputeAvantModification: 500, motifModificationPresident: "" }, 600, fmt))
      .toBe("Montant porté par le Président de 500.00 à 600.00 MRU");
  });
});

describe("dialogue « Modifier les montants »", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("fr");
    api.modifierMontantsPresident.mockReset();
  });
  const u = { id: 7, type: "DOUANIER", statut: "TRANSMISE_AU_PRESIDENT", creditDebite: true, totalPrisEnCharge: 1000, montantTVADouane: 300 } as UtilisationCreditDto;

  it("préremplit les deux champs, exige le motif, refuse une hausse en douane, envoie le PATCH", async () => {
    api.modifierMontantsPresident.mockResolvedValue({ ...u, totalPrisEnCharge: 900 });
    const onDone = vi.fn();
    render(<MontantsPresidentDialog utilisation={u} onClose={vi.fn()} onDone={onDone} />);
    const droits = screen.getByLabelText("Droits imputés (hors TVA)") as HTMLInputElement;
    expect(droits.value).toBe("700");
    expect((screen.getByLabelText("TVA imputée") as HTMLInputElement).value).toBe("300");
    const valider = screen.getByRole("button", { name: "Enregistrer les montants" });
    expect(valider).toBeDisabled();

    fireEvent.change(droits, { target: { value: "800" } });
    expect(screen.getByRole("alert")).toHaveTextContent("ne peuvent que baisser");
    fireEvent.change(droits, { target: { value: "600" } });
    expect(valider).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motif *"), { target: { value: "Taux erroné" } });
    expect(valider).toBeEnabled();
    fireEvent.click(valider);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.modifierMontantsPresident).toHaveBeenCalledWith(7, { droitsImputes: 600, motif: "Taux erroné" });
  });

  it("affiche le refus du serveur tel quel", async () => {
    api.modifierMontantsPresident.mockRejectedValue(new Error("Stock de TVA insuffisant"));
    render(<MontantsPresidentDialog utilisation={u} onClose={vi.fn()} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("TVA imputée"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Motif *"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les montants" }));
    expect(await screen.findByText("Stock de TVA insuffisant")).toBeInTheDocument();
  });
});
