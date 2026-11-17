import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ajouterNumero, lignesNumeros, modifierNumero, retirerNumero } from "@/lib/utilisationNumeros";

/** Champ répétable (n° de déclaration, n° de facture) : au moins une ligne, ajout et retrait. */
export function NumerosRepetables({ id, label, placeholder, values, onChange, required, disabled }: {
  id: string;
  label: string;
  placeholder?: string;
  values: string[] | null | undefined;
  onChange: (values: string[]) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation(["utilisations"]);
  const lignes = lignesNumeros(values);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-0`}>{label}{required ? " *" : ""}</Label>
      {lignes.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            id={`${id}-${i}`}
            placeholder={placeholder}
            value={v}
            disabled={disabled}
            aria-label={lignes.length > 1 ? t("utilisations:numeros.ligne", { label, n: i + 1 }) : undefined}
            onChange={(e) => onChange(modifierNumero(values, i, e.target.value))}
          />
          {lignes.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={disabled}
              onClick={() => onChange(retirerNumero(values, i))}
              aria-label={t("utilisations:numeros.retirer", { n: i + 1 })}
              title={t("utilisations:numeros.retirer", { n: i + 1 })}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="link" size="sm" className="h-auto p-0" disabled={disabled} onClick={() => onChange(ajouterNumero(values))}>
        <Plus className="h-3.5 w-3.5 me-1" /> {t("utilisations:numeros.ajouter")}
      </Button>
    </div>
  );
}
