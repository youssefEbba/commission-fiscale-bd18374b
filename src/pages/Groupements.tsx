import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  groupementApi, GroupementDto, GroupementWriteDto,
  entrepriseApi, EntrepriseDto, formatApiErrorMessage,
} from "@/lib/api";
import { Plus, Pencil, MoreHorizontal, Trash2, Loader2, RefreshCw, Users2, Search } from "lucide-react";

const emptyForm: GroupementWriteDto = {
  raisonSociale: "",
  nomCommercial: "",
  adresse: "",
  autre: "",
  situationFiscale: "",
  actif: true,
  chefDeFileId: 0,
  membreIds: [],
};

const Groupements = () => {
  const { toast } = useToast();
  const [data, setData] = useState<GroupementDto[]>([]);
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<GroupementWriteDto>({ ...emptyForm });
  const [membreSearch, setMembreSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<GroupementDto | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, ents] = await Promise.all([
        groupementApi.getAll(),
        entrepriseApi.getAll().catch(() => [] as EntrepriseDto[]),
      ]);
      setData(list || []);
      setEntreprises((ents || []).sort((a, b) =>
        (a.raisonSociale || "").localeCompare(b.raisonSociale || "", "fr", { sensitivity: "base" })));
    } catch (err: any) {
      toast({ title: "Erreur", description: formatApiErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setMembreSearch("");
    setShowDialog(true);
  };

  const openEdit = (g: GroupementDto) => {
    setEditingId(g.id ?? null);
    setForm({
      raisonSociale: g.raisonSociale || "",
      nomCommercial: g.nomCommercial || "",
      adresse: g.adresse || "",
      autre: g.autre || "",
      situationFiscale: g.situationFiscale || "",
      actif: g.actif ?? true,
      chefDeFileId: g.chefDeFileId,
      membreIds: g.membreIds || (g.membres || []).map(m => m.id!).filter(Boolean),
    });
    setMembreSearch("");
    setShowDialog(true);
  };

  const toggleMembre = (id: number, checked: boolean) => {
    setForm(prev => {
      const membreIds = checked
        ? Array.from(new Set([...prev.membreIds, id]))
        : prev.membreIds.filter(m => m !== id);
      return {
        ...prev,
        membreIds,
        chefDeFileId: membreIds.includes(prev.chefDeFileId) ? prev.chefDeFileId : 0,
      };
    });
  };

  const chefEntreprise = entreprises.find(e => e.id === form.chefDeFileId);
  const nifDerive = chefEntreprise?.nifAffiche || chefEntreprise?.nif || "—";

  const validationError = (): string | null => {
    if (!form.raisonSociale.trim()) return "La raison sociale est obligatoire.";
    if (form.membreIds.length < 2) return "Un groupement doit compter au moins 2 membres.";
    if (!form.chefDeFileId) return "Sélectionnez un chef de file parmi les membres.";
    if (!form.membreIds.includes(form.chefDeFileId)) return "Le chef de file doit faire partie des membres.";
    const chef = entreprises.find(e => e.id === form.chefDeFileId);
    if (chef && !(chef.nif || chef.nifAffiche)) return "Le chef de file doit disposer d'un NIF.";
    return null;
  };

  const handleSave = async () => {
    const err = validationError();
    if (err) {
      toast({ title: "Validation", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: GroupementWriteDto = {
        raisonSociale: form.raisonSociale.trim(),
        nomCommercial: form.nomCommercial?.trim() || undefined,
        adresse: form.adresse?.trim() || undefined,
        autre: form.autre?.trim() || undefined,
        situationFiscale: form.situationFiscale?.trim() || undefined,
        actif: form.actif ?? true,
        chefDeFileId: form.chefDeFileId,
        membreIds: form.membreIds,
      };
      if (editingId) await groupementApi.update(editingId, payload);
      else await groupementApi.create(payload);
      toast({ title: "Succès", description: editingId ? "Groupement mis à jour." : "Groupement créé." });
      setShowDialog(false);
      await load();
    } catch (e: any) {
      toast({ title: "Erreur", description: formatApiErrorMessage(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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

  const membresFiltres = useMemo(() => {
    const q = membreSearch.trim().toLowerCase();
    if (!q) return entreprises;
    return entreprises.filter(e =>
      `${e.raisonSociale || ""} ${e.nif || ""} ${e.nifAffiche || ""}`.toLowerCase().includes(q));
  }, [entreprises, membreSearch]);

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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier le groupement" : "Nouveau groupement"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Raison sociale <span className="text-destructive">*</span></Label>
                <Input value={form.raisonSociale} onChange={e => setForm(p => ({ ...p, raisonSociale: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Nom commercial</Label>
                <Input value={form.nomCommercial || ""} onChange={e => setForm(p => ({ ...p, nomCommercial: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Adresse</Label>
                <Input value={form.adresse || ""} onChange={e => setForm(p => ({ ...p, adresse: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Situation fiscale</Label>
                <Input value={form.situationFiscale || ""} onChange={e => setForm(p => ({ ...p, situationFiscale: e.target.value }))} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Autre</Label>
                <Input value={form.autre || ""} onChange={e => setForm(p => ({ ...p, autre: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Membres <span className="text-destructive">*</span> <span className="text-xs text-muted-foreground">(au moins 2)</span></Label>
              <Input placeholder="Filtrer les entreprises…" value={membreSearch} onChange={e => setMembreSearch(e.target.value)} />
              <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                {membresFiltres.map(e => (
                  <label key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={form.membreIds.includes(e.id!)}
                      onCheckedChange={v => toggleMembre(e.id!, !!v)}
                    />
                    <span className="flex-1">{e.raisonSociale}</span>
                    <span className="font-mono text-xs text-muted-foreground">{e.nifAffiche || e.nif || "—"}</span>
                  </label>
                ))}
                {membresFiltres.length === 0 && (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Aucune entreprise.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{form.membreIds.length} membre(s) sélectionné(s)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Chef de file <span className="text-destructive">*</span></Label>
                <Select
                  value={form.chefDeFileId ? String(form.chefDeFileId) : ""}
                  onValueChange={v => setForm(p => ({ ...p, chefDeFileId: Number(v) }))}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir parmi les membres" /></SelectTrigger>
                  <SelectContent>
                    {form.membreIds.map(id => {
                      const e = entreprises.find(x => x.id === id);
                      return <SelectItem key={id} value={String(id)}>{e?.raisonSociale || `#${id}`}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>NIF du groupement (dérivé)</Label>
                <Input value={nifDerive} readOnly disabled className="font-mono" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.actif ?? true} onCheckedChange={v => setForm(p => ({ ...p, actif: v }))} />
              <span className="text-sm">Groupement actif</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
              {editingId ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
