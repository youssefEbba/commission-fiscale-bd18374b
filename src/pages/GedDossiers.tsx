import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DossiersList from "@/components/ged/DossiersList";

const GedDossiers = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GED – Dossiers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consultez les dossiers et leurs documents par étape du workflow
          </p>
        </div>
        <DossiersList />
      </div>
    </DashboardLayout>
  );
};

export default GedDossiers;
