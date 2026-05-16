import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export type ErrorDialogPayload = {
  title: string;
  description: string;
};

const EVENT_NAME = "app:error-dialog";

export function emitErrorDialog(payload: ErrorDialogPayload) {
  window.dispatchEvent(new CustomEvent<ErrorDialogPayload>(EVENT_NAME, { detail: payload }));
}

export function ErrorDialog() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<ErrorDialogPayload>({ title: "", description: "" });

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ErrorDialogPayload>;
      setPayload(ce.detail);
      setOpen(true);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-xl">
            <AlertCircle className="h-6 w-6" />
            {payload.title}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap break-words text-base text-foreground pt-2">
            {payload.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
