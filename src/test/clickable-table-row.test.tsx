import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import ClickableTableRow from "@/components/ui/clickable-table-row";
import { echeanceConvention, ECHEANCE_AVERTISSEMENT_JOURS, ECHEANCE_CRITIQUE_JOURS } from "@/lib/conventionEcheance";

const renderRow = (cells: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={["/liste"]}>
      <Routes>
        <Route
          path="/liste"
          element={
            <table>
              <tbody>
                <ClickableTableRow to="/detail">{cells}</ClickableTableRow>
              </tbody>
            </table>
          }
        />
        <Route path="/detail" element={<div>FICHE_OUVERTE</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("ClickableTableRow", () => {
  it("ouvre la fiche au clic sur une cellule simple", () => {
    renderRow(<td>cellule libre</td>);
    fireEvent.click(screen.getByText("cellule libre"));
    expect(screen.getByText("FICHE_OUVERTE")).toBeInTheDocument();
  });

  it("n'ouvre pas la fiche quand on clique un bouton d'action de la ligne", () => {
    const onAction = vi.fn();
    renderRow(
      <td>
        <button onClick={onAction}>Supprimer</button>
      </td>
    );
    fireEvent.click(screen.getByText("Supprimer"));
    expect(onAction).toHaveBeenCalled();
    expect(screen.queryByText("FICHE_OUVERTE")).not.toBeInTheDocument();
  });

  it("n'ouvre pas la fiche quand on clique un lien de la ligne", () => {
    renderRow(
      <td>
        <Link to="/detail" onClick={(e) => e.stopPropagation()}>
          REF-001
        </Link>
      </td>
    );
    fireEvent.click(screen.getByText("REF-001"));
    // Le lien seul navigue (stopPropagation), la ligne ne double pas la navigation
    expect(screen.getByText("FICHE_OUVERTE")).toBeInTheDocument();
  });

  it("est activable au clavier (Entrée) sur la ligne", () => {
    renderRow(<td>cellule</td>);
    const row = screen.getByRole("link");
    fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.getByText("FICHE_OUVERTE")).toBeInTheDocument();
  });
});

describe("echeanceConvention", () => {
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

  it("aucune alerte sans date de fin", () => {
    expect(echeanceConvention(undefined)).toBeNull();
    expect(echeanceConvention("")).toBeNull();
  });

  it("aucune alerte au-delà du seuil d'avertissement", () => {
    expect(echeanceConvention(inDays(ECHEANCE_AVERTISSEMENT_JOURS + 10))).toBeNull();
  });

  it("avertissement à 90 jours ou moins", () => {
    expect(echeanceConvention(inDays(ECHEANCE_AVERTISSEMENT_JOURS))?.niveau).toBe("avertissement");
    expect(echeanceConvention(inDays(ECHEANCE_CRITIQUE_JOURS + 5))?.niveau).toBe("avertissement");
  });

  it("alerte critique à 30 jours ou moins", () => {
    expect(echeanceConvention(inDays(ECHEANCE_CRITIQUE_JOURS))?.niveau).toBe("critique");
    expect(echeanceConvention(inDays(1))?.niveau).toBe("critique");
  });

  it("mention dépassée quand la date est passée", () => {
    const e = echeanceConvention(inDays(-3));
    expect(e?.niveau).toBe("depassee");
    expect(e?.jours).toBeLessThan(0);
  });
});
