import i18n from "./index";

function locale(): string {
  return i18n.language?.startsWith("ar") ? "ar-MR" : "fr-FR";
}

export function formatDate(
  d: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" },
): string {
  if (d == null || d === "") return "—";
  const date = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale(), { numberingSystem: "latn", ...opts }).format(date);
}

export function formatDateTime(d: string | number | Date | null | undefined): string {
  return formatDate(d, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface FormatAmountOptions {
  currency?: string;
  numberingSystem?: "latn" | "arab";
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}

export function formatAmount(
  n: number | string | null | undefined,
  { currency = "MRU", numberingSystem = "latn", maximumFractionDigits = 0, minimumFractionDigits = 0 }: FormatAmountOptions = {},
): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || Number.isNaN(v as number)) return `0 ${currency}`;
  try {
    return new Intl.NumberFormat(locale(), {
      style: "currency",
      currency,
      numberingSystem,
      maximumFractionDigits,
      minimumFractionDigits,
    }).format(v as number);
  } catch {
    return `${v} ${currency}`;
  }
}

export function formatNumber(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || Number.isNaN(v as number)) return "0";
  return new Intl.NumberFormat(locale(), { numberingSystem: "latn" }).format(v as number);
}
