// ================================
// Fin de session centralisée
// ================================
// Déconnexion volontaire ou réponse 401 : on efface le jeton et l'utilisateur
// stockés, on ferme les connexions temps réel (WebSocket STOMP) et, si demandé,
// on renvoie vers /login.
//
// Sur une déconnexion volontaire, le serveur est prévenu (`POST /auth/logout`)
// pour invalider le jeton présenté et les autres jetons du compte. Cet appel ne
// bloque jamais : en cas d'échec, l'effacement local et la redirection ont lieu.

import { API_BASE } from "./apiConfig";

export const AUTH_TOKEN_KEY = "auth_token";
export const AUTH_USER_KEY = "auth_user";
export const SESSION_ENDED_EVENT = "auth:session-ended";
/** Message à afficher sur la page de connexion après une fin de session imposée. */
export const SESSION_NOTICE_KEY = "auth:session-notice";

/**
 * Origine de la fin de session :
 * - `logout` : clic sur « Déconnexion » → le serveur est prévenu ;
 * - `expired` : réponse 401, le jeton est déjà refusé → aucun appel serveur ;
 * - `password_changed` : mot de passe changé, le serveur a invalidé les jetons.
 */
export type SessionEndReason = "logout" | "expired" | "password_changed";
export type SessionNotice = Exclude<SessionEndReason, "logout">;

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

function readToken(): string | null {
  try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
}

/** Prévient le serveur de la déconnexion, sans attendre ni propager d'erreur. */
export function notifyServerLogout(token: string | null): void {
  if (!token || typeof fetch !== "function") return;
  try {
    fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
      // La requête survit au changement de page.
      keepalive: true,
    }).catch(() => { /* réseau indisponible : la session locale est effacée quand même */ });
  } catch { /* idem */ }
}

function setSessionNotice(notice: SessionNotice): void {
  try { sessionStorage.setItem(SESSION_NOTICE_KEY, notice); } catch { /* noop */ }
}

/** Lit puis efface le message de fin de session destiné à la page de connexion. */
export function takeSessionNotice(): SessionNotice | null {
  try {
    const v = sessionStorage.getItem(SESSION_NOTICE_KEY);
    sessionStorage.removeItem(SESSION_NOTICE_KEY);
    return v === "expired" || v === "password_changed" ? v : null;
  } catch { return null; }
}

/**
 * Termine la session : serveur prévenu (déconnexion volontaire seulement),
 * stockage effacé, WebSocket fermés, contexte prévenu.
 * `redirect` (par défaut) renvoie vers /login si l'on n'y est pas déjà.
 * `reason` vaut `expired` par défaut (chemin des réponses 401).
 */
export function endSession(options: { redirect?: boolean; reason?: SessionEndReason } = {}): void {
  const { redirect = true, reason = "expired" } = options;
  if (reason === "logout") notifyServerLogout(readToken());
  else setSessionNotice(reason);
  clearStoredSession();
  closeRealtimeConnections();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
  if (redirect && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}
