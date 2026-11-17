import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import i18n from "@/i18n";
import ReportingKPIs from "@/components/reporting/ReportingKPIs";
import type { ReportingSummaryDto } from "@/lib/api";

const summary = (parProcessus?: { key: string; count: number }[]) => ({
  demandes: { byStatut: [], total: 17, tauxAdoptionPct: 50, tauxRejetPct: null, parProcessus },
  certificatsTotal: 0, certificatsEnValidationPresident: 0, utilisationsTotal: 0, transfertsTotal: 2, sousTraitancesTotal: 1,
  certificatFinancials: { sumSoldeCordon: 0, sumSoldeTva: 0 },
}) as unknown as ReportingSummaryDto;

describe("reporting : carte « Demandes »", () => {
  beforeEach(async () => { await i18n.changeLanguage("fr"); });

  it("affiche le total puis le détail par processus, dans l'ordre du serveur", () => {
    render(<ReportingKPIs summary={summary([
      { key: "CORRECTION", count: 5 }, { key: "MISE_EN_PLACE", count: 3 }, { key: "UTILISATION_DOUANE", count: 4 },
      { key: "UTILISATION_TVA_INTERIEURE", count: 2 }, { key: "TRANSFERT", count: 2 }, { key: "AVENANT", count: 0 }, { key: "SOUS_TRAITANCE", count: 1 },
    ])} />);
    expect(screen.getByText("17")).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Demandes par processus" })).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "Correction5", "Mise en place3", "Utilisation douane4", "Utilisation TVA intérieure2", "Transfert2", "Avenant0", "Sous-traitance1",
    ]);
    expect(screen.getByText("Taux d'adoption (corrections)")).toBeInTheDocument();
  });

  it("sans détail (serveur plus ancien), seul le total s'affiche", () => {
    render(<ReportingKPIs summary={summary()} />);
    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Demandes par processus" })).toBeNull();
  });

  it("libellés arabes présents pour chaque processus", async () => {
    await i18n.changeLanguage("ar");
    for (const k of ["CORRECTION", "MISE_EN_PLACE", "UTILISATION_DOUANE", "UTILISATION_TVA_INTERIEURE", "TRANSFERT", "AVENANT", "SOUS_TRAITANCE"]) {
      expect(i18n.t(`reporting:kpis.processus.${k}`)).not.toMatch(/processus|[A-Z_]{4,}/);
    }
  });
});
