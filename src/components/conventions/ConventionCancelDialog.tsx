import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { conventionApi, ConventionDto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ban, Loader2 } from "lucide-react";
import type { ConventionCancelMode } from "@/lib/conventionEditability";

interface Props {
  convention: ConventionDto | null;
  /** Chemin calculé par `conventionCancelMode` ; null = aucune annulation possible. */
  mode: ConventionCancelMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: (updated: ConventionDto | null) => void;
}

/** Confirmation d'annulation (définitive), avec motif facultatif. */
const ConventionCancelDialog = ({ convention, mode, open, onOpenChange, onCancelled }: Props) => {
  const { t } = useTranslation(["conventions", "common"]);
  const { toast } = useToast();
  const [motif, setMotif] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { if (open) setMotif(""); }, [open]);

  const handleConfirm = async () => {
    if (!convention || !mode) return;
    setSending(true);
    const m = motif.trim() || undefined;
    try {
      const updated = mode === "autorite"
        ? await conventionApi.annuler(convention.id, m)
        : await conventionApi.updateStatut(convention.id, "ANNULEE", m);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:cancel_dialog.success") });
      onOpenChange(false);
      onCancelled(updated ?? null);
    } catch (e: any) {
      // Message du serveur affiché tel quel (409 non annulable, 403 périmètre/rôle).
      toast({ title: t("common:errors.title", "Erreur"), description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" /> {t("conventions:cancel_dialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("conventions:cancel_dialog.confirm", { ref: convention?.reference || convention?.intitule || "" })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("conventions:cancel_dialog.definitive")}</p>
        <div className="space-y-2">
          <Label htmlFor="convention-cancel-motif">{t("conventions:cancel_dialog.motif_optional")}</Label>
          <Textarea
            id="convention-cancel-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={t("conventions:cancel_dialog.motif_placeholder")}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("conventions:actions.keep")}</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={sending || !mode}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Ban className="h-4 w-4 me-1" />}
            {t("conventions:actions.cancel_yes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConventionCancelDialog;
