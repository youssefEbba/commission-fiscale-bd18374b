import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { RowNumberHead, RowNumberCell } from "@/components/ui/row-number";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Briefcase, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { showApiError, showSuccess } from "@/lib/feedback";
import { formatApiErrorMessage, secteurActiviteApi, type SecteurActiviteDto, type SecteurActiviteRequest } from "@/lib/api";
import { invalidateSecteurs } from "@/lib/secteurs";

const EMPTY: SecteurActiviteRequest = { code: "", libelle: "", libelleAr: "", actif: true };

/** Référentiel des secteurs d'activité (indicateurs bénéficiaires) — écriture : referentiel.secteur.manage. */
const ReferentielSecteurs = () => {
  const { t } = useTranslation(["referentiel", "common"]);
  usePageTitle("referentiel:secteurs.title");
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("referentiel.secteur.manage");
  const [items, setItems] = useState<SecteurActiviteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SecteurActiviteDto | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SecteurActiviteRequest>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await secteurActiviteApi.getAll(false);
      setItems([...list].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr", { sensitivity: "base" })));
    } catch (e) {
      showApiError(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openForm = (s: SecteurActiviteDto | null) => {
    setEditing(s);
    setForm(s ? { code: s.code, libelle: s.libelle, libelleAr: s.libelleAr ?? "", actif: s.actif } : EMPTY);
    setError(null);
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body: SecteurActiviteRequest = {
      code: form.code.trim().toUpperCase(),
      libelle: form.libelle.trim(),
      libelleAr: form.libelleAr?.trim() || null,
      actif: form.actif,
    };
    try {
      if (editing) await secteurActiviteApi.update(editing.id, body);
      else await secteurActiviteApi.create(body);
      // Les formulaires (entreprises) relisent la liste des secteurs.
      invalidateSecteurs(user);
      showSuccess(t("referentiel:secteurs.saved"));
      setOpen(false);
      await load();
    } catch (e2) {
      setError(formatApiErrorMessage(e2));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" /> {t("referentiel:secteurs.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("referentiel:secteurs.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            {canManage && <Button onClick={() => openForm(null)}><Plus className="h-4 w-4 me-1" />{t("referentiel:secteurs.new")}</Button>}
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-1 ${loading ? "animate-spin" : ""}`} />{t("common:actions.refresh")}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <RowNumberHead />
                  <TableHead>{t("referentiel:secteurs.code")}</TableHead>
                  <TableHead>{t("referentiel:secteurs.libelle")}</TableHead>
                  <TableHead>{t("referentiel:secteurs.libelle_ar")}</TableHead>
                  <TableHead>{t("referentiel:secteurs.statut")}</TableHead>
                  {canManage && <TableHead className="w-[60px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={canManage ? 6 : 5} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={canManage ? 6 : 5} className="py-10 text-center text-muted-foreground">{t("referentiel:secteurs.empty")}</TableCell></TableRow>
                ) : items.map((s, i) => (
                  <TableRow key={s.id}>
                    <RowNumberCell n={i + 1} />
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="font-medium">{s.libelle}</TableCell>
                    <TableCell dir="rtl">{s.libelleAr || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.actif ? "secondary" : "outline"}>{s.actif ? t("referentiel:secteurs.actif") : t("referentiel:secteurs.inactif")}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-end">
                        <Button variant="ghost" size="icon" onClick={() => openForm(s)} aria-label={t("common:actions.edit")}><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? t("referentiel:secteurs.edit") : t("referentiel:secteurs.new")}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="secteur-code">{t("referentiel:secteurs.code")} *</Label>
              <Input id="secteur-code" dir="ltr" className="font-mono uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="secteur-libelle">{t("referentiel:secteurs.libelle")} *</Label>
              <Input id="secteur-libelle" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="secteur-libelle-ar">{t("referentiel:secteurs.libelle_ar")}</Label>
              <Input id="secteur-libelle-ar" dir="rtl" value={form.libelleAr ?? ""} onChange={(e) => setForm({ ...form, libelleAr: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor="secteur-actif">{t("referentiel:secteurs.actif")}</Label>
              <Switch id="secteur-actif" checked={form.actif} onCheckedChange={(v) => setForm({ ...form, actif: v })} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common:actions.cancel")}</Button>
              <Button type="submit" disabled={saving || !form.code.trim() || !form.libelle.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin me-1" />}{t("common:actions.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ReferentielSecteurs;
