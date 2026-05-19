import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users, LayoutDashboard, LogOut, FileText, Award, Settings, ChevronDown, Tag, Landmark, ArrowRightLeft, Archive, BarChart3, Menu, X, FolderOpen, ScrollText, FlaskConical, User, CircleUser, Gavel, UserPlus, Handshake, PieChart, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { commissionRelaisApi, formatApiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { emitErrorDialog } from "@/components/ErrorDialog";
import LanguageSwitcher from "@/i18n/LanguageSwitcher";
import { tRole } from "@/i18n/enums";

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ElementType;
  roles?: AppRole[];
}

interface NavGroup {
  labelKey: string;
  icon: React.ElementType;
  roles?: AppRole[];
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const NAV_ENTRIES: NavEntry[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "conventions", href: "/dashboard/conventions", icon: ScrollText, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "DGD", "DGTCP", "DGI", "DGB", "PRESIDENT", "ADMIN_SI"] },
  { labelKey: "marches", href: "/dashboard/marches", icon: Gavel, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "DGD", "DGTCP", "DGI", "DGB", "PRESIDENT", "ADMIN_SI"] },
  {
    labelKey: "demandes",
    icon: FileText,
    roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"],
    children: [
      { labelKey: "demandes_correction", href: "/dashboard/demandes", icon: FileText, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
      { labelKey: "demandes_mise_en_place", href: "/dashboard/mise-en-place", icon: Award, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGD", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
    ],
  },
  { labelKey: "representants", href: "/dashboard/delegues", icon: UserPlus, roles: ["AUTORITE_CONTRACTANTE"] },
  { labelKey: "certificats", href: "/dashboard/certificats", icon: Award, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
  { labelKey: "utilisations", href: "/dashboard/utilisations", icon: Landmark, roles: ["ENTREPRISE", "DGD", "DGTCP", "DGI", "ADMIN_SI"] },
  { labelKey: "simulation", href: "/dashboard/simulation", icon: FlaskConical, roles: ["ENTREPRISE", "ADMIN_SI"] },
  { labelKey: "reporting", href: "/dashboard/reporting", icon: PieChart },
  {
    labelKey: "operations",
    icon: ArrowRightLeft,
    roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "SOUS_TRAITANT", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"],
    children: [
      { labelKey: "modifications", href: "/dashboard/modifications", icon: Settings, roles: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "DGI", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
      { labelKey: "transferts", href: "/dashboard/transferts", icon: ArrowRightLeft, roles: ["ENTREPRISE", "DGD", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
      { labelKey: "sous_traitance", href: "/dashboard/sous-traitance", icon: Handshake, roles: ["ENTREPRISE", "SOUS_TRAITANT", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
      { labelKey: "cloture", href: "/dashboard/cloture", icon: Archive, roles: ["DGB", "DGTCP", "PRESIDENT", "ADMIN_SI"] },
    ],
  },
  {
    labelKey: "ged",
    icon: FolderOpen,
    roles: ["ADMIN_SI"],
    children: [
      { labelKey: "ged_configuration", href: "/dashboard/ged/configuration", icon: Settings, roles: ["ADMIN_SI"] },
      { labelKey: "ged_dossiers", href: "/dashboard/ged/dossiers", icon: FolderOpen, roles: ["ADMIN_SI"] },
    ],
  },
  {
    labelKey: "parametrage",
    icon: Settings,
    roles: ["ADMIN_SI"],
    children: [
      { labelKey: "utilisateurs", href: "/dashboard/utilisateurs", icon: Users },
      { labelKey: "roles_permissions", href: "/dashboard/roles", icon: Tag },
      { labelKey: "referentiel_taxes", href: "/dashboard/referentiel-taxes", icon: Tag },
      { labelKey: "audit", href: "/dashboard/audit", icon: BarChart3 },
    ],
  },
];

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout, hasRole, isImpersonating, isCommissionRelais, applyImpersonation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(["nav", "common"]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const handleLogout = () => { logout(); navigate("/"); };

  const handleRelease = async () => {
    setReleasing(true);
    try {
      const res = await commissionRelaisApi.release();
      applyImpersonation(res);
      toast.success(t("common:session.back_to_relay"));
      navigate("/dashboard/relais");
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status === 403) {
        toast.message(t("common:session.session_ended"));
        logout();
        navigate("/login");
        return;
      }
      emitErrorDialog({
        title: t("common:session.release_failed_title"),
        description: formatApiErrorMessage(err, t("common:session.release_failed_title")),
      });
    } finally {
      setReleasing(false);
    }
  };

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
            <Collapsible key={entry.labelKey} defaultOpen={groupActive}>
              <CollapsibleTrigger className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium w-full transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground group">
                <entry.icon className="h-4 w-4" />
                <span className="flex-1 text-start">{t(`nav:${entry.labelKey}`)}</span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="ps-4 space-y-0.5 mt-0.5">
                {entry.children.map((child) => {
                  if (child.roles && !hasRole(child.roles)) return null;
                  return (
                    <Link key={child.href} to={child.href} className={linkClass(child.href)} onClick={closeMobile}>
                      <child.icon className="h-4 w-4" />
                      {t(`nav:${child.labelKey}`)}
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
            {t(`nav:${entry.labelKey}`)}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarContent = (closeMobile?: () => void) => (
    <>
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt={t("common:app.title")} className="h-8 w-8" />
          <div className="leading-tight">
            <span className="block text-sm font-bold">{t("common:app.title")}</span>
            <span className="block text-[10px] font-medium text-sidebar-primary tracking-wider uppercase">{t("common:app.subtitle")}</span>
          </div>
        </Link>
      </div>
      {renderNav(closeMobile)}
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-[10px] text-sidebar-foreground/40 text-center">© {t("common:app.title")}</div>
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

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-end gap-2 px-6 py-3 border-b border-border bg-card shrink-0">
          <LanguageSwitcher />
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
                <p className="text-xs text-muted-foreground">{tRole(user?.role)}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="h-4 w-4 me-2" /> {t("common:session.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt={t("common:app.title")} className="h-7 w-7" />
              <span className="text-sm font-bold text-foreground">{t("common:app.title")}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
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
                  <p className="text-xs text-muted-foreground">{tRole(user?.role)}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 me-2" /> {t("common:session.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {isImpersonating && (
          <div
            className="border-b px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0"
            style={{ backgroundColor: "hsl(45 95% 92%)", borderColor: "hsl(45 80% 70%)", color: "hsl(30 70% 25%)" }}
          >
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {t("common:session.impersonating", { label: user?.actingTargetLabel ?? "—" })}
                <span className="ms-1 opacity-80">
                  ({user?.role === "ENTREPRISE" ? t("common:session.impersonating_mode_entreprise") : t("common:session.impersonating_mode_ac")} — {t("common:session.impersonating_duration")})
                </span>
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={handleRelease}
              disabled={releasing}
            >
              {releasing ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1" /> : <ShieldCheck className="h-3.5 w-3.5 me-1" />}
              {t("common:session.release")}
            </Button>
          </div>
        )}
        {isCommissionRelais && !isImpersonating && location.pathname !== "/dashboard/relais" && (
          <div className="bg-muted border-b border-border px-4 md:px-6 py-2.5 text-sm shrink-0">
            <Link to="/dashboard/relais" className="text-primary font-medium hover:underline">
              {t("common:session.choose_entity")} <span className="rtl:hidden">→</span><span className="hidden rtl:inline">←</span>
            </Link>
          </div>
        )}
        <div className="flex-1 overflow-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
