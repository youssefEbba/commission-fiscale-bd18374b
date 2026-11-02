import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldX, XCircle } from "lucide-react";
import { conventionApi, ConventionDto, formatApiErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  convention: ConventionDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRejected: () => void;
}

/** Rejet d'une convention avec motif obligatoire (liste et fiche). */
const ConventionRejectDialog = ({ convention, open, onOpenChange, onRejected }: Props) => {
  const { t } = useTranslation(["conventions", "common"]);
  const { toast } = useToast();
  const [motif, setMotif] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => { if (open) setMotif(""); }, [open]);

  const handleReject = async () => {
    if (!convention || !motif.trim()) return;
    setRejecting(true);
    try {
      await conventionApi.updateStatut(convention.id, "REJETE", motif);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:reject.success") });
      onOpenChange(false);
      onRejected();
    } catch (e) {
      toast({ title: t("common:errors.title", "Erreur"), description: formatApiErrorMessage(e), variant: "destructive" });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!rejecting) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldX className="h-5 w-5" /> {t("conventions:reject.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("conventions:reject.convention_label")} <span className="font-medium text-foreground">{convention?.reference || convention?.intitule}</span>
          </p>
          <div className="space-y-2">
            <Label>{t("conventions:reject.motif_required")}</Label>
            <Textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={t("conventions:reject.motif_placeholder")}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={rejecting}>{t("conventions:actions.dismiss")}</Button>
          <Button variant="destructive" onClick={handleReject} disabled={rejecting || !motif.trim()}>
            {rejecting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <XCircle className="h-4 w-4 me-1" />}
            {t("conventions:actions.confirm_reject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConventionRejectDialog;
