import * as React from "react";
import { Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadRowProps {
  id: string;
  label: React.ReactNode;
  file?: File | null;
  onFileChange: (f: File | null) => void;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: React.ReactNode;
  className?: string;
  /** Right-side extra content (e.g. badge, icon) rendered before the browse hint */
  rightSlot?: React.ReactNode;
  /** Button/text shown to indicate the file picker action */
  browseLabel?: string;
  replaceLabel?: string;
  /** Sélection multiple : appelle onFilesChange avec la liste choisie. */
  multiple?: boolean;
  onFilesChange?: (files: File[]) => void;
}

/**
 * Composant d'upload — ligne entière cliquable.
 * Toute la surface est un <label> lié au <input type="file"> caché.
 * Un bouton X (croix) permet de retirer la sélection locale sans passer par « Remplacer ».
 */
export const UploadRow: React.FC<UploadRowProps> = ({
  id,
  label,
  file,
  onFileChange,
  accept,
  required,
  disabled,
  helperText,
  className,
  rightSlot,
  browseLabel = "Parcourir",
  replaceLabel = "Remplacer",
  multiple,
  onFilesChange,
}) => {
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "cursor-pointer hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
        file ? "border-emerald-300 bg-emerald-50/40" : "border-border",
        className,
      )}
    >
      <div className="shrink-0 rounded-md bg-muted/70 p-2 text-muted-foreground group-hover:text-primary">
        {file ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium truncate">
            {label}
            {required && <span className="text-destructive ms-0.5">*</span>}
          </span>
          {rightSlot}
        </div>
        {file ? (
          <span className="block text-xs text-emerald-700 truncate mt-0.5">{file.name}</span>
        ) : helperText ? (
          <span className="block text-xs text-muted-foreground mt-0.5">{helperText}</span>
        ) : null}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {file && !disabled && (
          <button
            type="button"
            aria-label="Retirer le fichier"
            className="rounded-full p-1 hover:bg-destructive/10 text-destructive"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFileChange(null);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <span className="text-xs text-primary underline-offset-2 group-hover:underline">
          {file ? replaceLabel : browseLabel}
        </span>
      </div>
      <input
        id={id}
        type="file"
        className="sr-only"
        accept={accept}
        disabled={disabled}
        multiple={multiple}
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (multiple && onFilesChange) {
            if (list.length) onFilesChange(list);
          } else {
            onFileChange(list[0] || null);
          }
          e.target.value = "";
        }}
      />
    </label>
  );
};

UploadRow.displayName = "UploadRow";
