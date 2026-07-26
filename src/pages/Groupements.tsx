import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import GroupementFormDialog from "@/components/groupements/GroupementFormDialog";
import { groupementApi, GroupementDto, formatApiErrorMessage } from "@/lib/api";
import { Plus, Pencil, MoreHorizontal, Trash2, Loader2, RefreshCw, Users2, Search } from "lucide-react";

const Groupements = () => {
  const { toast } = useToast();
  const [data, setData] = useState<GroupementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<GroupementDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GroupementDto | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await groupementApi.getAll();
      setData(list || []);
    } catch (err: any) {
      toast({ title: "Erreur", description: formatApiErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setShowDialog(true); };
  const openEdit = (g: GroupementDto) => { setEditing(g); setShowDialog(true); };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    try {
      await groupementApi.delete(confirmDelete.id);
      toast({ title: "Succès", description: "Groupement supprimé." });
      await load();
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status;
      toast({
        title: "Erreur",
        description: status === 409
          ? "Suppression impossible : des demandes de correction référencent ce groupement."
          : formatApiErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setConfirmDelete(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(g =>
      `${g.raisonSociale || ""} ${g.nomCommercial || ""} ${g.nifAffiche || ""} ${g.chefDeFileRaisonSociale || ""}`
        .toLowerCase().includes(q));
  }, [data, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users2 className="h-6 w-6 text-primary" /> Groupements d'entreprises
            </h1>
            <p className="text-sm text-muted-foreground">
              Le NIF du groupement est toujours celui du chef de file.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-1 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 me-1" /> Nouveau groupement
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Liste des groupements</CardTitle>
            <div className="relative max-w-sm">
              <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-8"
                placeholder="Rechercher (nom, NIF, chef de file)…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucun groupement.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Raison sociale</TableHead>
                      <TableHead>Chef de file</TableHead>
                      <TableHead>NIF (chef de file)</TableHead>
                      <TableHead>Membres</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">
                          {g.raisonSociale}
                          {g.nomCommercial && <div className="text-xs text-muted-foreground">{g.nomCommercial}</div>}
                        </TableCell>
                        <TableCell>{g.chefDeFileRaisonSociale || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{g.nifAffiche || "—"}</TableCell>
                        <TableCell>{(g.membreIds || g.membres || []).length}</TableCell>
                        <TableCell>
                          <Badge variant={g.actif === false ? "secondary" : "outline"}>
                            {g.actif === false ? "Inactif" : "Actif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(g)}>
                                <Pencil className="h-4 w-4 me-2" /> Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(g)}>
                                <Trash2 className="h-4 w-4 me-2" /> Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GroupementFormDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editing={editing}
        onSaved={() => load()}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce groupement ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {confirmDelete?.raisonSociale} » sera définitivement supprimé. Impossible si des demandes de correction y sont liées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Groupements;
