import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// La reprise d'un crédit seul est désactivée pour le moment : seule la reprise par fichier de période est ouverte.
vi.mock("@/components/dashboard/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => <div>{children as never}</div> }));
vi.mock("@/components/archive/ArchiveLotsTab", () => ({ ArchiveLotsTab: () => <p>onglet fichier de période</p> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { role: "ADMIN_SI" }, hasPermission: () => true }) }));
vi.mock("@/hooks/useArchiveRefs", () => ({ useArchiveRefs: () => ({}) }));

import i18n from "@/i18n";
import ArchiveCredits, { REPRISE_UN_CREDIT_ACTIVE } from "@/pages/ArchiveCredits";

describe("reprise d'archive : « Un crédit » désactivé", () => {
  beforeEach(async () => { await i18n.changeLanguage("fr"); });

  it("ouvre le fichier de période, même si l'adresse demande l'onglet « Un crédit »", () => {
    expect(REPRISE_UN_CREDIT_ACTIVE).toBe(false);
    render(<MemoryRouter initialEntries={["/dashboard/archive/credits?onglet=unique"]}><ArchiveCredits /></MemoryRouter>);
    expect(screen.getByText("onglet fichier de période")).toBeInTheDocument();
    const unCredit = screen.getByRole("tab", { name: /Un crédit/ });
    expect(unCredit).toBeDisabled();
    expect(unCredit).toHaveTextContent("désactivé pour le moment");
  });
});
