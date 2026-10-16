import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { tRole } from "@/i18n/enums";
import { usePageTitle } from "@/hooks/usePageTitle";
import MainCourante from "@/components/dashboard/MainCourante";

const Dashboard = () => {
  const { t } = useTranslation("dashboard");
  usePageTitle("dashboard:page_title");
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("greeting", { name: user?.nomComplet || user?.username })}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("welcome")} – <Badge variant="secondary" className="text-xs">{tRole(user?.role)}</Badge>
          </p>
        </div>

        <MainCourante />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
