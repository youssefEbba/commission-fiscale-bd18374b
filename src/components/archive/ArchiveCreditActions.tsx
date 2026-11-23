import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Link2, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuth } from "@/contexts/AuthContext";
import { useArchiveRefs } from "@/hooks/useArchiveRefs";
import { archiveCreditGestionApi, formatApiErrorMessage, type ArchiveCreditDto } from "@/lib/api";
import {
  AUCUN_MARCHE,
  autoriteOptions,
  buildRattachementBody,
  canConfirmSuppression,
  conventionOptions,
  entrepriseOptions,
  marcheOptions,
  rattachementFormError,
  suppressionLignes,
  type RattachementForm,
} from "@/lib/archiveCreditGestion";
import { isRouteUnavailable } from "@/lib/submission";

type Mode = "rattachement" | "suppression" | null;

/** Boutons « Corriger le rattachement » et « Supprimer définitivement » d'un crédit repris de l'archive. */
export function ArchiveCreditActions({ certificatId, onCorrected, onDeleted, size = "default" }: {
  certificatId: number;
  onCorrected: (credit: ArchiveCreditDto) => void;
  onDeleted: () => void;
  size?: "default" | "sm";
}) {
  const { t } = useTranslation(["archive"]);
  const [mode, setMode] = useState<Mode>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size={size} onClick={() => setMode("rattachement")}>
          <Link2 className="h-4 w-4 me-2" /> {t("archive:gestion.corriger")}
        </Button>
        <Button variant="outline" size={size} className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setMode("suppression")}>
          <Trash2 className="h-4 w-4 me-2" /> {t("archive:gestion.supprimer")}
        </Button>
      </div>
      {mode === "rattachement" && (
        <ArchiveRattachementDialog certificatId={certificatId} onClose={() => setMode(null)} onDone={(c) => { setMode(null); onCorrected(c); }} />
      )}
      {mode === "suppression" && (
        <ArchiveSuppressionDialog certificatId={certificatId} onClose={() => setMode(null)} onDone={() => { setMode(null); onDeleted(); }} />
      )}
    </>
  );
}

/** Le dossier est relu à chaque ouverture : rattachement et aperçu viennent du serveur. */
function useArchiveCredit(certificatId: number) {
  const { t } = useTranslation(["archive"]);
  const [credit, setCredit] = useState<ArchiveCreditDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setCredit(null);
    setError(null);
    archiveCreditGestionApi.get(certificatId)
      .then((c) => { if (alive) setCredit(c); })
      .catch((e) => {
        if (alive) setError(isRouteUnavailable(e) ? t("archive:gestion.unavailable") : formatApiErrorMessage(e, t("archive:gestion.error_load")));
      });
    return () => { alive = false; };
  }, [certificatId, t]);
  return { credit, error };
}

const EMPTY_FORM: RattachementForm = { entrepriseId: "", autoriteContractanteId: "", conventionId: "", marcheId: AUCUN_MARCHE, motif: "" };
const idOf = (v: number | null | undefined) => (v == null ? "" : String(v));

/** Ajoute la valeur actuelle si la liste chargée ne la contient pas (référentiel incomplet). */
function withCurrent(options: { value: string; label: string; description?: string }[], value: string, label: string | null | undefined) {
  if (!value || options.some((o) => o.value === value)) return options;
  return [{ value, label: label || "—" }, ...options];
}

export function ArchiveRattachementDialog({ certificatId, onClose, onDone }: {
  certificatId: number;
  onClose: () => void;
  onDone: (credit: ArchiveCreditDto) => void;
}) {
  const { t } = useTranslation(["archive", "common"]);
  const { user } = useAuth();
  const refs = useArchiveRefs(user);
  const { credit, error: loadError } = useArchiveCredit(certificatId);
  const [form, setForm] = useState<RattachementForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!credit) return;
    setForm({
      entrepriseId: idOf(credit.entrepriseId),
      autoriteContractanteId: idOf(credit.autoriteContractanteId),
      conventionId: idOf(credit.conventionId),
      marcheId: credit.marcheId == null ? AUCUN_MARCHE : String(credit.marcheId),
      motif: "",
    });
  }, [credit]);

  const set = (patch: Partial<RattachementForm>) => setForm((f) => ({ ...f, ...patch }));

  const entOpts = useMemo(
    () => withCurrent(entrepriseOptions(refs.entreprises), form.entrepriseId, form.entrepriseId === idOf(credit?.entrepriseId) ? credit?.entrepriseRaisonSociale : null),
    [refs.entreprises, form.entrepriseId, credit],
  );
  const acOpts = useMemo(
    () => withCurrent(autoriteOptions(refs.autorites), form.autoriteContractanteId, form.autoriteContractanteId === idOf(credit?.autoriteContractanteId) ? credit?.autoriteContractanteNom : null),
    [refs.autorites, form.autoriteContractanteId, credit],
  );
  const convOpts = useMemo(
    () => withCurrent(conventionOptions(refs.conventions, form.autoriteContractanteId), form.conventionId, form.conventionId === idOf(credit?.conventionId) ? credit?.conventionReference || credit?.conventionIntitule : null),
    [refs.conventions, form.autoriteContractanteId, form.conventionId, credit],
  );
  const marOpts = useMemo(() => {
    const base = withCurrent(
      marcheOptions(refs.marches, form.conventionId),
      form.marcheId === AUCUN_MARCHE ? "" : form.marcheId,
      form.marcheId === idOf(credit?.marcheId) ? credit?.marcheNumero : null,
    );
    return [{ value: AUCUN_MARCHE, label: t("archive:gestion.aucun_marche") }, ...base];
  }, [refs.marches, form.conventionId, form.marcheId, credit, t]);

  const formError = rattachementFormError(form);

  const submit = async () => {
    if (formError || saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = await archiveCreditGestionApi.corrigerRattachement(certificatId, buildRattachementBody(form));
      onDone(next);
    } catch (e) {
      setError(formatApiErrorMessage(e, t("archive:gestion.error_rattachement")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("archive:gestion.corriger_titre", { reference: credit?.reference ?? "" })}</DialogTitle>
          <DialogDescription>{t("archive:gestion.corriger_desc")}</DialogDescription>
        </DialogHeader>

        {loadError && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{loadError}</p>}
        {!credit && !loadError && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

        {credit && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("archive:entreprise")} *</Label>
              <SearchableSelect
                options={entOpts}
                value={form.entrepriseId}
                onValueChange={(v) => set({ entrepriseId: v })}
                placeholder={t("archive:select_entreprise")}
                loading={refs.loading.entreprise}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("archive:autorite")} *</Label>
              <SearchableSelect
                options={acOpts}
                value={form.autoriteContractanteId}
                // Changer d'autorité invalide la convention et le marché choisis.
                onValueChange={(v) => set(v === form.autoriteContractanteId ? {} : { autoriteContractanteId: v, conventionId: "", marcheId: AUCUN_MARCHE })}
                placeholder={t("archive:select_autorite")}
                loading={refs.loading.autorite}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("archive:convention")} *</Label>
              <SearchableSelect
                options={convOpts}
                value={form.conventionId}
                onValueChange={(v) => set(v === form.conventionId ? {} : { conventionId: v, marcheId: AUCUN_MARCHE })}
                placeholder={form.autoriteContractanteId ? t("archive:select_convention") : t("archive:convention_requires_autorite")}
                loading={refs.loading.convention}
                disabled={saving || !form.autoriteContractanteId}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("archive:marche")}</Label>
              <SearchableSelect
                options={marOpts}
                value={form.marcheId || AUCUN_MARCHE}
                onValueChange={(v) => set({ marcheId: v || AUCUN_MARCHE })}
                placeholder={t("archive:select_marche")}
                loading={refs.loading.marche}
                disabled={saving || !form.conventionId}
              />
              {credit.marcheCreeParImport && credit.marcheId != null && form.marcheId !== String(credit.marcheId) && (
                <p className="text-xs text-muted-foreground">{t("archive:gestion.marche_cree_par_import", { numero: credit.marcheNumero ?? "—" })}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="archive-rattachement-motif">{t("archive:gestion.motif")} *</Label>
              <Textarea id="archive-rattachement-motif" value={form.motif} onChange={(e) => set({ motif: e.target.value })} disabled={saving} rows={3} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common:actions.cancel")}</Button>
          <Button onClick={() => void submit()} disabled={!credit || !!formError || saving}>
            {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t("archive:gestion.corriger_valider")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveSuppressionDialog({ certificatId, onClose, onDone }: {
  certificatId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation(["archive", "common"]);
  const { credit, error: loadError } = useArchiveCredit(certificatId);
  const [motif, setMotif] = useState("");
  const [saisie, setSaisie] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lignes = suppressionLignes(credit?.suppression);
  const utilApp = credit?.suppression?.utilisationsApplication ?? 0;
  // Sans aperçu chargé, la suppression reste bloquée : on ne supprime pas à l'aveugle.
  const ready = !!credit && canConfirmSuppression(motif, saisie, credit.reference);

  const confirm = async () => {
    if (!ready || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await archiveCreditGestionApi.supprimer(certificatId, motif.trim());
      onDone();
    } catch (e) {
      setError(formatApiErrorMessage(e, t("archive:gestion.error_suppression")));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(o) => !o && !deleting && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("archive:gestion.supprimer_titre", { reference: credit?.reference ?? "" })}</AlertDialogTitle>
          <AlertDialogDescription>{t("archive:gestion.supprimer_desc")}</AlertDialogDescription>
        </AlertDialogHeader>

        {loadError && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{loadError}</p>}
        {!credit && !loadError && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

        {credit && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium mb-1">{t("archive:gestion.apercu")}</p>
              {lignes.length ? (
                <ul className="list-disc ps-5 space-y-0.5">
                  {lignes.map((l) => (
                    <li key={l.key} className={l.key === "utilisationsApplication" ? "text-destructive font-semibold" : undefined}>
                      {t(`archive:gestion.compte.${l.key}`, { count: l.count })}
                    </li>
                  ))}
                  {credit.marcheCreeParImport && credit.marcheId != null && (
                    <li>{t("archive:gestion.compte.marche", { numero: credit.marcheNumero ?? "—" })}</li>
                  )}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t("archive:gestion.apercu_vide")}</p>
              )}
            </div>
            {utilApp > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{t("archive:gestion.dont_application", { count: utilApp })}</AlertDescription>
              </Alert>
            )}
            {(credit.suppression?.creditsDeLot ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">{t("archive:gestion.reimportable")}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="archive-suppression-motif">{t("archive:gestion.motif")} *</Label>
              <Textarea id="archive-suppression-motif" value={motif} onChange={(e) => setMotif(e.target.value)} disabled={deleting} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="archive-suppression-ref">{t("archive:gestion.saisir_reference", { reference: credit.reference })}</Label>
              <Input id="archive-suppression-ref" value={saisie} onChange={(e) => setSaisie(e.target.value)} disabled={deleting} autoComplete="off" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t("common:actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); void confirm(); }}
            disabled={!ready || deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t("archive:gestion.supprimer_valider")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
