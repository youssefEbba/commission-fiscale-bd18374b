// ================================
// Fin de session centralisée
// ================================
// Déconnexion volontaire ou réponse 401 : on efface le jeton et l'utilisateur
// stockés, on ferme les connexions temps réel (WebSocket STOMP) et, si demandé,
// on renvoie vers /login.

export const AUTH_TOKEN_KEY = "auth_token";
export const AUTH_USER_KEY = "auth_user";
export const SESSION_ENDED_EVENT = "auth:session-ended";

type Closer = () => void;
const closers = new Set<Closer>();

/** Enregistre une connexion à fermer en fin de session ; renvoie la fonction de désinscription. */
export function registerSessionCloser(fn: Closer): () => void {
  closers.add(fn);
  return () => { closers.delete(fn); };
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch { /* stockage indisponible : rien à effacer */ }
}

export function closeRealtimeConnections(): void {
  for (const fn of Array.from(closers)) {
    try { fn(); } catch { /* fermeture best-effort */ }
  }
  closers.clear();
}

/**
 * Termine la session : stockage effacé, WebSocket fermés, contexte prévenu.
 * `redirect` (par défaut) renvoie vers /login si l'on n'y est pas déjà.
 */
export function endSession(options: { redirect?: boolean } = {}): void {
  const { redirect = true } = options;
  clearStoredSession();
  closeRealtimeConnections();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
  if (redirect && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}
