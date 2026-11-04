import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isAdmin: false,
    isCommissionRelais: false,
    isImpersonating: false,
    user: { role: "DGD" },
    hasRole: () => true,
    hasPermission: (p: string) => auth.permissions.includes(p),
  }),
}));

const ouvrir = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/demandes-rattachement"]}>
      <Routes>
        <Route path="/dashboard" element={<p>main courante</p>} />
        <Route
          path="/dashboard/demandes-rattachement"
          element={<ProtectedRoute permission="rattachement.validate"><p>demandes de rattachement</p></ProtectedRoute>}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("route protégée par un droit", () => {
  beforeEach(() => { auth.permissions = []; });

  it("sans le droit, renvoie à la main courante au lieu d'ouvrir une page refusée par l'API", () => {
    ouvrir();
    expect(screen.getByText("main courante")).toBeInTheDocument();
  });

  it("avec le droit, ouvre la page", () => {
    auth.permissions = ["rattachement.validate"];
    ouvrir();
    expect(screen.getByText("demandes de rattachement")).toBeInTheDocument();
  });
});
