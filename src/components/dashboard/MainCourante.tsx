import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Info, Loader2, AlertTriangle } from "lucide-react";
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
  const [filtre, setFiltre] = useState<string | null>(null);

  useEffect(() => {
    mainCouranteApi.get()
      .then(setData)
      .catch((err) => setError(formatApiErrorMessage(err, t("main_courante.load_error"))));
  }, []);

  const tp = (p: string) => t(`main_courante.processus.${p}`, { defaultValue: p });
  const tabs = data ? Object.entries(data.parProcessus ?? {}).filter(([, n]) => n > 0) : [];
  const lignes = data ? (filtre ? data.lignes.filter((l) => l.processus === filtre) : data.lignes) : [];

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
                  <TableHead>{t("main_courante.col_action")}</TableHead>
                  <TableHead>{t("main_courante.col_reference")}</TableHead>
                  <TableHead>{t("main_courante.col_entreprise")}</TableHead>
                  <TableHead>{t("main_courante.col_statut")}</TableHead>
                  <TableHead className="text-end">{data.definitionAttente || t("main_courante.col_jours")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => {
                  const href = hrefFor(l);
                  return (
                    <ClickableTableRow key={`${l.type}-${l.id}-${l.processus}`} to={href}>
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
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MainCourante;
