import { useCallback, useEffect, useState } from "react";
import { demandeCorrectionApi, type VisaEtatDto } from "@/lib/api";
import { formatApiErrorMessage } from "@/lib/api";

const DIRECTIONS = ["DGD", "DGTCP", "DGI", "DGB"];

/**
 * État serveur des visas d'une demande de correction pour le rôle courant.
 * À relire après chaque visa : `codeDocumentRequis`, `visaPrealableManquant` et
 * `saisieMontantsExigee` dépendent des crédits retenus. Un échec de lecture laisse
 * l'état « inconnu » (row = null, error renseignée) — on n'en déduit rien.
 */
export function useCorrectionVisaState(demandeId: number | null | undefined, role: string | null | undefined, enabled = true) {
  const active = enabled && !!demandeId && !!role && DIRECTIONS.includes(role);
  const [visas, setVisas] = useState<VisaEtatDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async (): Promise<VisaEtatDto[] | null> => {
    if (!active || !demandeId) return null;
    setLoading(true);
    try {
      const data = await demandeCorrectionApi.getVisas(demandeId);
      const list = Array.isArray(data) ? data : [];
      setVisas(list);
      setError(null);
      return list;
    } catch (e) {
      setVisas(null);
      setError(formatApiErrorMessage(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [active, demandeId]);

  useEffect(() => {
    setVisas(null);
    setError(null);
    if (active) reload();
  }, [active, reload]);

  const row = visas?.find((v) => v.role === role) ?? null;
  return { visas, row, saisieExigee: row?.saisieMontantsExigee === true, error, loading, reload, active };
}
