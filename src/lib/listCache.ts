// ================================
// Cache court des listes de référence
// ================================
// Les formulaires (ex. « Nouvelle demande de correction ») rechargent à chaque
// ouverture des listes complètes (entreprises, conventions, bailleurs…).
// Ce cache garde la dernière réponse quelques instants pour qu'une réouverture
// rapide soit immédiate. Une même requête en vol est partagée.
//
// - La clé doit inclure l'identité de l'appelant (compte + entité représentée) :
//   le serveur filtre les listes selon le périmètre.
// - Un échec n'est jamais mis en cache.
// - Tout est effacé en fin de session.

import { SESSION_ENDED_EVENT } from "./session";

export const LIST_CACHE_TTL_MS = 2 * 60 * 1000;

interface Entry {
  at: number;
  promise: Promise<unknown>;
}

const entries = new Map<string, Entry>();

export function cachedList<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = LIST_CACHE_TTL_MS,
  now: () => number = Date.now,
): Promise<T> {
  const hit = entries.get(key);
  if (hit && now() - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = fetcher();
  const entry: Entry = { at: now(), promise };
  entries.set(key, entry);
  promise.catch(() => {
    if (entries.get(key) === entry) entries.delete(key);
  });
  return promise;
}

/** Oublie une liste (après une création, pour que la prochaine ouverture la relise). */
export function invalidateList(key: string): void {
  entries.delete(key);
}

export function clearListCache(): void {
  entries.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener(SESSION_ENDED_EVENT, clearListCache);
}
