import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { delegueApi, DelegueDto, CreateDelegueRequest, ROLE_LABELS } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Plus, RefreshCw, Loader2, Search, UserCheck, UserX, MoreHorizontal, Pencil, FileText, Info } from "lucide-react";
import DelegueEditDialog from "@/components/delegues/DelegueEditDialog";
import DelegueMarchesDialog from "@/components/delegues/DelegueMarchesDialog";

const Delegues = () => {
  const { toast } = useToast();
  const { t } = useTranslation(["rattachement"]);
  const [delegues, setDelegues] = useState<DelegueDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [toggling, setToggling] = useState<number | null>(null);

  // Edit & Marches dialogs
  const [editDelegue, setEditDelegue] = useState<DelegueDto | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [marchesDelegue, setMarchesDelegue] = useState<DelegueDto | null>(null);
  const [marchesOpen, setMarchesOpen] = useState(false);

  const fetchDelegues = async () => {
    setLoading(true);
    try {
      setDelegues(await delegueApi.getAll());
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les représentants", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDelegues(); }, []);

  const toggleActif = async (d: DelegueDto) => {
    setToggling(d.id);
    try {
      await delegueApi.setActif(d.id, !d.actif);
      toast({ title: "Succès", description: `Représentant ${d.actif ? "désactivé" : "activé"}` });
      fetchDelegues();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const filtered = delegues.filter(d =>
    (d.nomComplet || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.username || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Représentants (UPM / UEP)
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Gérez les représentants rattachés à votre autorité contractante</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchDelegues} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        <div className="flex gap-2 rounded-md border border-accent bg-accent/10 p-3 text-sm text-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <p>{t("rattachement:delegues_notice")}</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un représentant..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nom complet</TableHead>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun représentant</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">#{d.id}</TableCell>
                        <TableCell>{d.nomComplet}</TableCell>
                        <TableCell className="text-muted-foreground">{d.username}</TableCell>
                        <TableCell className="text-muted-foreground">{d.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{ROLE_LABELS[d.role] || d.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${d.actif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {d.actif ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditDelegue(d); setEditOpen(true); }}>
                                <Pencil className="h-4 w-4 mr-2" /> Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setMarchesDelegue(d); setMarchesOpen(true); }}>
                                <FileText className="h-4 w-4 mr-2" /> Marchés rattachés
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleActif(d)}
                                disabled={toggling === d.id}
                                className={d.actif ? "text-destructive" : ""}
                              >
                                {toggling === d.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> :
                                  d.actif ? <UserX className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                                {d.actif ? "Désactiver" : "Activer"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Edit Dialog */}
      <DelegueEditDialog delegue={editDelegue} open={editOpen} onOpenChange={setEditOpen} onUpdated={fetchDelegues} />

      {/* Marches Dialog */}
      <DelegueMarchesDialog delegue={marchesDelegue} open={marchesOpen} onOpenChange={setMarchesOpen} />
    </DashboardLayout>
  );
};

export default Delegues;
