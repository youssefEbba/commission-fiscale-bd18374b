import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { showApiError, showSuccess } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export interface EntiteField { key: string; labelKey: string; required?: boolean; type?: string; }

interface Props<T extends { id?: number }> {
  titleKey: string;
  subtitleKey: string;
  newKey: string;
  editKey: string;
  fields: EntiteField[];
  /** Colonnes affichées (clés de `fields`) ; la première est le lien vers la fiche. */
  columns: string[];
  detailHref: (item: T) => string;
  nameOf: (item: T) => string;
  api: { getAll: () => Promise<T[]>; create: (d: T) => Promise<T>; update: (id: number, d: T) => Promise<T>; delete: (id: number) => Promise<void> };
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

/** Liste CRUD générique d'un référentiel d'entités (entreprises, autorités contractantes). */
export default function EntiteReferentielPage<T extends { id?: number }>(p: Props<T>) {
  const { t } = useTranslation(["rattachement"]);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<T | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await p.api.getAll()); } catch (e) { showApiError(e, t("errors.load")); } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => p.fields.some((f) => String((it as any)[f.key] ?? "").toLowerCase().includes(s)));
  }, [items, search, p.fields]);

  const openForm = (it: T | null) => {
    setEditing(it);
    setForm(Object.fromEntries(p.fields.map((f) => [f.key, it ? String((it as any)[f.key] ?? "") : ""])));
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...(editing ?? {}), ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()])) } as unknown as T;
      if (editing?.id != null) await p.api.update(editing.id, payload); else await p.api.create(payload);
      showSuccess(t("entites.saved"));
      setOpen(false);
      await load();
    } catch (e2) { showApiError(e2); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (toDelete?.id == null) return;
    try { await p.api.delete(toDelete.id); showSuccess(t("entites.deleted")); await load(); }
    catch (e) { showApiError(e); } finally { setToDelete(null); }
  };

  const labelOf = (key: string) => t(p.fields.find((f) => f.key === key)?.labelKey ?? key);
  const hasActions = p.canUpdate || p.canDelete;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t(p.titleKey)}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t(p.subtitleKey)}</p>
          </div>
          <div className="flex gap-2">
            {p.canCreate && <Button onClick={() => openForm(null)}><Plus className="h-4 w-4 me-1" />{t(p.newKey)}</Button>}
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 me-1 ${loading ? "animate-spin" : ""}`} />{t("actions.refresh")}</Button>
          </div>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("actions.search")} />
        </div>
        <Card><CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            : filtered.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">{t("entites.empty")}</p>
            : (
              <Table>
                <TableHeader><TableRow>
                  {p.columns.map((c) => <TableHead key={c}>{labelOf(c)}</TableHead>)}
                  {hasActions && <TableHead className="w-[80px] text-end">{t("actions.actions")}</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((it) => (
                    <ClickableTableRow key={it.id} to={p.detailHref(it)}>
                      {p.columns.map((c, i) => (
                        <TableCell key={c} className={i === 0 ? "font-medium" : ""}>
                          {i === 0
                            ? <Link to={p.detailHref(it)} className="text-primary underline-offset-2 hover:underline">{p.nameOf(it)}</Link>
                            : String((it as any)[c] ?? "—") || "—"}
                        </TableCell>
                      ))}
                      {hasActions && (
                        <TableCell className="text-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={t("actions.actions")}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {p.canUpdate && <DropdownMenuItem onClick={() => openForm(it)}><Pencil className="h-4 w-4 me-2" />{t("actions.edit")}</DropdownMenuItem>}
                              {p.canDelete && <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(it)}><Trash2 className="h-4 w-4 me-2" />{t("actions.delete")}</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </ClickableTableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent></Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t(editing ? p.editKey : p.newKey)}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            {p.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label>{t(f.labelKey)}{f.required && " *"}</Label>
                <Input type={f.type || "text"} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} required={f.required} />
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("actions.cancel")}</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 me-1 animate-spin" />}{t("actions.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("entites.delete_title", { nom: toDelete ? p.nameOf(toDelete) : "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("entites.delete_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={remove}>{t("actions.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
