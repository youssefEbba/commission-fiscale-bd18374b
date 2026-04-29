// ══════════════════════════════════════════════════════════════
// Configuration centralisée des URLs API
// Modifier uniquement ce fichier lors d'un changement de tunnel ngrok
// ══════════════════════════════════════════════════════════════

/** Backend principal (Spring Boot) */
export const API_BASE = "https://stateless-dryadic-marylouise.ngrok-free.dev/api";

/** WebSocket backend */
export const WS_BASE = "https://stateless-dryadic-marylouise.ngrok-free.dev/ws";

/** Service IA (Python / FastAPI) */
export const AI_SERVICE_BASE = "http://localhost:3000";

/** Headers communs pour ngrok */
export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
} as const;
