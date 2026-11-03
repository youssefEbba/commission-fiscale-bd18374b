import i18next from "i18next";
import { API_BASE } from "../apiConfig";
import { parseApiErrorBody, displayErrorText } from "../apiErrorText";
import { endSession, clearStoredSession } from "../session";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  rawBody?: FormData;
  skipAuthRedirect?: boolean;
  /** Route publique : n'envoie pas le jeton même si une session existe. */
  noAuth?: boolean;
}

// Structured error from the backend (GlobalExceptionHandler)
export interface ApiError {
  timestamp?: string;
  status: number;
  code: string;
  message: string;
  error?: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(apiError: ApiError) {
    super(apiError.message || apiError.error || `Erreur ${apiError.status}`);
    this.name = "ApiRequestError";
    this.status = apiError.status;
    this.code = apiError.code;
    this.details = apiError.details;
  }
}

// Known backend error codes
export const ApiErrorCode = {
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  ACCESS_DENIED: "ACCESS_DENIED",
  ROLE_FORBIDDEN: "ROLE_FORBIDDEN",
  CONFLICT: "CONFLICT",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  WORKFLOW_TRANSITION_INVALID: "WORKFLOW_TRANSITION_INVALID",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  STORAGE_UPLOAD_FAILED: "STORAGE_UPLOAD_FAILED",
  OBJECT_STORAGE_UNAVAILABLE: "OBJECT_STORAGE_UNAVAILABLE",
  EXTERNAL_EXCHANGE_SERVICE_UNAVAILABLE: "EXTERNAL_EXCHANGE_SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  // Codes métier marché / correction
  MARCHE_HORS_PERIMETRE_AC: "MARCHE_HORS_PERIMETRE_AC",
  MARCHE_DEJA_LIE_CORRECTION: "MARCHE_DEJA_LIE_CORRECTION",
  MARCHE_DEMANDE_ACTIVE: "MARCHE_DEMANDE_ACTIVE",
  // Brouillon / édition
  DEMANDE_NON_EDITABLE: "DEMANDE_NON_EDITABLE",
} as const;

/** Extrait un code métier depuis details.code (fallback sur err.code). */
export function getApiErrorBusinessCode(err: unknown): string | undefined {
  if (!isApiError(err)) return undefined;
  const detailsCode = (err.details && typeof err.details === "object" && (err.details as any).code) || undefined;
  return detailsCode || err.code;
}

/** Construit un message utilisateur lisible à partir d'une erreur API. */
export function formatApiErrorMessage(err: unknown, fallback = "Une erreur est survenue"): string {
  if (!isApiError(err)) return displayErrorText(err, fallback);
  const safe = displayErrorText(err, "");
  if (safe) return safe;
  const code = getApiErrorBusinessCode(err);
  switch (code) {
    case "MARCHE_HORS_PERIMETRE_AC":
      return "Ce marché n'appartient pas à votre Autorité Contractante.";
    case "MARCHE_DEJA_LIE_CORRECTION":
    case "MARCHE_DEMANDE_ACTIVE":
      return "Ce marché est déjà associé à une demande de correction active.";
    case "OBJECT_STORAGE_UNAVAILABLE":
    case "STORAGE_UPLOAD_FAILED":
      return "Stockage indisponible. Aucune modification n'a été enregistrée — veuillez réessayer.";
    default:
      return err.message || fallback;
  }
}

/** True si l'erreur correspond à une panne de stockage objet (MinIO) — rollback côté backend. */
export function isStorageUnavailableError(err: unknown): boolean {
  const code = getApiErrorBusinessCode(err);
  return code === "OBJECT_STORAGE_UNAVAILABLE" || code === "STORAGE_UPLOAD_FAILED";
}

export function isApiError(err: unknown): err is ApiRequestError {
  return err instanceof ApiRequestError;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem("auth_token");

  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
    ...options.headers,
  };

  if (!options.rawBody) {
    headers["Content-Type"] = "application/json";
  }

  if (token && !options.noAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.rawBody ? options.rawBody : options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    // Erreur structurée : seul le message (et la liste de champs/pièces) est conservé,
    // jamais une page HTML ni une pile d'appels.
    const text = await res.text().catch(() => "");
    const apiError: ApiError = parseApiErrorBody(res.status, text);
    // Envoi de fichier refusé faute de stockage : message clair, identique sur tous les écrans de dépôt.
    if (options.rawBody && (res.status === 503 || apiError.code === "OBJECT_STORAGE_UNAVAILABLE" || apiError.code === "STORAGE_UPLOAD_FAILED")) {
      apiError.message = i18next.t("errors:upload_unavailable", {
        defaultValue: "Le dépôt des documents est momentanément indisponible, réessayez plus tard.",
      });
    }

    // 401 : fin de session (jeton/utilisateur effacés, WebSocket fermés, retour à /login)
    if (res.status === 401 && !options.skipAuthRedirect) {
      const hadToken = !!localStorage.getItem("auth_token");
      if (hadToken) endSession({ redirect: true });
      else clearStoredSession();
    }

    throw new ApiRequestError(apiError);
  }

  if (res.status === 204) return undefined as T;
  const body = await res.text();
  if (!body) return undefined as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    // Réponse non JSON (page HTML d'un proxy…) : ne jamais l'afficher.
    throw new ApiRequestError({ status: res.status, code: "INVALID_RESPONSE", message: "Réponse inattendue du serveur." });
  }
}

export const normalizeDocs = <T extends { type?: string; codeDocument?: string; typeDocument?: string }>(list: T[]): T[] =>
  (list ?? []).map(d => ({
    ...d,
    type: (d.codeDocument ?? d.type ?? (d as any).typeDocument ?? "") as string,
    codeDocument: (d.codeDocument ?? (d as any).typeDocument ?? d.type ?? "") as string,
  }));
