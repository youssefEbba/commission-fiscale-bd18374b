import { useEffect, useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  reportingApi, ReportingParams, EngagementAxe, EngagementReportDto, EngagementLigneDto, EngagementEnveloppeDto,
  BlocagesReportDto, AFermerReportDto, AFermerCertificatDto,
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

const NS = "reporting:analyses";
const money = (v: number | null | undefined) => (v == null ? "—" : formatAmount(v));
/** Écarts : jamais arrondis à zéro — jusqu'à 4 décimales, signe conservé. */
const ecart = (v: number | null | undefined) =>
  v == null ? "—" : formatAmount(v, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const num = (v: number | null | undefined) => (v == null ? "—" : String(v));

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

function Truncation({ shown, total, truncated }: { shown: number; total?: number | null; truncated?: boolean }) {
  const { t } = useTranslation();
  if (!truncated) return null;
  return (
    <p className="text-sm font-medium text-destructive flex items-center gap-1 mt-2">
      <AlertTriangle className="h-4 w-4" />
      {t(`${NS}.truncated`, { shown, total: total ?? "?" })}
    </p>
  );
}

// ── Engagement ──────────────────────────────────────────────

const AXES: EngagementAxe[] = ["AUTORITE_CONTRACTANTE", "BAILLEUR", "CONVENTION", "ENTREPRISE"];

function EnvCells({ e }: { e?: EngagementEnveloppeDto }) {
  return (<>
    <TableCell className="text-end tabular-nums">{money(e?.accorde)}</TableCell>
    <TableCell className="text-end tabular-nums">{money(e?.consomme)}</TableCell>
    <TableCell className="text-end tabular-nums">{money(e?.restant)}</TableCell>
  </>);
}

function FiabiliteCell({ l }: { l: EngagementLigneDto }) {
  const { t } = useTranslation();
  if (l.fiabilite === "A_VERIFIER") return <Badge variant="destructive">{t(`${NS}.fiabilite.A_VERIFIER`)}</Badge>;
  if (l.fiabilite === "EXPLIQUE") return <Badge variant="outline">{t(`${NS}.fiabilite.EXPLIQUE`)}*</Badge>;
  return null;
}

function EngagementRow({ l, bold }: { l: EngagementLigneDto; bold?: boolean }) {
  return (
    <TableRow className={bold ? "font-semibold bg-muted/40" : undefined}>
      <TableCell>{l.libelle || l.cle}</TableCell>
      <TableCell className="text-end">{num(l.nbCertificats)}</TableCell>
      <EnvCells e={l.droitsTaxesHorsTva} />
      <EnvCells e={l.tvaImport} />
      <EnvCells e={l.tvaInterieure} />
      <TableCell className="text-end tabular-nums">{ecart(l.ecartMouvements)}</TableCell>
      <TableCell className="text-end tabular-nums">{ecart(l.ecartVentilation)}</TableCell>
      <TableCell className="text-end">{num(l.nbRestantSuperieurAccorde)}</TableCell>
      <TableCell><FiabiliteCell l={l} /></TableCell>
    </TableRow>
  );
}

export function EngagementSection({ params }: { params: ReportingParams }) {
  const { t } = useTranslation();
  const [axe, setAxe] = useState<EngagementAxe>("AUTORITE_CONTRACTANTE");
  const { data, loading, error, reload } = useLoad<EngagementReportDto>(() => reportingApi.getEngagement(params, axe), [axe, JSON.stringify(params)]);
  const lignes = data?.lignes ?? [];
  const expliques = [...lignes, ...(data?.total ? [data.total] : [])].filter((l) => l.fiabilite === "EXPLIQUE");
  const nbReprise = data?.total?.nbDossiersRepriseOuCorriges ?? expliques.reduce((s, l) => s + (l.nbDossiersRepriseOuCorriges ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label>{t(`${NS}.engagement.axe`)}</Label>
          <Select value={axe} onValueChange={(v) => setAxe(v as EngagementAxe)}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{AXES.map((a) => <SelectItem key={a} value={a}>{t(`${NS}.engagement.axes.${a}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <State loading={loading} error={error} onRetry={reload}>
        <Card>
          <CardHeader><CardTitle className="text-base">{t(`${NS}.engagement.title`)}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>{t(`${NS}.engagement.axes.${axe}`)}</TableHead>
                  <TableHead rowSpan={2} className="text-end">{t(`${NS}.engagement.nb_certificats`)}</TableHead>
                  <TableHead colSpan={3} className="text-center">{t(`${NS}.engagement.env_hors_tva`)}</TableHead>
                  <TableHead colSpan={3} className="text-center">{t(`${NS}.engagement.env_tva_import`)}</TableHead>
                  <TableHead colSpan={3} className="text-center">{t(`${NS}.engagement.env_tva_int`)}</TableHead>
                  <TableHead rowSpan={2} className="text-end">{t(`${NS}.engagement.ecart_mouvements`)}</TableHead>
                  <TableHead rowSpan={2} className="text-end">{t(`${NS}.engagement.ecart_ventilation`)}</TableHead>
                  <TableHead rowSpan={2} className="text-end">{t(`${NS}.engagement.restant_sup_accorde`)}</TableHead>
                  <TableHead rowSpan={2}>{t(`${NS}.engagement.fiabilite`)}</TableHead>
                </TableRow>
                <TableRow>
                  {[0, 1, 2].map((i) => (
                    <>
                      <TableHead key={`a${i}`} className="text-end">{t(`${NS}.engagement.accorde`)}</TableHead>
                      <TableHead key={`c${i}`} className="text-end">{t(`${NS}.engagement.consomme`)}</TableHead>
                      <TableHead key={`r${i}`} className="text-end">{t(`${NS}.engagement.restant`)}</TableHead>
                    </>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.length === 0 && (
                  <TableRow><TableCell colSpan={16} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>
                )}
                {lignes.map((l) => <EngagementRow key={l.cle} l={l} />)}
                {data?.total && <EngagementRow l={{ ...data.total, libelle: t(`${NS}.engagement.total`) as string }} bold />}
              </TableBody>
            </Table>
            {expliques.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">* {t(`${NS}.engagement.note_explique`, { count: nbReprise })}</p>
            )}
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
  const [seuil, setSeuil] = useState("");
  const [applied, setApplied] = useState<number | undefined>(undefined);
  const { data, loading, error, reload } = useLoad<BlocagesReportDto>(() => reportingApi.getBlocages(params, applied), [applied, JSON.stringify(params)]);
  const bloques = data?.dossiersBloques ?? [];
  const rejets = data?.rejetsTempOuverts ?? [];
  const delais = data?.delaisParDirection ?? [];

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
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t(`${NS}.blocages.rejets_ouverts`)}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{data?.rejetsTempOuvertsTotal ?? rejets.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t(`${NS}.blocages.plus_vieux_rejet`)}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{data?.anciennetePlusVieuxRejetJours != null ? t(`${NS}.days`, { count: data.anciennetePlusVieuxRejetJours }) : "—"}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{t(`${NS}.blocages.rejets_title`)}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t(`${NS}.blocages.dossier`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.direction`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.agent`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.date`)}</TableHead>
                <TableHead className="text-end">{t(`${NS}.blocages.anciennete`)}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rejets.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>}
                {rejets.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.dossierReference || "—"}</TableCell>
                    <TableCell>{r.direction || "—"}</TableCell>
                    <TableCell>{r.agent || "—"}</TableCell>
                    <TableCell>{r.date ? formatDateTime(r.date) : "—"}</TableCell>
                    <TableCell className="text-end">{num(r.ancienneteJours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Truncation shown={rejets.length} total={data?.rejetsTempOuvertsTotal} truncated={data?.rejetsTempOuvertsTronques} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t(`${NS}.blocages.delais_title`)}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t(`${NS}.blocages.direction`)}</TableHead>
                <TableHead className="text-end">{t(`${NS}.blocages.nb_visas`)}</TableHead>
                <TableHead className="text-end" title={data?.definitionDelai ?? undefined}>{data?.definitionDelai || "—"}</TableHead>
                <TableHead className="text-end">{t(`${NS}.blocages.visas_admin`)}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {delais.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>}
                {delais.map((d) => (
                  <TableRow key={d.direction}>
                    <TableCell>{d.direction}</TableCell>
                    <TableCell className="text-end">{num(d.nbVisas)}</TableCell>
                    <TableCell className="text-end tabular-nums">{d.delaiMoyenJours == null ? "—" : formatAmount(d.delaiMoyenJours, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-end">{num(d.nbVisasParAdmin)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-2">{t(`${NS}.blocages.note_visas_admin`)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t(`${NS}.blocages.dossiers_title`)}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t(`${NS}.blocages.dossier`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.type`)}</TableHead>
                <TableHead>{t(`${NS}.blocages.statut`)}</TableHead>
                <TableHead className="text-end" title={data?.definitionAge ?? undefined}>{data?.definitionAge || "—"}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bloques.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>}
                {bloques.map((b, i) => (
                  <TableRow key={`${b.type}-${b.id ?? i}`}>
                    <TableCell>{b.reference || (b.id != null ? `#${b.id}` : "—")}</TableCell>
                    <TableCell>{b.type || "—"}</TableCell>
                    <TableCell>{b.statut || "—"}</TableCell>
                    <TableCell className="text-end">{num(b.ageJours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Truncation shown={bloques.length} total={data?.dossiersBloquesTotal} truncated={data?.dossiersBloquesTronques} />
          </CardContent>
        </Card>
      </State>
    </div>
  );
}

// ── À fermer ────────────────────────────────────────────────

function CertList({ title, rows, total, truncated, defect, extra }: {
  title: string; rows: AFermerCertificatDto[]; total?: number | null; truncated?: boolean; defect?: boolean;
  extra: { head: string; cell: (r: AFermerCertificatDto) => ReactNode };
}) {
  const { t } = useTranslation();
  return (
    <Card className={defect && rows.length > 0 ? "border-destructive/50" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          {defect && rows.length > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
          {title}
        </CardTitle>
        <Badge variant={defect && (total ?? rows.length) > 0 ? "destructive" : "secondary"}>{total ?? rows.length}</Badge>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {defect && <p className="text-sm text-destructive mb-2">{t(`${NS}.a_fermer.sans_date_defaut`)}</p>}
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t(`${NS}.a_fermer.certificat`)}</TableHead>
            <TableHead>{t(`${NS}.a_fermer.entreprise`)}</TableHead>
            <TableHead>{t(`${NS}.blocages.statut`)}</TableHead>
            <TableHead>{extra.head}</TableHead>
            <TableHead>{t(`${NS}.a_fermer.equipements`)}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("reporting:charts.empty")}</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={r.id ?? i}>
                <TableCell>{r.reference || (r.id != null ? `#${r.id}` : "—")}</TableCell>
                <TableCell>{r.entrepriseRaisonSociale || "—"}</TableCell>
                <TableCell>{r.statut || "—"}</TableCell>
                <TableCell>{extra.cell(r)}</TableCell>
                <TableCell>{r.equipementsDeclares == null ? t(`${NS}.a_fermer.equip_non_renseigne`) : r.equipementsDeclares ? t(`${NS}.a_fermer.equip_oui`) : t(`${NS}.a_fermer.equip_non`)}</TableCell>
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
  const [horizon, setHorizon] = useState("");
  const [dormance, setDormance] = useState("");
  const [applied, setApplied] = useState<{ h?: number; d?: number }>({});
  const { data, loading, error, reload } = useLoad<AFermerReportDto>(() => reportingApi.getAFermer(params, applied.h, applied.d), [applied.h, applied.d, JSON.stringify(params)]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label>{t(`${NS}.a_fermer.horizon`)}</Label>
          <Input type="number" min={0} className="w-32" value={horizon} onChange={(e) => setHorizon(e.target.value)} /></div>
        <div className="space-y-1"><Label>{t(`${NS}.a_fermer.dormance`)}</Label>
          <Input type="number" min={0} className="w-32" value={dormance} onChange={(e) => setDormance(e.target.value)} /></div>
        <Button variant="outline" onClick={() => setApplied({ h: horizon ? Number(horizon) : undefined, d: dormance ? Number(dormance) : undefined })}>{t("reporting:filters.apply")}</Button>
      </div>
      <State loading={loading} error={error} onRetry={reload}>
        <Card><CardContent className="p-4 grid gap-2 sm:grid-cols-2 text-sm">
          <p><span className="font-semibold">{t(`${NS}.a_fermer.equip_declares`)} : </span>{num(data?.equipementsDeclares)}</p>
          <p><span className="font-semibold">{t(`${NS}.a_fermer.equip_non_renseignes`)} : </span>{num(data?.equipementsNonRenseignes)}</p>
          <p className="sm:col-span-2 text-muted-foreground">{t(`${NS}.a_fermer.equip_note`)}</p>
        </CardContent></Card>

        <CertList
          title={t(`${NS}.a_fermer.echeance_title`)}
          rows={data?.echeanceProche ?? []} total={data?.echeanceProcheTotal} truncated={data?.echeanceProcheTronques}
          extra={{ head: t(`${NS}.a_fermer.date_validite`), cell: (r) => (r.dateValidite ? formatDate(r.dateValidite) : "—") }}
        />

        <div className="space-y-1">
          <p className="text-sm"><span className="font-semibold">{t(`${NS}.a_fermer.critere_dormance`)} : </span>{data?.definitionDormance || "—"}</p>
          <CertList
            title={t(`${NS}.a_fermer.dormants_title`)}
            rows={data?.dormants ?? []} total={data?.dormantsTotal} truncated={data?.dormantsTronques}
            extra={{ head: t(`${NS}.a_fermer.derniere_activite`), cell: (r) => (r.derniereActivite ? formatDate(r.derniereActivite) : "—") }}
          />
        </div>

        <CertList
          defect
          title={t(`${NS}.a_fermer.sans_date_title`)}
          rows={data?.certificatsSansDateValidite ?? []} total={data?.certificatsSansDateValiditeTotal} truncated={data?.certificatsSansDateValiditeTronques}
          extra={{ head: t(`${NS}.a_fermer.date_validite`), cell: () => "—" }}
        />
      </State>
    </div>
  );
}
