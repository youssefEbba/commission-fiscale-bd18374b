// ============================================
// Helper universel d'ouverture / téléchargement de documents
// Envoie le JWT + le header ngrok-skip-browser-warning,
// puis ouvre le fichier via une URL blob (fonctionne sur Chrome/Firefox).
// ============================================
import { API_BASE, NGROK_HEADERS } from "./apiConfig";

export interface OpenableDoc {
  id?: number | string;
  url?: string;
  chemin?: string;
  nom?: string;
  nomFichier?: string;
}

/** Construit l'URL absolue de téléchargement d'un document. */
export function resolveDocumentUrl(doc: OpenableDoc): string | null {
  const raw = doc.url || doc.chemin;
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw;
    const origin = API_BASE.replace(/\/api\/?$/, "");
    return origin + (raw.startsWith("/") ? "" : "/") + raw.replace(/\\/g, "/");
  }
  if (doc.id != null) return `${API_BASE}/documents/${doc.id}/download`;
  return null;
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { ...NGROK_HEADERS };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const t = await res.text();
      if (t) msg += ` — ${t.slice(0, 200)}`;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  return res.blob();
}

/** Ouvre le document dans un nouvel onglet (auth JWT + bypass ngrok). */
export async function openDocument(doc: OpenableDoc): Promise<void> {
  const url = resolveDocumentUrl(doc);
  if (!url) throw new Error("Document introuvable");
  const blob = await fetchAsBlob(url);
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!win) {
    // popup bloquée -> téléchargement forcé
    triggerDownloadFromBlob(blobUrl, doc.nomFichier || doc.nom || "document");
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/** Force le téléchargement du document (auth JWT + bypass ngrok). */
export async function downloadDocument(doc: OpenableDoc): Promise<void> {
  const url = resolveDocumentUrl(doc);
  if (!url) throw new Error("Document introuvable");
  const blob = await fetchAsBlob(url);
  const blobUrl = URL.createObjectURL(blob);
  triggerDownloadFromBlob(blobUrl, doc.nomFichier || doc.nom || "document");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

function triggerDownloadFromBlob(blobUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
