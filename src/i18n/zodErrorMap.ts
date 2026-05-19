import { z, type ZodErrorMap } from "zod";
import i18n from "./index";

/**
 * Mappe les erreurs Zod vers les clés du namespace `validation`.
 * Branché globalement via `z.setErrorMap` au bootstrap.
 */
export const i18nZodErrorMap: ZodErrorMap = (issue, ctx) => {
  const t = i18n.getFixedT(i18n.language, "validation");

  switch (issue.code) {
    case z.ZodIssueCode.invalid_type: {
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: t("required") };
      }
      return { message: t("invalid_type_expected", { expected: issue.expected }) };
    }
    case z.ZodIssueCode.invalid_string: {
      if (issue.validation === "email") return { message: t("invalid_string.email") };
      if (issue.validation === "url") return { message: t("invalid_string.url") };
      if (issue.validation === "uuid") return { message: t("invalid_string.uuid") };
      if (issue.validation === "regex") return { message: t("invalid_string.regex") };
      return { message: t("invalid_string.default") };
    }
    case z.ZodIssueCode.too_small: {
      const k =
        issue.type === "string"
          ? issue.exact
            ? "too_small.string_exact"
            : "too_small.string"
          : issue.type === "number"
          ? issue.inclusive
            ? "too_small.number"
            : "too_small.number_exclusive"
          : issue.type === "array"
          ? "too_small.array"
          : issue.type === "date"
          ? "too_small.date"
          : "too_small.string";
      return { message: t(k, { minimum: issue.minimum as number }) };
    }
    case z.ZodIssueCode.too_big: {
      const k =
        issue.type === "string"
          ? issue.exact
            ? "too_big.string_exact"
            : "too_big.string"
          : issue.type === "number"
          ? issue.inclusive
            ? "too_big.number"
            : "too_big.number_exclusive"
          : issue.type === "array"
          ? "too_big.array"
          : issue.type === "date"
          ? "too_big.date"
          : "too_big.string";
      return { message: t(k, { maximum: issue.maximum as number }) };
    }
    case z.ZodIssueCode.invalid_enum_value:
      return { message: t("invalid_enum") };
    case z.ZodIssueCode.invalid_date:
      return { message: t("invalid_date") };
    case z.ZodIssueCode.custom:
      return { message: issue.message ?? t("custom") };
    default:
      return { message: ctx.defaultError };
  }
};

export function installZodErrorMap() {
  z.setErrorMap(i18nZodErrorMap);
  // Re-bind on language change so freshly-thrown errors pick the new locale
  i18n.on("languageChanged", () => z.setErrorMap(i18nZodErrorMap));
}
