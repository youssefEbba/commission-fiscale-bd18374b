import { Fragment, useEffect, useMemo, useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  reportingApi, ReportingParams, EngagementAxe, EngagementReportDto, EngagementLigneDto,
  BlocagesReportDto, AFermerReportDto, AFermerLigneDto, DelaiDirectionDto,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle } from "lucide-react";
import { formatAmount, formatDate, formatDateTime } from "@/i18n/format";
import { orNA, arrangeLines, formatCivilDate } from "@/lib/reportingValues";

const NS = "reporting:analyses";
type N = number | null | undefined;

/** Formateurs : toute valeur nulle s'affiche « n/a », jamais « 0 ». */
function useFmt() {
  const { t, i18n } = useTranslation();
  const na = t(`${NS}.na`) as string;
  return {
    na,
    money: (v: N) => orNA(v, (n) => formatAmount(n), na),
    /** Écarts : jamais arrondis à zéro — jusqu'à 4 décimales, signe conservé. */
    ecart: (v: N) => orNA(v, (n) => formatAmount(n, { minimumFractionDigits: 2, maximumFractionDigits: 4 }), na),
    num: (v: N) => orNA(v, (n) => String(n), na),
    jours: (v: N) => orNA(v, (n) => formatAmount(n, { currency: "", minimumFractionDigits: 0, maximumFractionDigits: 2 }).trim(), na),
    instant: (s?: string | null) => (s ? formatDate(s) : na),
    instantTime: (s?: string | null) => (s ? formatDateTime(s) : na),
    civil: (s?: string | null) => formatCivilDate(s, i18n.language?.startsWith("ar") ? "ar" : "fr-FR", na),
  };
}

function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setLoading(true); setError(null);
    loader().then(setData).catch((e) => { setError(e?.message || "error"); setData(null); }).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps);
  return { data, loading, error, reload: run };
}

function State({ loading, error, onRetry, children }: { loading: boolean; error: string | null; onRetry: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return (
    <Card className="border-destructive/50"><CardContent className="p-6 text-center space-y-3">
      <p className="text-destructive font-medium">{t("reporting:page.load_error_title")}</p>
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button variant="outline" onClick={onRetry}>{t("reporting:page.retry")}</Button>
    </CardContent></Card>
  );
  return <>{children}</>;
}

function Truncation({ shown, total, truncated }: { shown: number; total?: N; truncated?: boolean }) {
  const { t } = useTranslation();
  if (!truncated && !(total != null && total > shown)) return null;
  return (
    <p className="text-sm font-medium text-destructive flex items-center gap-1 mt-2">
      <AlertTriangle className="h-4 w-4" />
      {t(`${NS}.truncated`, { shown, total: total ?? "?" })}
    </p>
  );
}

const Empty = ({ cols }: { cols: number }) => {
  const { t } = useTranslation();
  return <TableRow><TableCell colSpan={cols} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>;
};

function Stat({ label, value, alert }: { label: string; value: ReactNode; alert?: boolean }) {
  return (
    <Card className={alert ? "border-destructive/50" : undefined}>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><p className={`text-2xl font-bold tabular-nums ${alert ? "text-destructive" : ""}`}>{value}</p></CardContent>
    </Card>
  );
}

const nonZero = (v: N) => v != null && v !== 0;

// ── Engagement ──────────────────────────────────────────────

const AXES: EngagementAxe[] = ["AUTORITE_CONTRACTANTE", "BAILLEUR", "CONVENTION", "ENTREPRISE"];
const ENVS = [
  { key: "env_hors_tva", a: "accordeCordonHorsTva", c: "consommeCordonHorsTva", r: "restantCordonHorsTva" },
  { key: "env_tva_import", a: "accordeTvaImport", c: "consommeTvaImport", r: "restantTvaImport" },
  { key: "env_tva_int", a: "accordeTvaInterieure", c: "consommeTvaInterieure", r: "restantTvaInterieure" },
] as const;
type SortKey = "none" | "libelle" | "accordeTotal" | "restantTotal" | "consommeSoldes";

function FiabiliteCell({ l }: { l: EngagementLigneDto }) {
  const { t } = useTranslation();
  if (l.fiabilite === "A_VERIFIER") return <Badge variant="destructive">{t(`${NS}.fiabilite.A_VERIFIER`)}</Badge>;
  if (l.fiabilite === "EXPLIQUE") return (
    <Badge variant="outline">{t(`${NS}.fiabilite.EXPLIQUE`)} ({t(`${NS}.engagement.nb_reprise`, { count: l.nbDossiersRepriseOuCorriges ?? 0 })})</Badge>
  );
  if (l.fiabilite === "CONFORME") return <span className="text-xs text-muted-foreground">{t(`${NS}.fiabilite.CONFORME`)}</span>;
  return null;
}

function EngagementRow({ l, bold, label }: { l: EngagementLigneDto; bold?: boolean; label?: string }) {
  const f = useFmt();
  return (
    <TableRow className={bold ? "font-semibold bg-muted/40" : undefined}>
      <TableCell>{label ?? (l.libelle || l.cle)}</TableCell>
      <TableCell className="text-end">{f.num(l.nbCertificats)}</TableCell>
      {ENVS.map((e) => (
        <Fragment key={e.key}>
          <TableCell className="text-end tabular-nums">{f.money(l[e.a])}</TableCell>
          <TableCell className="text-end tabular-nums">{f.money(l[e.c])}</TableCell>
          <TableCell className="text-end tabular-nums">{f.money(l[e.r])}</TableCell>
        </Fragment>
      ))}
      <TableCell className="text-end tabular-nums">{f.money(l.accordeTotal)}</TableCell>
      <TableCell className="text-end tabular-nums">{f.money(l.consommeSoldes)}</TableCell>
      <TableCell className="text-end tabular-nums">{f.money(l.restantTotal)}</TableCell>
      <TableCell className={`text-end tabular-nums ${nonZero(l.ecartMouvements) ? "text-destructive font-medium" : ""}`}
        title={l.consommeMouvements != null ? `${f.money(l.consommeMouvements)}` : undefined}>
        {f.ecart(l.ecartMouvements)}
      </TableCell>
      <TableCell><FiabiliteCell l={l} /></TableCell>
    </TableRow>
  );
}

export function EngagementSection({ params }: { params: ReportingParams }) {
  const { t } = useTranslation();
  const f = useFmt();
  const [axe, setAxe] = useState<EngagementAxe>("AUTORITE_CONTRACTANTE");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("none");
  const { data, loading, error, reload } = useLoad<EngagementReportDto>(() => reportingApi.getEngagement(params, axe), [axe, JSON.stringify(params)]);
  const shownAxe = (data?.axe ?? axe) as EngagementAxe;

  const lignes = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return arrangeLines(data?.lignes ?? [], {
      filter: needle ? (l) => `${l.libelle ?? ""} ${l.cle}`.toLowerCase().includes(needle) : undefined,
      compare: sort === "none" ? undefined
        : sort === "libelle" ? (a, b) => (a.libelle ?? a.cle).localeCompare(b.libelle ?? b.cle)
        : (a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity),
    });
  }, [data, q, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>{t(`${NS}.engagement.axe`)}</Label>
          <Select value={axe} onValueChange={(v) => setAxe(v as EngagementAxe)}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{AXES.map((a) => <SelectItem key={a} value={a}>{t(`${NS}.engagement.axes.${a}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t(`${NS}.engagement.filtrer`)}</Label>
          <Input className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{t(`${NS}.engagement.trier`)}</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["none", "libelle", "accordeTotal", "consommeSoldes", "restantTotal"] as SortKey[]).map((s) => (
                <SelectItem key={s} value={s}>{t(`${NS}.engagement.sort.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <State loading={loading} error={error} onRetry={reload}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t(`${NS}.engagement.ecart_ventilation`)} value={f.ecart(data?.ecartVentilation)} alert={nonZero(data?.ecartVentilation)} />
          <Stat label={t(`${NS}.engagement.nb_ecart_ventilation`)} value={f.num(data?.nbEcartVentilation)} alert={nonZero(data?.nbEcartVentilation)} />
          <Stat label={t(`${NS}.engagement.ecart_mouvements`)} value={f.ecart(data?.ecartMouvements)} alert={nonZero(data?.ecartMouvements)} />
          <Stat label={t(`${NS}.engagement.restant_sup_accorde`)} value={f.num(data?.nbRestantSuperieurAccorde)} alert={nonZero(data?.nbRestantSuperieurAccorde)} />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">{t(`${NS}.engagement.title`)} — {t(`${NS}.engagement.axes.${shownAxe}`)}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>{t(`${NS}.engagement.axes.${shownAxe}`)}</TableHead>
                  <TableHead rowSpan={2} className="text-end">{t(`${NS}.engagement.nb_certificats`)}</TableHead>
                  {ENVS.map((e) => <TableHead key={e.key} colSpan={3} className="text-center">{t(`${NS}.engagement.${e.key}`)}</TableHead>)}
                  <TableHead colSpan={3} className="text-center">{t(`${NS}.engagement.env_total`)}</TableHead>
                  <TableHead rowSpan={2} className="text-end">{t(`${NS}.engagement.ecart_mouvements`)}</TableHead>
                  <TableHead rowSpan={2}>{t(`${NS}.engagement.fiabilite`)}</TableHead>
                </TableRow>
                <TableRow>
                  {[0, 1, 2, 3].map((i) => (
                    <Fragment key={i}>
                      <TableHead className="text-end">{t(`${NS}.engagement.accorde`)}</TableHead>
                      <TableHead className="text-end">{t(`${NS}.engagement.consomme`)}</TableHead>
                      <TableHead className="text-end">{t(`${NS}.engagement.restant`)}</TableHead>
                    </Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.length === 0 && <Empty cols={16} />}
                {lignes.map((l) => <EngagementRow key={l.cle} l={l} />)}
                {data?.total && <EngagementRow l={data.total} label={t(`${NS}.engagement.total`) as string} bold />}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-3">{t(`${NS}.engagement.note_controle`)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t(`${NS}.engagement.note_consomme`)}</p>
          </CardContent>
        </Card>
      </State>
    </div>
  );
}

// ── Blocages ────────────────────────────────────────────────

export function BlocagesSection({ params }: { params: ReportingParams }) {
  const { t } = useTranslation();
  const f = useFmt();
  const [seuil, setSeuil] = useState("");
  const [applied, setApplied] = useState<number | undefined>(undefined);
  const { data, loading, error, reload } = useLoad<BlocagesReportDto>(() => reportingApi.getBlocages(params, applied), [applied, JSON.stringify(params)]);
  const immobiles = data?.dossiersImmobiles ?? [];
  const rejets = data?.rejetsTempOuverts ?? [];
  const parCircuit = useMemo(() => {
    const m = new Map<string, DelaiDirectionDto[]>();
    for (const d of data?.delaisParDirection ?? []) {
      const k = d.circuit || "—";
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return [...m.entries()];
  }, [data]);
  const anyRepli = immobiles.some((b) => b.dateDeRepli);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label>{t(`${NS}.blocages.seuil`)}</Label>
          <Input type="number" min={0} className="w-32" value={seuil} onChange={(e) => setSeuil(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => setApplied(seuil ? Number(seuil) : undefined)}>{t("reporting:filters.apply")}</Button>
      </div>
      <State loading={loading} error={error} onRetry={reload}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t(`${NS}.blocages.nb_immobiles`, { seuil: f.num(data?.seuilImmobiliteJours) })} value={f.num(data?.nbDossiersImmobiles)} />
          <Stat label={t(`${NS}.blocages.rejets_ouverts`)} value={f.num(data?.nbRejetsTempOuverts)} />
          <Stat label={t(`${NS}.blocages.plus_vieux_rejet`)} value={data?.anciennetePlusVieuxRejetJours != null ? t(`${NS}.days`, { count: data.anciennetePlusVieuxRejetJours }) : f.na} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{t(`${NS}.blocages.dossiers_title`)}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {data?.definitionAge && <p className="text-sm text-muted-foreground mb-2">{data.definitionAge}</p>}
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t(`${NS}.blocages.dossier`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.type`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.statut`)}</TableHead>
                <TableHead>{t(`${NS}.a_fermer.entreprise`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.date_reference`)}</TableHead>
                <TableHead className="text-end">{t(`${NS}.blocages.jours_depuis`)}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {immobiles.length === 0 && <Empty cols={6} />}
                {immobiles.map((b, i) => (
                  <TableRow key={`${b.type}-${b.id ?? i}`}>
                    <TableCell>{b.reference || (b.id != null ? `#${b.id}` : f.na)}</TableCell>
                    <TableCell>{b.type || f.na}</TableCell>
                    <TableCell>{b.statut || f.na}</TableCell>
                    <TableCell>{b.entrepriseRaisonSociale || f.na}</TableCell>
                    <TableCell className={b.dateDeRepli ? "italic" : undefined}>
                      {f.instantTime(b.dateReference)}{b.dateDeRepli ? " *" : ""}
                    </TableCell>
                    <TableCell className="text-end">{f.num(b.joursDepuisDerniereDecision)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {anyRepli && <p className="text-xs text-muted-foreground mt-2 italic">* {t(`${NS}.blocages.note_repli`)}</p>}
            <Truncation shown={immobiles.length} total={data?.nbDossiersImmobiles} truncated={data?.dossiersImmobilesTronques} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t(`${NS}.blocages.rejets_title`)}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t(`${NS}.blocages.dossier`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.type`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.direction`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.agent`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.date`)}</TableHead>
                <TableHead className="text-end">{t(`${NS}.blocages.anciennete`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.motif`)}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rejets.length === 0 && <Empty cols={7} />}
                {rejets.map((r, i) => (
                  <TableRow key={`${r.type}-${r.dossierId ?? i}-${i}`}>
                    <TableCell>{r.reference || (r.dossierId != null ? `#${r.dossierId}` : f.na)}</TableCell>
                    <TableCell>{r.type || f.na}</TableCell>
                    <TableCell>{r.role || f.na}</TableCell>
                    <TableCell>{r.agentUsername || f.na}</TableCell>
                    <TableCell>{f.instantTime(r.dateDecision)}</TableCell>
                    <TableCell className="text-end">{f.num(r.joursOuvert)}</TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap">{r.motifRejet || f.na}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Truncation shown={rejets.length} total={data?.nbRejetsTempOuverts} truncated={data?.rejetsTempOuvertsTronques} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t(`${NS}.blocages.delais_title`)}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto space-y-4">
            {parCircuit.length === 0 && <p className="text-center text-muted-foreground text-sm">{t("reporting:charts.empty")}</p>}
            {parCircuit.map(([circuit, rows]) => {
              const defs = [...new Set(rows.map((r) => r.definitionDelai).filter(Boolean))];
              return (
                <div key={circuit}>
                  <h4 className="font-semibold text-sm">{t(`${NS}.blocages.circuits.${circuit}`, { defaultValue: circuit })}</h4>
                  {defs.map((d) => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t(`${NS}.blocages.direction`)}</TableHead>
                      <TableHead className="text-end">{t(`${NS}.blocages.nb_visas`)}</TableHead>
                      <TableHead className="text-end">{t(`${NS}.blocages.delai_moyen`)}</TableHead>
                      <TableHead className="text-end">{t(`${NS}.blocages.delai_max`)}</TableHead>
                      <TableHead className="text-end">{t(`${NS}.blocages.visas_admin`)}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {rows.map((d) => (
                        <TableRow key={`${circuit}-${d.role}`}>
                          <TableCell>{d.role}</TableCell>
                          <TableCell className="text-end">{f.num(d.nbVisas)}</TableCell>
                          <TableCell className="text-end tabular-nums">{f.jours(d.delaiMoyenJours)}</TableCell>
                          <TableCell className="text-end tabular-nums">{f.jours(d.delaiMaxJours)}</TableCell>
                          <TableCell className="text-end">{f.num(d.nbVisasParAdmin)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">{t(`${NS}.blocages.note_visas_admin`)}</p>
          </CardContent>
        </Card>
      </State>
    </div>
  );
}

// ── À fermer ────────────────────────────────────────────────

type Col = { head: string; cell: (r: AFermerLigneDto) => ReactNode; end?: boolean };

function LigneList({ title, rows, total, truncated, defect, defectText, cols }: {
  title: string; rows: AFermerLigneDto[]; total?: N; truncated?: boolean; defect?: boolean; defectText?: string; cols: Col[];
}) {
  const { t } = useTranslation();
  const f = useFmt();
  const count = total ?? rows.length;
  const alert = defect && count > 0;
  return (
    <Card className={alert ? "border-destructive/50" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          {alert && <AlertTriangle className="h-4 w-4 text-destructive" />}
          {title}
        </CardTitle>
        <Badge variant={alert ? "destructive" : "secondary"}>{f.num(total ?? rows.length)}</Badge>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {alert && defectText && <p className="text-sm text-destructive mb-2">{defectText}</p>}
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t(`${NS}.a_fermer.reference`)}</TableHead>
            <TableHead>{t(`${NS}.a_fermer.entreprise`)}</TableHead>
            <TableHead>{t(`${NS}.blocages.statut`)}</TableHead>
            {cols.map((c) => <TableHead key={c.head} className={c.end ? "text-end" : undefined}>{c.head}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <Empty cols={3 + cols.length} />}
            {rows.map((r, i) => (
              <TableRow key={`${r.type}-${r.id ?? i}`}>
                <TableCell>{r.reference || (r.id != null ? `#${r.id}` : f.na)}</TableCell>
                <TableCell>{r.entrepriseRaisonSociale || f.na}</TableCell>
                <TableCell>{r.statut || f.na}</TableCell>
                {cols.map((c) => <TableCell key={c.head} className={c.end ? "text-end tabular-nums" : undefined}>{c.cell(r)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Truncation shown={rows.length} total={total} truncated={truncated} />
      </CardContent>
    </Card>
  );
}

export function AFermerSection({ params }: { params: ReportingParams }) {
  const { t } = useTranslation();
  const f = useFmt();
  const [horizon, setHorizon] = useState("");
  const [dormance, setDormance] = useState("");
  const [applied, setApplied] = useState<{ h?: number; d?: number }>({});
  const { data, loading, error, reload } = useLoad<AFermerReportDto>(() => reportingApi.getAFermer(params, applied.h, applied.d), [applied.h, applied.d, JSON.stringify(params)]);

  const L = (k: string) => t(`${NS}.a_fermer.${k}`) as string;
  const cValidite: Col = { head: L("date_validite"), cell: (r) => f.instant(r.dateValidite) };
  const cJours: Col = { head: L("jours_avant"), end: true, cell: (r) => f.num(r.joursAvantEcheance) };
  const cRestant: Col = { head: L("restant"), end: true, cell: (r) => f.money(r.restantTotal) };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label>{L("horizon")}</Label>
          <Input type="number" min={0} className="w-32" value={horizon} onChange={(e) => setHorizon(e.target.value)} /></div>
        <div className="space-y-1"><Label>{L("dormance")}</Label>
          <Input type="number" min={0} className="w-32" value={dormance} onChange={(e) => setDormance(e.target.value)} /></div>
        <Button variant="outline" onClick={() => setApplied({ h: horizon ? Number(horizon) : undefined, d: dormance ? Number(dormance) : undefined })}>{t("reporting:filters.apply")}</Button>
      </div>
      <State loading={loading} error={error} onRetry={reload}>
        <Card><CardContent className="p-4 grid gap-2 sm:grid-cols-2 text-sm">
          <p><span className="font-semibold">{L("horizon")} : </span>{f.num(data?.horizonEcheanceJours)}</p>
          <p><span className="font-semibold">{L("dormance")} : </span>{f.num(data?.seuilDormanceJours)}</p>
          <p><span className="font-semibold">{L("equip_non_renseignes")} : </span>{f.num(data?.equipementsNonRenseignes)}</p>
          <p className="sm:col-span-2 text-muted-foreground">{L("equip_note")}</p>
          {data?.definitionDormance && <p className="sm:col-span-2"><span className="font-semibold">{L("critere_dormance")} : </span>{data.definitionDormance}</p>}
        </CardContent></Card>

        <Stat label={L("montant_immobilise")} value={f.money(data?.montantImmobiliseExpires)} alert={nonZero(data?.montantImmobiliseExpires)} />
        <LigneList title={L("expires_title")} rows={data?.certificatsExpiresAvecSolde ?? []}
          total={data?.nbCertificatsExpiresAvecSolde} truncated={data?.certificatsExpiresTronques}
          cols={[cValidite, cJours, cRestant]} />
        <LigneList title={L("echeance_title")} rows={data?.certificatsExpirantProchainement ?? []}
          total={data?.nbCertificatsExpirantProchainement} cols={[cValidite, cJours, cRestant]} />
        <LigneList title={L("sans_date_title")} defect defectText={L("sans_date_defaut")}
          rows={data?.certificatsSansDateValidite ?? []} total={data?.nbCertificatsSansDateValidite} cols={[cRestant]} />
        <LigneList title={L("conventions_title")} rows={data?.conventionsAEcheance ?? []} total={data?.nbConventionsAEcheance}
          cols={[{ head: L("date_fin"), cell: (r) => f.civil(r.dateFin) }, cJours]} />
        <LigneList title={L("equip_ouvert_title")} rows={data?.equipementsSurCreditOuvert ?? []} total={data?.nbEquipementsSurCreditOuvert}
          cols={[cValidite, cRestant]} />
        <LigneList title={L("dormants_title")} rows={data?.creditsDormants ?? []}
          total={data?.nbCreditsDormants} truncated={data?.creditsDormantsTronques}
          cols={[{ head: L("jours_sans_activite"), end: true, cell: (r) => f.num(r.joursSansActivite) }, cRestant]} />
      </State>
    </div>
  );
}
