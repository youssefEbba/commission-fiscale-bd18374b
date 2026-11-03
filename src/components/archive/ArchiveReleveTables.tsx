import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate } from "@/i18n/format";
import type { SoldeAxe, StockTvaDetail } from "@/lib/archiveLots";
import { cn } from "@/lib/utils";
import type { ArchiveUtilisationDto } from "@/lib/api";

const money = (v: number | null | undefined) => formatAmount(v ?? 0);

/** Ligne de calcul d'un axe : « Douanier : crédit − utilisations − sortie = solde · fichier : … ✓ ». */
export function SoldeFormule({ axe: a, type }: { axe: SoldeAxe; type: "douanier" | "interieur" }) {
  const { t } = useTranslation("archive");
  const douanier = type === "douanier";
  return (
    <div className="space-y-0.5 text-xs leading-relaxed">
      <p>
        <span className="font-semibold">{t(douanier ? "soldes.douanier" : "soldes.interieur")} : </span>
        <span className="tabular-nums">{money(a.credit)}</span> ({t("soldes.credit")})
        {douanier ? (
          <> − <span className="tabular-nums">{money(a.utilisations)}</span> ({t("soldes.utilisations_douane")}) − <span className="tabular-nums">{money(a.transfert)}</span> ({t("soldes.sortie_transfert")})</>
        ) : a.deduit != null ? (
          <> − <span className="tabular-nums">{money(a.utilisations)}</span> ({t("soldes.utilisations_interieur")}) + <span className="tabular-nums">{money(a.deduit)}</span> ({t("soldes.deduit")}) + <span className="tabular-nums">{money(a.paye ?? 0)}</span> ({t("soldes.paye")})</>
        ) : (
          <> + <span className="tabular-nums">{money(a.transfert)}</span> ({t("soldes.transfert_recu")}) − <span className="tabular-nums">{money(a.utilisations)}</span> ({t("soldes.utilisations_interieur")})</>
        )}
        {" = "}<strong className="tabular-nums">{money(a.calcule)}</strong>
        {" · "}{t("soldes.fichier")} : {a.fichier == null ? "—" : <span className="tabular-nums">{money(a.fichier)}</span>}
        {a.regleFichier != null && <> ({t("soldes.regle_fichier")} : <span className="tabular-nums">{money(a.regleFichier)}</span>)</>}
        {a.fichier != null && a.ecart == null && <span className="text-emerald-600 dark:text-emerald-400"> ✓</span>}
      </p>
      {a.ecart != null && (
        <p className="text-amber-700 dark:text-amber-300">{t("soldes.ecart_ligne", { ecart: money(a.ecart) })}</p>
      )}
      {a.negatif && <p className="text-amber-700 dark:text-amber-300">{t("soldes.negatif")}</p>}
    </div>
  );
}

/** Ligne du stock de TVA déductible reconstitué : entrées − déduit = restant. */
export function StockFormule({ stock }: { stock: StockTvaDetail | null }) {
  const { t } = useTranslation("archive");
  if (!stock) return null;
  return (
    <p className="text-xs leading-relaxed">
      <span className="font-semibold">{t("soldes.stock")} : </span>
      <span className="tabular-nums">{money(stock.entrees)}</span> ({t("soldes.stock_entrees")}) − <span className="tabular-nums">{money(stock.deduit)}</span> ({t("soldes.stock_deduit")})
      {" = "}<strong className="tabular-nums">{money(stock.restant)}</strong> ({t("soldes.stock_restant")})
    </p>
  );
}

/** Calcul complet des deux soldes (ligne / douanier / intérieur) et explication de l'écart avec le fichier. */
export function ArchiveSoldesTable({ detail }: { detail: { douanier: SoldeAxe; interieur: SoldeAxe; stock?: StockTvaDetail | null } }) {
  const { t } = useTranslation("archive");
  const { douanier: d, interieur: i } = detail;
  const rejoue = i.deduit != null;
  const cell = (v: number | null) => <TableCell className="text-end tabular-nums">{v == null ? "—" : money(v)}</TableCell>;
  const ecartCell = (a: SoldeAxe) => (
    <TableCell className="text-end">
      {a.ecart != null ? <Badge variant="destructive">{money(a.ecart)}</Badge>
        : a.fichier == null ? "—" : <span className="text-xs text-muted-foreground">{t("no_ecart")}</span>}
    </TableCell>
  );
  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("soldes.ligne")}</TableHead>
              <TableHead className="text-end">{t("soldes.douanier")}</TableHead>
              <TableHead className="text-end">{t("soldes.interieur")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell>{t("soldes.credit_initial")}</TableCell>{cell(d.credit)}{cell(i.credit)}</TableRow>
            <TableRow><TableCell>− {t("soldes.utilisations")}</TableCell>{cell(d.utilisations)}{cell(i.utilisations)}</TableRow>
            <TableRow>
              <TableCell>{t("soldes.transfert_ligne")}</TableCell>
              <TableCell className="text-end tabular-nums">− {money(d.transfert)}</TableCell>
              <TableCell className="text-end tabular-nums">{rejoue ? <span className="text-xs text-muted-foreground">{t("soldes.vers_stock")}</span> : <>+ {money(i.transfert)}</>}</TableCell>
            </TableRow>
            {rejoue && (
              <>
                <TableRow><TableCell>+ {t("soldes.deduit_ligne")}</TableCell><TableCell className="text-end">—</TableCell>{cell(i.deduit ?? 0)}</TableRow>
                <TableRow><TableCell>+ {t("soldes.paye_ligne")}</TableCell><TableCell className="text-end">—</TableCell>{cell(i.paye ?? 0)}</TableRow>
              </>
            )}
            <TableRow className="font-semibold">
              <TableCell>= {t("soldes.calcule_importe")}</TableCell>
              {[d, i].map((a, k) => (
                <TableCell key={k} className={cn("text-end tabular-nums", a.negatif && "text-amber-700 dark:text-amber-300")}>
                  {money(a.calcule)}{a.negatif && <span className="block text-[11px] font-normal">{t("soldes.negatif")}</span>}
                </TableCell>
              ))}
            </TableRow>
            <TableRow><TableCell>{t("soldes.fichier_controle")}</TableCell>{cell(d.fichier)}{cell(i.fichier)}</TableRow>
            {rejoue && <TableRow><TableCell>{t("soldes.regle_fichier_ligne")}</TableCell><TableCell className="text-end">—</TableCell>{cell(i.regleFichier ?? null)}</TableRow>}
            <TableRow><TableCell>{t("ecart")}</TableCell>{ecartCell(d)}{ecartCell(i)}</TableRow>
          </TableBody>
        </Table>
      </div>
      <StockFormule stock={detail.stock ?? null} />
      <p className="text-xs text-muted-foreground leading-relaxed">{t("soldes.regle")} {t("soldes.pourquoi")}{rejoue ? ` ${t("soldes.regle_stock")}` : ""}</p>
    </div>
  );
}

/** Utilisations d'un relevé avec le détail des lignes de taxe dépliable. */
export function ArchiveUtilisationsTable({ utilisations }: { utilisations: ArchiveUtilisationDto[] }) {
  const { t } = useTranslation("archive");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (utilisations.length === 0) return <p className="text-sm text-muted-foreground">{t("no_utilisations")}</p>;

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("libelle")}</TableHead>
            <TableHead>{t("quittance")}</TableHead>
            <TableHead>{t("type")}</TableHead>
            <TableHead className="text-end">{t("montant")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {utilisations.map((u, idx) => {
            const open = !!expanded[idx];
            const hasLignes = (u.lignesTaxe?.length ?? 0) > 0;
            return (
              <Fragment key={idx}>
                <TableRow>
                  <TableCell>
                    {hasLignes && (
                      <button
                        type="button"
                        aria-label={t("detail_taxes")}
                        aria-expanded={open}
                        onClick={() => setExpanded((p) => ({ ...p, [idx]: !p[idx] }))}
                        className="rounded p-1 hover:bg-muted"
                      >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>{u.date ? formatDate(u.date) : "—"}</TableCell>
                  <TableCell className="font-medium">{u.libelle}</TableCell>
                  <TableCell>{u.numeroQuittance || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.douaniere ? "default" : "secondary"}>
                      {u.douaniere ? t("douane") : t("tva_interieure")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">{money(u.montant)}</TableCell>
                </TableRow>
                {open && hasLignes && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/40">
                      <div className="p-2 space-y-2">
                        <div className="flex gap-6 text-xs text-muted-foreground">
                          <span>{t("total_pris_en_charge")} : <strong>{money(u.totalPrisEnCharge)}</strong></span>
                          <span>{t("total_a_payer")} : <strong>{money(u.totalAPayer)}</strong></span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("code_taxe")}</TableHead>
                              <TableHead>{t("denomination")}</TableHead>
                              <TableHead className="text-end">{t("valeur")}</TableHead>
                              <TableHead>{t("affectation")}</TableHead>
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
                                    {l.affectation === "AU_CI" ? t("au_ci") : t("a_payer")}
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
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
