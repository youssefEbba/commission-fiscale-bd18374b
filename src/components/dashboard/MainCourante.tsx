import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Info, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { mainCouranteApi, MainCouranteDto, MainCouranteLigneDto, MainCouranteNonCouvert, formatApiErrorMessage } from "@/lib/api";

const hrefFor = (l: MainCouranteLigneDto): string => {
  if (l.type === "DemandeCorrection") return `/dashboard/demandes/${l.id}`;
  if (l.type === "TransfertCredit") return `/dashboard/transferts/${l.id}`;
  if (l.type === "CertificatCredit") {
    if (l.processus === "MISE_EN_PLACE") return `/dashboard/mise-en-place/${l.id}`;
    if (l.processus === "CLOTURE") return `/dashboard/cloture`;
    return `/dashboard/certificats/${l.id}`;
  }
  if (l.type === "UtilisationCredit") return `/dashboard/utilisations/${l.id}`;
  if (l.type === "DemandeRattachement") return `/dashboard/demandes-rattachement/${l.id}`;
  if (l.type === "DemandeResetPassword") return `/dashboard/utilisateurs`;
  return "/dashboard";
};

const nonCouvertText = (n: MainCouranteNonCouvert) =>
  typeof n === "string" ? { proc: undefined, text: n } : { proc: n.processus, text: n.raison ?? n.message ?? "" };

const MainCourante = () => {
  const { t } = useTranslation("dashboard");
  const [data, setData] = useState<MainCouranteDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltreState] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const setFiltre = (f: string | null) => { setFiltreState(f); setPage(0); };

  useEffect(() => {
    mainCouranteApi.get()
      .then(setData)
      .catch((err) => setError(formatApiErrorMessage(err, t("main_courante.load_error"))));
  }, []);

  const tp = (p: string) => t(`main_courante.processus.${p}`, { defaultValue: p });
  const tabs = data ? Object.entries(data.parProcessus ?? {}).filter(([, n]) => n > 0) : [];
  const lignes = data ? (filtre ? data.lignes.filter((l) => l.processus === filtre) : data.lignes) : [];
  const pageCount = Math.max(1, Math.ceil(lignes.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const pageLignes = lignes.slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between gap-2 flex-wrap">
          <span>{t("main_courante.title")}</span>
          {data && <Badge variant="secondary">{t("main_courante.total", { count: data.total })}</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("main_courante.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data && !error && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && data.processusNonCouverts?.length > 0 && (
          <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm space-y-1">
            <p className="font-medium flex items-center gap-2"><Info className="h-4 w-4" />{t("main_courante.non_couverts")}</p>
            <ul className="list-disc ps-6 space-y-0.5">
              {data.processusNonCouverts.map((n, i) => {
                const { proc, text } = nonCouvertText(n);
                return <li key={i}>{proc && <strong>{tp(proc)} : </strong>}{text}</li>;
              })}
            </ul>
          </div>
        )}

        {data && data.lignes.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-foreground">{t("main_courante.empty")}</p>
          </div>
        )}

        {data && data.lignes.length > 0 && (
          <>
            {tabs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={filtre === null ? "default" : "outline"} onClick={() => setFiltre(null)}>
                  {t("main_courante.all")} <Badge variant="secondary" className="ms-2">{data.total}</Badge>
                </Button>
                {tabs.map(([p, n]) => (
                  <Button key={p} size="sm" variant={filtre === p ? "default" : "outline"} onClick={() => setFiltre(p)}>
                    {tp(p)} <Badge variant="secondary" className="ms-2">{n}</Badge>
                  </Button>
                ))}
              </div>
            )}
            {data.tronquee && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{t("main_courante.tronquee", { shown: data.lignes.length, total: data.total })}
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">N°</TableHead>
                  <TableHead>{t("main_courante.col_action")}</TableHead>
                  <TableHead>{t("main_courante.col_reference")}</TableHead>
                  <TableHead>{t("main_courante.col_entreprise")}</TableHead>
                  <TableHead>{t("main_courante.col_statut")}</TableHead>
                  <TableHead className="text-end">{data.definitionAttente || t("main_courante.col_jours")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageLignes.map((l, i) => {
                  const href = hrefFor(l);
                  return (
                    <ClickableTableRow key={`${l.type}-${l.id}-${l.processus}`} to={href}>
                      <TableCell className="text-muted-foreground tabular-nums">{start + i + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div>{l.action}</div>
                        <div className="text-xs text-muted-foreground">{tp(l.processus)}</div>
                      </TableCell>
                      <TableCell><Link to={href} className="text-primary hover:underline">{l.reference || `#${l.id}`}</Link></TableCell>
                      <TableCell className="text-sm">{l.entrepriseRaisonSociale || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{l.statut || "—"}</Badge></TableCell>
                      <TableCell className="text-end tabular-nums">{l.joursDAttente ?? "—"}</TableCell>
                    </ClickableTableRow>
                  );
                })}
              </TableBody>
            </Table>
            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {start + 1}–{Math.min(start + PAGE_SIZE, lignes.length)} / {lignes.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Précédent">
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                  {Array.from({ length: pageCount }, (_, p) => p)
                    .filter((p) => p === 0 || p === pageCount - 1 || Math.abs(p - safePage) <= 1)
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center gap-1">
                        {idx > 0 && p - arr[idx - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
                        <Button size="sm" variant={p === safePage ? "default" : "outline"} onClick={() => setPage(p)} className="min-w-9 tabular-nums">
                          {p + 1}
                        </Button>
                      </span>
                    ))}
                  <Button size="sm" variant="outline" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Suivant">
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            )}

          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MainCourante;
