import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("common");
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
      <DialogContent className="sm:max-w-3xl md:max-w-4xl p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-destructive text-2xl">
            <AlertCircle className="h-8 w-8 shrink-0" />
            {payload.title}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap break-words text-lg leading-relaxed text-foreground pt-3">
            {payload.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOpen(false)}>
            {t("actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
