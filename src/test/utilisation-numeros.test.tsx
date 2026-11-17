import { describe, it, expect, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "@/i18n";
import {
  ajouterNumero, cleanNumeros, joinNumeros, numerosDeclaration, numerosFacture, retirerNumero, withNumerosListes,
} from "@/lib/utilisationNumeros";
import { NumerosRepetables } from "@/components/common/NumerosRepetables";

describe("numéros multiples : règles", () => {
  it("lit la liste du serveur, repli sur l'ancien champ unique", () => {
    expect(numerosDeclaration({ numeroDeclaration: "D1", numerosDeclaration: ["D1", "D2"] })).toEqual(["D1", "D2"]);
    expect(numerosDeclaration({ numeroDeclaration: "D1" })).toEqual(["D1"]);
    expect(numerosFacture({ numerosFacture: [] , numeroFacture: null })).toEqual([]);
    expect(joinNumeros(["F1", "F2", "F3"])).toBe("F1, F2, F3");
  });

  it("nettoyage comme le serveur : espaces, vides, doublons sans casse", () => {
    expect(cleanNumeros([" a1 ", "", "A1", "b2", null, "  "])).toEqual(["a1", "b2"]);
  });

  it("ajout et retrait de ligne : au moins une ligne", () => {
    expect(ajouterNumero(undefined)).toEqual(["", ""]);
    expect(ajouterNumero(["X"])).toEqual(["X", ""]);
    expect(retirerNumero(["X", "Y"], 0)).toEqual(["Y"]);
    expect(retirerNumero(["X"], 0)).toEqual([""]);
  });

  it("sérialisation : listes nettoyées, ancien champ unique non envoyé", () => {
    expect(withNumerosListes({ type: "DOUANIER", numeroDeclaration: "OLD", numerosDeclaration: ["D1", " d1", "D2", ""], numerosFacture: ["F"] }, "DOUANIER"))
      .toEqual({ type: "DOUANIER", numerosDeclaration: ["D1", "D2"] });
    expect(withNumerosListes({ type: "TVA_INTERIEURE", numeroFacture: "OLD", numerosFacture: ["F1", "F2"] }, "TVA_INTERIEURE"))
      .toEqual({ type: "TVA_INTERIEURE", numerosFacture: ["F1", "F2"] });
  });
});

function Harness({ initial }: { initial?: string[] }) {
  const [values, setValues] = useState<string[] | undefined>(initial);
  return (
    <>
      <NumerosRepetables id="num" label="N° de déclaration" values={values} onChange={setValues} required />
      <output data-testid="json">{JSON.stringify(values ?? null)}</output>
    </>
  );
}

describe("numéros multiples : champ répétable", () => {
  beforeEach(async () => { await i18n.changeLanguage("fr"); });

  it("ajoute une ligne, saisit, retire une ligne", () => {
    render(<Harness />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Retirer/ })).toBeNull();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "D1" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un numéro" }));
    const boxes = screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(2);
    fireEvent.change(boxes[1], { target: { value: "D2" } });
    expect(screen.getByTestId("json").textContent).toBe('["D1","D2"]');

    fireEvent.click(screen.getByRole("button", { name: "Retirer le numéro 1" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByTestId("json").textContent).toBe('["D2"]');
  });
});
