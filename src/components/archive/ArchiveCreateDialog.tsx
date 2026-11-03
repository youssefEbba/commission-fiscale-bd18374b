import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BailleurFormDialog from "@/components/conventions/BailleurFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import { tStatutMarche } from "@/i18n/enums";
import {
  autoriteContractanteApi,
  bailleurApi,
  conventionApi,
  entrepriseApi,
  formatApiErrorMessage,
  marcheApi,
  verifierNifDgi,
  MARCHE_STATUT_VALUES,
  type BailleurDto,
  type EntrepriseDto,
  type StatutMarche,
} from "@/lib/api";
import { invalidateArchiveRef } from "@/lib/archiveLots";

export type ArchiveCreateKind = "entreprise" | "autorite" | "convention" | "marche";

/** Valeurs de départ (NIF et noms DGI, données du marché lues dans le relevé…). */
export type ArchiveCreateInitial = Partial<Record<
  "nif" | "raisonSociale" | "nomCommercial" | "nom" | "sigle" | "reference" | "intitule" | "numeroMarche" | "montantContratHt" | "dateSignature" | "dureeExecution" | "statut",
  string
>>;

interface Props {
  kind: ArchiveCreateKind | null;
  initial?: ArchiveCreateInitial;
  /** Autorité de la convention créée (requise pour « convention »). */
  autoriteId?: number | null;
  /** Convention du marché créé (requise pour « marche »). */
  conventionId?: number | null;
  onClose: () => void;
  onCreated: (kind: ArchiveCreateKind, id: number) => void | Promise<void>;
}

const EMPTY: Record<ArchiveCreateKind, Record<string, string>> = {
  entreprise: { raisonSociale: "", nif: "", nomCommercial: "" },
  autorite: { nom: "", sigle: "" },
  convention: { reference: "", intitule: "", bailleurId: "" },
  marche: { numeroMarche: "", intitule: "", montantContratHt: "", dateSignature: "", dureeExecution: "", statut: "CLOTURE" },
};

/** Création d'une entité manquante pendant une reprise d'archive (relevé unitaire et fichier de période). */
export function ArchiveCreateDialog({ kind, initial, autoriteId, conventionId, onClose, onCreated }: Props) {
  const { t } = useTranslation(["archive", "common"]);
  const { user } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dgiLoading, setDgiLoading] = useState(false);
  const [dgiNote, setDgiNote] = useState<string | null>(null);
  const [bailleurs, setBailleurs] = useState<BailleurDto[]>([]);
  const [bailleursLoading, setBailleursLoading] = useState(false);
  const [bailleurOpen, setBailleurOpen] = useState(false);
  const setField = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!kind) return;
    const base = { ...EMPTY[kind] };
    for (const [k, v] of Object.entries(initial ?? {})) if (k in base && v != null) base[k] = v;
    setForm(base);
    setError(null);
    setDgiNote(null);
    if (kind === "convention") {
      setBailleursLoading(true);
      bailleurApi.getAll()
        .then((v) => setBailleurs(Array.isArray(v) ? v : []))
        .catch(() => setBailleurs([]))
        .finally(() => setBailleursLoading(false));
    }
    // L'initialisation ne suit que l'ouverture : la saisie en cours n'est pas écrasée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const bailleurOptions = useMemo(
    () => [...bailleurs]
      .sort((x, y) => (x.nom || "").localeCompare(y.nom || "", "fr"))
      .map((b) => ({ value: String(b.id), label: b.nom || `#${b.id}` })),
    [bailleurs],
  );

  const valid = (() => {
    switch (kind) {
      case "entreprise": return !!form.raisonSociale?.trim() && !!form.nif?.trim();
      case "autorite": return !!form.nom?.trim();
      case "convention": return !!form.reference?.trim() && !!form.intitule?.trim() && autoriteId != null;
      case "marche": return !!form.numeroMarche?.trim() && conventionId != null && !!form.montantContratHt;
      default: return false;
    }
  })();

  const fetchDgi = async () => {
    const nif = form.nif?.trim();
    if (!nif) return;
    setDgiLoading(true);
    setDgiNote(null);
    try {
      const r = await verifierNifDgi(nif);
      if (!r.trouve) {
        setDgiNote(t("archive:dgi.nif_inconnu"));
        return;
      }
      setForm((p) => ({
        ...p,
        raisonSociale: r.raisonSociale || p.raisonSociale,
        nomCommercial: r.nomCommercial || p.nomCommercial,
      }));
      setDgiNote(r.etat ? t("archive:dgi.trouve_etat", { etat: r.etat }) : t("archive:dgi.trouve"));
    } catch (e) {
      setDgiNote(formatApiErrorMessage(e, t("archive:dgi.indisponible")));
    } finally {
      setDgiLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!kind || !valid) return;
    setCreating(true);
    setError(null);
    try {
      let id: number | undefined;
      if (kind === "entreprise") {
        const created = await entrepriseApi.create({
          raisonSociale: form.raisonSociale.trim(),
          nif: form.nif.trim(),
          nomCommercial: form.nomCommercial?.trim() || undefined,
        } as EntrepriseDto);
        id = created?.id;
        invalidateArchiveRef("entreprises", user);
      } else if (kind === "autorite") {
        const created = await autoriteContractanteApi.create({ nom: form.nom.trim(), sigle: form.sigle?.trim() || undefined });
        id = created?.id;
        invalidateArchiveRef("autorites", user);
      } else if (kind === "convention") {
        const created = await conventionApi.create({
          reference: form.reference.trim(),
          intitule: form.intitule.trim(),
          autoriteContractanteId: Number(autoriteId),
          bailleurId: form.bailleurId ? Number(form.bailleurId) : undefined,
        });
        id = created?.id;
        invalidateArchiveRef("conventions", user);
      } else {
        const created = await marcheApi.create({
          conventionId: Number(conventionId),
          numeroMarche: form.numeroMarche.trim(),
          intitule: form.intitule?.trim() || undefined,
          montantContratHt: form.montantContratHt ? Number(form.montantContratHt) : undefined,
          dateSignature: form.dateSignature || undefined,
          dureeExecution: form.dureeExecution?.trim() || undefined,
          statut: (form.statut || "CLOTURE") as StatutMarche,
        });
        id = created?.id;
        invalidateArchiveRef("marches", user);
      }
      if (id != null) await onCreated(kind, id);
      onClose();
    } catch (e) {
      setError(formatApiErrorMessage(e, t("archive:error_create")));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Dialog open={kind !== null} onOpenChange={(o) => !o && !creating && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{kind ? t(`archive:create_${kind}`) : ""}</DialogTitle>
            <DialogDescription>{t("archive:create_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {kind === "entreprise" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-nif">{t("archive:nif")} *</Label>
                  <div className="flex gap-2">
                    <Input id="ac-nif" value={form.nif ?? ""} onChange={(e) => setField("nif", e.target.value)} />
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void fetchDgi()} disabled={!form.nif?.trim() || dgiLoading}>
                      {dgiLoading ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <SearchCheck className="h-4 w-4 me-1" />}
                      {t("archive:dgi.recuperer")}
                    </Button>
                  </div>
                  {dgiNote && <p className="text-xs text-muted-foreground" role="status">{dgiNote}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-rs">{t("archive:f_raison_sociale")} *</Label>
                  <Input id="ac-rs" value={form.raisonSociale ?? ""} onChange={(e) => setField("raisonSociale", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-nc">{t("archive:f_nom_commercial")}</Label>
                  <Input id="ac-nc" value={form.nomCommercial ?? ""} onChange={(e) => setField("nomCommercial", e.target.value)} />
                </div>
              </>
            )}
            {kind === "autorite" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-nom">{t("archive:f_nom")} *</Label>
                  <Input id="ac-nom" value={form.nom ?? ""} onChange={(e) => setField("nom", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-sigle">{t("archive:f_sigle")}</Label>
                  <Input id="ac-sigle" value={form.sigle ?? ""} onChange={(e) => setField("sigle", e.target.value)} />
                </div>
              </>
            )}
            {kind === "convention" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-ref">{t("archive:f_reference")} *</Label>
                  <Input id="ac-ref" value={form.reference ?? ""} onChange={(e) => setField("reference", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-int">{t("archive:f_intitule")} *</Label>
                  <Input id="ac-int" value={form.intitule ?? ""} onChange={(e) => setField("intitule", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("archive:f_bailleur")}</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        options={bailleurOptions}
                        value={form.bailleurId ?? ""}
                        onValueChange={(v) => setField("bailleurId", v)}
                        placeholder={t("archive:select_bailleur")}
                        loading={bailleursLoading}
                        clearable
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setBailleurOpen(true)} aria-label={t("archive:create_bailleur")} title={t("archive:create_bailleur")}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {autoriteId == null && <p className="text-xs text-muted-foreground">{t("archive:convention_requires_autorite")}</p>}
              </>
            )}
            {kind === "marche" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-num">{t("archive:f_numero_marche")} *</Label>
                  <Input id="ac-num" value={form.numeroMarche ?? ""} onChange={(e) => setField("numeroMarche", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-mint">{t("archive:f_intitule")}</Label>
                  <Input id="ac-mint" value={form.intitule ?? ""} onChange={(e) => setField("intitule", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-ht">{t("archive:f_montant_ht")} *</Label>
                  <Input id="ac-ht" type="number" step="0.01" value={form.montantContratHt ?? ""} onChange={(e) => setField("montantContratHt", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ac-date">{t("archive:f_date_signature")}</Label>
                    <Input id="ac-date" type="date" value={form.dateSignature ?? ""} onChange={(e) => setField("dateSignature", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ac-duree">{t("archive:f_duree_execution")}</Label>
                    <Input id="ac-duree" maxLength={100} value={form.dureeExecution ?? ""} onChange={(e) => setField("dureeExecution", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("archive:f_statut")}</Label>
                  <Select value={form.statut ?? "CLOTURE"} onValueChange={(v) => setField("statut", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MARCHE_STATUT_VALUES.map((s) => (
                        <SelectItem key={s} value={s}>{tStatutMarche(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {conventionId == null && <p className="text-xs text-muted-foreground">{t("archive:marche_requires_convention")}</p>}
              </>
            )}
            {error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={creating}>{t("common:actions.cancel")}</Button>
            <Button onClick={() => void handleCreate()} disabled={!valid || creating}>
              {creating && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("archive:create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BailleurFormDialog
        open={bailleurOpen}
        onOpenChange={setBailleurOpen}
        onSaved={(b) => {
          setBailleurs((cur) => [...cur.filter((x) => x.id !== b.id), b]);
          setField("bailleurId", String(b.id));
        }}
      />
    </>
  );
}
