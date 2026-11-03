import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { bailleurApi, BailleurDto, BAILLEUR_CATEGORIES, formatApiErrorMessage, type BailleurCategorie } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, Loader2, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent = création (POST /api/bailleurs) ; présent = modification (PUT /api/bailleurs/{id}). */
  bailleur?: { id: number; nom: string; details?: string; categorie?: BailleurCategorie | null } | null;
  onSaved: (saved: BailleurDto) => void;
}

/** Création ou modification d'un bailleur ; message serveur affiché tel quel en cas de refus. */
const BailleurFormDialog = ({ open, onOpenChange, bailleur, onSaved }: Props) => {
  const { t } = useTranslation(["conventions", "common", "enums"]);
  const { toast } = useToast();
  const [nom, setNom] = useState("");
  const [details, setDetails] = useState("");
  const [categorie, setCategorie] = useState<BailleurCategorie | "">("");
  const [saving, setSaving] = useState(false);
  const isEdit = !!bailleur;

  useEffect(() => {
    if (!open) return;
    setNom(bailleur?.nom ?? "");
    setDetails(bailleur?.details ?? "");
    setCategorie(bailleur?.categorie ?? "");
    // Détail et catégorie ne sont pas toujours fournis avec la liste liée à la convention : relus dans le référentiel.
    if (bailleur && (bailleur.details === undefined || bailleur.categorie === undefined)) {
      bailleurApi.getAll()
        .then((all) => {
          const found = all.find((b) => b.id === bailleur.id);
          if (found) { setDetails(found.details ?? ""); setCategorie(found.categorie ?? ""); }
        })
        .catch(() => {});
    }
  }, [open, bailleur]);

  const handleSave = async () => {
    if (!nom.trim()) return;
    setSaving(true);
    try {
      const saved = isEdit
        ? await bailleurApi.update(bailleur!.id, { nom: nom.trim(), details: details.trim() || null, categorie: categorie || null })
        : await bailleurApi.create({ nom: nom.trim(), details: details.trim() || undefined, categorie: categorie || null });
      toast({ title: t("common:success.title", "Succès"), description: isEdit ? t("conventions:bailleur.updated") : t("conventions:bailleur.added") });
      onOpenChange(false);
      onSaved(saved);
    } catch (e) {
      toast({ title: t("common:errors.title", "Erreur"), description: formatApiErrorMessage(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("conventions:bailleur.edit_title") : t("conventions:bailleur.modal_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t("conventions:bailleur.name_required")}</Label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t("conventions:bailleur.name_placeholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("conventions:bailleur.details")}</Label>
            <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("conventions:bailleur.details_placeholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("conventions:bailleur.categorie")}</Label>
            <Select value={categorie || undefined} onValueChange={(v) => setCategorie(v as BailleurCategorie)}>
              <SelectTrigger><SelectValue placeholder={t("conventions:bailleur.categorie_placeholder")} /></SelectTrigger>
              <SelectContent>
                {BAILLEUR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`enums:bailleur_categorie.${c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("conventions:actions.dismiss")}</Button>
          <Button onClick={handleSave} disabled={saving || !nom.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : isEdit ? <CheckCircle className="h-4 w-4 me-1" /> : <Plus className="h-4 w-4 me-1" />}
            {isEdit ? t("conventions:actions.save") : t("conventions:actions.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BailleurFormDialog;
