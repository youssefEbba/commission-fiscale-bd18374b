import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DossiersList from "@/components/ged/DossiersList";
import { usePageTitle } from "@/hooks/usePageTitle";

const GedDossiers = () => {
  const { t } = useTranslation();
  usePageTitle("ged:dossiers.title");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("ged:dossiers.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("ged:dossiers.subtitle")}
          </p>
        </div>
        <DossiersList />
      </div>
    </DashboardLayout>
  );
};

export default GedDossiers;
