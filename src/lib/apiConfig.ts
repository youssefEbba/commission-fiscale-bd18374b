// ================================
// Configuration centralisée des URLs API
// ================================

const NGROK_ORIGIN = "https://stateless-dryadic-marylouise.ngrok-free.dev";

/** En `npm run dev`, le proxy Vite relaie /api et /ws vers le backend local. */
const localDev = import.meta.env.DEV;

/** Backend principal (Spring Boot) */
export const API_BASE = localDev ? "/api" : `${NGROK_ORIGIN}/api`;

/** WebSocket backend (URL absolue exigée par le constructeur WebSocket) */
export const WS_BASE = localDev ? "ws://127.0.0.1:5173/ws" : `${NGROK_ORIGIN.replace(/^https/, "wss")}/ws`;

/** Service IA (Python / FastAPI) */
export const AI_SERVICE_BASE = "http://localhost:3000";

/** Headers communs pour ngrok */
export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
} as const;
