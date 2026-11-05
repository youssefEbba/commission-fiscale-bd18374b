import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Après « Créer une entreprise », la fenêtre annonce que l'entité sera sélectionnée :
// la liste du relais doit être filtrée sur elle (A98).
const api = vi.hoisted(() => ({
  listEntreprises: vi.fn(async () => ({ content: [], totalPages: 1, totalElements: 0 })),
  listAutorites: vi.fn(async () => ({ content: [], totalPages: 1, totalElements: 0 })),
}));

vi.mock("@/lib/api", async (orig) => ({ ...(await orig<object>()), commissionRelaisApi: api }));
vi.mock("@/components/dashboard/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => <div>{children as never}</div> }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    applyImpersonation: vi.fn(), isCommissionRelais: true, isImpersonating: false,
    user: { username: "commission_relais" }, hasPermission: () => true,
  }),
}));
vi.mock("@/components/archive/ArchiveCreateDialog", () => ({
  ArchiveCreateDialog: ({ kind, onCreated }: { kind: string | null; onCreated: (k: string, id: number, r?: string) => void }) =>
    kind ? <button onClick={() => onCreated(kind, 99, "99990001")}>simuler la création</button> : null,
}));

import i18n from "@/i18n";
import CommissionRelais from "@/pages/CommissionRelais";

describe("commission relais : entité créée sur place", () => {
  beforeEach(async () => { await i18n.changeLanguage("fr"); });

  it("filtre la liste sur l'entreprise créée", async () => {
    render(<MemoryRouter><CommissionRelais /></MemoryRouter>);
    fireEvent.click(screen.getByText("Mode Entreprise"));
    fireEvent.click(await screen.findByRole("button", { name: /Créer une entreprise/ }));
    fireEvent.click(screen.getByText("simuler la création"));
    expect(screen.getByPlaceholderText(/Rechercher/)).toHaveValue("99990001");
    await waitFor(() => expect(api.listEntreprises).toHaveBeenLastCalledWith(0, 10, "99990001"));
  });

  it("l'écran est traduit en arabe", async () => {
    await i18n.changeLanguage("ar");
    render(<MemoryRouter><CommissionRelais /></MemoryRouter>);
    expect(screen.getByText("وضع المؤسسة")).toBeInTheDocument();
    expect(screen.queryByText("Mode Entreprise")).toBeNull();
  });

  it("le compteur de résultats est en arabe quel que soit le nombre", async () => {
    await i18n.changeLanguage("ar");
    for (const n of [0, 1, 2, 5, 290, 1000]) {
      expect(i18n.t("common:relais.results", { count: n, page: 1, pages: 29 })).not.toMatch(/résultat/);
    }
  });
});
