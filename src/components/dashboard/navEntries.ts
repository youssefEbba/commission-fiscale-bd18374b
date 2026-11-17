// Menu latéral : groupes et entrées, filtrés à l'affichage par rôle et permission (DashboardLayout).
// « Demandes » regroupe les dépôts : correction, mise en place, utilisations et transferts.
import type { ElementType } from "react";
import {
  Archive, ArrowRightLeft, Award, BarChart3, Briefcase, Building2, ClipboardList, FilePen, FileText, FlaskConical, FolderOpen, Gavel, Handshake, Landmark, LayoutDashboard, PenLine, PieChart, ScrollText, Settings, Smile, Tag, UserCheck, UserPlus, Users,
} from "lucide-react";
import type { AppRole } from "@/contexts/AuthContext";

export interface NavItem {
  labelKey: string;
  href: string;
  icon: ElementType;
  roles?: AppRole[];
  /** Permission métier requise (en plus des rôles éventuels). */
  permission?: string;
}

export interface NavGroup {
  labelKey: string;
  icon: ElementType;
  roles?: AppRole[];
  children: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

export const NAV_ENTRIES: NavEntry[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "conventions", href: "/dashboard/conventions", icon: ScrollText, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "DGD", "DGTCP", "DGI", "DGB", "PRESIDENT", "ADMIN_SI"] },
  {
    // Attributions / Marchés : les marchés et leurs avenants (une entreprise ne voit que les avenants).
    labelKey: "marches",
    icon: Gavel,
    roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGTCP", "DGI", "DGB", "PRESIDENT", "ADMIN_SI"],
    children: [
      { labelKey: "marches_liste", href: "/dashboard/marches", icon: Gavel, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "DGD", "DGTCP", "DGI", "DGB", "PRESIDENT", "ADMIN_SI"] },
      { labelKey: "modifications", href: "/dashboard/modifications", icon: FilePen, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
    ],
  },
  { labelKey: "groupements", href: "/dashboard/groupements", icon: Users, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
  {
    labelKey: "demandes",
    icon: FileText,
    roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"],
    children: [
      { labelKey: "demandes_correction", href: "/dashboard/demandes", icon: FileText, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
      { labelKey: "demandes_mise_en_place", href: "/dashboard/mise-en-place", icon: Award, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
      { labelKey: "utilisations", href: "/dashboard/utilisations", icon: Landmark, roles: ["ENTREPRISE", "DGD", "DGTCP", "DGI", "PRESIDENT", "ADMIN_SI"] },
      { labelKey: "transferts", href: "/dashboard/transferts", icon: ArrowRightLeft, roles: ["ENTREPRISE", "DGD", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
    ],
  },
  { labelKey: "representants", href: "/dashboard/delegues", icon: UserPlus, roles: ["AUTORITE_CONTRACTANTE"] },
  { labelKey: "certificats", href: "/dashboard/certificats", icon: Award, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
  { labelKey: "simulation", href: "/dashboard/simulation", icon: FlaskConical, roles: ["ENTREPRISE", "ADMIN_SI"] },
  { labelKey: "reporting", href: "/dashboard/reporting", icon: PieChart, permission: "reporting.view" },
  {
    labelKey: "operations",
    icon: ArrowRightLeft,
    roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "SOUS_TRAITANT", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"],
    children: [
      { labelKey: "sous_traitance", href: "/dashboard/sous-traitance", icon: Handshake, roles: ["ENTREPRISE", "SOUS_TRAITANT", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
      { labelKey: "cloture", href: "/dashboard/cloture", icon: Archive, roles: ["DGTCP", "PRESIDENT", "ADMIN_SI"], permission: "cloture.queue.view" },
    ],
  },
  {
    labelKey: "referentiel_entites",
    icon: Building2,
    roles: ["PRESIDENT", "ADMIN_SI"],
    children: [
      { labelKey: "demandes_rattachement", href: "/dashboard/demandes-rattachement", icon: UserCheck, permission: "rattachement.validate" },
      { labelKey: "entreprises", href: "/dashboard/entreprises", icon: Building2 },
      { labelKey: "autorites", href: "/dashboard/autorites", icon: Landmark },
    ],
  },
  {
    labelKey: "ged",
    icon: FolderOpen,
    roles: ["ADMIN_SI", "PRESIDENT"],
    children: [
      { labelKey: "ged_configuration", href: "/dashboard/ged/configuration", icon: Settings, roles: ["ADMIN_SI"] },
      { labelKey: "ged_dossiers", href: "/dashboard/ged/dossiers", icon: FolderOpen, roles: ["ADMIN_SI", "PRESIDENT"] },
    ],
  },
  {
    labelKey: "satisfaction",
    icon: Smile,
    roles: ["ADMIN_SI", "PRESIDENT"],
    children: [
      { labelKey: "satisfaction_dashboard", href: "/dashboard/satisfaction", icon: Smile, roles: ["ADMIN_SI", "PRESIDENT"], permission: "feedback.dashboard.view" },
      { labelKey: "satisfaction_enquetes", href: "/dashboard/satisfaction/enquetes", icon: ClipboardList, roles: ["ADMIN_SI", "PRESIDENT"], permission: "feedback.enquete.manage" },
    ],
  },
  {
    labelKey: "parametrage",
    icon: Settings,
    roles: ["ADMIN_SI", "PRESIDENT"],
    children: [
      { labelKey: "utilisateurs", href: "/dashboard/utilisateurs", icon: Users, roles: ["ADMIN_SI"] },
      { labelKey: "roles_permissions", href: "/dashboard/roles", icon: Tag, roles: ["ADMIN_SI"] },
      { labelKey: "signatures", href: "/dashboard/signatures", icon: PenLine, roles: ["ADMIN_SI"] },
      { labelKey: "parametres", href: "/dashboard/parametres", icon: Settings, permission: "parametre.manage" },
      { labelKey: "referentiel_taxes", href: "/dashboard/referentiel-taxes", icon: Tag, roles: ["ADMIN_SI"] },
      { labelKey: "referentiel_secteurs", href: "/dashboard/referentiel-secteurs", icon: Briefcase, roles: ["ADMIN_SI", "PRESIDENT"], permission: "referentiel.secteur.manage" },
      { labelKey: "archive_credits", href: "/dashboard/archive/credits", icon: Archive, roles: ["ADMIN_SI"] },
      { labelKey: "audit", href: "/dashboard/audit", icon: BarChart3, roles: ["ADMIN_SI"] },
    ],
  },
];
