import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Shield, Users, LayoutDashboard, LogOut, FileText, Award, Settings, ChevronDown, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Demandes", href: "/dashboard/demandes", icon: FileText },
  { label: "Certificats", href: "/dashboard/certificats", icon: Award },
  {
    label: "Paramétrage",
    icon: Settings,
    roles: ["PRESIDENT", "ADMIN_SI"],
    children: [
      { label: "Utilisateurs", href: "/dashboard/utilisateurs", icon: Users },
      { label: "Rôles", href: "/dashboard/roles", icon: Tag },
    ],
  },
];

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate("/"); };

  const linkClass = (href: string) => {
    const active = location.pathname === href;
    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    }`;
  };

  const isGroupActive = (group: NavGroup) => group.children.some((c) => location.pathname === c.href);

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-sidebar-primary" />
            <div className="leading-tight">
              <span className="block text-sm font-bold">Commission Fiscale</span>
              <span className="block text-[10px] font-medium text-sidebar-primary tracking-wider uppercase">Mauritanie</span>
            </div>
          </Link>
        </div>

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
                    {entry.children.map((child) => (
                      <Link key={child.href} to={child.href} className={linkClass(child.href)}>
                        <child.icon className="h-4 w-4" />
                        {child.label}
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            }
            if (entry.roles && !hasRole(entry.roles)) return null;
            return (
              <Link key={entry.href} to={entry.href} className={linkClass(entry.href)}>
                <entry.icon className="h-4 w-4" />
                {entry.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60 mb-2">
            <p className="font-medium text-sidebar-foreground">{user?.nomComplet || user?.username}</p>
            <p className="capitalize">{user?.role?.toLowerCase().replace("_", " ")}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4 mr-2" /> Déconnexion
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-sm font-bold text-foreground">Commission Fiscale</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4" /></Button>
        </header>
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
