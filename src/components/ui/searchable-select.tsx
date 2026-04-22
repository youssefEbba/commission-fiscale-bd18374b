import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Texte secondaire facultatif affiché sous le label (ex: NIF, sigle) */
  description?: string;
  /** Texte additionnel utilisé pour la recherche (concaténé au label) */
  keywords?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  /** Active un bouton "Effacer" et autorise une valeur vide */
  clearable?: boolean;
  triggerClassName?: string;
}

/**
 * Combobox recherchable basé sur shadcn Command + Popover.
 * Remplacement direct des Select standard quand la liste est longue.
 */
export const SearchableSelect = React.forwardRef<HTMLButtonElement, SearchableSelectProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Sélectionner...",
      searchPlaceholder = "Rechercher...",
      emptyMessage = "Aucun résultat.",
      disabled,
      className,
      clearable = false,
      triggerClassName,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const selected = React.useMemo(
      () => options.find((o) => o.value === value),
      [options, value],
    );

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex w-full min-w-0 max-w-full justify-between font-normal h-10 px-3 overflow-hidden",
              !selected && "text-muted-foreground",
              triggerClassName,
              className,
            )}
            title={selected?.label}
          >
            <span className="truncate text-left flex-1 min-w-0 block">
              {selected ? selected.label : placeholder}
            </span>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {clearable && selected && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onValueChange("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onValueChange("");
                    }
                  }}
                  className="rounded-sm p-0.5 hover:bg-muted"
                  aria-label="Effacer"
                >
                  <X className="h-3.5 w-3.5 opacity-60" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[min(260px,calc(100vw-2rem))] max-w-[calc(100vw-1rem)]"
          align="start"
          collisionPadding={8}
        >
          <Command
            filter={(value, search) => {
              const opt = options.find((o) => o.value === value);
              if (!opt) return 0;
              const haystack = `${opt.label} ${opt.description ?? ""} ${opt.keywords ?? ""}`.toLowerCase();
              return haystack.includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[min(60vh,320px)]">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="break-words whitespace-normal text-sm leading-snug">
                        {opt.label}
                      </span>
                      {opt.description && (
                        <span className="text-xs text-muted-foreground break-words whitespace-normal">
                          {opt.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

SearchableSelect.displayName = "SearchableSelect";

