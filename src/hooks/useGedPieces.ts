import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { documentRequirementApi, ProcessusType, DocumentRequirementDto, FormatFichier } from "@/lib/api";
import { tTypeDocument } from "@/i18n/enums";

export interface GedPieceOption {
  /** Code envoyé au serveur (`codeDocument`, repli `typeDocument`). */
  code: string;
  /** Libellé paramétré dans la GED (repli : libellé de l'énumération, puis code). */
  label: string;
  /** Pièce marquée obligatoire dans la GED. */
  obligatoire: boolean;
  /** Formats acceptés par le serveur pour cette pièce. */
  typesAutorises: FormatFichier[];
}

export function toGedPieceOptions(reqs: DocumentRequirementDto[]): GedPieceOption[] {
  const seen = new Set<string>();
  return [...reqs]
    .sort((a, b) => (a.ordreAffichage ?? 0) - (b.ordreAffichage ?? 0))
    .flatMap((r) => {
      const code = r.codeDocument || r.typeDocument || "";
      if (!code || seen.has(code)) return [];
      seen.add(code);
      const enumLabel = tTypeDocument(code);
      const label = r.libelle?.trim() || (enumLabel && enumLabel !== "—" ? enumLabel : code);
      return [{ code, label, obligatoire: r.obligatoire === true, typesAutorises: r.typesAutorises ?? [] }];
    });
}

/** Attribut `accept` d'un champ fichier à partir des formats autorisés par la GED (vide = aucun filtre). */
export function acceptFromFormats(formats: FormatFichier[] | undefined): string | undefined {
  if (!formats || formats.length === 0) return undefined;
  const map: Record<string, string> = {
    PDF: ".pdf",
    WORD: ".doc,.docx",
    EXCEL: ".xls,.xlsx",
    IMAGE: "image/*",
  };
  return formats.map((f) => map[f] ?? "").filter(Boolean).join(",") || undefined;
}

export interface UseGedPiecesOptions {
  /** `true` → pièces que le demandeur dépose (`depot=true`). Par défaut `false` (pièces réclamables en rejet temporaire). */
  depot?: boolean;
  enabled?: boolean;
}

/**
 * Pièces actives paramétrées dans la GED pour un processus.
 * Sans `depot` : pièces réclamables lors d'un rejet temporaire.
 * Avec `depot: true` : pièces que le demandeur dépose (formulaire de dépôt, contrôle des obligatoires).
 * Le serveur refuse (400) toute pièce non paramétrée, donc aucune liste de repli écrite en dur.
 */
export function useGedPieces(
  processus: ProcessusType | null | undefined,
  opts: UseGedPiecesOptions | boolean = {},
) {
  const { depot = false, enabled = true } = typeof opts === "boolean" ? { enabled: opts } : opts;
  const query = useQuery({
    queryKey: ["document-requirements", "active", processus, depot ? "depot" : "all"],
    queryFn: () => documentRequirementApi.getByProcessus(processus as ProcessusType, { depot }),
    enabled: !!processus && enabled,
    staleTime: 60_000,
  });
  const options = useMemo(() => toGedPieceOptions(query.data || []), [query.data]);
  const labelOf = (code: string) => options.find((o) => o.code === code)?.label ?? tTypeDocument(code);
  return {
    options,
    labelOf,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
