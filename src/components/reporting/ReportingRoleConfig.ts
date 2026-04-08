import { AppRole } from "@/contexts/AuthContext";

export const NATIONAL_ROLES: AppRole[] = ["PRESIDENT", "ADMIN_SI", "DGD", "DGTCP", "DGI", "DGB"];

export function isNationalRole(role?: AppRole): boolean {
  return !!role && NATIONAL_ROLES.includes(role);
}

export function getRoleLabel(role?: AppRole): string {
  switch (role) {
    case "PRESIDENT": return "Présidence — vue nationale";
    case "ADMIN_SI": return "Administration — vue nationale";
    case "DGD":
    case "DGTCP":
    case "DGI":
    case "DGB":
      return "Vue nationale (direction)";
    case "AUTORITE_CONTRACTANTE": return "Ma collecte — mon autorité contractante";
    case "AUTORITE_UPM":
    case "AUTORITE_UEP":
      return "Mes marchés délégués";
    case "ENTREPRISE": return "Mon entreprise";
    case "SOUS_TRAITANT": return "Mon entreprise (sous-traitant)";
    default: return "Reporting";
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
