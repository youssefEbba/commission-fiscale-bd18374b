import { useCallback, useEffect, useState } from "react";
import type { AutoriteContractanteDto, ConventionDto, EntrepriseDto, MarcheDto } from "@/lib/api";
import {
  invalidateArchiveRef,
  loadArchiveAutorites,
  loadArchiveConventions,
  loadArchiveEntreprises,
  loadArchiveMarches,
} from "@/lib/archiveLots";

type Kind = "entreprise" | "autorite" | "convention" | "marche";

interface CacheUser {
  userId?: number;
  actingEntrepriseId?: number;
  actingAutoriteContractanteId?: number;
}

/** Listes de rattachement de la reprise d'archive, chargées séparément (chaque champ a sa propre attente). */
export function useArchiveRefs(user?: CacheUser | null) {
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [autorites, setAutorites] = useState<AutoriteContractanteDto[]>([]);
  const [conventions, setConventions] = useState<ConventionDto[]>([]);
  const [marches, setMarches] = useState<MarcheDto[]>([]);
  const [loading, setLoading] = useState<Record<Kind, boolean>>({ entreprise: true, autorite: true, convention: true, marche: true });

  const load = useCallback((kind: Kind, force = false): Promise<void> => {
    setLoading((l) => ({ ...l, [kind]: true }));
    const done = () => setLoading((l) => ({ ...l, [kind]: false }));
    switch (kind) {
      case "entreprise":
        if (force) invalidateArchiveRef("entreprises", user);
        return loadArchiveEntreprises(user).then(setEntreprises, () => setEntreprises([])).finally(done);
      case "autorite":
        if (force) invalidateArchiveRef("autorites", user);
        return loadArchiveAutorites(user).then(setAutorites, () => setAutorites([])).finally(done);
      case "convention":
        if (force) invalidateArchiveRef("conventions", user);
        return loadArchiveConventions(user).then(setConventions, () => setConventions([])).finally(done);
      case "marche":
        if (force) invalidateArchiveRef("marches", user);
        return loadArchiveMarches(user).then(setMarches, () => setMarches([])).finally(done);
    }
    // Les champs de cache suffisent : l'objet `user` change à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.actingEntrepriseId, user?.actingAutoriteContractanteId]);

  useEffect(() => {
    void load("entreprise");
    void load("autorite");
    void load("convention");
    void load("marche");
  }, [load]);

  /** Relit une liste après une création (le dialogue a déjà vidé le cache). */
  const reload = useCallback((kind: Kind) => load(kind, true), [load]);

  return { entreprises, autorites, conventions, marches, loading, reload };
}
