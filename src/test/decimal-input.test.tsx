import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DecimalInput } from "@/components/ui/decimal-input";
import { isPartialDecimal, parseDecimalInput } from "@/lib/decimalInput";

describe("parseDecimalInput", () => {
  it("accepte point, virgule et espaces ; vide ou invalide → null", () => {
    expect(parseDecimalInput("1.0")).toBe(1);
    expect(parseDecimalInput("0,025")).toBe(0.025);
    expect(parseDecimalInput(" 1 000,5 ")).toBe(1000.5);
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("-")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNull();
  });
  it("saisie partielle : un seul séparateur, signe seulement si autorisé", () => {
    expect(isPartialDecimal("0.")).toBe(true);
    expect(isPartialDecimal("1,0")).toBe(true);
    expect(isPartialDecimal("1.2.3")).toBe(false);
    expect(isPartialDecimal("-1")).toBe(false);
    expect(isPartialDecimal("-1", true)).toBe(true);
  });
});

/** Champ contrôlé comme dans les formulaires : l'état parent ne garde que le nombre. */
function Harness({ initial = 0, zeroAsEmpty = false, onValue }: { initial?: number | null; zeroAsEmpty?: boolean; onValue?: (n: number | null) => void }) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <>
      <DecimalInput aria-label="valeur" value={v} zeroAsEmpty={zeroAsEmpty} onValueChange={(n) => { setV(n); onValue?.(n); }} />
      <button type="button" onClick={() => setV(0)}>reset</button>
    </>
  );
}

const typeSeq = (el: HTMLElement, steps: string[]) => steps.forEach((s) => fireEvent.change(el, { target: { value: s } }));

describe("DecimalInput", () => {
  it("garde « 0.0 » pendant la frappe et atteint 0.025", () => {
    const onValue = vi.fn();
    render(<Harness initial={null} onValue={onValue} />);
    const input = screen.getByLabelText("valeur") as HTMLInputElement;
    typeSeq(input, ["0", "0.", "0.0", "0.02", "0.025"]);
    expect(input.value).toBe("0.025");
    expect(onValue).toHaveBeenLastCalledWith(0.025);
  });

  it("« 1.0 » reste affiché tel quel", () => {
    render(<Harness initial={null} />);
    const input = screen.getByLabelText("valeur") as HTMLInputElement;
    typeSeq(input, ["1", "1.", "1.0"]);
    expect(input.value).toBe("1.0");
  });

  it("zeroAsEmpty : vide au départ, « 0 » tapé reste affiché", () => {
    render(<Harness initial={0} zeroAsEmpty />);
    const input = screen.getByLabelText("valeur") as HTMLInputElement;
    expect(input.value).toBe("");
    typeSeq(input, ["0", "0.", "0.5"]);
    expect(input.value).toBe("0.5");
  });

  it("refuse les caractères non numériques et réaligne sur une remise à zéro externe", () => {
    render(<Harness initial={0} zeroAsEmpty />);
    const input = screen.getByLabelText("valeur") as HTMLInputElement;
    typeSeq(input, ["12", "12a"]);
    expect(input.value).toBe("12");
    fireEvent.click(screen.getByText("reset"));
    expect(input.value).toBe("");
  });
});
