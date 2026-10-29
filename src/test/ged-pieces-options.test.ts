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
    expect(opts).toEqual([{ code: "DEMANDE_MOTIVEE_TRANSFERT", label: "Demande motivée signée" }]);
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
