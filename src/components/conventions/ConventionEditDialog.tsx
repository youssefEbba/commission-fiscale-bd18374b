import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  conventionApi, ConventionDto,
  bailleurApi, BailleurDto,
  deviseApi, DeviseDto,
  forexApi,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CheckCircle, Edit, Loader2 } from "lucide-react";
import { formatNumber } from "@/i18n/format";
import {
  buildUpdateConventionRequest, conventionToEditForm, ConventionEditForm, conventionDateError,
} from "@/lib/conventionEditability";

/** Devises proposées si le référentiel serveur est vide ou indisponible (mêmes valeurs qu'à la création). */
export const DEFAULT_DEVISES: DeviseDto[] = [
  { id: -1, code: "EUR", libelle: "Euro", symbole: "€" },
  { id: -2, code: "USD", libelle: "Dollar américain", symbole: "$" },
  { id: -3, code: "CNY", libelle: "Yuan chinois", symbole: "¥" },
  { id: -4, code: "SAR", libelle: "Riyal saoudien", symbole: "﷼" },
  { id: -5, code: "AED", libelle: "Dirham des Émirats", symbole: "د.إ" },
  { id: -6, code: "QAR", libelle: "Riyal qatari", symbole: "﷼" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Props {
  convention: ConventionDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Appelé avec la convention renvoyée par le serveur après enregistrement. */
  onSaved: (updated: ConventionDto) => void;
}

/**
 * Formulaire de modification (reprise du formulaire de création, sans autorité contractante).
 * Remplacement complet côté serveur : tout le formulaire est envoyé.
 */
const ConventionEditDialog = ({ convention, open, onOpenChange, onSaved }: Props) => {
  const { t } = useTranslation(["conventions", "common"]);
  const { toast } = useToast();
  const [form, setForm] = useState<ConventionEditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [bailleurs, setBailleurs] = useState<BailleurDto[]>([]);
  const [bailleursLoading, setBailleursLoading] = useState(false);
  const [devises, setDevises] = useState<DeviseDto[]>(DEFAULT_DEVISES);
  const [devisesLoading, setDevisesLoading] = useState(false);
  const [tauxLoading, setTauxLoading] = useState(false);

  useEffect(() => {
    if (!open || !convention) return;
    setForm(conventionToEditForm(convention));
    setBailleursLoading(true);
    bailleurApi.getAll().then(setBailleurs).catch(() => {}).finally(() => setBailleursLoading(false));
    setDevisesLoading(true);
    deviseApi.getAll()
      .then((fetched) => {
        const codes = new Set(fetched.map((d) => d.code));
        setDevises([...fetched, ...DEFAULT_DEVISES.filter((d) => !codes.has(d.code))]);
      })
      .catch(() => setDevises(DEFAULT_DEVISES))
      .finally(() => setDevisesLoading(false));
  }, [open, convention]);

  if (!convention || !form) {
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-2xl" /></Dialog>;
  }

  const set = (patch: Partial<ConventionEditForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  // Taux récupéré seulement quand l'utilisateur change de devise : les valeurs enregistrées restent sinon intactes.
  const handleDeviseChange = (code: string) => {
    if (code === "MRU") {
      set({ deviseOrigine: code, tauxChange: 1, montantMru: form.montantDevise ?? null });
      return;
    }
    set({ deviseOrigine: code, tauxChange: null, montantMru: null });
    if (!code) return;
    setTauxLoading(true);
    forexApi.rate(code, "MRU")
      .then((res) => {
        const rate = Math.round(res.rate * 10000) / 10000;
        setForm((f) => (f ? { ...f, tauxChange: rate, montantMru: f.montantDevise != null ? round2(f.montantDevise * rate) : null } : f));
      })
      .catch(() => toast({ title: t("common:errors.title", "Erreur"), description: t("conventions:create.rate_error", { currency: code }), variant: "destructive" }))
      .finally(() => setTauxLoading(false));
  };

  const today = todayIso();
  const missingRequired = !form.reference.trim() || !form.intitule.trim();

  const handleSave = async () => {
    if (missingRequired) {
      toast({ title: t("common:errors.title", "Erreur"), description: t("conventions:create.missing_required"), variant: "destructive" });
      return;
    }
    // Seules les dates modifiées sont contrôlées : une date enregistrée déjà passée n'empêche pas de corriger un autre champ.
    const dateError = conventionDateError(form, today, conventionToEditForm(convention));
    if (dateError) {
      toast({ title: t("common:errors.title", "Erreur"), description: t(`conventions:create.${dateError}`), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const updated = await conventionApi.update(convention.id, buildUpdateConventionRequest(form));
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:edit.success") });
      onOpenChange(false);
      onSaved(updated);
    } catch (e: any) {
      // Message du serveur affiché tel quel (409 non éditable, 403 périmètre/rôle, 409 référence, 400).
      toast({ title: t("common:errors.title", "Erreur"), description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" /> {t("conventions:edit.title")}
          </DialogTitle>
          <DialogDescription>{t("conventions:edit.full_replace_hint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pe-1">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t("conventions:fields.autorite_contractante")} : </span>
            <span className="font-medium text-foreground">{convention.autoriteContractanteNom || "—"}</span>
            <p className="text-xs text-muted-foreground mt-1">{t("conventions:edit.autorite_fixed")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("conventions:fields.reference_required")}</Label>
              <Input value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder={t("conventions:create.reference_placeholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("conventions:fields.project_reference")}</Label>
              <Input value={form.projectReference} onChange={(e) => set({ projectReference: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("conventions:fields.intitule_required")}</Label>
            <Input value={form.intitule} onChange={(e) => set({ intitule: e.target.value })} placeholder={t("conventions:create.intitule_placeholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("conventions:fields.bailleur")}</Label>
            <SearchableSelect
              value={form.bailleurId != null ? String(form.bailleurId) : ""}
              onValueChange={(v) => set({ bailleurId: v ? Number(v) : null })}
              placeholder={bailleursLoading ? t("conventions:create.loading") : t("conventions:create.select_bailleur")}
              searchPlaceholder={t("conventions:create.search_bailleur")}
              options={bailleurs.map((b) => ({ value: String(b.id), label: b.nom }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("conventions:fields.date_signature")}</Label>
              <Input type="date" max={today} value={form.dateSignature} onChange={(e) => set({ dateSignature: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("conventions:fields.date_fin")}</Label>
              <Input type="date" min={today} value={form.dateFin} onChange={(e) => set({ dateFin: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("conventions:fields.devise")}</Label>
            <SearchableSelect
              value={form.deviseOrigine || ""}
              onValueChange={handleDeviseChange}
              placeholder={devisesLoading ? t("conventions:create.loading") : t("conventions:create.select_devise")}
              searchPlaceholder={t("conventions:create.search_devise")}
              options={devises.map((d) => ({
                value: d.code,
                label: `${d.code} — ${d.libelle}${d.symbole ? ` (${d.symbole})` : ""}`,
                keywords: `${d.code} ${d.libelle}`,
              }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="space-y-2">
              <Label>{t("conventions:fields.montant_devise")}</Label>
              <Input type="number" step="0.01" value={form.montantDevise ?? ""} onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                set({ montantDevise: val, montantMru: val != null && form.tauxChange ? round2(val * form.tauxChange) : form.montantMru ?? null });
              }} />
            </div>
            <div className="space-y-2">
              <Label>{t("conventions:fields.taux_change")}</Label>
              <Input readOnly value={form.tauxChange != null ? formatNumber(form.tauxChange) : "—"} className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>{t("conventions:fields.montant_mru_auto")}</Label>
              <Input type="number" step="0.01" value={form.montantMru ?? ""} onChange={(e) => set({ montantMru: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
          {tauxLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("conventions:create.rate_loading")}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("conventions:actions.dismiss")}</Button>
          <Button onClick={handleSave} disabled={saving || missingRequired}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <CheckCircle className="h-4 w-4 me-1" />}
            {t("conventions:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConventionEditDialog;
