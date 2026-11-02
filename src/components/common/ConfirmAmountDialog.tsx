import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** Libellé et montant concerné, affichés en évidence. */
  amountLabel: string;
  amount: string;
  cancelLabel: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}

/** Confirmation d'un geste financier irréversible, montant concerné en évidence (modèle « Clôturer l'utilisation »). */
const ConfirmAmountDialog = ({
  open, onOpenChange, title, description, amountLabel, amount, cancelLabel, confirmLabel, loading, onConfirm, children,
}: Props) => (
  <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">{amountLabel}</p>
          <p className="text-lg font-bold text-foreground">{amount}</p>
        </div>
        {children}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{cancelLabel}</Button>
        <Button onClick={onConfirm} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ConfirmAmountDialog;
