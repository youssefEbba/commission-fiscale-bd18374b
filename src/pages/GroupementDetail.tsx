import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { groupementApi, entrepriseApi, GroupementDto, EntrepriseDto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Users2, Loader2, MapPin, Crown } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDate } from "@/i18n/format";

const Field = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </p>
    <p className="text-sm font-medium text-foreground break-words">{value ?? "—"}</p>
  </div>
);

const GroupementDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation(["demandes", "common"]);
  const [groupement, setGroupement] = useState<GroupementDto | null>(null);
  const [loading, setLoading] = useState(true);

  usePageTitle("demandes:dialogs.entreprise_info.voir_groupement");

  const [membres, setMembres] = useState<EntrepriseDto[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await groupementApi.getById(Number(id));
        setGroupement(data);
        if (data.membres?.length) {
          setMembres(data.membres);
        } else if (data.membreIds?.length) {
          const results = await Promise.allSettled(data.membreIds.map(mid => entrepriseApi.getById(mid)));
          setMembres(results.filter(r => r.status === "fulfilled").map(r => (r as PromiseFulfilledResult<EntrepriseDto>).value));
        } else {
          setMembres([]);
        }
      } catch (e: any) {
        toast({
          title: t("common:errors.title", { defaultValue: "Erreur" }),
          description: e.message || t("demandes:toast.load_groupement_error"),
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

  if (!groupement) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">{t("demandes:dialogs.entreprise_info.empty")}</div>
      </DashboardLayout>
    );
  }

  const chefDeFile = membres.find((m: EntrepriseDto) => m.id === groupement.chefDeFileId);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("demandes:detail.back")}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Users2 className="h-6 w-6 text-primary" />
              {groupement.raisonSociale || `Groupement #${groupement.id}`}
            </CardTitle>
            {groupement.nomCommercial && groupement.nomCommercial !== groupement.raisonSociale && (
              <p className="text-sm text-muted-foreground">{groupement.nomCommercial}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="NIF (chef de file)" value={groupement.nifAffiche} />
              <Field label={t("demandes:dialogs.entreprise_info.adresse")} value={groupement.adresse} icon={MapPin} />
              <Field label="Chef de file" value={chefDeFile?.raisonSociale || groupement.chefDeFileRaisonSociale} icon={Crown} />
              <Field label="Statut" value={
                <Badge variant={groupement.actif !== false ? "default" : "secondary"}>
                  {groupement.actif !== false ? "Actif" : "Inactif"}
                </Badge>
              } />
              <Field label="Date de création" value={formatDate(groupement.dateCreation)} />
              <Field label="Date de modification" value={formatDate(groupement.dateModification)} />
            </div>

            {groupement.autre && <Field label="Autre" value={groupement.autre} />}

            <div>
              <h3 className="text-sm font-semibold mb-3">Membres ({membres.length})</h3>
              {membres.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun membre.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Raison sociale</TableHead>
                        <TableHead>NIF</TableHead>
                        <TableHead>Adresse</TableHead>
                        <TableHead className="w-24">Rôle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membres.map((m: EntrepriseDto) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.raisonSociale || "—"}</TableCell>
                          <TableCell>{m.nifAffiche || m.nif || "—"}</TableCell>
                          <TableCell>{m.adresse || "—"}</TableCell>
                          <TableCell>
                            {m.id === groupement.chefDeFileId ? (
                              <Badge variant="default" className="text-xs">Chef de file</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Membre</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default GroupementDetail;
