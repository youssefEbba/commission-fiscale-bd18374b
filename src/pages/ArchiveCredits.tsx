import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadRow } from "@/components/ui/upload-row";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Archive, CheckCircle2, ChevronDown, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { formatAmount, formatDate } from "@/i18n/format";
import {
  archiveCreditApi,
  entrepriseApi,
  autoriteContractanteApi,
  marcheApi,
  formatApiErrorMessage,
  type ArchiveCreditPreviewDto,
  type ArchiveCreditImportResultDto,
  type EntrepriseDto,
  type AutoriteContractanteDto,
  type MarcheDto,
} from "@/lib/api";

const money = (v: number | null | undefined) => formatAmount(v ?? 0);

const ArchiveCredits = () => {
  const { t } = useTranslation(["archive", "common"]);
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ArchiveCreditPreviewDto | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ArchiveCreditImportResultDto | null>(null);
  const [confirmAnomalies, setConfirmAnomalies] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [autorites, setAutorites] = useState<AutoriteContractanteDto[]>([]);
  const [marches, setMarches] = useState<MarcheDto[]>([]);

  const [entrepriseId, setEntrepriseId] = useState<string>("");
  const [autoriteId, setAutoriteId] = useState<string>("");
  const [marcheId, setMarcheId] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const [e, a, m] = await Promise.allSettled([
        entrepriseApi.getAll(),
        autoriteContractanteApi.getAll(),
        marcheApi.getAll(),
      ]);
      if (e.status === "fulfilled") setEntreprises(Array.isArray(e.value) ? e.value : []);
      if (a.status === "fulfilled") setAutorites(Array.isArray(a.value) ? a.value : []);
      if (m.status === "fulfilled") setMarches(Array.isArray(m.value) ? m.value : []);
    })();
  }, []);

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
  const marcheOptions = useMemo(
    () =>
      [...marches]
        .sort((x, y) => (x.numeroMarche || "").localeCompare(y.numeroMarche || "", "fr"))
        .map((m) => ({
          value: String(m.id),
          label: m.numeroMarche || `#${m.id}`,
          description: m.intitule || undefined,
        })),
    [marches],
  );

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setConfirmAnomalies(false);
    setEntrepriseId("");
    setAutoriteId("");
    setMarcheId("");
    setExpanded({});
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
    } catch (err) {
      toast({ title: t("common:error", { defaultValue: "Erreur" }), description: formatApiErrorMessage(err, t("archive:error_preview")), variant: "destructive" });
      setFile(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const anomalies = preview?.anomalies ?? [];
  const blocked = !!preview?.certificatDejaImporteId;
  const canImport =
    !!file && !!preview && !blocked && !!entrepriseId && (anomalies.length === 0 || confirmAnomalies);

  const handleImport = async () => {
    if (!file || !entrepriseId) return;
    setImporting(true);
    try {
      const res = await archiveCreditApi.importer({
        fichier: file,
        entrepriseId: Number(entrepriseId),
        autoriteContractanteId: autoriteId ? Number(autoriteId) : undefined,
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

  const SoldeRow = ({ label, declare, calcule }: { label: string; declare: number; calcule: number }) => {
    const ecart = (declare ?? 0) - (calcule ?? 0);
    const hasEcart = Math.abs(ecart) > 0.005;
    return (
      <TableRow>
        <TableCell className="font-medium">{label}</TableCell>
        <TableCell className="text-end">{money(declare)}</TableCell>
        <TableCell className="text-end">{money(calcule)}</TableCell>
        <TableCell className="text-end">
          {hasEcart ? (
            <Badge variant="destructive">{money(ecart)}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{t("archive:no_ecart")}</span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value ?? "—"}</p>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Archive className="h-6 w-6 text-primary" />
              {t("archive:title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("archive:subtitle")}</p>
          </div>
          {(preview || result) && (
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 me-2" />
              {t("archive:reset")}
            </Button>
          )}
        </div>

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
            {blocked && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
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
                    <div className="sm:col-span-2 lg:col-span-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{t("archive:transfert_credit")}</p>
                        <p className="text-sm font-medium break-words">{money(preview.transfertCredit)}</p>
                        <p className="text-xs text-muted-foreground">{t("archive:transfert_credit_hint")}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{t("archive:total_transfert_sortant")}</p>
                        <p className="text-sm font-medium break-words">{money(preview.totalTransfertSortant)}</p>
                      </div>
                    </div>
                    <Info label={t("archive:total_utilisations_douane")} value={money(preview.totalUtilisationsDouane)} />
                    <Info label={t("archive:total_utilisations_interieur")} value={money(preview.totalUtilisationsInterieur)} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">{t("archive:soldes_compare")}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("archive:solde")}</TableHead>
                        <TableHead className="text-end">{t("archive:declare")}</TableHead>
                        <TableHead className="text-end">{t("archive:calcule")}</TableHead>
                        <TableHead className="text-end">{t("archive:ecart")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SoldeRow label={t("archive:solde_douanier")} declare={preview.soldeDouanierDeclare} calcule={preview.soldeDouanierCalcule} />
                      <SoldeRow label={t("archive:solde_interieur")} declare={preview.soldeInterieurDeclare} calcule={preview.soldeInterieurCalcule} />
                    </TableBody>
                  </Table>
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
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>{t("archive:entreprise")} *</Label>
                      <SearchableSelect
                        options={entrepriseOptions}
                        value={entrepriseId}
                        onValueChange={setEntrepriseId}
                        placeholder={t("archive:select_entreprise")}
                        clearable
                      />
                      <p className="text-xs text-muted-foreground">
                        {preview.entrepriseRapprocheeId
                          ? `${t("archive:from_nif")} — ${preview.entrepriseRapprocheeRaisonSociale ?? ""}`
                          : t("archive:no_match_entreprise")}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("archive:autorite")}</Label>
                      <SearchableSelect
                        options={autoriteOptions}
                        value={autoriteId}
                        onValueChange={setAutoriteId}
                        placeholder={t("archive:select_autorite")}
                        clearable
                      />
                      <p className="text-xs text-muted-foreground">
                        {preview.autoriteRapprocheeId
                          ? `${t("archive:from_marche")} — ${preview.autoriteRapprocheeNom ?? ""}`
                          : t("archive:no_match_autorite")}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("archive:marche")}</Label>
                      <SearchableSelect
                        options={marcheOptions}
                        value={marcheId}
                        onValueChange={setMarcheId}
                        placeholder={t("archive:select_marche")}
                        clearable
                      />
                      <p className="text-xs text-muted-foreground">
                        {preview.marcheRapprocheId
                          ? `${t("archive:from_reference")} — ${preview.marcheRapprocheNumero ?? ""}${preview.marcheRapprocheIntitule ? ` · ${preview.marcheRapprocheIntitule}` : ""}`
                          : t("archive:no_match_marche")}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">{t("archive:utilisations")}</h3>
                  {preview.utilisations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("archive:no_utilisations")}</p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8" />
                            <TableHead>{t("archive:date")}</TableHead>
                            <TableHead>{t("archive:libelle")}</TableHead>
                            <TableHead>{t("archive:quittance")}</TableHead>
                            <TableHead>{t("archive:type")}</TableHead>
                            <TableHead className="text-end">{t("archive:montant")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.utilisations.map((u, idx) => {
                            const open = !!expanded[idx];
                            const hasLignes = (u.lignesTaxe?.length ?? 0) > 0;
                            return (
                              <>
                                <TableRow key={`u-${idx}`}>
                                  <TableCell>
                                    {hasLignes && (
                                      <button
                                        type="button"
                                        aria-label={t("archive:detail_taxes")}
                                        onClick={() => setExpanded((p) => ({ ...p, [idx]: !p[idx] }))}
                                        className="rounded p-1 hover:bg-muted"
                                      >
                                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                      </button>
                                    )}
                                  </TableCell>
                                  <TableCell>{u.date ? formatDate(u.date) : "—"}</TableCell>
                                  <TableCell className="font-medium">{u.libelle}</TableCell>
                                  <TableCell>{u.numeroQuittance || "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant={u.douaniere ? "default" : "secondary"}>
                                      {u.douaniere ? t("archive:douane") : t("archive:tva_interieure")}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-end">{money(u.montant)}</TableCell>
                                </TableRow>
                                {open && hasLignes && (
                                  <TableRow key={`d-${idx}`}>
                                    <TableCell colSpan={6} className="bg-muted/40">
                                      <div className="p-2 space-y-2">
                                        <div className="flex gap-6 text-xs text-muted-foreground">
                                          <span>{t("archive:total_pris_en_charge")} : <strong>{money(u.totalPrisEnCharge)}</strong></span>
                                          <span>{t("archive:total_a_payer")} : <strong>{money(u.totalAPayer)}</strong></span>
                                        </div>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>{t("archive:code_taxe")}</TableHead>
                                              <TableHead>{t("archive:denomination")}</TableHead>
                                              <TableHead className="text-end">{t("archive:valeur")}</TableHead>
                                              <TableHead>{t("archive:affectation")}</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {u.lignesTaxe.map((l, li) => (
                                              <TableRow key={li}>
                                                <TableCell className="font-mono text-xs">{l.codeTaxe}</TableCell>
                                                <TableCell>{l.denominationTaxe || "—"}</TableCell>
                                                <TableCell className="text-end">{money(l.valeur)}</TableCell>
                                                <TableCell>
                                                  <Badge variant={l.affectation === "AU_CI" ? "default" : "outline"}>
                                                    {l.affectation === "AU_CI" ? t("archive:au_ci") : t("archive:a_payer")}
                                                  </Badge>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Étape 3 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. {t("archive:step3")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {anomalies.length > 0 && !blocked && (
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
                {!entrepriseId && !blocked && (
                  <p className="text-xs text-muted-foreground">{t("archive:import_disabled_entreprise")}</p>
                )}
                <Button onClick={() => void handleImport()} disabled={!canImport || importing}>
                  {importing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Archive className="h-4 w-4 me-2" />}
                  {importing ? t("archive:importing") : t("archive:import")}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {result && (
          <Card className="border-emerald-300">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                {t("archive:result_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Info label={t("archive:result_certificat")} value={`${result.certificatNumero} (${result.certificatStatut})`} />
                <Info label={t("archive:entreprise")} value={result.entrepriseRaisonSociale} />
                <Info label={t("archive:result_utilisations_douane")} value={result.utilisationsDouanieres} />
                <Info label={t("archive:result_utilisations_interieur")} value={result.utilisationsInterieures} />
                <Info label={t("archive:result_lignes_taxe")} value={result.lignesTaxeCreees} />
                <Info label={t("archive:result_solde_cordon")} value={money(result.soldeCordon)} />
                <Info label={t("archive:result_solde_tva")} value={money(result.soldeTVA)} />
              </div>
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
                <Button variant="outline" onClick={reset}>{t("archive:new_import")}</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ArchiveCredits;
