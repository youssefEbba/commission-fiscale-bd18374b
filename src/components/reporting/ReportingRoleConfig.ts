import { AppRole } from "@/contexts/AuthContext";
import i18n from "@/i18n";

export const NATIONAL_ROLES: AppRole[] = ["PRESIDENT", "ADMIN_SI", "DGD", "DGTCP", "DGI", "DGB"];

export function isNationalRole(role?: AppRole): boolean {
  return !!role && NATIONAL_ROLES.includes(role);
}

/**
 * Libellé de rôle pour le header Reporting. Utilise `reporting:roles.*` plutôt
 * que `tRole` car la formulation (« — vue nationale », « Mes marchés délégués »)
 * est spécifique à ce module et ne dérive pas directement du code de rôle.
 */
export function getRoleLabel(role?: AppRole): string {
  const t = (k: string) => i18n.t(`reporting:roles.${k}`) as string;
  switch (role) {
    case "PRESIDENT": return t("PRESIDENT");
    case "ADMIN_SI": return t("ADMIN_SI");
    case "DGD":
    case "DGTCP":
    case "DGI":
    case "DGB":
      return t("DIRECTION_NATIONALE");
    case "AUTORITE_CONTRACTANTE": return t("AUTORITE_CONTRACTANTE");
    case "AUTORITE_UPM":
    case "AUTORITE_UEP":
      return t("AUTORITE_DELEGUEE");
    case "ENTREPRISE": return t("ENTREPRISE");
    case "SOUS_TRAITANT": return t("SOUS_TRAITANT");
    default: return t("DEFAULT");
  }
}

/** Should audit section be displayed? Only for national roles. */
export function showAuditSection(role?: AppRole): boolean {
  return isNationalRole(role);
}

/** Should the "en validation Président" subtext be shown? */
export function showPresidentValidation(role?: AppRole): boolean {
  return isNationalRole(role) || role === "AUTORITE_CONTRACTANTE" || role === "AUTORITE_UPM" || role === "AUTORITE_UEP";
}
