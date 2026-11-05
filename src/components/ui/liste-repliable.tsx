import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableHeader } from "@/components/ui/table";

interface Props<T> {
  /** Titre de la carte, toujours visible (même repliée). */
  title: ReactNode;
  items: T[];
  /** Ligne d'en-tête du tableau (un <TableRow>). */
  head: ReactNode;
  /** Une ligne du tableau (un <TableRow>) par élément. */
  row: (item: T) => ReactNode;
  pageSize?: number;
  /** Par défaut, une liste courte est dépliée et une liste longue repliée. */
  defaultOpen?: boolean;
}

/** Carte dont la liste se replie et se pagine (stock de TVA déductible…). */
export function ListeRepliable<T>({ title, items, head, row, pageSize = 5, defaultOpen }: Props<T>) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(defaultOpen ?? items.length <= pageSize);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));

  // La liste peut raccourcir (rechargement) : la page affichée reste dans les bornes.
  useEffect(() => { if (page > pages - 1) setPage(pages - 1); }, [page, pages]);

  const debut = page * pageSize;
  const visibles = items.slice(debut, debut + pageSize);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center gap-2 text-start" aria-expanded={open}>
              <CardTitle className="text-base flex flex-1 items-center gap-2">{title}</CardTitle>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{open ? t("liste.replier") : t("liste.deplier", { count: items.length })}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-0">
            <Table>
              <TableHeader>{head}</TableHeader>
              <TableBody>{visibles.map((item) => row(item))}</TableBody>
            </Table>
            {items.length > pageSize && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
                <span>{t("pagination.showing", { from: debut + 1, to: Math.min(debut + pageSize, items.length), total: items.length })}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4 me-1 rtl:rotate-180" />{t("actions.previous")}
                  </Button>
                  <span className="tabular-nums">{page + 1} / {pages}</span>
                  <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                    {t("actions.next")}<ChevronRight className="h-4 w-4 ms-1 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
