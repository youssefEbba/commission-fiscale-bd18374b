import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Users, LayoutDashboard, LogOut, FileText, Award, Settings, ChevronDown, Tag, Landmark, ArrowRightLeft, Archive, BarChart3, Menu, X, FolderOpen, ScrollText, FlaskConical, User, CircleUser, Gavel } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: AppRole[];
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  roles?: AppRole[];
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const NAV_ENTRIES: NavEntry[] = [
  // Tous les rôles voient le tableau de bord
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  // Conventions : AC crée, DGB valide
  { label: "Conventions", href: "/dashboard/conventions", icon: ScrollText, roles: ["AUTORITE_CONTRACTANTE", "DGB", "PRESIDENT", "ADMIN_SI"] },
  // P1 (Référentiel Projet) : AC crée, DGB valide
  { label: "Référentiel Projet", href: "/dashboard/referentiels", icon: FolderOpen, roles: ["AUTORITE_CONTRACTANTE", "DGB", "PRESIDENT", "ADMIN_SI"] },
  // P2 (Correction de l'offre) : AC initie, DGD/DGI/DGB/DGTCP évaluent, PRESIDENT valide
  { label: "Demandes", href: "/dashboard/demandes", icon: FileText, roles: ["AUTORITE_CONTRACTANTE", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
  // Marchés : AC crée, admin consulte
  { label: "Marchés", href: "/dashboard/marches", icon: Gavel, roles: ["AUTORITE_CONTRACTANTE", "ADMIN_SI", "PRESIDENT"] },
  // P3 (Certificat) : AC soumet, DGI vérifie, DGTCP ouvre crédit, PRESIDENT signe
  { label: "Certificats", href: "/dashboard/certificats", icon: Award, roles: ["AUTORITE_CONTRACTANTE", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
  // P4 (Douane) : ENT soumet, DGD contrôle, DGTCP impute | P5 (Intérieur) : ENT soumet, DGTCP valide, DGI consulte
  { label: "Utilisations", href: "/dashboard/utilisations", icon: Landmark, roles: ["ENTREPRISE", "DGD", "DGTCP", "DGI", "ADMIN_SI"] },
  // Simulation : Entreprise uniquement
  { label: "Simulation", href: "/dashboard/simulation", icon: FlaskConical, roles: ["ENTREPRISE", "ADMIN_SI"] },
  {
    label: "Opérations",
    icon: ArrowRightLeft,
    roles: ["AUTORITE_CONTRACTANTE", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"],
    children: [
      // P6 (Modifications) : AC/ENT soumettent, DGTCP analyse, DGI consulté, PRESIDENT valide
      { label: "Modifications", href: "/dashboard/modifications", icon: Settings, roles: ["AUTORITE_CONTRACTANTE", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
      // P7 (Transfert Douane→Intérieur) : ENT demande, DGTCP contrôle, DGD consulté, PRESIDENT valide
      { label: "Transferts", href: "/dashboard/transferts", icon: ArrowRightLeft, roles: ["ENTREPRISE", "DGD", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
      // P8 (Clôture/Archivage/Reporting) : DGTCP prépare, PRESIDENT valide, DGB consulte reporting
      { label: "Clôture & Reporting", href: "/dashboard/cloture", icon: Archive, roles: ["DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
    ],
  },
  {
    label: "Paramétrage",
    icon: Settings,
    roles: ["PRESIDENT", "ADMIN_SI"],
    children: [
      { label: "Utilisateurs", href: "/dashboard/utilisateurs", icon: Users },
      { label: "Rôles & Permissions", href: "/dashboard/roles", icon: Tag },
      { label: "Journal d'audit", href: "/dashboard/audit", icon: BarChart3 },
    ],
  },
];

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate("/"); };

  const linkClass = (href: string) => {
    const active = location.pathname === href;
    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    }`;
  };

  const isGroupActive = (group: NavGroup) => group.children.some((c) => location.pathname === c.href);

  const renderNav = (closeMobile?: () => void) => (
    <nav className="flex-1 p-3 space-y-1">
      {NAV_ENTRIES.map((entry) => {
        if (isGroup(entry)) {
          if (entry.roles && !hasRole(entry.roles)) return null;
          const groupActive = isGroupActive(entry);
          return (
            <Collapsible key={entry.label} defaultOpen={groupActive}>
              <CollapsibleTrigger className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium w-full transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground group">
                <entry.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{entry.label}</span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
                {entry.children.map((child) => {
                  if (child.roles && !hasRole(child.roles)) return null;
                  return (
                    <Link key={child.href} to={child.href} className={linkClass(child.href)} onClick={closeMobile}>
                      <child.icon className="h-4 w-4" />
                      {child.label}
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        }
        if (entry.roles && !hasRole(entry.roles)) return null;
        return (
          <Link key={entry.href} to={entry.href} className={linkClass(entry.href)} onClick={closeMobile}>
            <entry.icon className="h-4 w-4" />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarContent = (closeMobile?: () => void) => (
    <>
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Commission Fiscale" className="h-8 w-8" />
          <div className="leading-tight">
            <span className="block text-sm font-bold">Commission Fiscale</span>
            <span className="block text-[10px] font-medium text-sidebar-primary tracking-wider uppercase">Mauritanie</span>
          </div>
        </Link>
      </div>
      {renderNav(closeMobile)}
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-[10px] text-sidebar-foreground/40 text-center">© Commission Fiscale</div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
        {sidebarContent()}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col bg-sidebar text-sidebar-foreground">
            {sidebarContent(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-end gap-2 px-6 py-3 border-b border-border bg-card">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 px-2">
                <CircleUser className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-sm">{user?.nomComplet || user?.username}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{user?.nomComplet || user?.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role?.toLowerCase().replace("_", " ")}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" /> Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="Commission Fiscale" className="h-7 w-7" />
              <span className="text-sm font-bold text-foreground">Commission Fiscale</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <CircleUser className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium">{user?.nomComplet || user?.username}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role?.toLowerCase().replace("_", " ")}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
