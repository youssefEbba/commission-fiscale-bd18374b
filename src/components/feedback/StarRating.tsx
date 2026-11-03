import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Note de 1 à 5 étoiles, utilisable au clavier (groupe radio). */
export function StarRating({ value, onChange, label, size = "md" }: { value: number | null | undefined; onChange: (n: number) => void; label: string; size?: "sm" | "md" }) {
  const { t } = useTranslation("feedback");
  const cls = size === "sm" ? "h-5 w-5" : "h-7 w-7";
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t("stars", { count: n })}
            title={t(`note_labels.${n}`)}
            onClick={() => onChange(n)}
            className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star className={cn(cls, active ? "fill-accent text-accent" : "text-muted-foreground")} />
          </button>
        );
      })}
      {value != null && <span className="ms-2 text-sm text-muted-foreground">{t(`note_labels.${value}`)}</span>}
    </div>
  );
}
