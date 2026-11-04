// ================================
// Configuration centralisée des URLs API
// ================================

const NGROK_ORIGIN = "https://stateless-dryadic-marylouise.ngrok-free.dev";

/** En `npm run dev`, le proxy Vite relaie /api et /ws vers le backend local. */
const localDev = import.meta.env.DEV;

/** Backend principal (Spring Boot) */
export const API_BASE = localDev ? "/api" : `${NGROK_ORIGIN}/api`;

/**
 * WebSocket backend (URL absolue exigée par le constructeur WebSocket). En développement, le /ws du
 * serveur Vite qui sert la page, quel que soit son port (5173, ou le suivant si 5173 est pris).
 */
export const wsDeveloppement = (loc: Pick<Location, "protocol" | "host">) =>
  `${loc.protocol === "https:" ? "wss" : "ws"}://${loc.host}/ws`;
export const WS_BASE = localDev && typeof window !== "undefined"
  ? wsDeveloppement(window.location)
  : `${NGROK_ORIGIN.replace(/^https/, "wss")}/ws`;

/** Service IA (Python / FastAPI) */
export const AI_SERVICE_BASE = "http://localhost:3000";

/** Headers communs pour ngrok */
export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
} as const;
