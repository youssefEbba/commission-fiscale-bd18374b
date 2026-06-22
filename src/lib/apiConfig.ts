// ================================
// Configuration centralisée des URLs API
// ================================

/** Backend principal (Spring Boot) */
export const API_BASE = "https://ca96-197-231-9-252.ngrok-free.app/api";

/** WebSocket backend */
export const WS_BASE = "https://ca96-197-231-9-252.ngrok-free.app/ws";

/** Service IA (Python / FastAPI) */
export const AI_SERVICE_BASE = "http://localhost:3000";

/** Headers communs pour ngrok */
export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
} as const;
