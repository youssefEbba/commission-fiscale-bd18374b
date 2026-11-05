import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "@/i18n";
import { ListeRepliable } from "@/components/ui/liste-repliable";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";

// La liste du stock de TVA déductible se replie et se pagine.
const lignes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
const afficher = (n: number) => render(
  <ListeRepliable
    title="Stock TVA déductible"
    items={lignes(n)}
    head={<TableRow><TableHead>Déclaration</TableHead></TableRow>}
    row={(x) => <TableRow key={x.id}><TableCell>{`UT ${x.id}`}</TableCell></TableRow>}
  />,
);

describe("liste repliable et paginée", () => {
  beforeEach(async () => { await i18n.changeLanguage("fr"); });

  it("une liste longue est repliée, puis se parcourt 5 lignes par 5", () => {
    afficher(12);
    expect(screen.queryByText("UT 1")).toBeNull();
    fireEvent.click(screen.getByText("Afficher (12 lignes)"));
    expect(screen.getByText("UT 5")).toBeInTheDocument();
    expect(screen.queryByText("UT 6")).toBeNull();
    expect(screen.getByText("Affichage de 1 à 5 sur 12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suivant/ }));
    fireEvent.click(screen.getByRole("button", { name: /Suivant/ }));
    expect(screen.getByText("UT 12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Suivant/ })).toBeDisabled();
    fireEvent.click(screen.getByText("Replier"));
    expect(screen.queryByText("UT 12")).toBeNull();
  });

  it("une liste courte est dépliée, sans pagination", () => {
    afficher(2);
    expect(screen.getByText("UT 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Suivant/ })).toBeNull();
  });
});
