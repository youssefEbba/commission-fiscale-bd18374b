/**
 * Règles d'affichage du reporting, isolées pour être testées.
 * - Un nombre nul (null/undefined) s'affiche « n/a », jamais « 0 ».
 * - Les lignes HORS_RATTACHEMENT et NON_RENSEIGNE survivent à tout filtre ou tri.
 * - Une date civile (« 2026-11-30 ») n'est jamais convertie de fuseau.
 */

export const SPECIAL_KEYS = ["HORS_RATTACHEMENT", "NON_RENSEIGNE"] as const;

export const isSpecialKey = (cle: string | null | undefined) =>
  !!cle && (SPECIAL_KEYS as readonly string[]).includes(cle);

/** Formate une valeur numérique ; nul → libellé « n/a » fourni. */
export function orNA(
  v: number | null | undefined,
  fmt: (n: number) => string,
  na: string,
): string {
  if (v == null || typeof v !== "number" || Number.isNaN(v)) return na;
  return fmt(v);
}

/**
 * Filtre et trie les lignes ordinaires, puis remet toujours à la fin
 * les lignes de qualité des données (HORS_RATTACHEMENT, NON_RENSEIGNE).
 */
export function arrangeLines<T extends { cle: string }>(
  lignes: T[],
  opts: { filter?: (l: T) => boolean; compare?: (a: T, b: T) => number } = {},
): T[] {
  const regular = lignes.filter((l) => !isSpecialKey(l.cle));
  const special = lignes.filter((l) => isSpecialKey(l.cle));
  let out = opts.filter ? regular.filter(opts.filter) : [...regular];
  if (opts.compare) out = [...out].sort(opts.compare);
  const order = (c: string) => (SPECIAL_KEYS as readonly string[]).indexOf(c);
  return [...out, ...[...special].sort((a, b) => order(a.cle) - order(b.cle))];
}

/** Date civile « AAAA-MM-JJ » formatée sans conversion de fuseau. */
export function formatCivilDate(s: string | null | undefined, locale: string, na: string): string {
  if (!s) return na;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}
