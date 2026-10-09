import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Landmark, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import EntiteComptesCard from "@/components/entites/EntiteComptesCard";
import { autoriteContractanteApi, type AutoriteContractanteDto } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSmartBack } from "@/hooks/useSmartBack";
import { usePageTitle } from "@/hooks/usePageTitle";
import { showApiError } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTORITE_FIELDS } from "./AutoritesContractantes";

export default function AutoriteDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(["rattachement"]);
  usePageTitle("rattachement:entites.detail_autorite");
  const smartBack = useSmartBack("/dashboard/autorites");
  const { hasPermission } = useAuth();
  const [ac, setAc] = useState<AutoriteContractanteDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    autoriteContractanteApi.getById(Number(id)).then(setAc).catch((e) => showApiError(e, t("errors.load"))).finally(() => setLoading(false));
  }, [id, t]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="outline" size="sm" onClick={smartBack}><ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />{t("detail.back")}</Button>
        {loading ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          : !ac ? <p className="text-center text-muted-foreground py-20">{t("entites.empty")}</p>
          : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Landmark className="h-6 w-6 text-primary" />{ac.nom}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {AUTORITE_FIELDS.filter((f) => f.key !== "nom").map((f) => (
                    <div key={f.key} className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(f.labelKey)}</p>
                      <p className="text-sm font-medium text-foreground break-words">{(ac as any)[f.key] || "—"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {hasPermission("rattachement.validate") && ac.id != null && <EntiteComptesCard type="AUTORITE_CONTRACTANTE" entiteId={ac.id} />}
            </>
          )}
      </div>
    </DashboardLayout>
  );
}
