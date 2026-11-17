import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), mainCouranteApi: api }));

import i18n from "@/i18n";
import MainCourante, { MAIN_COURANTE_DEBOUNCE_MS } from "@/components/dashboard/MainCourante";

const ligne = (over: Record<string, unknown>) => ({
  processus: "UTILISATION", type: "UtilisationCredit", id: 1, reference: "DU-0001", statut: "DEMANDEE",
  entrepriseRaisonSociale: "SOMELEC", action: "Viser", joursDAttente: 2, ...over,
});
const dto = (lignes: unknown[]) => ({ lignes, total: lignes.length, parProcessus: {}, processusCouverts: [], processusNonCouverts: [], definitionAttente: "", tronquee: false });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

describe("main courante : recherche et n° du crédit", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await i18n.changeLanguage("fr");
    api.get.mockReset().mockResolvedValue(dto([
      ligne({ certificatId: 42, certificatReference: "CI-0042-2026", marcheNumero: "M-12" }),
      ligne({ id: 2, reference: "DC-0002", type: "DemandeCorrection", processus: "CORRECTION" }),
    ]));
  });
  afterEach(() => { vi.useRealTimers(); });

  it("interroge le serveur avec ?q= seulement après le délai de frappe", async () => {
    render(<MemoryRouter><MainCourante /></MemoryRouter>);
    await act(async () => { vi.advanceTimersByTime(MAIN_COURANTE_DEBOUNCE_MS); });
    await flush();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenLastCalledWith(undefined);

    const input = screen.getByRole("searchbox", { name: "N° de dossier, de crédit ou de marché" });
    fireEvent.change(input, { target: { value: "CI-" } });
    fireEvent.change(input, { target: { value: "CI-0042 " } });
    await act(async () => { vi.advanceTimersByTime(MAIN_COURANTE_DEBOUNCE_MS - 50); });
    expect(api.get).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(50); });
    await flush();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenLastCalledWith("CI-0042");
  });

  it("colonne « N° du crédit » : lien vers la fiche crédit, « — » sinon ; n° du marché sous la référence", async () => {
    render(<MemoryRouter><MainCourante /></MemoryRouter>);
    await flush();
    expect(screen.getByRole("columnheader", { name: "N° du crédit" })).toBeInTheDocument();
    const lien = screen.getByRole("link", { name: "CI-0042-2026" });
    expect(lien).toHaveAttribute("href", "/dashboard/certificats/42");
    expect(screen.getByText("Marché M-12")).toBeInTheDocument();
    const row2 = screen.getByRole("link", { name: "DC-0002" }).closest("tr")!;
    expect(within(row2).getByText("—")).toBeInTheDocument();
  });
});
