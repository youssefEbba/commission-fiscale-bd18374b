import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, ArrowLeft, Ban, CheckCheck, Download, FileSpreadsheet, Hammer, Info, Loader2, Plus, RefreshCw, SearchCheck, Undo2, X,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RowNumberCell, RowNumberHead } from "@/components/ui/row-number";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArchiveCreateDialog, type ArchiveCreateInitial, type ArchiveCreateKind } from "@/components/archive/ArchiveCreateDialog";
import { ArchiveLotCounters, ArchiveLotStatutBadge, SourceBadge } from "@/components/archive/ArchiveLotStatut";
import { ArchiveLotCreditDialog } from "@/components/archive/ArchiveLotCreditDialog";
import { SoldeFormule, StockFormule } from "@/components/archive/ArchiveReleveTables";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useArchiveRefs } from "@/hooks/useArchiveRefs";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useToast } from "@/hooks/use-toast";
import { formatAmount, formatDateTime } from "@/i18n/format";
import {
  archiveLotApi,
  formatApiErrorMessage,
  ARCHIVE_LOT_STATUTS,
  type ArchiveLotAffectationRequest,
  type ArchiveLotCreditDto,
  type ArchiveLotCreditStatut,
  type ArchiveLotDto,
} from "@/lib/api";
import {
  IMPORT_BATCH_SIZE,
  chunk,
  commonValue,
  isDgiUnavailable,
  isSelectable,
  mergeCredits,
  nifsInconnus,
  pretIds,
  soldesDetail,
  type SoldeAxe,
} from "@/lib/archiveLots";
import { isRouteUnavailable } from "@/lib/submission";
import { cn } from "@/lib/utils";

const money = (v: number | null | undefined) => (v == null ? "—" : formatAmount(v));

type Busy = "load" | "dgi" | "rapprocher" | "recalculer" | "import" | "affect" | null;
type CreateTarget = { nif: string } | { creditIds: number[] };

/** Écran d'un lot (fichier de période) : rattachements à compléter puis import des crédits prêts. */
const ArchiveLotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const lotId = Number(id);
  const { t } = useTranslation(["archive", "common"]);
  const { toast } = useToast();
  const { user } = useAuth();
  const smartBack = useSmartBack("/dashboard/archive/credits?onglet=periode");
  const refs = useArchiveRefs(user);

  const [lot, setLot] = useState<ArchiveLotDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>("load");
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [dgiMessage, setDgiMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<{ importes: number; erreurs: number; nonPrets: number; interrompu?: string } | null>(null);
  const [confirmImport, setConfirmImport] = useState<number[] | null>(null);

  const [filtre, setFiltre] = useState<ArchiveLotCreditStatut | "ALL">("ALL");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [barAutorite, setBarAutorite] = useState("");
  const [barConvention, setBarConvention] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const [createKind, setCreateKind] = useState<ArchiveCreateKind | null>(null);
  const [createInitial, setCreateInitial] = useState<ArchiveCreateInitial>({});
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);

  // Le dernier lot connu sert de repli quand une réponse arrive sans ses crédits.
  const lotRef = useRef<ArchiveLotDto | null>(null);
  lotRef.current = lot;

  const applyLot = useCallback((next: ArchiveLotDto) => {
    setLot((cur) => (next.credits ? next : { ...next, credits: cur?.credits ?? null }));
  }, []);

  const reload = useCallback(async () => {
    const next = await archiveLotApi.getById(lotId);
    setLot(next);
    return next;
  }, [lotId]);

  useEffect(() => {
    if (!Number.isFinite(lotId)) return;
    setBusy("load");
    setLoadError(null);
    reload()
      .catch((e) => setLoadError(isRouteUnavailable(e) ? t("archive:lots.unavailable") : formatApiErrorMessage(e, t("archive:lots.error_load"))))
      .finally(() => setBusy(null));
  }, [lotId, reload, t]);

  const credits = useMemo(() => [...(lot?.credits ?? [])].sort((a, b) => a.ordre - b.ordre), [lot]);
  const visibles = useMemo(() => (filtre === "ALL" ? credits : credits.filter((c) => c.statut === filtre)), [credits, filtre]);
  const nifs = useMemo(() => nifsInconnus(credits), [credits]);
  const selection = useMemo(() => credits.filter((c) => selected.has(c.id)), [credits, selected]);
  const selectionPrete = useMemo(() => selection.filter((c) => c.statut === "PRET").map((c) => c.id), [selection]);

  // Une sélection ne garde que des crédits encore modifiables.
  useEffect(() => {
    setSelected((cur) => {
      const ok = new Set(credits.filter(isSelectable).map((c) => c.id));
      const next = new Set([...cur].filter((x) => ok.has(x)));
      return next.size === cur.size ? cur : next;
    });
  }, [credits]);

  useEffect(() => {
    if (selected.size === 0) { setBarAutorite(""); setBarConvention(""); }
  }, [selected.size]);

  // Listes filtrées : autorité/convention choisies dans la barre, sinon valeur commune de la sélection.
  const effAutorite = barAutorite || (commonValue(selection, "autoriteContractanteId") != null ? String(commonValue(selection, "autoriteContractanteId")) : "");
  const effConvention = barConvention || (commonValue(selection, "conventionId") != null ? String(commonValue(selection, "conventionId")) : "");

  const entrepriseOptions = useMemo(() => [...refs.entreprises]
    .sort((x, y) => (x.raisonSociale || "").localeCompare(y.raisonSociale || "", "fr"))
    .map((e) => ({ value: String(e.id), label: e.raisonSociale || `#${e.id}`, description: e.nif ? `NIF ${e.nif}` : undefined, keywords: e.nif || undefined })),
  [refs.entreprises]);
  const autoriteOptions = useMemo(() => [...refs.autorites]
    .sort((x, y) => (x.nom || "").localeCompare(y.nom || "", "fr"))
    .map((a) => ({ value: String(a.id), label: a.nom || `#${a.id}`, description: a.sigle || undefined })),
  [refs.autorites]);
  const conventionOptions = useMemo(() => {
    const scoped = refs.conventions.filter((c) => !effAutorite || String(c.autoriteContractanteId ?? "") === effAutorite);
    // Aucune convention connue pour l'autorité : toute la liste reste proposée.
    return (scoped.length ? scoped : refs.conventions)
      .slice()
      .sort((x, y) => (x.reference || "").localeCompare(y.reference || "", "fr"))
      .map((c) => ({ value: String(c.id), label: c.reference || `#${c.id}`, description: c.intitule || undefined }));
  }, [refs.conventions, effAutorite]);
  const marcheOptions = useMemo(() => {
    const scoped = refs.marches.filter((m) => !effConvention || String(m.conventionId ?? "") === effConvention || (m.conventionIds ?? []).map(String).includes(effConvention));
    return (scoped.length ? scoped : refs.marches)
      .slice()
      .sort((x, y) => (x.numeroMarche || "").localeCompare(y.numeroMarche || "", "fr"))
      .map((m) => ({ value: String(m.id), label: m.numeroMarche || `#${m.id}`, description: m.intitule || undefined }));
  }, [refs.marches, effConvention]);

  const working = busy !== null;

  const affect = async (body: Omit<ArchiveLotAffectationRequest, "creditIds" | "nif">, target: CreateTarget) => {
    if (!lot) return;
    setBusy("affect");
    setActionError(null);
    try {
      const next = await archiveLotApi.affecter(lot.id, { ...target, ...body });
      if (next.credits) setLot(next); else await reload();
    } catch (e) {
      setActionError(formatApiErrorMessage(e, t("archive:lots.error_affect")));
    } finally {
      setBusy(null);
    }
  };
  const affectSelection = (body: Omit<ArchiveLotAffectationRequest, "creditIds" | "nif">) => affect(body, { creditIds: [...selected] });

  const runDgi = async () => {
    const start = lotRef.current;
    if (!start || start.nifsAInterrogerDgi <= 0) return;
    setBusy("dgi");
    setDgiMessage(null);
    setActionError(null);
    const total = start.nifsAInterrogerDgi;
    let restant = total;
    setProgress({ label: t("archive:lots.dgi_progress"), done: 0, total });
    try {
      while (restant > 0) {
        let next: ArchiveLotDto;
        try {
          next = await archiveLotApi.interrogerDgi(start.id);
        } catch (e) {
          if (isDgiUnavailable(e)) setDgiMessage(formatApiErrorMessage(e, t("archive:dgi.indisponible")));
          else setActionError(formatApiErrorMessage(e, t("archive:lots.error_dgi")));
          break;
        }
        applyLot(next);
        // Garde-fou : un appel qui n'avance plus arrête la boucle.
        if (next.nifsAInterrogerDgi >= restant) { restant = next.nifsAInterrogerDgi; break; }
        restant = next.nifsAInterrogerDgi;
        setProgress({ label: t("archive:lots.dgi_progress"), done: total - restant, total });
      }
      await reload().catch(() => undefined);
    } finally {
      setProgress(null);
      setBusy(null);
    }
  };

  /**
   * Crédits importés avant la ventilation du crédit douanier (03/11/2026) : leurs composantes
   * (b, c, d, TVA restante) se recalculent à partir du relevé, une fois le fichier redéposé.
   */
  const runRecalculer = async () => {
    if (!lot) return;
    setBusy("recalculer");
    setActionError(null);
    try {
      const r = await archiveLotApi.recalculer(lot.id);
      await reload();
      toast({ title: t("archive:lots.recalcul_ok", { count: r.importes }), description: r.erreurs > 0 ? t("archive:lots.recalcul_erreurs", { count: r.erreurs }) : undefined });
    } catch (e) {
      setActionError(formatApiErrorMessage(e, t("archive:lots.error_recalculer")));
    } finally {
      setBusy(null);
    }
  };

  const runRapprocher = async () => {
    if (!lot) return;
    setBusy("rapprocher");
    setActionError(null);
    try {
      // Des entreprises ou marchés ont pu être créés ailleurs : listes relues.
      await Promise.allSettled([refs.reload("entreprise"), refs.reload("autorite"), refs.reload("convention"), refs.reload("marche")]);
      const next = await archiveLotApi.rapprocher(lot.id);
      if (next.credits) setLot(next); else await reload();
      toast({ title: t("archive:lots.rapproche_ok") });
    } catch (e) {
      setActionError(formatApiErrorMessage(e, t("archive:lots.error_rapprocher")));
    } finally {
      setBusy(null);
    }
  };

  const runImport = async (ids: number[]) => {
    if (!lot || !ids.length) return;
    setConfirmImport(null);
    setBusy("import");
    setActionError(null);
    setImportReport(null);
    const acc = { importes: 0, erreurs: 0, nonPrets: 0, interrompu: undefined as string | undefined };
    const batches = chunk(ids, IMPORT_BATCH_SIZE);
    let done = 0;
    setProgress({ label: t("archive:lots.import_progress"), done: 0, total: ids.length });
    try {
      for (const batch of batches) {
        try {
          const r = await archiveLotApi.importer(lot.id, batch);
          acc.importes += r.importes ?? 0;
          acc.erreurs += r.erreurs ?? 0;
          acc.nonPrets += r.nonPrets ?? 0;
          setLot((cur) => (cur ? mergeCredits(cur, r.credits ?? []) : cur));
        } catch (e) {
          // Les lots déjà envoyés restent importés (une transaction par crédit côté serveur).
          acc.interrompu = formatApiErrorMessage(e, t("archive:lots.error_import"));
          break;
        }
        done += batch.length;
        setProgress({ label: t("archive:lots.import_progress"), done, total: ids.length });
      }
      await reload().catch(() => undefined);
      setImportReport(acc);
      setSelected(new Set());
    } finally {
      setProgress(null);
      setBusy(null);
    }
  };

  const openCreate = (kind: ArchiveCreateKind, target: CreateTarget, initial: ArchiveCreateInitial = {}) => {
    setCreateTarget(target);
    setCreateInitial(initial);
    setCreateKind(kind);
  };

  const openCreateMarche = () => {
    const c = selection[0];
    openCreate("marche", { creditIds: [...selected] }, c ? {
      numeroMarche: c.numeroMarche || c.referenceMarche || "",
      montantContratHt: c.montantMarche != null ? String(c.montantMarche) : "",
      dateSignature: c.dateMarche ? c.dateMarche.slice(0, 10) : "",
      dureeExecution: c.dureeMarche || "",
    } : {});
  };

  const handleCreated = async (kind: ArchiveCreateKind, createdId: number) => {
    await refs.reload(kind);
    if (!createTarget) return;
    if (kind === "entreprise") await affect({ entrepriseId: createdId }, createTarget);
    else if (kind === "autorite") { setBarAutorite(String(createdId)); setBarConvention(""); await affect({ autoriteContractanteId: createdId }, createTarget); }
    else if (kind === "convention") { setBarConvention(String(createdId)); await affect({ conventionId: createdId }, createTarget); }
    else await affect({ marcheId: createdId }, createTarget);
  };

  const toggle = (creditId: number, on: boolean) => setSelected((cur) => {
    const next = new Set(cur);
    if (on) next.add(creditId); else next.delete(creditId);
    return next;
  });
  const visiblesSelectables = visibles.filter(isSelectable);
  const allChecked = visiblesSelectables.length > 0 && visiblesSelectables.every((c) => selected.has(c.id));
  const someChecked = visiblesSelectables.some((c) => selected.has(c.id));
  const toggleAll = (on: boolean) => setSelected((cur) => {
    const next = new Set(cur);
    for (const c of visiblesSelectables) { if (on) next.add(c.id); else next.delete(c.id); }
    return next;
  });

  const prets = pretIds(credits);

  if (busy === "load" && !lot) {
    return <DashboardLayout><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }
  if (!lot) {
    return (
      <DashboardLayout>
        <Card><CardContent className="p-8 text-center space-y-3">
          <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{loadError ?? t("archive:lots.error_load")}</p>
          <Button variant="outline" onClick={smartBack}><ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />{t("common:actions.back")}</Button>
        </CardContent></Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={smartBack} aria-label={t("common:actions.back")}><ArrowLeft className="h-5 w-5 rtl:rotate-180" /></Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2 break-all">
              <FileSpreadsheet className="h-6 w-6 text-primary shrink-0" />{lot.nomFichier}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("archive:lots.analyse_le", { date: formatDateTime(lot.dateAnalyse), par: lot.analyseParNom || "—" })}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div><p className="text-xs text-muted-foreground">{t("archive:lots.col_credits")}</p><p className="text-lg font-semibold tabular-nums">{lot.nbCredits}</p></div>
            <div><p className="text-xs text-muted-foreground">{t("archive:lots.col_nifs")}</p><p className="text-lg font-semibold tabular-nums">{lot.nifsSansEntreprise}</p></div>
            <div><p className="text-xs text-muted-foreground">{t("archive:lots.nifs_dgi")}</p><p className="text-lg font-semibold tabular-nums">{lot.nifsAInterrogerDgi}</p></div>
            <div className="flex-1 min-w-[12rem]"><ArchiveLotCounters parStatut={lot.parStatut} /></div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void runDgi()} disabled={working || lot.nifsAInterrogerDgi <= 0}>
            {busy === "dgi" ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <SearchCheck className="h-4 w-4 me-2" />}
            {t("archive:lots.interroger_dgi")}
          </Button>
          <Button variant="outline" onClick={() => void runRapprocher()} disabled={working}>
            {busy === "rapprocher" ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <RefreshCw className="h-4 w-4 me-2" />}
            {t("archive:lots.rapprocher")}
          </Button>
          {(lot.parStatut?.IMPORTE ?? 0) > 0 && (
            <Button variant="outline" onClick={() => void runRecalculer()} disabled={working} title={t("archive:lots.recalculer_aide")}>
              {busy === "recalculer" ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <RefreshCw className="h-4 w-4 me-2" />}
              {t("archive:lots.recalculer", { count: lot.parStatut?.IMPORTE ?? 0 })}
            </Button>
          )}
          <Button onClick={() => setConfirmImport(prets)} disabled={working || prets.length === 0}>
            {busy === "import" ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
            {t("archive:lots.importer_prets", { count: prets.length })}
          </Button>
        </div>

        {progress && (
          <div className="space-y-1" role="status">
            <div className="flex justify-between text-sm"><span>{progress.label}</span><span className="tabular-nums">{progress.done} / {progress.total}</span></div>
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
          </div>
        )}
        {dgiMessage && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t("archive:dgi.indisponible")}</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{dgiMessage}</AlertDescription>
          </Alert>
        )}
        {actionError && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{actionError}</p>}
        {importReport && (
          <Alert variant={importReport.erreurs || importReport.interrompu ? "destructive" : "default"}>
            <CheckCheck className="h-4 w-4" />
            <AlertTitle>{t("archive:lots.rapport_titre")}</AlertTitle>
            <AlertDescription>
              {t("archive:lots.rapport", importReport)}
              {importReport.interrompu && <p className="mt-1 whitespace-pre-wrap">{t("archive:lots.rapport_interrompu")} {importReport.interrompu}</p>}
            </AlertDescription>
          </Alert>
        )}

        {/* NIF inconnus */}
        {nifs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("archive:lots.nifs_titre", { count: nifs.length })}</CardTitle>
              <CardDescription>{t("archive:lots.nifs_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("archive:nif")}</TableHead>
                      <TableHead className="text-end">{t("archive:lots.col_credits")}</TableHead>
                      <TableHead>{t("archive:lots.nom_dgi")}</TableHead>
                      <TableHead className="min-w-[16rem]">{t("archive:lots.choisir_entreprise")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nifs.map((n) => (
                      <TableRow key={n.nif}>
                        <TableCell className="font-mono">{n.nif}</TableCell>
                        <TableCell className="text-end tabular-nums">{n.nbCredits}</TableCell>
                        <TableCell>
                          {n.raisonSocialeDgi ? (
                            <div>
                              <p className="font-medium">{n.raisonSocialeDgi}</p>
                              {(n.nomCommercialDgi || n.etatDgi) && (
                                <p className="text-xs text-muted-foreground">{[n.nomCommercialDgi, n.etatDgi].filter(Boolean).join(" · ")}</p>
                              )}
                            </div>
                          ) : n.inconnuDgi ? (
                            <span className="text-sm text-amber-700 dark:text-amber-300">{t("archive:lots.inconnu_dgi")}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">{t("archive:lots.non_interroge")}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SearchableSelect
                            options={entrepriseOptions}
                            value=""
                            onValueChange={(v) => v && void affect({ entrepriseId: Number(v) }, { nif: n.nif })}
                            placeholder={t("archive:select_entreprise")}
                            loading={refs.loading.entreprise}
                            disabled={working}
                          />
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            variant="outline" size="sm" disabled={working}
                            onClick={() => openCreate("entreprise", { nif: n.nif }, { nif: n.nif, raisonSociale: n.raisonSocialeDgi ?? "", nomCommercial: n.nomCommercialDgi ?? "" })}
                          >
                            <Plus className="h-4 w-4 me-1" />{t("archive:create")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Crédits — min-w-0 : le tableau défile dans la carte au lieu de sortir de l'écran (A51). */}
        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">{t("archive:lots.credits_titre")}</CardTitle>
            <Select value={filtre} onValueChange={(v) => setFiltre(v as ArchiveLotCreditStatut | "ALL")}>
              <SelectTrigger className="w-56" aria-label={t("archive:lots.filtre_statut")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("archive:lots.tous_statuts")}</SelectItem>
                {ARCHIVE_LOT_STATUTS.map((s) => (
                  <SelectItem key={s} value={s}>{t(`archive:lots.statut.${s}`)} ({lot.parStatut?.[s] ?? 0})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected.size > 0 && (
              <div className="sticky top-0 z-10 rounded-md border bg-card p-3 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{t("archive:lots.selection", { count: selected.size })}</p>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}><X className="h-4 w-4 me-1" />{t("archive:lots.deselectionner")}</Button>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="flex gap-1">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        options={autoriteOptions}
                        value={barAutorite}
                        onValueChange={(v) => { setBarAutorite(v); setBarConvention(""); if (v) void affectSelection({ autoriteContractanteId: Number(v) }); }}
                        placeholder={t("archive:lots.choisir_autorite")}
                        loading={refs.loading.autorite}
                        disabled={working}
                      />
                    </div>
                    <Button variant="outline" size="icon" disabled={working} onClick={() => openCreate("autorite", { creditIds: [...selected] })} title={t("archive:create_autorite")} aria-label={t("archive:create_autorite")}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        options={conventionOptions}
                        value={barConvention}
                        onValueChange={(v) => { setBarConvention(v); if (v) void affectSelection({ conventionId: Number(v) }); }}
                        placeholder={t("archive:lots.choisir_convention")}
                        loading={refs.loading.convention}
                        disabled={working}
                      />
                    </div>
                    <Button variant="outline" size="icon" disabled={working || !effAutorite} onClick={() => openCreate("convention", { creditIds: [...selected] })} title={effAutorite ? t("archive:create_convention") : t("archive:convention_requires_autorite")} aria-label={t("archive:create_convention")}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        options={marcheOptions}
                        value=""
                        onValueChange={(v) => v && void affectSelection({ marcheId: Number(v) })}
                        placeholder={t("archive:lots.choisir_marche")}
                        loading={refs.loading.marche}
                        disabled={working}
                      />
                    </div>
                    <Button variant="outline" size="icon" disabled={working || !effConvention} onClick={openCreateMarche} title={effConvention ? t("archive:create_marche") : t("archive:marche_requires_convention")} aria-label={t("archive:create_marche")}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={working} onClick={() => void affectSelection({ creerMarche: true })}><Hammer className="h-4 w-4 me-1" />{t("archive:lots.creer_marche_releve")}</Button>
                  <Button variant="outline" size="sm" disabled={working} onClick={() => void affectSelection({ confirmerMalgreAnomalies: true })}><CheckCheck className="h-4 w-4 me-1" />{t("archive:lots.confirmer_anomalies")}</Button>
                  <Button variant="outline" size="sm" disabled={working} onClick={() => void affectSelection({ ignorer: true })}><Ban className="h-4 w-4 me-1" />{t("archive:lots.ignorer")}</Button>
                  <Button variant="outline" size="sm" disabled={working} onClick={() => void affectSelection({ ignorer: false })}><Undo2 className="h-4 w-4 me-1" />{t("archive:lots.reintegrer")}</Button>
                  <Button size="sm" disabled={working || selectionPrete.length === 0} onClick={() => setConfirmImport(selectionPrete)}>
                    <Download className="h-4 w-4 me-1" />{t("archive:lots.importer_selection", { count: selectionPrete.length })}
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <RowNumberHead />
                    <TableHead className="w-8">
                      <Checkbox
                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                        onCheckedChange={(v) => toggleAll(v === true)}
                        disabled={visiblesSelectables.length === 0 || working}
                        aria-label={t("archive:lots.tout_selectionner")}
                      />
                    </TableHead>
                    <TableHead>{t("archive:numero_credit")}</TableHead>
                    <TableHead>{t("archive:nif")}</TableHead>
                    <TableHead>{t("archive:entreprise")}</TableHead>
                    <TableHead>{t("archive:autorite")}</TableHead>
                    <TableHead>{t("archive:convention")}</TableHead>
                    <TableHead>{t("archive:marche")}</TableHead>
                    <TableHead className="text-end">{t("archive:montant_credit_impot")}</TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        {t("archive:lots.col_soldes")}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("archive:soldes.regle")}><Info className="h-3.5 w-3.5" /></button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs font-normal">{t("archive:soldes.regle")}</TooltipContent>
                        </Tooltip>
                      </span>
                    </TableHead>
                    <TableHead className="text-end">{t("archive:lots.col_anomalies")}</TableHead>
                    <TableHead>{t("archive:lots.col_statut")}</TableHead>
                    <TableHead>{t("archive:lots.col_manquants")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.length === 0 ? (
                    <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">{t("archive:lots.aucun_credit")}</TableCell></TableRow>
                  ) : visibles.map((c, i) => (
                    <CreditRow
                      key={c.id}
                      n={i + 1}
                      credit={c}
                      checked={selected.has(c.id)}
                      disabled={working || !isSelectable(c)}
                      onCheck={(on) => toggle(c.id, on)}
                      onOpen={() => setDetailId(c.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ArchiveLotCreditDialog lotId={lot.id} creditId={detailId} onClose={() => setDetailId(null)} onSaved={() => reload().catch(() => undefined)} />

      <ArchiveCreateDialog
        kind={createKind}
        initial={createInitial}
        autoriteId={effAutorite ? Number(effAutorite) : null}
        conventionId={effConvention ? Number(effConvention) : null}
        onClose={() => setCreateKind(null)}
        onCreated={handleCreated}
      />

      <AlertDialog open={confirmImport !== null} onOpenChange={(o) => !o && setConfirmImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("archive:lots.confirm_import_titre")}</AlertDialogTitle>
            <AlertDialogDescription>{t("archive:lots.confirm_import_desc", { count: confirmImport?.length ?? 0 })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmImport && void runImport(confirmImport)}>{t("archive:lots.importer")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

/**
 * Libellé long sur une seule ligne, coupé avec « … » et lisible en entier au survol (A51) : les noms
 * d'autorité ou de convention étiraient les lignes du tableau sur une dizaine de lignes.
 */
function Tronque({ texte, attenue, children }: { texte?: string | null; attenue?: boolean; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-1 max-w-[14rem]">
      <span className={cn("truncate", attenue && "text-muted-foreground")} title={texte ?? undefined}>{texte || "—"}</span>
      {children}
    </div>
  );
}

function SoldeLine({ label, axe: a }: { label: string; axe: SoldeAxe }) {
  const alerte = a.ecart != null || a.negatif;
  return (
    <p className={cn("whitespace-nowrap tabular-nums", alerte && "text-amber-700 dark:text-amber-300 font-medium")}>
      <span className="text-muted-foreground">{label}</span> {money(a.calcule)} / {money(a.fichier)}
    </p>
  );
}

/** Soldes d'un crédit : calculé / fichier, et le calcul détaillé au survol ou au clic. */
function SoldesCell({ credit }: { credit: ArchiveLotCreditDto }) {
  const { t } = useTranslation("archive");
  const d = soldesDetail(credit);
  const ecart = d.douanier.ecart != null || d.interieur.ecart != null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-start rounded px-1 -mx-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("soldes.voir_calcul")}>
          <SoldeLine label={t("lots.solde_d")} axe={d.douanier} />
          <SoldeLine label={t("lots.solde_i")} axe={d.interieur} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(36rem,calc(100vw-2rem))] space-y-2" align="start">
        <SoldeFormule type="douanier" axe={d.douanier} />
        <SoldeFormule type="interieur" axe={d.interieur} />
        <StockFormule stock={d.stock} />
        {ecart && <p className="text-xs text-amber-700 dark:text-amber-300">{t("soldes.ecart_note")}</p>}
      </PopoverContent>
    </Popover>
  );
}

function CreditRow({ n, credit: c, checked, disabled, onCheck, onOpen }: {
  n: number;
  credit: ArchiveLotCreditDto;
  checked: boolean;
  disabled: boolean;
  onCheck: (on: boolean) => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation("archive");
  return (
    <TableRow data-state={checked ? "selected" : undefined}>
      <RowNumberCell n={n} />
      <TableCell>
        <Checkbox checked={checked} onCheckedChange={(v) => onCheck(v === true)} disabled={disabled} aria-label={t("lots.selectionner", { numero: c.numeroCredit ?? c.ordre })} />
      </TableCell>
      <TableCell>
        <button type="button" onClick={onOpen} className="font-medium text-primary hover:underline text-start">{c.numeroCredit || t("lots.numero_a_saisir")}</button>
        <p className="text-[11px] text-muted-foreground">{t("lots.lignes", { debut: c.ligneDebut, fin: c.ligneFin })}</p>
      </TableCell>
      <TableCell className="font-mono text-xs">{c.nif || "—"}</TableCell>
      <TableCell>
        {c.entrepriseId != null ? <Tronque texte={c.entrepriseRaisonSociale}><SourceBadge source={c.sourceEntreprise} /></Tronque> : <Tronque texte={c.raisonSocialeDgi ? t("lots.dgi_suggere", { nom: c.raisonSocialeDgi }) : "—"} attenue />}
      </TableCell>
      <TableCell>{c.autoriteContractanteId != null ? <Tronque texte={c.autoriteContractanteNom}><SourceBadge source={c.sourceAutorite} /></Tronque> : "—"}</TableCell>
      <TableCell>{c.conventionId != null ? <Tronque texte={c.conventionIntitule}><SourceBadge source={c.sourceConvention} /></Tronque> : "—"}</TableCell>
      <TableCell>
        {c.marcheId != null ? <Tronque texte={c.marcheNumero}><SourceBadge source={c.sourceMarche} /></Tronque>
          : c.creerMarche ? <span className="text-muted-foreground italic">{t("lots.marche_cree_releve")}</span>
          : c.dejaRepris ? <span className="text-muted-foreground">{t("lots.deja_repris")}</span>
          : "—"}
      </TableCell>
      <TableCell className="text-end tabular-nums whitespace-nowrap">{money(c.montantCreditImpot)}</TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        <SoldesCell credit={c} />
      </TableCell>
      <TableCell className="text-end">
        {c.anomalies?.length ? (
          <Badge variant={c.confirmerMalgreAnomalies ? "secondary" : "destructive"} title={c.confirmerMalgreAnomalies ? t("lots.anomalies_confirmees") : undefined}>{c.anomalies.length}</Badge>
        ) : <span className="text-muted-foreground">0</span>}
      </TableCell>
      <TableCell><ArchiveLotStatutBadge statut={c.statut} /></TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {(c.manquants ?? []).map((m) => <Badge key={m} variant="outline" className="text-[10px] font-normal">{t(`lots.manquant.${m}`)}</Badge>)}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default ArchiveLotDetail;
