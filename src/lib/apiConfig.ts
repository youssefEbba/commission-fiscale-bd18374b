// ================================
// Configuration centralisée des URLs API
// ================================

/** Backend principal (Spring Boot) */
export const API_BASE = "/api/https://stateless-dryadic-marylouise.ngrok-free.dev";

/** WebSocket backend */
export const WS_BASE = "/ws/https://stateless-dryadic-marylouise.ngrok-free.dev";

/** Service IA (Python / FastAPI) */
export const AI_SERVICE_BASE = "http://localhost:3000";

/** Headers communs pour ngrok */
export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
} as const;
