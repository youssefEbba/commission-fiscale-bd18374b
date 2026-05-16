import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  variant?: "default" | "ghost" | "outline";
  className?: string;
}

const LANGS = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

const LanguageSwitcher = ({ variant = "ghost", className }: Props) => {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("ar") ? "ar" : "fr";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className={className} aria-label="Language">
          <Languages className="h-4 w-4" />
          <span className="ms-2 text-xs font-semibold uppercase">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => i18n.changeLanguage(l.code)}
            className={current === l.code ? "font-semibold" : ""}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
