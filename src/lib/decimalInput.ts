// Saisie de nombres décimaux : le texte tapé reste tel quel, seul le nombre est transmis.

/** Texte saisi → nombre (`,` accepté, espaces ignorés) ; vide ou invalide → `null`. */
export function parseDecimalInput(text: string | null | undefined): number | null {
  const raw = (text ?? "").replace(/\s/g, "").replace(",", ".");
  if (raw === "" || raw === "-" || raw === ".") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Saisie en cours acceptable (« 1. », « 0,0 », « - »…) : chiffres, un séparateur, signe éventuel. */
export function isPartialDecimal(text: string, allowNegative = false): boolean {
  const raw = text.replace(/\s/g, "");
  return (allowNegative ? /^-?\d*[.,]?\d*$/ : /^\d*[.,]?\d*$/).test(raw);
}

/** Le texte affiché correspond-il déjà à la valeur (vide ≡ 0) ? */
export function decimalTextMatches(text: string, value: number | null | undefined): boolean {
  return (parseDecimalInput(text) ?? 0) === (value ?? 0);
}
