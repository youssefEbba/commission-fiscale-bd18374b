import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAmount, formatDate, formatDateTime } from "@/i18n/format";
import { archiveLotApi, formatApiErrorMessage, type ArchiveCreditPreviewDto, type ArchiveLotCreditDto } from "@/lib/api";
import { ArchiveSoldesTable, ArchiveUtilisationsTable } from "./ArchiveReleveTables";
import { ArchiveLotStatutBadge, SourceBadge } from "./ArchiveLotStatut";
import { soldesDetail } from "@/lib/archiveLots";

const money = (v: number | null | undefined) => (v == null ? "—" : formatAmount(v));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium break-words">{children ?? "—"}</div>
    </div>
  );
}

/** Détail d'un crédit du lot : données du fichier, soldes, anomalies et utilisations du relevé. */
export function ArchiveLotCreditDialog({ lotId, creditId, onClose, onSaved }: {
  lotId: number;
  creditId: number | null;
  onClose: () => void;
  /** Après saisie du N° ou de la date : le lot est relu par l'appelant. */
  onSaved?: () => void;
}) {
  const { t } = useTranslation(["archive", "common"]);
  const [data, setData] = useState<{ credit: ArchiveLotCreditDto; releve: ArchiveCreditPreviewDto } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (creditId == null) return;
    let alive = true;
    setData(null);
    setError(null);
    setNumero("");
    setDate("");
    setSaveError(null);
    archiveLotApi.getCredit(lotId, creditId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(formatApiErrorMessage(e, t("archive:lots.error_credit"))); });
    return () => { alive = false; };
  }, [lotId, creditId, t]);

  const c = data?.credit;
  const r = data?.releve;
  const manqueNumero = !!c && c.statut !== "IMPORTE" && c.manquants?.includes("NUMERO");
  const manqueDate = !!c && c.statut !== "IMPORTE" && c.manquants?.includes("DATE");

  // N° et date se saisissent crédit par crédit (seuls les champs remplis sont envoyés).
  const saveIdentite = async () => {
    if (!c) return;
    const body = {
      creditIds: [c.id],
      ...(manqueNumero && numero.trim() ? { numeroCredit: numero.trim() } : {}),
      ...(manqueDate && date ? { dateCredit: date } : {}),
    };
    if (!("numeroCredit" in body) && !("dateCredit" in body)) return;
    setSaving(true);
    setSaveError(null);
    try {
      await archiveLotApi.affecter(lotId, body);
      const d = await archiveLotApi.getCredit(lotId, c.id);
      setData(d);
      setNumero("");
      setDate("");
      onSaved?.();
    } catch (e) {
      setSaveError(formatApiErrorMessage(e, t("archive:lots.error_affect")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={creditId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {t("archive:numero_credit")} {c ? (c.numeroCredit || t("archive:lots.numero_a_saisir")) : ""}
            {c && <ArchiveLotStatutBadge statut={c.statut} />}
          </DialogTitle>
          <DialogDescription>{c ? t("archive:lots.lignes", { debut: c.ligneDebut, fin: c.ligneFin }) : t("archive:lots.chargement")}</DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
        {!data && !error && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

        {c && r && (
          <div className="space-y-6">
            {c.statut === "ERREUR" && c.messageErreur && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t("archive:lots.statut.ERREUR")}</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">{c.messageErreur}</AlertDescription>
              </Alert>
            )}
            {c.certificatId != null && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>{t("archive:lots.importe_le", { date: formatDateTime(c.dateImport) })}</AlertTitle>
                <AlertDescription>
                  <Button asChild variant="link" className="h-auto p-0">
                    <Link to={`/dashboard/certificats/${c.certificatId}`}>{c.certificatReference || t("archive:open_certificat")}</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {c.dejaRepris && c.certificatId == null && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{t("archive:lots.deja_repris_desc")}</AlertDescription>
              </Alert>
            )}

            {(manqueNumero || manqueDate) && (
              <section className="rounded-md border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-3">
                <h3 className="text-sm font-semibold">{t("archive:lots.identite_titre")}</h3>
                <p className="text-xs text-muted-foreground">{t("archive:lots.identite_desc")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {manqueNumero && (
                    <div className="space-y-1.5">
                      <Label htmlFor="lot-numero">{t("archive:lots.manquant.NUMERO")}</Label>
                      <Input id="lot-numero" maxLength={50} value={numero} onChange={(e) => setNumero(e.target.value)} />
                    </div>
                  )}
                  {manqueDate && (
                    <div className="space-y-1.5">
                      <Label htmlFor="lot-date">{t("archive:lots.manquant.DATE")}</Label>
                      <Input id="lot-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                  )}
                </div>
                {saveError && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{saveError}</p>}
                <Button size="sm" onClick={() => void saveIdentite()} disabled={saving || !((manqueNumero && numero.trim()) || (manqueDate && date))}>
                  {saving ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Save className="h-4 w-4 me-1" />}
                  {t("common:actions.save")}
                </Button>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold mb-3">{t("archive:lots.marche_fichier")}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={t("archive:nif")}>{c.nif}</Field>
                <Field label={t("archive:reference_marche")}>{c.referenceMarche}</Field>
                <Field label={t("archive:f_numero_marche")}>{c.numeroMarche}</Field>
                <Field label={t("archive:f_date_signature")}>{c.dateMarche ? formatDate(c.dateMarche) : "—"}</Field>
                <Field label={t("archive:f_duree_execution")}>{c.dureeMarche}</Field>
                <Field label={t("archive:montant_marche")}>{money(c.montantMarche)}</Field>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-3">{t("archive:recap")}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={t("archive:date_credit")}>{c.dateCredit ? formatDate(c.dateCredit) : "—"}</Field>
                <Field label={t("archive:montant_credit_impot")}>{money(c.montantCreditImpot)}</Field>
                <Field label={t("archive:credit_douanier")}>{money(c.creditDouanier)}</Field>
                <Field label={t("archive:credit_interieur")}>{money(c.creditInterieur)}</Field>
                <Field label={t("archive:transfert_credit")}>{money(c.transfertCredit)}</Field>
                <Field label={t("archive:total_utilisations_douane")}>{money(r.totalUtilisationsDouane)}</Field>
                <Field label={t("archive:total_utilisations_interieur")}>{money(r.totalUtilisationsInterieur)}</Field>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-3">{t("archive:rapprochements")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("archive:entreprise")}>{c.entrepriseRaisonSociale ?? "—"}<SourceBadge source={c.sourceEntreprise} /></Field>
                <Field label={t("archive:autorite")}>{c.autoriteContractanteNom ?? "—"}<SourceBadge source={c.sourceAutorite} /></Field>
                <Field label={t("archive:convention")}>{c.conventionIntitule ?? "—"}<SourceBadge source={c.sourceConvention} /></Field>
                <Field label={t("archive:marche")}>
                  {c.marcheNumero ?? (c.creerMarche ? t("archive:lots.marche_cree_releve") : "—")}<SourceBadge source={c.sourceMarche} />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-3">{t("archive:soldes_compare")}</h3>
              <ArchiveSoldesTable
                detail={soldesDetail({
                  ...c,
                  totalUtilisationsDouane: c.totalUtilisationsDouane ?? r.totalUtilisationsDouane,
                  totalUtilisationsInterieur: c.totalUtilisationsInterieur ?? r.totalUtilisationsInterieur,
                  sortieTransfert: c.sortieTransfert ?? r.totalTransfertSortant ?? c.transfertCredit,
                })}
              />
            </section>

            <Alert variant={c.anomalies?.length && !c.confirmerMalgreAnomalies ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("archive:anomalies")}{c.confirmerMalgreAnomalies && c.anomalies?.length ? ` — ${t("archive:lots.anomalies_confirmees")}` : ""}</AlertTitle>
              <AlertDescription>
                {c.anomalies?.length ? (
                  <ul className="list-disc ps-5 space-y-1 mt-1">{c.anomalies.map((a, i) => <li key={i} className="text-sm">{a}</li>)}</ul>
                ) : <span className="text-sm">{t("archive:no_anomalies")}</span>}
              </AlertDescription>
            </Alert>

            <section>
              <h3 className="text-sm font-semibold mb-3">{t("archive:utilisations")}</h3>
              <ArchiveUtilisationsTable utilisations={r.utilisations ?? []} />
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
