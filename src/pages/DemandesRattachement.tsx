import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { demandeRattachementApi, type DemandeRattachementDto, type StatutRattachement } from "@/lib/api";
import { showApiError } from "@/lib/feedback";
import { formatDateTime } from "@/i18n/format";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ClickableTableRow from "@/components/ui/clickable-table-row";

const STATUTS: StatutRattachement[] = ["EN_ATTENTE", "APPROUVEE", "REFUSEE"];
export const statutVariant = (s?: StatutRattachement) => (s === "APPROUVEE" ? "default" : s === "REFUSEE" ? "destructive" : "secondary") as "default" | "destructive" | "secondary";

/** File des demandes de rattachement (permission `rattachement.validate`). */
export default function DemandesRattachement() {
  const { t } = useTranslation(["rattachement"]);
  usePageTitle("rattachement:queue.title");
  const [statut, setStatut] = useState<StatutRattachement | "ALL">("EN_ATTENTE");
  const [items, setItems] = useState<DemandeRattachementDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await demandeRattachementApi.getAll(statut === "ALL" ? undefined : statut)); }
    catch (e) { showApiError(e, t("errors.load")); }
    finally { setLoading(false); }
  }, [statut, t]);
  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("queue.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("queue.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Select value={statut} onValueChange={(v) => setStatut(v as StatutRattachement | "ALL")}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("queue.all")}</SelectItem>
                {STATUTS.map((s) => <SelectItem key={s} value={s}>{t(`statut.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 me-1 ${loading ? "animate-spin" : ""}`} />{t("actions.refresh")}</Button>
          </div>
        </div>
        <Card><CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            : items.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">{t("queue.empty")}</p>
            : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t("queue.col_reference")}</TableHead><TableHead>{t("queue.col_demandeur")}</TableHead>
                  <TableHead>{t("queue.col_qualite")}</TableHead><TableHead>{t("queue.col_entite")}</TableHead>
                  <TableHead>{t("queue.col_date")}</TableHead><TableHead>{t("queue.col_statut")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {items.map((d) => {
                    const href = `/dashboard/demandes-rattachement/${d.id}`;
                    return (
                      <ClickableTableRow key={d.id} to={href}>
                        <TableCell className="font-medium"><Link to={href} className="text-primary underline-offset-2 hover:underline" dir="ltr">{d.reference || `#${d.id}`}</Link></TableCell>
                        <TableCell>{d.nomComplet || d.username}<div className="text-xs text-muted-foreground">{d.email}</div></TableCell>
                        <TableCell>{d.roleDemande ? t(`roles.${d.roleDemande}`) : "—"}</TableCell>
                        <TableCell>
                          {d.entiteNomAffiche || d.entiteNom || "—"}
                          {d.entiteNouvelle && <Badge variant="outline" className="ms-2 border-accent">{t("queue.entite_a_creer")}</Badge>}
                        </TableCell>
                        <TableCell>{formatDateTime(d.dateDemande)}</TableCell>
                        <TableCell><Badge variant={statutVariant(d.statut)}>{t(`statut.${d.statut}`)}</Badge></TableCell>
                      </ClickableTableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
