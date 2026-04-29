// ══════════════════════════════════════════════════════════════
// Configuration centralisée des URLs API
// Modifier uniquement ce fichier lors d'un changement de tunnel ngrok
// ══════════════════════════════════════════════════════════════

/** Backend principal (Spring Boot) */
export const API_BASE = "https://9e25-197-231-3-56.ngrok-free.app/api";

/** WebSocket backend */
export const WS_BASE = "https://9e25-197-231-3-56.ngrok-free.app/ws";

/** Service IA (Python / FastAPI) */
export const AI_SERVICE_BASE = "http://localhost:3000";

/** Headers communs pour ngrok */
export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
} as const;
