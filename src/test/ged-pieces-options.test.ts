import { describe, it, expect } from "vitest";
import { toGedPieceOptions } from "@/hooks/useGedPieces";
import type { DocumentRequirementDto } from "@/lib/api";

const req = (p: Partial<DocumentRequirementDto>): DocumentRequirementDto => ({
  id: 1, processus: "TRANSFERT_CREDIT", obligatoire: true, typesAutorises: ["PDF"], ...p,
});

describe("pièces réclamables en rejet temporaire (GED)", () => {
  it("envoie le codeDocument et affiche le libellé paramétré dans la GED", () => {
    const opts = toGedPieceOptions([
      req({ id: 1, codeDocument: "DEMANDE_MOTIVEE_TRANSFERT", typeDocument: "ANCIEN", libelle: "Demande motivée signée" }),
    ]);
    expect(opts).toEqual([{ code: "DEMANDE_MOTIVEE_TRANSFERT", label: "Demande motivée signée", obligatoire: true, typesAutorises: ["PDF"] }]);
  });

  it("ne propose qu'une fois une pièce paramétrée en double, dans l'ordre d'affichage", () => {
    const opts = toGedPieceOptions([
      req({ id: 2, codeDocument: "B", libelle: "Pièce B", ordreAffichage: 2 }),
      req({ id: 1, codeDocument: "A", libelle: "Pièce A", ordreAffichage: 1 }),
      req({ id: 3, codeDocument: "B", libelle: "Pièce B bis", ordreAffichage: 3 }),
    ]);
    expect(opts.map((o) => o.code)).toEqual(["A", "B"]);
  });

  it("aucune pièce paramétrée : aucune pièce proposée (pas de liste écrite en dur)", () => {
    expect(toGedPieceOptions([])).toEqual([]);
  });
});

describe("pièces de dépôt (GED) : obligatoire / facultative", () => {
  it("expose l'obligation telle que paramétrée dans la GED, pièce facultative comprise", () => {
    const opts = toGedPieceOptions([
      req({ id: 1, codeDocument: "DEMANDE_MOTIVEE_TRANSFERT", obligatoire: true, ordreAffichage: 1 }),
      req({ id: 2, codeDocument: "JUSTIFICATIFS_CLOTURE_DOUANE", obligatoire: false, ordreAffichage: 2 }),
    ]);
    expect(opts.map((o) => [o.code, o.obligatoire])).toEqual([
      ["DEMANDE_MOTIVEE_TRANSFERT", true],
      ["JUSTIFICATIFS_CLOTURE_DOUANE", false],
    ]);
  });
});
