// ================================
// Texte d'erreur affichable à l'utilisateur
// ================================
// Règle : on n'affiche que le `message` du serveur (et `details` quand c'est une
// liste de champs ou de pièces). Jamais l'objet brut, une pile d'appels ni une
// page HTML (proxy, page d'erreur du serveur web, avertissement ngrok…).

export interface ParsedApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

const MAX_MESSAGE_LENGTH = 1000;
const HTML_RE = /<\s*(!doctype|html|head|body|div|span|p|br|pre|title|h\d|table|script|style)\b/i;
const STACK_RE = /(\n\s*at\s+\S+)|(\bat\s+[\w$.]+\([\w$.]*:\d+(:\d+)?\))|(\b[\w.]+(Exception|Error):\s.*\n)/;
/** Clés techniques d'un objet `details` qui ne sont pas des champs métier. */
const TECHNICAL_KEYS = new Set(["code", "message", "error", "status", "timestamp", "path", "trace", "stack", "exception"]);

/** Renvoie un message serveur affichable, ou null s'il est vide, HTML, une pile d'appels ou démesuré. */
export function sanitizeServerMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  if (text.startsWith("<") || HTML_RE.test(text)) return null;
  if (STACK_RE.test(text)) return null;
  if (text.length > MAX_MESSAGE_LENGTH) return null;
  return text;
}

function itemText(item: unknown): string | null {
  if (typeof item === "string" || typeof item === "number") return sanitizeServerMessage(String(item));
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const label = o.libelle ?? o.label ?? o.field ?? o.champ ?? o.codeDocument ?? o.code;
    const msg = o.message ?? o.defaultMessage ?? o.erreur;
    const l = sanitizeServerMessage(label == null ? null : String(label));
    const m = sanitizeServerMessage(msg == null ? null : String(msg));
    if (l && m) return `${l} : ${m}`;
    return m || l;
  }
  return null;
}

/**
 * Lignes lisibles tirées de `details` lorsqu'il s'agit d'une liste
 * (tableau de pièces/champs, ou objet « champ → message »). Sinon : aucune ligne.
 */
export function formatErrorDetails(details: unknown): string[] {
  if (!details) return [];
  if (Array.isArray(details)) {
    return details.map(itemText).filter((s): s is string => !!s);
  }
  if (typeof details === "object") {
    const out: string[] = [];
    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      if (TECHNICAL_KEYS.has(key)) continue;
      if (Array.isArray(value)) {
        out.push(...value.map(itemText).filter((s): s is string => !!s));
      } else if (typeof value === "string") {
        const m = sanitizeServerMessage(value);
        if (m) out.push(`${key} : ${m}`);
      }
    }
    return out;
  }
  return [];
}

/** Message principal + lignes de détail qui n'y figurent pas déjà. */
export function composeErrorMessage(message: string, details: unknown): string {
  const extra = formatErrorDetails(details).filter((line) => !message.includes(line));
  return extra.length ? `${message} — ${extra.join(" ; ")}` : message;
}

/** Construit une erreur structurée à partir du statut HTTP et du corps texte de la réponse. */
export function parseApiErrorBody(status: number, text: string): ParsedApiError {
  const fallback = `Erreur ${status}`;
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) json = parsed as Record<string, unknown>;
    } catch { json = null; }
  }
  if (json) {
    const base = sanitizeServerMessage(json.message) ?? sanitizeServerMessage(json.error) ?? fallback;
    const code = typeof json.code === "string" && json.code ? json.code : "UNKNOWN";
    return { status, code, message: composeErrorMessage(base, json.details), details: json.details };
  }
  // Corps non JSON : texte court affiché seulement s'il n'est ni HTML ni une pile d'appels.
  const plain = text && text.length < 200 ? sanitizeServerMessage(text) : null;
  return { status, code: "UNKNOWN", message: plain ?? fallback };
}

/** Texte affichable pour n'importe quelle erreur attrapée (jamais `String(objet)`). */
export function displayErrorText(err: unknown, fallback: string): string {
  if (err instanceof Error) return sanitizeServerMessage(err.message) ?? fallback;
  if (typeof err === "string") return sanitizeServerMessage(err) ?? fallback;
  if (err && typeof err === "object" && "message" in err) {
    return sanitizeServerMessage((err as { message?: unknown }).message) ?? fallback;
  }
  return fallback;
}
