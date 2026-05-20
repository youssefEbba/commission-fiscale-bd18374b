import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { auditLogApi, AuditLogDto, PageAuditLogDto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Search, RefreshCw, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

const AuditLogs = () => {
  const { t } = useTranslation();
  usePageTitle("audit:page.title");
  const { toast } = useToast();
  const [data, setData] = useState<PageAuditLogDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchUser, setSearchUser] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");

  // Mini-helper i18n local : libellés affichés pour les actions d'audit.
  // Les codes CREATE/UPDATE/DELETE restent inchangés côté API.
  const tAuditAction = (action: string): string => {
    if (action === "CREATE" || action === "UPDATE" || action === "DELETE") {
      return t(`audit:actions.${action}`);
    }
    return action;
  };

  const fetchLogs = async (p = page) => {
    setLoading(true);
    try {
      const result = await auditLogApi.getAll({
        page: p,
        size: 20,
        username: searchUser || undefined,
        action: filterAction !== "ALL" ? filterAction : undefined,
      });
      setData(result);
    } catch {
      toast({
        title: t("audit:toast.load_error_title"),
        description: t("audit:toast.load_error_description"),
        variant: "destructive",
      });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [page, filterAction]);

  const handleSearch = () => { setPage(0); fetchLogs(0); };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              {t("audit:page.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("audit:page.subtitle")}</p>
          </div>
          <Button variant="outline" onClick={() => fetchLogs()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} />
            {t("audit:actions.refresh")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("audit:list.search_placeholder")}
              aria-label={t("audit:list.search_placeholder")}
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="ps-9"
            />
          </div>
          <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
            <SelectTrigger className="w-40" aria-label={t("audit:table.action")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("audit:actions.all")}</SelectItem>
              <SelectItem value="CREATE">{t("audit:actions.CREATE")}</SelectItem>
              <SelectItem value="UPDATE">{t("audit:actions.UPDATE")}</SelectItem>
              <SelectItem value="DELETE">{t("audit:actions.DELETE")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("audit:table.date")}</TableHead>
                      <TableHead>{t("audit:table.user")}</TableHead>
                      <TableHead>{t("audit:table.action")}</TableHead>
                      <TableHead>{t("audit:table.entity")}</TableHead>
                      <TableHead>{t("audit:table.details")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!data || data.content.length === 0) ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("audit:list.empty")}</TableCell></TableRow>
                    ) : data.content.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.dateAction)}
                        </TableCell>
                        {/* Username brut depuis l'API — non traduisible */}
                        <TableCell className="font-medium">{log.username}</TableCell>
                        <TableCell><Badge className={`text-xs ${ACTION_COLORS[log.action] || ""}`}>{tAuditAction(log.action)}</Badge></TableCell>
                        {/* entityType : code JPA brut côté API (DEMANDE, CERTIFICAT…) — non traduit */}
                        <TableCell className="text-muted-foreground">{log.entityType}{log.entityId ? ` #${log.entityId}` : ""}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.details || t("audit:table.empty_cell")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {data && data.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      {t("audit:pagination.summary", {
                        current: data.number + 1,
                        total: data.totalPages,
                        count: data.totalElements,
                      })}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={data.number === 0}
                        onClick={() => setPage(data.number - 1)}
                        aria-label={t("audit:pagination.previous")}
                      >
                        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={data.number >= data.totalPages - 1}
                        onClick={() => setPage(data.number + 1)}
                        aria-label={t("audit:pagination.next")}
                      >
                        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogs;
