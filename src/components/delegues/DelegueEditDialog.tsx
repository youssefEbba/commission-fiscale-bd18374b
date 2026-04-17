import { useState } from "react";
import { delegueApi, DelegueDto, UpdateDelegueRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface Props {
  delegue: DelegueDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const DelegueEditDialog = ({ delegue, open, onOpenChange, onUpdated }: Props) => {
  const { toast } = useToast();
  const [form, setForm] = useState<UpdateDelegueRequest>({ nomComplet: "", email: "", newPassword: "" });
  const [saving, setSaving] = useState(false);

  // Sync form when delegue changes
  const handleOpenChange = (o: boolean) => {
    if (o && delegue) {
      setForm({ nomComplet: delegue.nomComplet, email: delegue.email || "", newPassword: "" });
    }
    onOpenChange(o);
  };

  const handleSave = async () => {
    if (!delegue) return;
    if (!form.nomComplet?.trim()) {
      toast({ title: "Erreur", description: "Le nom complet est requis", variant: "destructive" });
      return;
    }
    if (form.newPassword && form.newPassword.length < 8) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 8 caractères", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: UpdateDelegueRequest = { nomComplet: form.nomComplet, email: form.email || undefined };
      if (form.newPassword?.trim()) payload.newPassword = form.newPassword;
      await delegueApi.update(delegue.id, payload);
      toast({ title: "Succès", description: "Représentant mis à jour" });
      onOpenChange(false);
      onUpdated();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le représentant</DialogTitle>
          <DialogDescription>Mettez à jour les informations du représentant #{delegue?.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom complet *</Label>
            <Input value={form.nomComplet || ""} onChange={e => setForm(f => ({ ...f, nomComplet: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Nouveau mot de passe (laisser vide pour ne pas changer)</Label>
            <Input type="password" value={form.newPassword || ""} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="≥ 8 caractères" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DelegueEditDialog;
