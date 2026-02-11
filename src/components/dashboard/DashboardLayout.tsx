import { ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Shield, Users, LayoutDashboard, LogOut, FileText, Award, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, AppRole } from "@/contexts/AuthContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: AppRole[]; // if undefined, visible to all authenticated users
}

const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Utilisateurs", href: "/dashboard/utilisateurs", icon: Users, roles: ["PRESIDENT", "ADMIN_SI"] },
  { label: "Demandes", href: "/dashboard/demandes", icon: FileText },
  { label: "Certificats", href: "/dashboard/certificats", icon: Award },
];

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || hasRole(item.roles));

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
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
          {visibleItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
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
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-sm font-bold text-foreground">Commission Fiscale</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
