import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { entrepriseApi, EntrepriseDto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const Field = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </p>
    <p className="text-sm font-medium text-foreground break-words">{value ?? "—"}</p>
  </div>
);

const EntrepriseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation(["demandes", "common"]);
  const [entreprise, setEntreprise] = useState<EntrepriseDto | null>(null);
  const [loading, setLoading] = useState(true);

  usePageTitle("demandes:dialogs.entreprise_info.title");

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await entrepriseApi.getById(Number(id));
        setEntreprise(data);
      } catch (e: any) {
        toast({
          title: t("common:errors.title", { defaultValue: "Erreur" }),
          description: e.message || t("demandes:toast.load_entreprise_error"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, toast, t]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  if (!entreprise) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">{t("demandes:dialogs.entreprise_info.empty")}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("demandes:detail.back")}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              {entreprise.raisonSociale || `Entreprise #${entreprise.id}`}
            </CardTitle>
            {entreprise.nomCommercial && entreprise.nomCommercial !== entreprise.raisonSociale && (
              <p className="text-sm text-muted-foreground">{entreprise.nomCommercial}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="NIF" value={entreprise.nifAffiche || entreprise.nif} />
              <Field label={t("demandes:dialogs.entreprise_info.adresse")} value={entreprise.adresse} icon={MapPin} />
              <Field label="Téléphone" value={entreprise.telephone} icon={Phone} />
              <Field label="Email" value={entreprise.email} icon={Mail} />
              <Field label="Activité" value={entreprise.activite} />
              <Field label="Autre" value={entreprise.autre} />
            </div>

            {entreprise.entrepriseEtrangere && (
              <div className="rounded-lg border border-border p-4 bg-muted/30">
                <Badge variant="outline" className="mb-2">Entreprise étrangère</Badge>
                <Field label="Registre de commerce étranger" value={entreprise.registreCommerceEtranger} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EntrepriseDetail;
