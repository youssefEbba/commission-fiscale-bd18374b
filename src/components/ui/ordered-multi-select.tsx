import * as React from "react";
import { Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

interface Props {
  /** Options proposées à l'ajout (les valeurs déjà choisies sont retirées automatiquement). */
  options: SearchableSelectOption[];
  /** Valeurs choisies, dans l'ordre : la première est l'élément principal. */
  values: string[];
  onChange: (values: string[]) => void;
  /** Libellé affiché d'une valeur choisie (peut être absente des options, ex. convention désactivée). */
  labelOf: (value: string) => string;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  principalLabel: string;
  makePrincipalLabel: string;
  removeLabel: string;
  disabled?: boolean;
  /** Actions supplémentaires par élément choisi (ex. modifier un bailleur). */
  renderItemActions?: (value: string) => React.ReactNode;
  /** Bouton accolé au sélecteur (ex. créer à la volée). */
  addon?: React.ReactNode;
  className?: string;
}

/**
 * Sélection multiple ordonnée : le premier élément choisi est le principal.
 * Chaque élément peut être retiré ou passé en tête.
 */
export function OrderedMultiSelect({
  options, values, onChange, labelOf, placeholder, searchPlaceholder, emptyMessage,
  principalLabel, makePrincipalLabel, removeLabel, disabled, renderItemActions, addon, className,
}: Props) {
  const remaining = options.filter((o) => !values.includes(o.value));
  const add = (v: string) => { if (v && !values.includes(v)) onChange([...values, v]); };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));
  const makePrincipal = (v: string) => onChange([v, ...values.filter((x) => x !== v)]);

  return (
    <div className={cn("space-y-2", className)}>
      {values.length > 0 && (
        <ul className="space-y-1">
          {values.map((v, i) => (
            <li key={v} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-sm">
              <span className="truncate flex-1 min-w-0" title={labelOf(v)}>{labelOf(v)}</span>
              {i === 0 ? (
                <Badge variant="secondary" className="text-[10px] shrink-0">{principalLabel}</Badge>
              ) : (
                <Button
                  type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs shrink-0"
                  disabled={disabled} onClick={() => makePrincipal(v)} title={makePrincipalLabel}
                >
                  <Star className="h-3 w-3 me-1" /> {makePrincipalLabel}
                </Button>
              )}
              {renderItemActions?.(v)}
              <Button
                type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive shrink-0"
                disabled={disabled} onClick={() => remove(v)} aria-label={removeLabel} title={removeLabel}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <SearchableSelect
          value=""
          onValueChange={add}
          options={remaining}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          emptyMessage={emptyMessage}
          disabled={disabled}
          triggerClassName="flex-1"
        />
        {addon}
      </div>
    </div>
  );
}

export default OrderedMultiSelect;
