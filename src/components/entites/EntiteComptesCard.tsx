import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, UserPlus, UserX, UserCheck, Users } from "lucide-react";
import { entiteComptesApi, type CompteEntiteDto, type TypeEntite } from "@/lib/api";
import { showApiError, showSuccess } from "@/lib/feedback";
import { tRole } from "@/i18n/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const ROLES_PAR_TYPE: Record<TypeEntite, string[]> = {
  ENTREPRISE: ["ENTREPRISE"],
  AUTORITE_CONTRACTANTE: ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP"],
};

/** Comptes rattachés à une entité (permission `rattachement.validate`) — la désactivation est le geste principal. */
export default function EntiteComptesCard({ type, entiteId }: { type: TypeEntite; entiteId: number }) {
  const { t } = useTranslation(["rattachement"]);
  const [comptes, setComptes] = useState<CompteEntiteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [toDisable, setToDisable] = useState<CompteEntiteDto | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: "", motDePasse: "", role: ROLES_PAR_TYPE[type][0], nomComplet: "", email: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try { setComptes(await entiteComptesApi.list(type, entiteId)); }
    catch (e) { showApiError(e, t("errors.load")); }
    finally { setLoading(false); }
  }, [type, entiteId, t]);
  useEffect(() => { load(); }, [load]);

  const setActif = async (c: CompteEntiteDto, actif: boolean) => {
    setBusy(c.id);
    try {
      await entiteComptesApi.setActif(type, entiteId, c.id, actif);
      showSuccess(actif ? t("comptes.toggled_on") : t("comptes.toggled_off"));
      await load();
    } catch (e) { showApiError(e); }
    finally { setBusy(null); setToDisable(null); }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await entiteComptesApi.create(type, entiteId, form);
      showSuccess(t("comptes.created"));
      setAddOpen(false);
      setForm({ username: "", motDePasse: "", role: ROLES_PAR_TYPE[type][0], nomComplet: "", email: "" });
      await load();
    } catch (e2) { showApiError(e2); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-primary" />{t("comptes.title")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t("comptes.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4 me-1" />{t("comptes.add")}</Button>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : comptes.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">{t("comptes.empty")}</p>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("comptes.col_nom")}</TableHead><TableHead>{t("comptes.col_username")}</TableHead>
                <TableHead>{t("comptes.col_role")}</TableHead><TableHead>{t("comptes.col_etat")}</TableHead><TableHead className="text-end">{t("actions.actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {comptes.map((c) => (
                  <TableRow key={c.id} className={c.actif ? "" : "opacity-70"}>
                    <TableCell className="font-medium">{c.nomComplet || "—"}<div className="text-xs text-muted-foreground">{c.email}</div></TableCell>
                    <TableCell dir="ltr" className="text-start">{c.username}</TableCell>
                    <TableCell>{tRole(c.role)}</TableCell>
                    <TableCell><Badge variant={c.actif ? "default" : "destructive"}>{c.actif ? t("comptes.actif") : t("comptes.inactif")}</Badge></TableCell>
                    <TableCell className="text-end">
                      {c.actif
                        ? <Button size="sm" variant="destructive" disabled={busy === c.id} onClick={() => setToDisable(c)}><UserX className="h-4 w-4 me-1" />{t("comptes.deactivate")}</Button>
                        : <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => setActif(c, true)}><UserCheck className="h-4 w-4 me-1" />{t("comptes.activate")}</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </CardContent>

      <AlertDialog open={!!toDisable} onOpenChange={(o) => !o && setToDisable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("comptes.deactivate_title", { nom: toDisable?.nomComplet || toDisable?.username })}</AlertDialogTitle>
            <AlertDialogDescription>{t("comptes.deactivate_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDisable && setActif(toDisable, false)}>{t("comptes.deactivate")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("comptes.add")}</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-1"><Label>{t("comptes.f_nom_complet")}</Label><Input value={form.nomComplet} onChange={(e) => setForm({ ...form, nomComplet: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("comptes.f_email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("comptes.f_username")} *</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoComplete="off" /></div>
            <div className="space-y-1"><Label>{t("comptes.f_password")} *</Label><Input type="password" value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} required minLength={6} autoComplete="new-password" /></div>
            <div className="space-y-1">
              <Label>{t("comptes.f_role")} *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES_PAR_TYPE[type].map((r) => <SelectItem key={r} value={r}>{tRole(r)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{t("actions.cancel")}</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 me-1 animate-spin" />}{t("actions.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
