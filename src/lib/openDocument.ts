// ============================================
// Helper universel d'ouverture / téléchargement de documents
// Envoie le JWT + le header ngrok-skip-browser-warning,
// puis ouvre le fichier via une URL blob (fonctionne sur Chrome/Firefox).
//
// Attente : chaque ouverture / téléchargement / génération est suivi dans un
// registre global (indicateur `DocumentTaskIndicator` + boutons `DocumentButton`).
// Un second clic sur le même document réutilise la tâche en cours au lieu de
// relancer la requête. L'attente reste sur la page courante : l'onglet du
// fichier ne s'ouvre qu'à sa réception.
// ============================================
import i18n from "@/i18n";
import { toast } from "sonner";
import { API_BASE, NGROK_HEADERS } from "./apiConfig";
import { ApiRequestError } from "./api";

export interface OpenableDoc {
  id?: number | string;
  url?: string;
  chemin?: string;
  nom?: string;
  nomFichier?: string;
}

export type DocumentTaskMode = "open" | "download" | "generate";

export interface DocumentTask {
  key: string;
  mode: DocumentTaskMode;
  label?: string;
}

// ---------- Registre des tâches en cours ----------
const inflight = new Map<string, { task: DocumentTask; promise: Promise<unknown> }>();
let snapshot: DocumentTask[] = [];
const listeners = new Set<() => void>();

function emit() {
  snapshot = Array.from(inflight.values()).map((v) => v.task);
  listeners.forEach((l) => l());
}

export function subscribeDocumentTasks(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getDocumentTasks(): DocumentTask[] {
  return snapshot;
}

export function isDocumentTaskPending(key: string): boolean {
  return inflight.has(key);
}

/**
 * Exécute une tâche documentaire en la signalant comme « en cours ».
 * Si une tâche de même clé tourne déjà, sa promesse est réutilisée (pas de double requête).
 */
export function trackDocumentTask<T>(key: string, mode: DocumentTaskMode, label: string | undefined, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing.promise as Promise<T>;
  const promise = (async () => {
    try { return await run(); }
    finally { inflight.delete(key); emit(); }
  })();
  inflight.set(key, { task: { key, mode, label }, promise });
  emit();
  return promise;
}

// ---------- Résolution d'URL ----------
const WINDOWS_PATH = /^[A-Za-z]:[\\/]/;

/** Construit l'URL absolue de téléchargement d'un document. */
export function resolveDocumentUrl(doc: OpenableDoc): string | null {
  if (doc.url && /^https?:\/\//i.test(doc.url)) return doc.url;
  const raw = doc.url || doc.chemin;
  // Un chemin disque du serveur (C:\...) n'est pas téléchargeable : passer par l'identifiant.
  if (raw && !(WINDOWS_PATH.test(raw) && doc.id != null)) {
    if (/^https?:\/\//i.test(raw)) return raw;
    const origin = API_BASE.replace(/\/api\/?$/, "");
    return origin + (raw.startsWith("/") ? "" : "/") + raw.replace(/\\/g, "/");
  }
  if (doc.id != null) return `${API_BASE}/documents/${doc.id}/download`;
  return null;
}

/** Clé stable d'une tâche (même document + même geste = même tâche). */
export function documentTaskKey(doc: OpenableDoc, mode: "open" | "download"): string {
  return `${mode}:${resolveDocumentUrl(doc) ?? doc.id ?? doc.nomFichier ?? doc.nom ?? "?"}`;
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { ...NGROK_HEADERS };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    // Le serveur renvoie une erreur structurée : afficher son message lisible, pas le JSON brut.
    let text = "";
    try { text = await res.text(); } catch { /* noop */ }
    let body: { message?: string; error?: string; code?: string } | null = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    throw new ApiRequestError({
      status: res.status,
      code: body?.code || `HTTP_${res.status}`,
      message: body?.message || body?.error || text.slice(0, 200) || `HTTP ${res.status}`,
    });
  }
  return res.blob();
}

/** Types que le navigateur sait afficher dans un onglet (sinon : téléchargement). */
function isViewable(blob: Blob): boolean {
  const type = (blob.type || "").toLowerCase();
  return type === "application/pdf" || type.startsWith("image/") || type.startsWith("text/");
}

function displayName(doc: OpenableDoc): string | undefined {
  return doc.nomFichier || doc.nom || undefined;
}

/**
 * Ouvre le document dans un nouvel onglet (auth JWT + bypass ngrok).
 * L'attente se fait sur la page courante ; l'onglet ne s'ouvre qu'une fois le fichier reçu.
 */
export function openDocument(doc: OpenableDoc): Promise<void> {
  const url = resolveDocumentUrl(doc);
  if (!url) return Promise.reject(new Error(i18n.t("common:documents.not_found") as string));
  const name = displayName(doc);
  return trackDocumentTask(documentTaskKey(doc, "open"), "open", name, async () => {
    presentBlob(await fetchAsBlob(url), name || "document", "open");
  });
}

/**
 * Affiche (onglet) ou télécharge un fichier déjà en mémoire (PDF généré dans le navigateur).
 * Si l'onglet est bloqué par le navigateur, propose un bouton « Ouvrir ».
 */
export function presentBlob(blob: Blob, filename: string, mode: "open" | "download"): void {
  const blobUrl = URL.createObjectURL(blob);
  if (mode === "download" || !isViewable(blob)) {
    triggerDownloadFromBlob(blobUrl, filename);
  } else if (!window.open(blobUrl, "_blank", "noopener,noreferrer")) {
    toast.success(i18n.t("common:documents.ready") as string, {
      description: filename,
      duration: 15_000,
      action: { label: i18n.t("common:documents.open_now") as string, onClick: () => { window.open(blobUrl, "_blank", "noopener,noreferrer"); } },
    });
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
}

/** Force le téléchargement du document (auth JWT + bypass ngrok), avec attente visible. */
export function downloadDocument(doc: OpenableDoc): Promise<void> {
  const url = resolveDocumentUrl(doc);
  if (!url) return Promise.reject(new Error(i18n.t("common:documents.not_found") as string));
  const name = displayName(doc);
  return trackDocumentTask(documentTaskKey(doc, "download"), "download", name, async () => {
    presentBlob(await fetchAsBlob(url), name || "document", "download");
  });
}

function triggerDownloadFromBlob(blobUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
