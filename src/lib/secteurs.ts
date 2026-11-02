import { secteurActiviteApi, type SecteurActiviteDto } from "./api";
import { cachedList, invalidateList } from "./listCache";

interface CacheUser {
  userId?: number;
  actingEntrepriseId?: number;
  actingAutoriteContractanteId?: number;
}

/** Clé de cache des secteurs actifs : compte + entité représentée (règle listCache). */
export const secteursCacheKey = (user?: CacheUser | null) =>
  `secteurs-activite:actifs:${user?.userId ?? "anon"}:${user?.actingEntrepriseId ?? ""}:${user?.actingAutoriteContractanteId ?? ""}`;

/** Secteurs actifs pour les formulaires (liste chargée à part, mise en cache). */
export const loadSecteursActifs = (user?: CacheUser | null): Promise<SecteurActiviteDto[]> =>
  cachedList(secteursCacheKey(user), () => secteurActiviteApi.getAll(true));

/** Après une création ou une modification du référentiel. */
export const invalidateSecteurs = (user?: CacheUser | null) => invalidateList(secteursCacheKey(user));
