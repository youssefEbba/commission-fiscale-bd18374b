import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { autoriteContractanteApi, AutoriteContractanteDto, conventionApi, ConventionDto, EntiteRefDto } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Building2, Landmark, Link2, Loader2, Pencil, Unlink } from "lucide-react";
import { canManageConventionAutorites, conventionAutorites, conventionBailleurs } from "@/lib/conventionEditability";
import BailleurFormDialog from "./BailleurFormDialog";

interface Props {
  convention: ConventionDto;
  /** Relire la convention après un changement (liaison, déliaison, bailleur modifié). */
  onChanged: () => void;
}

/**
 * Autorités contractantes reliées et bailleurs d'une convention (principal en tête).
 * Relier / délier une autorité et modifier un bailleur : Président et administrateur ;
 * les refus du serveur (409 dossiers existants, 400 dernière autorité) sont affichés tels quels.
 */
const ConventionLiensCard = ({ convention, onChanged }: Props) => {
  const { t } = useTranslation(["conventions", "common"]);
  const { toast } = useToast();
  const { hasRole, hasPermission } = useAuth();
  const isAdministration = hasRole(["PRESIDENT", "ADMIN_SI"]);
  const canManageAutorites = canManageConventionAutorites(convention, hasPermission("convention.update"), isAdministration);
  const canEditBailleur = isAdministration && hasPermission("bailleur.update");

  const autorites = conventionAutorites(convention);
  const bailleurs = conventionBailleurs(convention);

  const [linkOpen, setLinkOpen] = useState(false);
  const [allAutorites, setAllAutorites] = useState<AutoriteContractanteDto[]>([]);
  const [autoritesLoading, setAutoritesLoading] = useState(false);
  const [selected, setSelected] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [unlinkTarget, setUnlinkTarget] = useState<EntiteRefDto | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  const [editBailleur, setEditBailleur] = useState<EntiteRefDto | null>(null);

  useEffect(() => {
    if (!linkOpen) return;
    setSelected("");
    setLinkError(null);
    setAutoritesLoading(true);
    autoriteContractanteApi.getAll()
      .then(setAllAutorites)
      .catch((e: any) => setLinkError(e?.message || t("conventions:liens.autorites_load_error")))
      .finally(() => setAutoritesLoading(false));
  }, [linkOpen, t]);

  const linkedIds = new Set(autorites.map((a) => a.id));
  const options = allAutorites
    .filter((a) => a.id != null && !linkedIds.has(a.id))
    .map((a) => ({ value: String(a.id), label: a.nom, description: a.sigle, keywords: `${a.sigle ?? ""} ${a.ministereTutelleNom ?? ""}` }));

  const handleLink = async () => {
    if (!selected) return;
    setLinking(true);
    setLinkError(null);
    try {
      await conventionApi.lierAutorite(convention.id, Number(selected));
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:liens.linked") });
      setLinkOpen(false);
      setUnlinkError(null);
      onChanged();
    } catch (e: any) {
      setLinkError(e?.message || t("common:errors.title", "Erreur"));
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    setUnlinking(true);
    setUnlinkError(null);
    try {
      await conventionApi.delierAutorite(convention.id, unlinkTarget.id);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:liens.unlinked", { nom: unlinkTarget.nom }) });
      onChanged();
    } catch (e: any) {
      // 409 (marché ou demande existants) et 400 (dernière autorité) : message serveur tel quel.
      setUnlinkError(e?.message || t("common:errors.title", "Erreur"));
    } finally {
      setUnlinking(false);
      setUnlinkTarget(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> {t("conventions:liens.autorites_title")}
          </CardTitle>
          {canManageAutorites && (
            <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
              <Link2 className="h-4 w-4 me-1" /> {t("conventions:liens.link_action")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {unlinkError && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{unlinkError}</p>}
          {autorites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("conventions:liens.autorites_empty")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {autorites.map((a, i) => (
                <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="font-medium text-foreground flex-1 min-w-0 truncate" title={a.nom}>{a.nom}</span>
                  {i === 0 && <Badge variant="secondary" className="text-[10px]">{t("conventions:liens.principale")}</Badge>}
                  {canManageAutorites && (
                    <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => setUnlinkTarget(a)}>
                      <Unlink className="h-3.5 w-3.5 me-1" /> {t("conventions:liens.unlink_action")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" /> {t("conventions:liens.bailleurs_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bailleurs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("conventions:liens.bailleurs_empty")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {bailleurs.map((b, i) => (
                <li key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="font-medium text-foreground flex-1 min-w-0 truncate" title={b.nom}>{b.nom}</span>
                  {i === 0 && <Badge variant="secondary" className="text-[10px]">{t("conventions:bailleurs.principal")}</Badge>}
                  {canEditBailleur && (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditBailleur(b)}>
                      <Pencil className="h-3.5 w-3.5 me-1" /> {t("conventions:actions.edit")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> {t("conventions:liens.link_title")}</DialogTitle>
            <DialogDescription>{t("conventions:liens.link_desc", { ref: convention.reference || `#${convention.id}` })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("conventions:fields.autorite_contractante")}</Label>
            <SearchableSelect
              value={selected}
              onValueChange={setSelected}
              options={options}
              placeholder={autoritesLoading ? t("conventions:create.loading") : t("conventions:liens.link_placeholder")}
              searchPlaceholder={t("conventions:liens.link_search")}
              emptyMessage={t("conventions:liens.link_empty")}
            />
            {linkError && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{linkError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>{t("conventions:actions.dismiss")}</Button>
            <Button onClick={handleLink} disabled={linking || !selected}>
              {linking ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Link2 className="h-4 w-4 me-1" />}
              {t("conventions:liens.link_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!unlinkTarget} onOpenChange={(o) => { if (!o && !unlinking) setUnlinkTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("conventions:liens.unlink_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("conventions:liens.unlink_desc", { nom: unlinkTarget?.nom ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>{t("conventions:actions.dismiss")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleUnlink(); }} disabled={unlinking}>
              {unlinking ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Unlink className="h-4 w-4 me-1" />}
              {t("conventions:liens.unlink_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BailleurFormDialog
        open={!!editBailleur}
        onOpenChange={(o) => { if (!o) setEditBailleur(null); }}
        bailleur={editBailleur}
        onSaved={() => onChanged()}
      />
    </>
  );
};

export default ConventionLiensCard;
