// ══════════════════════════════════════════════════════════════
// Configuration centralisée des URLs API
// Modifier uniquement ce fichier lors d'un changement de tunnel ngrok
// ══════════════════════════════════════════════════════════════

/** Backend principal (Spring Boot) */
export const API_BASE = "https://1b5f-197-231-3-222.ngrok-free.app/api";

/** WebSocket backend */
export const WS_BASE = "https://1b5f-197-231-3-222.ngrok-free.app/ws";

/** Service IA (Python / FastAPI) */
export const AI_SERVICE_BASE = "https://f7c6-197-231-9-128.ngrok-free.app";

/** Headers communs pour ngrok */
export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
} as const;
