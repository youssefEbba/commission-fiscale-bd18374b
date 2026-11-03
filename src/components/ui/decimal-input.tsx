import * as React from "react";
import { Input } from "@/components/ui/input";
import { decimalTextMatches, isPartialDecimal, parseDecimalInput } from "@/lib/decimalInput";

type InputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "defaultValue">;

export interface DecimalInputProps extends InputProps {
  value: number | null | undefined;
  /** Nombre saisi ; `null` quand le champ est vide. */
  onValueChange: (value: number | null) => void;
  allowNegative?: boolean;
  /** Affiche un champ vide pour 0 (au lieu de « 0 »). */
  zeroAsEmpty?: boolean;
}

const toText = (value: number | null | undefined, zeroAsEmpty: boolean) =>
  value == null || (zeroAsEmpty && value === 0) ? "" : String(value);

/**
 * Champ décimal : le texte tapé n'est jamais réécrit pendant la frappe (« 1.0 », « 0.0 » restent affichés),
 * seul le nombre remonte. Le texte n'est réaligné que si la valeur reçue change sans correspondre à la saisie.
 */
export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onValueChange, allowNegative = false, zeroAsEmpty = false, inputMode, ...props }, ref) => {
    const [text, setText] = React.useState(() => toText(value, zeroAsEmpty));

    React.useEffect(() => {
      setText((cur) => (decimalTextMatches(cur, value) ? cur : toText(value, zeroAsEmpty)));
    }, [value, zeroAsEmpty]);

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode ?? "decimal"}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          if (!isPartialDecimal(next, allowNegative)) return;
          setText(next);
          onValueChange(parseDecimalInput(next));
        }}
      />
    );
  },
);
DecimalInput.displayName = "DecimalInput";
