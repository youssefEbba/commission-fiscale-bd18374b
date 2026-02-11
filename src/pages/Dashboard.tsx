import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Users, FileText, Award, Activity } from "lucide-react";

const stats = [
  { label: "Utilisateurs", icon: Users, value: "—", color: "text-primary" },
  { label: "Demandes", icon: FileText, value: "—", color: "text-accent" },
  { label: "Certificats", icon: Award, value: "—", color: "text-green-glow" },
  { label: "En cours", icon: Activity, value: "—", color: "text-primary" },
];

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bonjour, {user?.nomComplet || user?.username} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bienvenue sur votre tableau de bord
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
