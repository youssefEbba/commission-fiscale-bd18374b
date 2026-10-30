import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Motif obligatoire (rejet, substitution par l'administrateur). Sinon, simple confirmation. */
  motifRequired: boolean;
  /** Affiche le rappel « vous agissez à la place de… ». */
  adminHint?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (motif: string) => Promise<void>;
}

/** Confirmation d'un geste du circuit des avenants, avec motif quand le serveur l'exige. */
export default function AvenantMotifDialog({ open, onOpenChange, title, description, motifRequired, adminHint, confirmLabel, destructive, onConfirm }: Props) {
  const { t } = useTranslation(["modifications"]);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setMotif(""); }, [open]);

  const submit = async () => {
    if (motifRequired && !motif.trim()) return;
    setBusy(true);
    try {
      await onConfirm(motif.trim());
      onOpenChange(false);
    } catch {
      // L'appelant affiche le message serveur ; le dialogue reste ouvert.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {adminHint && <p className="text-xs rounded-md border border-border bg-muted/40 p-2 text-muted-foreground">{adminHint}</p>}
        {motifRequired && (
          <div className="space-y-1.5">
            <Label htmlFor="avenant-motif">{t("modifications:dialogs.motif_label")} *</Label>
            <Textarea id="avenant-motif" rows={4} value={motif} onChange={(e) => setMotif(e.target.value)} />
            {!motif.trim() && <p className="text-xs text-muted-foreground">{t("modifications:dialogs.motif_required")}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("modifications:dialogs.cancel")}</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={submit} disabled={busy || (motifRequired && !motif.trim())}>
            {busy && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
