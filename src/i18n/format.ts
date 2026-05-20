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

export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Renvoie "0" pour les valeurs proches de zéro selon l'epsilon (utile pour la simulation fiscale). */
  zeroEpsilon?: number;
}

export function formatNumber(
  n: number | string | null | undefined,
  { minimumFractionDigits, maximumFractionDigits, zeroEpsilon }: FormatNumberOptions = {},
): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || Number.isNaN(v as number)) return "0";
  if (zeroEpsilon != null && Math.abs(v as number) < zeroEpsilon) return "0";
  return new Intl.NumberFormat(locale(), {
    numberingSystem: "latn",
    ...(minimumFractionDigits != null ? { minimumFractionDigits } : {}),
    ...(maximumFractionDigits != null ? { maximumFractionDigits } : {}),
  }).format(v as number);
}

/**
 * Formate une taille de fichier en utilisant les suffixes localisés (`ged.units.*`).
 * Le séparateur décimal suit la locale courante. Le nombre est toujours en chiffres latins.
 */
export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return i18n.t("ged:units.placeholder", { defaultValue: "—" }) as string;
  const fmt = (n: number, frac = 0) =>
    new Intl.NumberFormat(locale(), {
      numberingSystem: "latn",
      maximumFractionDigits: frac,
      minimumFractionDigits: 0,
    }).format(n);
  if (bytes < 1024) {
    return `${fmt(bytes)} ${i18n.t("ged:units.byte_short", { defaultValue: "o" })}`;
  }
  if (bytes < 1024 * 1024) {
    return `${fmt(bytes / 1024, 1)} ${i18n.t("ged:units.kilobyte_short", { defaultValue: "Ko" })}`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${fmt(bytes / (1024 * 1024), 1)} ${i18n.t("ged:units.megabyte_short", { defaultValue: "Mo" })}`;
  }
  return `${fmt(bytes / (1024 * 1024 * 1024), 2)} ${i18n.t("ged:units.gigabyte_short", { defaultValue: "Go" })}`;
}

