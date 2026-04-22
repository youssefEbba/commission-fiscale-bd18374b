import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand
      visibleToasts={5}
      toastOptions={{
        // Largeur étendue pour rendre les messages d'erreur lisibles
        style: {
          width: "min(440px, calc(100vw - 2rem))",
        },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-lg group-[.toaster]:p-4",
          title: "text-sm font-semibold leading-snug",
          description:
            "group-[.toast]:text-muted-foreground text-sm leading-snug whitespace-pre-wrap break-words mt-1",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error:
            "group-[.toaster]:!bg-destructive/5 group-[.toaster]:!border-destructive/40 group-[.toaster]:!text-destructive",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
