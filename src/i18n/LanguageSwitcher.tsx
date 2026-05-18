import { Globe, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGS = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

interface Props {
  variant?: "icon" | "compact";
}

export function LanguageSwitcher({ variant = "icon" }: Props) {
  const { i18n, t } = useTranslation("common");
  const current = i18n.language?.startsWith("ar") ? "ar" : "fr";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={variant === "icon" ? "icon" : "sm"} className="gap-2" aria-label={t("language.switch")}>
          <Globe className="h-4 w-4" />
          {variant === "compact" && <span className="text-xs font-medium uppercase">{current}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => i18n.changeLanguage(l.code)}
            className="cursor-pointer"
          >
            <span className="flex-1">{l.label}</span>
            {current === l.code && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;
