import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate } from "@/i18n/format";
import { SOLDE_TOLERANCE } from "@/lib/archiveLots";
import type { ArchiveUtilisationDto } from "@/lib/api";

const money = (v: number | null | undefined) => formatAmount(v ?? 0);

/** Soldes déclaré / recalculé d'un relevé, écart mis en évidence (reprise unitaire et fichier de période). */
export function ArchiveSoldesTable({ rows }: { rows: { label: string; declare: number | null | undefined; calcule: number | null | undefined }[] }) {
  const { t } = useTranslation("archive");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("solde")}</TableHead>
          <TableHead className="text-end">{t("declare")}</TableHead>
          <TableHead className="text-end">{t("calcule")}</TableHead>
          <TableHead className="text-end">{t("ecart")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ label, declare, calcule }) => {
          const ecart = (declare ?? 0) - (calcule ?? 0);
          return (
            <TableRow key={label}>
              <TableCell className="font-medium">{label}</TableCell>
              <TableCell className="text-end">{money(declare)}</TableCell>
              <TableCell className="text-end">{money(calcule)}</TableCell>
              <TableCell className="text-end">
                {Math.abs(ecart) > SOLDE_TOLERANCE ? (
                  <Badge variant="destructive">{money(ecart)}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("no_ecart")}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
