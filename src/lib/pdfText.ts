const UNITES = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function below100(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7 || d === 9) return DIZAINES[d] + "-" + UNITES[10 + u];
  if (d === 8 && u === 0) return "quatre-vingts";
  return DIZAINES[d] + (u === 1 && d !== 8 ? " et un" : u ? "-" + UNITES[u] : "");
}

function below1000(n: number): string {
  if (n < 100) return below100(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  const cs = c === 1 ? "cent" : UNITES[c] + " cent" + (r === 0 ? "s" : "");
  return r === 0 ? cs : cs + " " + below100(r);
}

/** Espaces fines et tirets Unicode absents des polices PDF de base. */
export function pdfSafe(s: string): string {
  return s
    .replace(/[\u00A0\u202F\u2007\u2009]/g, " ")
    .replace(/[\u2013\u2014]/g, "-");
}

export function pdfFmtNombre(v: unknown, fractionDigits = 2): string {
  if (v == null || Number.isNaN(Number(v))) return "";
  return pdfSafe(
    Number(v).toLocaleString("fr-FR", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }),
  );
}

export function numberToFrenchWords(n: number): string {
  if (!Number.isFinite(n)) return "";
  const entier = Math.floor(Math.abs(n));
  if (entier === 0) return "zéro";
  const millions = Math.floor(entier / 1_000_000);
  const milliers = Math.floor((entier % 1_000_000) / 1000);
  const reste = entier % 1000;
  let s = "";
  if (millions > 0) s += millions === 1 ? "un million" : below1000(millions) + " millions";
  if (milliers > 0) {
    if (s) s += " ";
    s += milliers === 1 ? "mille" : below1000(milliers) + " mille";
  }
  if (reste > 0) {
    if (s) s += " ";
    s += below1000(reste);
  }
  return s;
}

export function montantOuguiyaEnLettres(n: number): string {
  if (!Number.isFinite(n)) return "";
  const entier = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - entier) * 100);
  if (entier === 0 && cents === 0) return "zéro Ouguiya";
  let s = numberToFrenchWords(entier);
  if (cents > 0) s += " virgule " + numberToFrenchWords(cents);
  return s + " Ouguiya";
}
