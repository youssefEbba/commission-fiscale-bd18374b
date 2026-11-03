import type { ComponentProps } from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="system"
    className="toaster group"
    position="bottom-right"
    richColors
    closeButton
    expand
    visibleToasts={5}
    toastOptions={{
      style: {
        width: "min(440px, calc(100vw - 2rem))",
      },
      classNames: {
        toast:
          "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-lg group-[.toaster]:p-4",
        title: "text-sm font-semibold leading-snug",
        description:
          "group-[.toast]:text-muted-foreground text-sm leading-snug whitespace-pre-wrap break-words mt-1",
        actionButton: "group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground",
        cancelButton: "group-[.toaster]:bg-muted group-[.toaster]:text-muted-foreground",
        error:
          "group-[.toaster]:!bg-destructive/5 group-[.toaster]:!border-destructive/40 group-[.toaster]:!text-destructive",
      },
    }}
    {...props}
  />
);

export { Toaster, toast };
