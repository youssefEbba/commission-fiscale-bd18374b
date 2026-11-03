import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadRow } from "@/components/ui/upload-row";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArchiveCreateDialog, type ArchiveCreateInitial, type ArchiveCreateKind } from "@/components/archive/ArchiveCreateDialog";
import { ArchiveSoldesTable, ArchiveUtilisationsTable } from "@/components/archive/ArchiveReleveTables";
import { ArchiveLotsTab } from "@/components/archive/ArchiveLotsTab";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useArchiveRefs } from "@/hooks/useArchiveRefs";
import { soldesDetail } from "@/lib/archiveLots";
import { AlertTriangle, Archive, CheckCircle2, Loader2, Plus, RotateCcw, Info as Info_ } from "lucide-react";
import { formatAmount, formatDate } from "@/i18n/format";
import {
  archiveCreditApi,
  formatApiErrorMessage,
  type ArchiveCreditPreviewDto,
  type ArchiveCreditImportResultDto,
} from "@/lib/api";


const money = (v: number | null | undefined) => formatAmount(v ?? 0);

/** Onglet « Un crédit » : un relevé par fichier (écran historique). */
const ArchiveCreditUnique = () => {
  const { t } = useTranslation(["archive", "common"]);
  const { toast } = useToast();
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ArchiveCreditPreviewDto | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ArchiveCreditImportResultDto | null>(null);
  const [confirmAnomalies, setConfirmAnomalies] = useState(false);

  const { entreprises, autorites, conventions, marches, loading: refsLoading, reload } = useArchiveRefs(user);

  const [entrepriseId, setEntrepriseId] = useState<string>("");
  const [autoriteId, setAutoriteId] = useState<string>("");
  const [conventionId, setConventionId] = useState<string>("");
  const [marcheId, setMarcheId] = useState<string>("");

  // Création d'entités manquantes
  const [createKind, setCreateKind] = useState<ArchiveCreateKind | null>(null);
  const [createInitial, setCreateInitial] = useState<ArchiveCreateInitial>({});

  const entrepriseOptions = useMemo(
    () =>
      [...entreprises]
        .sort((x, y) => (x.raisonSociale || "").localeCompare(y.raisonSociale || "", "fr"))
        .map((e) => ({ value: String(e.id), label: e.raisonSociale || `#${e.id}`, description: e.nif ? `NIF ${e.nif}` : undefined })),
    [entreprises],
  );
  const autoriteOptions = useMemo(
    () =>
      [...autorites]
        .sort((x, y) => (x.nom || "").localeCompare(y.nom || "", "fr"))
        .map((a) => ({ value: String(a.id), label: a.nom || `#${a.id}`, description: a.sigle || undefined })),
    [autorites],
  );
  const conventionOptions = useMemo(
    () =>
      [...conventions]
        .filter((c) => !autoriteId || String(c.autoriteContractanteId ?? "") === autoriteId)
        .sort((x, y) => (x.reference || "").localeCompare(y.reference || "", "fr"))
        .map((c) => ({ value: String(c.id), label: c.actif === false ? `${c.reference || `#${c.id}`} — ${t("conventions:activation.disabled_badge")}` : (c.reference || `#${c.id}`), description: c.intitule || undefined })),
    [conventions, autoriteId, t],
  );
  const marcheOptions = useMemo(
    () =>
      [...marches]
        .filter((m) => !conventionId || String(m.conventionId ?? "") === conventionId)
        .sort((x, y) => (x.numeroMarche || "").localeCompare(y.numeroMarche || "", "fr"))
        .map((m) => ({
          value: String(m.id),
          label: m.numeroMarche || `#${m.id}`,
          description: m.intitule || undefined,
        })),
    [marches, conventionId],
  );

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setConfirmAnomalies(false);
    setEntrepriseId("");
    setAutoriteId("");
    setConventionId("");
    setMarcheId("");
  };

  const handleFile = async (f: File | null) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    setConfirmAnomalies(false);
    if (!f) return;
    setLoadingPreview(true);
    try {
      const p = await archiveCreditApi.previsualiser(f);
      setPreview(p);
      setEntrepriseId(p.entrepriseRapprocheeId != null ? String(p.entrepriseRapprocheeId) : "");
      setAutoriteId(p.autoriteRapprocheeId != null ? String(p.autoriteRapprocheeId) : "");
      setMarcheId(p.marcheRapprocheId != null ? String(p.marcheRapprocheId) : "");
      const m = p.marcheRapprocheId != null ? marches.find((x) => x.id === p.marcheRapprocheId) : undefined;
      setConventionId(m?.conventionId != null ? String(m.conventionId) : "");
    } catch (err) {
      toast({ title: t("common:error", { defaultValue: "Erreur" }), description: formatApiErrorMessage(err, t("archive:error_preview")), variant: "destructive" });
      setFile(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const openCreate = (kind: ArchiveCreateKind) => {
    if (kind === "entreprise") setCreateInitial({ nif: preview?.nif ?? "" });
    else if (kind === "marche")
      setCreateInitial({
        numeroMarche: preview?.referenceMarche ?? "",
        montantContratHt: preview?.montantMarche != null ? String(preview.montantMarche) : "",
      });
    else setCreateInitial({});
    setCreateKind(kind);
  };

  const handleCreated = async (kind: ArchiveCreateKind, id: number) => {
    await reload(kind);
    const v = String(id);
    if (kind === "entreprise") setEntrepriseId(v);
    else if (kind === "autorite") setAutoriteId(v);
    else if (kind === "convention") setConventionId(v);
    else setMarcheId(v);
    toast({ title: t("archive:created_ok") });
  };

  const anomalies = preview?.anomalies ?? [];
  // Un crédit déjà repris n'est plus bloquant : l'import complète le dossier existant.
  const existing = !!preview?.certificatDejaImporteId;
  const canImport =
    !!file && !!preview && !!entrepriseId && !!autoriteId && !!conventionId &&
    (anomalies.length === 0 || confirmAnomalies);

  const handleImport = async () => {
    if (!file || !entrepriseId || !autoriteId || !conventionId) return;
    setImporting(true);
    try {
      const res = await archiveCreditApi.importer({
        fichier: file,
        entrepriseId: Number(entrepriseId),
        autoriteContractanteId: Number(autoriteId),
        conventionId: Number(conventionId),
        marcheId: marcheId ? Number(marcheId) : undefined,
        confirmerMalgreAnomalies: confirmAnomalies,
      });
      setResult(res);
    } catch (err) {
      toast({ title: t("common:error", { defaultValue: "Erreur" }), description: formatApiErrorMessage(err, t("archive:error_import")), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };


  const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value ?? "—"}</p>
    </div>
  );

  return (
      <div className="space-y-6">
        {(preview || result) && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 me-2" />
              {t("archive:reset")}
            </Button>
          </div>
        )}

        {/* Étape 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. {t("archive:step1")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UploadRow
              id="archive-file"
              label={t("archive:upload_label")}
              helperText={t("archive:upload_helper")}
              accept=".xls,.xlsx"
              file={file}
              disabled={loadingPreview || importing}
              onFileChange={(f) => void handleFile(f)}
            />
            {loadingPreview && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("archive:analyzing")}
              </p>
            )}
          </CardContent>
        </Card>

        {preview && !result && (
          <>
            {existing && (
              <Alert>
                <Info_ className="h-4 w-4" />
                <AlertTitle>{t("archive:deja_importe")}</AlertTitle>
                <AlertDescription>
                  {t("archive:deja_importe_desc", { reference: preview.certificatDejaImporteReference ?? preview.certificatDejaImporteId })}
                </AlertDescription>
              </Alert>
            )}

            {/* Étape 2 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. {t("archive:step2")}</CardTitle>
                <CardDescription>{preview.nomFichier}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3">{t("archive:recap")}</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Info label={t("archive:nif")} value={preview.nif} />
                    <Info label={t("archive:reference_marche")} value={preview.referenceMarche} />
                    <Info label={t("archive:numero_credit")} value={preview.numeroCredit} />
                    <Info label={t("archive:date_credit")} value={formatDate(preview.dateCredit)} />
                    <Info label={t("archive:montant_marche")} value={money(preview.montantMarche)} />
                    <Info label={t("archive:credit_douanier")} value={money(preview.creditDouanier)} />
                    <Info label={t("archive:credit_interieur")} value={money(preview.creditInterieur)} />
                    <Info label={t("archive:montant_credit_impot")} value={money(preview.montantCreditImpot)} />
                    {preview.totalTransfertSortant != null ? (
                      <div className="sm:col-span-2 lg:col-span-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">{t("archive:total_transfert_sortant")}</p>
                            <p className="text-sm font-semibold">{money(preview.totalTransfertSortant)}</p>
                          </div>
                          <div className="flex items-center justify-between ps-4">
                            <p className="text-xs text-muted-foreground">{t("archive:transfert_dont_transfere")}</p>
                            <p className="text-sm">{money(preview.transfertCredit)}</p>
                          </div>
                          <div className="flex items-center justify-between ps-4">
                            <p className="text-xs text-muted-foreground">{t("archive:transfert_dont_zero")}</p>
                            <p className="text-sm">
                              {money((preview.totalTransfertSortant ?? 0) - (preview.transfertCredit ?? 0))}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            {t("archive:transfert_credit_note")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="sm:col-span-2 lg:col-span-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">{t("archive:transfert_credit")}</p>
                          <p className="text-sm font-medium break-words">{money(preview.transfertCredit)}</p>
                        </div>
                      </div>
                    )}
                    <Info label={t("archive:total_utilisations_douane")} value={money(preview.totalUtilisationsDouane)} />
                    <Info label={t("archive:total_utilisations_interieur")} value={money(preview.totalUtilisationsInterieur)} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">{t("archive:soldes_compare")}</h3>
                  <ArchiveSoldesTable detail={soldesDetail({ ...preview, sortieTransfert: preview.totalTransfertSortant ?? preview.transfertCredit })} />
                </div>

                <Alert variant={anomalies.length ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t("archive:anomalies")}</AlertTitle>
                  <AlertDescription>
                    {anomalies.length ? (
                      <ul className="list-disc ps-5 space-y-1 mt-1">
                        {anomalies.map((a, i) => (
                          <li key={i} className="text-sm">{a}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm">{t("archive:no_anomalies")}</span>
                    )}
                  </AlertDescription>
                </Alert>

                <div>
                  <h3 className="text-sm font-semibold mb-3">{t("archive:rapprochements")}</h3>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t("archive:entreprise")} *</Label>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <SearchableSelect
                            options={entrepriseOptions}
                            loading={refsLoading.entreprise}
                            value={entrepriseId}
                            onValueChange={setEntrepriseId}
                            placeholder={t("archive:select_entreprise")}
                            clearable
                          />
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => openCreate("entreprise")}>
                          <Plus className="h-4 w-4 me-1" />
                          {t("archive:create")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {preview.entrepriseRapprocheeId
                          ? `${t("archive:from_nif")} — ${preview.entrepriseRapprocheeRaisonSociale ?? ""}`
                          : t("archive:no_match_entreprise")}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("archive:autorite")} *</Label>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <SearchableSelect
                            options={autoriteOptions}
                            loading={refsLoading.autorite}
                            value={autoriteId}
                            onValueChange={(v) => {
                              setAutoriteId(v);
                              setConventionId("");
                              setMarcheId("");
                            }}
                            placeholder={t("archive:select_autorite")}
                            clearable
                          />
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => openCreate("autorite")}>
                          <Plus className="h-4 w-4 me-1" />
                          {t("archive:create")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {preview.autoriteRapprocheeId
                          ? `${t("archive:from_marche")} — ${preview.autoriteRapprocheeNom ?? ""}`
                          : t("archive:no_match_autorite")}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("archive:convention")} *</Label>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <SearchableSelect
                            options={conventionOptions}
                            loading={refsLoading.convention}
                            value={conventionId}
                            onValueChange={(v) => {
                              setConventionId(v);
                              setMarcheId("");
                            }}
                            placeholder={t("archive:select_convention")}
                            disabled={!autoriteId}
                            clearable
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!autoriteId}
                          onClick={() => openCreate("convention")}
                        >
                          <Plus className="h-4 w-4 me-1" />
                          {t("archive:create")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {!autoriteId ? t("archive:convention_requires_autorite") : t("archive:convention_hint")}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("archive:marche")}</Label>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <SearchableSelect
                            options={marcheOptions}
                            loading={refsLoading.marche}
                            value={marcheId}
                            onValueChange={setMarcheId}
                            placeholder={t("archive:select_marche")}
                            disabled={!conventionId}
                            clearable
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!conventionId}
                          onClick={() => openCreate("marche")}
                        >
                          <Plus className="h-4 w-4 me-1" />
                          {t("archive:create")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {!conventionId
                          ? t("archive:marche_requires_convention")
                          : preview.marcheRapprocheId
                            ? `${t("archive:from_reference")} — ${preview.marcheRapprocheNumero ?? ""}${preview.marcheRapprocheIntitule ? ` · ${preview.marcheRapprocheIntitule}` : ""}`
                            : t("archive:no_match_marche")}
                      </p>
                    </div>
                  </div>

                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">{t("archive:utilisations")}</h3>
                  <ArchiveUtilisationsTable utilisations={preview.utilisations} />
                </div>
              </CardContent>
            </Card>

            {/* Étape 3 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. {t("archive:step3")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {anomalies.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="confirm-anomalies"
                      checked={confirmAnomalies}
                      onCheckedChange={(v) => setConfirmAnomalies(v === true)}
                    />
                    <Label htmlFor="confirm-anomalies" className="text-sm font-normal leading-snug">
                      {t("archive:confirm_anomalies")}
                    </Label>
                  </div>
                )}
                {(!entrepriseId || !autoriteId || !conventionId) && (
                  <p className="text-xs text-muted-foreground">{t("archive:import_disabled_required")}</p>
                )}

                <Button onClick={() => void handleImport()} disabled={!canImport || importing}>
                  {importing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Archive className="h-4 w-4 me-2" />}
                  {importing ? t("archive:importing") : t("archive:import")}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {result && (() => {
          const complement = !!result.certificatDejaExistant;
          const ajoutees = (result.utilisationsDouanieres ?? 0) + (result.utilisationsInterieures ?? 0);
          const ignorees = result.utilisationsIgnorees ?? 0;
          return (
          <Card className="border-emerald-300">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                {complement ? t("archive:result_title_complement") : t("archive:result_title_creation")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {complement && (
                <Alert>
                  <Info_ className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {ajoutees === 0
                      ? t("archive:result_complement_rien", { ignorees })
                      : t("archive:result_complement_desc", { ajoutees, ignorees })}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Info label={t("archive:result_certificat")} value={`${result.certificatNumero} (${result.certificatStatut})`} />
                <Info label={t("archive:entreprise")} value={result.entrepriseRaisonSociale} />
                {result.demandeCorrectionId != null && (
                  <Info label={t("archive:result_dossier")} value={result.demandeCorrectionNumero ?? `#${result.demandeCorrectionId}`} />
                )}
                {result.transfertCreditId != null && (
                  <Info label={t("archive:result_transfert")} value={money(result.transfertCreditMontant)} />
                )}
                <Info label={t("archive:result_utilisations_douane")} value={result.utilisationsDouanieres} />
                <Info label={t("archive:result_utilisations_interieur")} value={result.utilisationsInterieures} />
                <Info label={t("archive:result_lignes_taxe")} value={result.lignesTaxeCreees} />
                {complement && <Info label={t("archive:result_utilisations_ignorees")} value={ignorees} />}
                <Info label={t("archive:result_solde_cordon")} value={money(result.soldeCordon)} />
                <Info label={t("archive:result_solde_tva")} value={money(result.soldeTVA)} />
              </div>
              {result.transfertCreditId != null && (
                <p className="text-sm text-muted-foreground">
                  {t("archive:result_transfert_note")}
                </p>
              )}
              {result.anomalies?.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t("archive:anomalies")}</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc ps-5 space-y-1 mt-1">
                      {result.anomalies.map((a, i) => <li key={i} className="text-sm">{a}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button asChild>
                  <Link to={`/dashboard/certificats/${result.certificatId}`}>{t("archive:open_certificat")}</Link>
                </Button>
                {result.demandeCorrectionId != null && (
                  <Button asChild variant="secondary">
                    <Link to={`/dashboard/demandes/${result.demandeCorrectionId}`}>{t("archive:open_demande")}</Link>
                  </Button>
                )}
                <Button variant="outline" onClick={reset}>{t("archive:new_import")}</Button>
              </div>
            </CardContent>
          </Card>
          );
        })()}

        <ArchiveCreateDialog
          kind={createKind}
          initial={createInitial}
          autoriteId={autoriteId ? Number(autoriteId) : null}
          conventionId={conventionId ? Number(conventionId) : null}
          onClose={() => setCreateKind(null)}
          onCreated={handleCreated}
        />
      </div>
  );
};

type Onglet = "unique" | "periode";

/** Reprise d'archive : relevé unitaire ou fichier de période (lots), côte à côte. */
const ArchiveCredits = () => {
  const { t } = useTranslation(["archive", "common"]);
  const [params, setParams] = useSearchParams();
  const onglet: Onglet = params.get("onglet") === "periode" ? "periode" : "unique";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary" />
            {t("archive:title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{onglet === "periode" ? t("archive:lots.subtitle") : t("archive:subtitle")}</p>
        </div>
        <Tabs value={onglet} onValueChange={(v) => setParams(v === "periode" ? { onglet: "periode" } : {}, { replace: true })}>
          <TabsList>
            <TabsTrigger value="unique">{t("archive:tabs.unique")}</TabsTrigger>
            <TabsTrigger value="periode">{t("archive:tabs.periode")}</TabsTrigger>
          </TabsList>
          <TabsContent value="unique" className="mt-6"><ArchiveCreditUnique /></TabsContent>
          <TabsContent value="periode" className="mt-6"><ArchiveLotsTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ArchiveCredits;
