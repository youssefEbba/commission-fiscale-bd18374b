import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { auditLogApi, AuditLogDto, PageAuditLogDto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [data, setData] = useState<PageAuditLogDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchUser, setSearchUser] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");

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
      toast({ title: "Erreur", description: "Impossible de charger les logs", variant: "destructive" });
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
              Journal d'audit
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Traçabilité des connexions et activités</p>
          </div>
          <Button variant="outline" onClick={() => fetchLogs()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrer par utilisateur..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes actions</SelectItem>
              <SelectItem value="CREATE">Création</SelectItem>
              <SelectItem value="UPDATE">Modification</SelectItem>
              <SelectItem value="DELETE">Suppression</SelectItem>
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
                      <TableHead>Date</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entité</TableHead>
                      <TableHead>Détails</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!data || data.content.length === 0) ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun log</TableCell></TableRow>
                    ) : data.content.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(log.dateAction).toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="font-medium">{log.username}</TableCell>
                        <TableCell><Badge className={`text-xs ${ACTION_COLORS[log.action] || ""}`}>{log.action}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{log.entityType}{log.entityId ? ` #${log.entityId}` : ""}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.details || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {data && data.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      Page {data.number + 1} / {data.totalPages} ({data.totalElements} entrées)
                    </span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={data.number === 0} onClick={() => setPage(data.number - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={data.number >= data.totalPages - 1} onClick={() => setPage(data.number + 1)}>
                        <ChevronRight className="h-4 w-4" />
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
