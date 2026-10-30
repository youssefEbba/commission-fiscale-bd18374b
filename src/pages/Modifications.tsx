import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { avenantApi, AvenantDto } from "@/lib/api";
import { STATUTS_AVENANT, TYPES_AVENANT } from "@/lib/avenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { RowNumberHead, RowNumberCell } from "@/components/ui/row-number";
import { FilePen, Search, RefreshCw, Loader2, Filter, Plus } from "lucide-react";
import AvenantStatutBadge from "@/components/avenants/AvenantStatutBadge";
import AvenantCreateDialog from "@/components/avenants/AvenantCreateDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutAvenant, tTypeAvenant } from "@/i18n/enums";
import { formatDate } from "@/i18n/format";

const avenantRef = (a: AvenantDto) => a.numero || `#${a.id}`;

const Modifications = () => {
  const { t } = useTranslation(["modifications", "common"]);
  usePageTitle("modifications:list.title");
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AvenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await avenantApi.getAll());
    } catch (e: any) {
      setData([]);
      setLoadError(e?.message || t("modifications:list.load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const canDeposer = hasPermission("modification.submit");

  // Ordre serveur conservé : filtres seulement, aucun tri.
  const q = search.trim().toLowerCase();
  const filtered = data.filter((a) => {
    const matchSearch = !q || [a.numero, a.certificatReference, a.certificatNumero, a.entrepriseNom, a.autoriteContractanteNom, a.motif]
      .some((v) => (v || "").toLowerCase().includes(q));
    return matchSearch
      && (filterStatut === "ALL" || a.statut === filterStatut)
      && (filterType === "ALL" || a.type === filterType);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FilePen className="h-6 w-6 text-primary" />
              {t("modifications:list.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("modifications:list.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} />
              {t("modifications:actions.refresh")}
            </Button>
            {canDeposer && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 me-2" /> {t("modifications:actions.deposer")}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("modifications:list.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-10" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("modifications:list.filter_type_all")}</SelectItem>
                  {TYPES_AVENANT.map((k) => <SelectItem key={k} value={k}>{tTypeAvenant(k)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="w-full sm:w-56">
                  <Filter className="h-4 w-4 me-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("modifications:list.filter_all")}</SelectItem>
                  {STATUTS_AVENANT.map((k) => <SelectItem key={k} value={k}>{tStatutAvenant(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <RowNumberHead />
                    <TableHead>{t("modifications:list.columns.numero")}</TableHead>
                    <TableHead>{t("modifications:list.columns.certificat")}</TableHead>
                    <TableHead>{t("modifications:list.columns.entreprise")}</TableHead>
                    <TableHead>{t("modifications:list.columns.type")}</TableHead>
                    <TableHead>{t("modifications:list.columns.statut")}</TableHead>
                    <TableHead>{t("modifications:list.columns.date_depot")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-destructive">{loadError}</TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("modifications:list.empty")}</TableCell>
                    </TableRow>
                  ) : filtered.map((a, idx) => (
                    <ClickableTableRow key={a.id} to={`/dashboard/modifications/${a.id}`}>
                      <RowNumberCell n={idx + 1} />
                      <TableCell className="font-medium">
                        <Link to={`/dashboard/modifications/${a.id}`} className="text-primary hover:underline">{avenantRef(a)}</Link>
                      </TableCell>
                      <TableCell className="text-xs">{a.certificatReference || a.certificatNumero || `#${a.certificatCreditId}`}</TableCell>
                      <TableCell className="text-sm">{a.entrepriseNom || "—"}</TableCell>
                      <TableCell className="text-sm">{tTypeAvenant(a.type)}</TableCell>
                      <TableCell><AvenantStatutBadge statut={a.statut} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.dateDepot ? formatDate(a.dateDepot) : "—"}</TableCell>
                    </ClickableTableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AvenantCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(a) => navigate(`/dashboard/modifications/${a.id}?pieces=1`)}
      />
    </DashboardLayout>
  );
};

export default Modifications;
