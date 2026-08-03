import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  groupementApi, GroupementDto, GroupementWriteDto,
  entrepriseApi, EntrepriseDto, formatApiErrorMessage,
} from "@/lib/api";
import { Loader2, Plus, X } from "lucide-react";

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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Groupement à modifier ; null/undefined = création. */
  editing?: GroupementDto | null;
  onSaved?: (g: GroupementDto) => void;
}

const GroupementFormDialog = ({ open, onOpenChange, editing, onSaved }: Props) => {
  const { toast } = useToast();
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [form, setForm] = useState<GroupementWriteDto>({ ...emptyForm });
  const [membreSearch, setMembreSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Création d'entreprise en ligne (si un membre n'existe pas encore)
  const [showCreateEnt, setShowCreateEnt] = useState(false);
  const [newEnt, setNewEnt] = useState<EntrepriseDto>({ raisonSociale: "", nif: "" });
  const [creatingEnt, setCreatingEnt] = useState(false);

  const sortEnts = (list: EntrepriseDto[]) =>
    [...list].sort((a, b) => (a.raisonSociale || "").localeCompare(b.raisonSociale || "", "fr", { sensitivity: "base" }));

  useEffect(() => {
    if (!open) return;
    entrepriseApi.getAll()
      .then(list => setEntreprises(sortEnts(list || [])))
      .catch(() => setEntreprises([]));
    setMembreSearch("");
    setShowCreateEnt(false);
    setNewEnt({ raisonSociale: "", nif: "" });
    if (editing) {
      setForm({
        raisonSociale: editing.raisonSociale || "",
        nomCommercial: editing.nomCommercial || "",
        adresse: editing.adresse || "",
        autre: editing.autre || "",
        situationFiscale: editing.situationFiscale || "",
        actif: editing.actif ?? true,
        chefDeFileId: editing.chefDeFileId,
        membreIds: editing.membreIds || (editing.membres || []).map(m => m.id!).filter(Boolean),
      });
    } else {
      setForm({ ...emptyForm });
    }
  }, [open, editing]);

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

  const handleCreateEntreprise = async () => {
    if (!newEnt.raisonSociale.trim()) {
      toast({ title: "Validation", description: "La raison sociale est obligatoire.", variant: "destructive" });
      return;
    }
    if (newEnt.entrepriseEtrangere) {
      if (!newEnt.registreCommerceEtranger?.trim()) {
        toast({ title: "Validation", description: "Le registre de commerce étranger est obligatoire.", variant: "destructive" });
        return;
      }
    } else if ((newEnt.nif || "").length !== 8) {
      toast({ title: "Validation", description: "Le NIF doit contenir 8 caractères.", variant: "destructive" });
      return;
    }
    setCreatingEnt(true);
    try {
      const created = await entrepriseApi.create({
        ...newEnt,
        raisonSociale: newEnt.raisonSociale.trim(),
        nif: newEnt.entrepriseEtrangere ? (newEnt.nif || "") : newEnt.nif,
      });
      setEntreprises(prev => sortEnts([...prev, created]));
      if (created.id) toggleMembre(created.id, true);
      setShowCreateEnt(false);
      setNewEnt({ raisonSociale: "", nif: "" });
      toast({ title: "Succès", description: "Entreprise créée et ajoutée aux membres." });
    } catch (e: any) {
      toast({ title: "Erreur", description: formatApiErrorMessage(e), variant: "destructive" });
    } finally {
      setCreatingEnt(false);
    }
  };

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
      const saved = editing?.id
        ? await groupementApi.update(editing.id, payload)
        : await groupementApi.create(payload);
      toast({ title: "Succès", description: editing?.id ? "Groupement mis à jour." : "Groupement créé." });
      onOpenChange(false);
      onSaved?.(saved);
    } catch (e: any) {
      toast({ title: "Erreur", description: formatApiErrorMessage(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const membresFiltres = useMemo(() => {
    const q = membreSearch.trim().toLowerCase();
    const list = q
      ? entreprises.filter(e =>
          `${e.raisonSociale || ""} ${e.nif || ""} ${e.nifAffiche || ""}`.toLowerCase().includes(q))
      : [...entreprises];
    // Les membres sélectionnés remontent toujours en haut et apparaissent groupés
    return list.sort((a, b) => {
      const aSelected = form.membreIds.includes(a.id!);
      const bSelected = form.membreIds.includes(b.id!);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.raisonSociale || "").localeCompare(b.raisonSociale || "", "fr", { sensitivity: "base" });
    });
  }, [entreprises, membreSearch, form.membreIds]);

  const selectedEntreprises = useMemo(() => {
    return form.membreIds
      .map(id => entreprises.find(e => e.id === id))
      .filter(Boolean) as EntrepriseDto[];
  }, [form.membreIds, entreprises]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing?.id ? "Modifier le groupement" : "Nouveau groupement"}</DialogTitle>
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
            <Label className="flex items-center justify-between">
              <span>Membres <span className="text-destructive">*</span> <span className="text-xs text-muted-foreground">(au moins 2)</span></span>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-primary"
                onClick={() => setShowCreateEnt(v => !v)}>
                {showCreateEnt ? <><X className="h-3 w-3 me-1" /> Annuler</> : <><Plus className="h-3 w-3 me-1" /> Nouvelle entreprise</>}
              </Button>
            </Label>

            {showCreateEnt && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Raison sociale <span className="text-destructive">*</span></Label>
                    <Input value={newEnt.raisonSociale} onChange={e => setNewEnt(p => ({ ...p, raisonSociale: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      NIF{!newEnt.entrepriseEtrangere && <span className="text-destructive"> *</span>}
                    </Label>
                    <Input
                      value={newEnt.nif}
                      maxLength={8}
                      onChange={e => setNewEnt(p => ({ ...p, nif: e.target.value.replace(/\s/g, "") }))}
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Checkbox
                      id="grp-ent-etrangere"
                      checked={!!newEnt.entrepriseEtrangere}
                      onCheckedChange={v => setNewEnt(p => ({ ...p, entrepriseEtrangere: !!v }))}
                    />
                    <Label htmlFor="grp-ent-etrangere" className="text-xs font-normal">Entreprise étrangère</Label>
                  </div>
                  {newEnt.entrepriseEtrangere && (
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Registre de commerce étranger <span className="text-destructive">*</span></Label>
                      <Input
                        value={newEnt.registreCommerceEtranger || ""}
                        onChange={e => setNewEnt(p => ({ ...p, registreCommerceEtranger: e.target.value }))}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Adresse</Label>
                    <Input value={newEnt.adresse || ""} onChange={e => setNewEnt(p => ({ ...p, adresse: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input value={newEnt.email || ""} onChange={e => setNewEnt(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <Button type="button" size="sm" onClick={handleCreateEntreprise} disabled={creatingEnt}>
                  {creatingEnt && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
                  Créer et ajouter comme membre
                </Button>
                <p className="text-xs text-muted-foreground">
                  Note : le chef de file doit disposer d'un NIF (une entreprise étrangère sans NIF ne peut pas être chef de file).
                </p>
              </div>
            )}

            {/* Récapitulatif visuel des membres sélectionnés */}
            <div className="rounded-md border bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Membres sélectionnés</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {form.membreIds.length}
                </span>
              </div>
              {selectedEntreprises.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune entreprise sélectionnée.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedEntreprises.map(e => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleMembre(e.id!, false)}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                      title="Retirer ce membre"
                    >
                      <span className="font-medium truncate max-w-[12rem]">{e.raisonSociale}</span>
                      <span className="font-mono text-muted-foreground">{e.nifAffiche || e.nif || "—"}</span>
                      <X className="h-3 w-3 text-destructive" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Input placeholder="Filtrer les entreprises…" value={membreSearch} onChange={e => setMembreSearch(e.target.value)} />
            <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
              {membresFiltres.map(e => {
                const selected = form.membreIds.includes(e.id!);
                return (
                  <label
                    key={e.id}
                    className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors ${
                      selected
                        ? "bg-primary/10 hover:bg-primary/15 border-s-4 border-s-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={v => toggleMembre(e.id!, !!v)}
                    />
                    <span className={`flex-1 ${selected ? "font-medium" : ""}`}>{e.raisonSociale}</span>
                    <span className="font-mono text-xs text-muted-foreground">{e.nifAffiche || e.nif || "—"}</span>
                    {selected && <Badge variant="outline" className="text-[10px] h-5">Sélectionnée</Badge>}
                  </label>
                );
              })}
              {membresFiltres.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground">Aucune entreprise.</p>
              )}
            </div>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
            {editing?.id ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GroupementFormDialog;
