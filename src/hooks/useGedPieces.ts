import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { documentRequirementApi, ProcessusType, DocumentRequirementDto } from "@/lib/api";
import { tTypeDocument } from "@/i18n/enums";

export interface GedPieceOption {
  /** Code envoyé au serveur (`codeDocument`, repli `typeDocument`). */
  code: string;
  /** Libellé paramétré dans la GED (repli : libellé de l'énumération, puis code). */
  label: string;
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
      return [{ code, label }];
    });
}

/**
 * Pièces actives paramétrées dans la GED pour un processus.
 * Sert aux pièces réclamables lors d'un rejet temporaire : le serveur refuse (400)
 * toute pièce non paramétrée, donc aucune liste de repli écrite en dur.
 */
export function useGedPieces(processus: ProcessusType | null | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ["document-requirements", "active", processus],
    queryFn: () => documentRequirementApi.getByProcessus(processus as ProcessusType),
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
