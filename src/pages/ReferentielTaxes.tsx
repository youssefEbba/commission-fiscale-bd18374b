import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { referentielTaxeApi, ReferentielTaxeDto, ReferentielTaxeRequest, formatApiErrorMessage } from "@/lib/api";
import { Plus, Pencil, MoreHorizontal, Power, PowerOff, Trash2, Loader2, RefreshCw, Tag } from "lucide-react";

const emptyForm: ReferentielTaxeRequest = {
  codeTaxe: "",
  denominationTaxe: "",
  valeurTaxe: null,
  ordreAffichage: null,
  active: true,
};

const ReferentielTaxes = () => {
  const { toast } = useToast();
  const [data, setData] = useState<ReferentielTaxeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ReferentielTaxeRequest>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ReferentielTaxeDto | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await referentielTaxeApi.getAll();
      setData((list || []).sort((a, b) => (a.ordreAffichage ?? 999) - (b.ordreAffichage ?? 999)));
    } catch (err: any) {
      toast({ title: "Erreur", description: formatApiErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, ordreAffichage: (data.length || 0) + 1 });
    setShowDialog(true);
  };

  const openEdit = (t: ReferentielTaxeDto) => {
    setEditingId(t.id);
    setForm({
      codeTaxe: t.codeTaxe,
      denominationTaxe: t.denominationTaxe,
      valeurTaxe: t.valeurTaxe ?? null,
      ordreAffichage: t.ordreAffichage ?? null,
      active: t.active,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.codeTaxe.trim() || !form.denominationTaxe.trim()) {
      toast({ title: "Champs requis", description: "Code et dénomination sont obligatoires.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: ReferentielTaxeRequest = {
        codeTaxe: form.codeTaxe.trim().toUpperCase(),
        denominationTaxe: form.denominationTaxe.trim(),
        valeurTaxe: form.valeurTaxe === null || form.valeurTaxe === undefined || (form.valeurTaxe as any) === ""
          ? null : Number(form.valeurTaxe),
        ordreAffichage: form.ordreAffichage === null || form.ordreAffichage === undefined || (form.ordreAffichage as any) === ""
          ? null : Number(form.ordreAffichage),
        active: form.active ?? true,
      };
      if (editingId) await referentielTaxeApi.update(editingId, payload);
      else await referentielTaxeApi.create(payload);
      toast({ title: editingId ? "Taxe modifiée" : "Taxe créée" });
      setShowDialog(false);
      load();
    } catch (err: any) {
      toast({ title: "Erreur", description: formatApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (t: ReferentielTaxeDto) => {
    setActionId(t.id);
    try {
      if (t.active) await referentielTaxeApi.desactiver(t.id);
      else await referentielTaxeApi.activer(t.id);
      toast({ title: t.active ? "Taxe désactivée" : "Taxe réactivée" });
      load();
    } catch (err: any) {
      toast({ title: "Erreur", description: formatApiErrorMessage(err), variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionId(confirmDelete.id);
    try {
      await referentielTaxeApi.remove(confirmDelete.id);
      toast({ title: "Taxe supprimée" });
      setConfirmDelete(null);
      load();
    } catch (err: any) {
      toast({ title: "Suppression impossible", description: formatApiErrorMessage(err), variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tag className="h-6 w-6 text-primary" /> Référentiel des Taxes
            </h1>
            <p className="text-sm text-muted-foreground">
              Gérez les codes de taxes utilisés dans les bulletins de liquidation (DD, TVA, RS…).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Nouvelle taxe
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Taxes ({data.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Chargement…
              </div>
            ) : data.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-6 text-center">Aucune taxe enregistrée.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Ordre</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Dénomination</TableHead>
                    <TableHead className="text-right">Valeur indicative</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">{t.ordreAffichage ?? "—"}</TableCell>
                      <TableCell className="font-mono font-semibold uppercase">{t.codeTaxe}</TableCell>
                      <TableCell>{t.denominationTaxe}</TableCell>
                      <TableCell className="text-right">
                        {t.valeurTaxe !== null && t.valeurTaxe !== undefined
                          ? Number(t.valeurTaxe).toLocaleString("fr-FR")
                          : <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell>
                        {t.active ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={actionId === t.id}>
                              {actionId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(t)}>
                              <Pencil className="h-4 w-4 mr-2" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggle(t)}>
                              {t.active ? <><PowerOff className="h-4 w-4 mr-2" /> Désactiver</> : <><Power className="h-4 w-4 mr-2" /> Réactiver</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(t)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier la taxe" : "Nouvelle taxe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code *</Label>
                <Input
                  className="uppercase"
                  placeholder="DD"
                  value={form.codeTaxe}
                  onChange={e => setForm({ ...form, codeTaxe: e.target.value.toUpperCase().slice(0, 20) })}
                />
              </div>
              <div>
                <Label>Ordre d'affichage</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="1"
                  value={form.ordreAffichage ?? ""}
                  onChange={e => setForm({ ...form, ordreAffichage: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>Dénomination *</Label>
              <Input
                placeholder="Droits de douane"
                maxLength={150}
                value={form.denominationTaxe}
                onChange={e => setForm({ ...form, denominationTaxe: e.target.value })}
              />
            </div>
            <div>
              <Label>Valeur indicative (optionnel)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Laisser vide si saisie libre par l'entreprise"
                value={form.valeurTaxe ?? ""}
                onChange={e => setForm({ ...form, valeurTaxe: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Indicative uniquement — l'entreprise saisit le montant réel dans le bulletin.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={form.active ?? true} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label className="cursor-pointer">Active (visible dans les formulaires)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la taxe ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && (
                <>Suppression définitive de <strong>{confirmDelete.codeTaxe}</strong> — {confirmDelete.denominationTaxe}.
                Échouera si la taxe est déjà utilisée dans un bulletin (préférez la désactivation).</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default ReferentielTaxes;
