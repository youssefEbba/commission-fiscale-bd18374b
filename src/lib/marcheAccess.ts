import type { AppRole } from "@/contexts/AuthContext";

/** Rôles admis sur les écrans Marchés (mêmes que les routes `/dashboard/marches`). */
export const MARCHE_ROUTE_ROLES: AppRole[] = ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"];

/** Un lien vers la fiche marché n'est proposé qu'aux rôles qui peuvent l'ouvrir (pas l'entreprise). */
export const canOpenMarche = (role?: string | null) => !!role && (MARCHE_ROUTE_ROLES as string[]).includes(role);
