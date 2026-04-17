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
import { Users, Plus, RefreshCw, Loader2, Search, UserCheck, UserX, MoreHorizontal, Pencil, FileText } from "lucide-react";
import DelegueEditDialog from "@/components/delegues/DelegueEditDialog";
import DelegueMarchesDialog from "@/components/delegues/DelegueMarchesDialog";

const Delegues = () => {
  const { toast } = useToast();
  const [delegues, setDelegues] = useState<DelegueDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateDelegueRequest>({ username: "", password: "", role: "AUTORITE_UPM", nomComplet: "", email: "" });
  const [creating, setCreating] = useState(false);
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

  const handleCreate = async () => {
    if (!form.username.trim() || !form.password.trim() || !form.nomComplet.trim()) {
      toast({ title: "Erreur", description: "Identifiant, mot de passe et nom complet sont requis", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await delegueApi.create(form);
      toast({ title: "Succès", description: "Représentant créé" });
      setCreateOpen(false);
      setForm({ username: "", password: "", role: "AUTORITE_UPM", nomComplet: "", email: "" });
      fetchDelegues();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

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
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau représentant
            </Button>
            <Button variant="outline" onClick={fetchDelegues} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau représentant</DialogTitle>
            <DialogDescription>Créez un compte représentant UPM ou UEP rattaché à votre autorité.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input value={form.nomComplet} onChange={e => setForm(f => ({ ...f, nomComplet: e.target.value }))} placeholder="Nom Prénom" />
            </div>
            <div className="space-y-2">
              <Label>Identifiant *</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="upm1" />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe *</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Rôle *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as "AUTORITE_UPM" | "AUTORITE_UEP" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTORITE_UPM">Autorité UPM</SelectItem>
                  <SelectItem value="AUTORITE_UEP">Autorité UEP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <DelegueEditDialog delegue={editDelegue} open={editOpen} onOpenChange={setEditOpen} onUpdated={fetchDelegues} />

      {/* Marches Dialog */}
      <DelegueMarchesDialog delegue={marchesDelegue} open={marchesOpen} onOpenChange={setMarchesOpen} />
    </DashboardLayout>
  );
};

export default Delegues;
