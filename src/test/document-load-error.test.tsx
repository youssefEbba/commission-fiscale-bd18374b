import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DocumentGED from "@/components/ged/DocumentGED";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
const props = {
  open: true, onOpenChange: vi.fn(), title: "Documents", dossierId: 1,
  documentTypes: [], documents: [], loading: false, canUpload: true,
  onUpload: vi.fn(), onRefresh: vi.fn(),
};

it("affiche le refus d'accès au lieu d'une liste vide et ne propose pas d'écriture", () => {
  render(<DocumentGED {...props} loadError="Accès refusé : marché hors périmètre" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Accès refusé : marché hors périmètre");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ged:upload.submit" })).not.toBeInTheDocument();
});

it("une réponse vide réussie reste une liste consultable sans refus d'accès", () => {
  render(<DocumentGED {...props} canUpload={false} />);
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});