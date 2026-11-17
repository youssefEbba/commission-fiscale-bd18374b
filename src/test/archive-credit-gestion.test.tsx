import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ get: vi.fn(), corrigerRattachement: vi.fn(), supprimer: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), archiveCreditGestionApi: api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { role: "ADMIN_SI" }, hasPermission: () => true }) }));
vi.mock("@/hooks/useArchiveRefs", () => ({
  useArchiveRefs: () => ({
    entreprises: [{ id: 1, raisonSociale: "SOMELEC", nif: "123" }],
    autorites: [{ id: 2, nom: "Ministère" }],
    conventions: [{ id: 3, reference: "CONV-1", autoriteContractanteId: 2 }],
    marches: [],
    loading: { entreprise: false, autorite: false, convention: false, marche: false },
    reload: vi.fn(),
  }),
}));

import i18n from "@/i18n";
import {
  AUCUN_MARCHE,
  buildRattachementBody,
  canConfirmSuppression,
  canManageArchiveCredit,
  conventionOptions,
  isArchiveReference,
  marcheOptions,
  rattachementFormError,
  suppressionLignes,
} from "@/lib/archiveCreditGestion";
import { ArchiveRattachementDialog, ArchiveSuppressionDialog } from "@/components/archive/ArchiveCreditActions";
import type { ArchiveCreditDto, ConventionDto, MarcheDto } from "@/lib/api";

const SUPPRESSION = {
  utilisationsArchive: 4, utilisationsApplication: 2, transferts: 0, avenants: 0, sousTraitances: 0,
  clotures: 0, pieces: 1, lignesStockTva: 0, echanges: 0, creditsDeLot: 1,
};
const CREDIT: ArchiveCreditDto = {
  certificatId: 10, reference: "ARCHIVE-0001-2024", entrepriseId: 1, entrepriseRaisonSociale: "SOMELEC",
  autoriteContractanteId: 2, autoriteContractanteNom: "Ministère", conventionId: 3, conventionReference: "CONV-1",
  marcheId: null, marcheCreeParImport: false, suppression: SUPPRESSION,
};

describe("crédit repris de l'archive : règle d'affichage", () => {
  it("exige la référence « ARCHIVE- » et la permission archive.import", () => {
    const yes = (p: string) => p === "archive.import";
    const no = () => false;
    expect(isArchiveReference("ARCHIVE-0001-2024")).toBe(true);
    expect(isArchiveReference("CI-0001-2024")).toBe(false);
    expect(isArchiveReference(null)).toBe(false);
    expect(canManageArchiveCredit(yes, "ARCHIVE-0001-2024")).toBe(true);
    expect(canManageArchiveCredit(no, "ARCHIVE-0001-2024")).toBe(false);
    expect(canManageArchiveCredit(yes, "CI-0001-2024")).toBe(false);
    expect(canManageArchiveCredit(yes, undefined)).toBe(false);
  });
});

describe("crédit repris de l'archive : validation", () => {
  const form = { entrepriseId: "1", autoriteContractanteId: "2", conventionId: "3", marcheId: AUCUN_MARCHE, motif: "Erreur de NIF" };

  it("rattachement : entreprise, autorité, convention et motif obligatoires ; marché facultatif", () => {
    expect(rattachementFormError(form)).toBeNull();
    expect(rattachementFormError({ ...form, entrepriseId: "" })).toBe("entreprise");
    expect(rattachementFormError({ ...form, autoriteContractanteId: "" })).toBe("autorite");
    expect(rattachementFormError({ ...form, conventionId: "" })).toBe("convention");
    expect(rattachementFormError({ ...form, motif: "   " })).toBe("motif");
    expect(buildRattachementBody(form)).toEqual({ entrepriseId: 1, autoriteContractanteId: 2, conventionId: 3, marcheId: null, motif: "Erreur de NIF" });
    expect(buildRattachementBody({ ...form, marcheId: "7" }).marcheId).toBe(7);
  });

  it("suppression : motif et référence saisie à l'identique", () => {
    expect(canConfirmSuppression("doublon", "ARCHIVE-0001-2024", "ARCHIVE-0001-2024")).toBe(true);
    expect(canConfirmSuppression("doublon", " ARCHIVE-0001-2024 ", "ARCHIVE-0001-2024")).toBe(true);
    expect(canConfirmSuppression("", "ARCHIVE-0001-2024", "ARCHIVE-0001-2024")).toBe(false);
    expect(canConfirmSuppression("doublon", "archive-0001-2024", "ARCHIVE-0001-2024")).toBe(false);
    expect(canConfirmSuppression("doublon", "", null)).toBe(false);
  });

  it("aperçu : seules les lignes non nulles", () => {
    expect(suppressionLignes(SUPPRESSION).map((l) => l.key)).toEqual(["utilisationsArchive", "utilisationsApplication", "pieces", "creditsDeLot"]);
    expect(suppressionLignes(null)).toEqual([]);
  });

  it("listes : conventions de l'autorité (principale ou liée), marchés de la convention", () => {
    const conventions = [
      { id: 1, reference: "A", autoriteContractanteId: 9 },
      { id: 2, reference: "B", autoriteContractanteId: 8, autorites: [{ id: 8 }, { id: 9 }] },
      { id: 3, reference: "C", autoriteContractanteId: 7 },
    ] as unknown as ConventionDto[];
    expect(conventionOptions(conventions, "9").map((o) => o.value)).toEqual(["1", "2"]);
    const marches = [
      { id: 5, numeroMarche: "M5", conventionId: 1 },
      { id: 6, numeroMarche: "M6", conventionId: 2, conventionIds: [2, 1] },
      { id: 7, numeroMarche: "M7", conventionId: 3 },
    ] as unknown as MarcheDto[];
    expect(marcheOptions(marches, "1").map((o) => o.value)).toEqual(["5", "6"]);
  });
});

describe("crédit repris de l'archive : dialogues", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("fr");
    api.get.mockReset().mockResolvedValue(CREDIT);
    api.corrigerRattachement.mockReset().mockResolvedValue(CREDIT);
    api.supprimer.mockReset().mockResolvedValue(undefined);
  });

  it("suppression : aperçu, utilisations de l'application mises en évidence, bouton actif après motif et référence", async () => {
    const onDone = vi.fn();
    render(<ArchiveSuppressionDialog certificatId={10} onClose={vi.fn()} onDone={onDone} />);
    expect(await screen.findByText("dont 2 utilisations faites dans l'application après la reprise")).toBeInTheDocument();
    expect(screen.getByText("4 utilisations reprises de l'archive")).toBeInTheDocument();

    const bouton = screen.getByRole("button", { name: "Supprimer définitivement" });
    expect(bouton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motif *"), { target: { value: "Doublon" } });
    expect(bouton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/saisissez la référence/), { target: { value: "ARCHIVE-0001" } });
    expect(bouton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/saisissez la référence/), { target: { value: "ARCHIVE-0001-2024" } });
    expect(bouton).toBeEnabled();

    fireEvent.click(bouton);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.supprimer).toHaveBeenCalledWith(10, "Doublon");
  });

  it("suppression : erreur serveur affichée dans la fenêtre", async () => {
    api.supprimer.mockRejectedValue(new Error("Crédit hors archive"));
    const onDone = vi.fn();
    render(<ArchiveSuppressionDialog certificatId={10} onClose={vi.fn()} onDone={onDone} />);
    await screen.findByLabelText("Motif *");
    fireEvent.change(screen.getByLabelText("Motif *"), { target: { value: "Doublon" } });
    fireEvent.change(screen.getByLabelText(/saisissez la référence/), { target: { value: "ARCHIVE-0001-2024" } });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(await screen.findByText("Crédit hors archive")).toHaveAttribute("role", "alert");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("rattachement : pré-rempli depuis le serveur, motif obligatoire, marché envoyé à null", async () => {
    const onDone = vi.fn();
    render(<ArchiveRattachementDialog certificatId={10} onClose={vi.fn()} onDone={onDone} />);
    const bouton = await screen.findByRole("button", { name: "Enregistrer le rattachement" });
    expect(screen.getByText("SOMELEC")).toBeInTheDocument();
    expect(bouton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motif *"), { target: { value: "NIF corrigé" } });
    expect(bouton).toBeEnabled();
    fireEvent.click(bouton);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(CREDIT));
    expect(api.corrigerRattachement).toHaveBeenCalledWith(10, {
      entrepriseId: 1, autoriteContractanteId: 2, conventionId: 3, marcheId: null, motif: "NIF corrigé",
    });
  });
});
