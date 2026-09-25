import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { transfertCreditApi, TransfertVisaEtatDto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/i18n/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Circle, Loader2, ShieldCheck, Stamp, AlertTriangle, ArrowRight } from "lucide-react";

interface Props {
  transfertId: number;
  /** Rafraîchir le transfert après une action (visa ou approbation). */
  onChanged: () => void;
  /** Incrémenter pour forcer un rechargement (ex. après résolution d'un rejet). */
  reloadKey?: number;
}

/**
 * Circuit P7 : DGD → DGI → DGTCP → Président.
 * Le tour est calculé par le backend (`visablePourMoi`) — aucune règle recalculée ici.
 */
const TransfertVisasCircuit = ({ transfertId, onChanged, reloadKey }: Props) => {
  const { t } = useTranslation(["transferts", "roles", "common"]);
  const { toast } = useToast();
  const [rows, setRows] = useState<TransfertVisaEtatDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await transfertCreditApi.getVisas(transfertId);
      setRows([...data].sort((a, b) => a.rang - b.rang));
    } catch (e: any) {
      setRows([]);
      toast({ title: t("common:error", { defaultValue: "Erreur" }), description: e?.message || String(e), variant: "destructive" });
    } finally { setLoading(false); }
  }, [transfertId, t, toast]);

  useEffect(() => { load(); }, [load, reloadKey]);

  // La ligne « au tour » = première ligne non posée (affichage seulement ; l'action dépend de visablePourMoi).
  const currentRang = rows.find((r) => !r.pose)?.rang;

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setActing(true);
    try {
      await fn();
      toast({ title: t("common:success", { defaultValue: "Succès" }), description: okMsg });
      setConfirmOpen(false);
      await load();
      onChanged();
    } catch (e: any) {
      toast({ title: t("common:error", { defaultValue: "Erreur" }), description: e?.message || String(e), variant: "destructive" });
    } finally { setActing(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> {t("transferts:circuit.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("transferts:circuit.subtitle")}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t("transferts:circuit.empty")}</p>
        ) : (
          <ol className="space-y-3">
            {rows.map((r) => {
              const isTurn = !r.pose && r.rang === currentRang;
              const isPresident = r.role === "PRESIDENT";
              return (
                <li
                  key={r.role}
                  className={`rounded-lg border p-3 transition-colors ${
                    r.pose
                      ? "border-primary/30 bg-primary/5"
                      : isTurn
                        ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                        : "border-border bg-muted/20 opacity-80"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        r.pose ? "bg-primary text-primary-foreground" : isTurn ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {r.pose ? <CheckCircle2 className="h-4 w-4" /> : r.rang}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{t(`roles:${r.role}`, { defaultValue: r.role })}</span>
                          {isPresident && <Badge variant="outline" className="text-[10px]">{t("transferts:circuit.approbation")}</Badge>}
                          {r.pose ? (
                            <Badge className="text-[10px] bg-primary/15 text-primary hover:bg-primary/15">
                              {isPresident ? t("transferts:circuit.approuve") : t("transferts:circuit.vise")}
                            </Badge>
                          ) : isTurn ? (
                            <Badge className="text-[10px] bg-accent text-accent-foreground hover:bg-accent">{t("transferts:circuit.au_tour")}</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]"><Circle className="h-2.5 w-2.5 me-1" />{t("transferts:circuit.en_attente")}</Badge>
                          )}
                        </div>
                        {r.pose ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("transferts:circuit.par", { nom: r.utilisateurNom || "—", date: formatDateTime(r.datePose) })}
                          </p>
                        ) : (
                          <>
                            {!r.visablePourMoi && r.motifBlocage && (
                              <p className="text-xs text-muted-foreground mt-1">{r.motifBlocage}</p>
                            )}
                            {r.visaPrealableManquant && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                                {t("transferts:circuit.attend", { role: t(`roles:${r.visaPrealableManquant}`, { defaultValue: r.visaPrealableManquant }) })}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {r.visablePourMoi && !r.pose && (
                      isPresident ? (
                        <Button size="sm" variant="destructive" disabled={acting} onClick={() => { setConfirmChecked(false); setConfirmOpen(true); }}>
                          <Stamp className="h-4 w-4 me-1" /> {t("transferts:circuit.btn_approuver")}
                        </Button>
                      ) : (
                        <Button size="sm" disabled={acting}
                          onClick={() => run(() => transfertCreditApi.viser(transfertId), t("transferts:circuit.toast_vise"))}>
                          {acting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <CheckCircle2 className="h-4 w-4 me-1" />}
                          {t("transferts:circuit.btn_viser")}
                        </Button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!acting) setConfirmOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> {t("transferts:circuit.confirm_title")}
            </DialogTitle>
            <DialogDescription>{t("transferts:circuit.confirm_intro")}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc ps-5 text-sm space-y-1">
            <li>{t("transferts:circuit.effet_quota")}</li>
            <li>{t("transferts:circuit.effet_stock")}</li>
            <li>{t("transferts:circuit.effet_cloture")}</li>
          </ul>
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
            {t("transferts:circuit.irreversible")}
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={confirmChecked} onCheckedChange={(c) => setConfirmChecked(!!c)} />
            <span>{t("transferts:circuit.confirm_check")}</span>
          </label>
          <DialogFooter>
            <Button variant="outline" disabled={acting} onClick={() => setConfirmOpen(false)}>{t("transferts:cancel.btn_back")}</Button>
            <Button variant="destructive" disabled={!confirmChecked || acting}
              onClick={() => run(() => transfertCreditApi.valider(transfertId), t("transferts:toasts.valid_success"))}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Stamp className="h-4 w-4 me-1" />}
              {t("transferts:circuit.btn_confirmer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TransfertVisasCircuit;
