import { useEffect, useRef, useState } from "react";

/**
 * Persiste un état dans sessionStorage afin d'éviter la perte des données
 * quand l'utilisateur quitte temporairement le navigateur (bascule WhatsApp,
 * appel, autre app...) sur mobile et y revient.
 *
 * - Les Files / Blobs ne sont PAS sauvegardés (non sérialisables) — uniquement
 *   les valeurs primitives / objets JSON.
 * - Utilise sessionStorage : reset à la fermeture de l'onglet.
 */
export function usePersistedState<T>(key: string, initial: T, enabled = true): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const storageKey = `lvbl:form:${key}`;
  const isFirstRender = useRef(true);

  const [value, setValue] = useState<T>(() => {
    if (!enabled || typeof window === "undefined") return initial;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw == null) return initial;
      const parsed = JSON.parse(raw);
      return parsed as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (!enabled) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* quota exceeded — ignorer */
    }
  }, [storageKey, value, enabled]);

  const clear = () => {
    try { sessionStorage.removeItem(storageKey); } catch { /* noop */ }
  };

  return [value, setValue, clear];
}
