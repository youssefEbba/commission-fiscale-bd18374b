// ============================================
// Helper universel d'ouverture / téléchargement de documents
// Envoie le JWT + le header ngrok-skip-browser-warning,
// puis ouvre le fichier via une URL blob (fonctionne sur Chrome/Firefox).
//
// Attente : chaque ouverture / téléchargement / génération est suivi dans un
// registre global (indicateur `DocumentTaskIndicator` + boutons `DocumentButton`).
// Un second clic sur le même document réutilise la tâche en cours au lieu de
// relancer la requête. À l'ouverture, un onglet d'attente est ouvert tout de
// suite (dans le geste de l'utilisateur, donc non bloqué) puis remplacé par
// le fichier ; il est refermé si le serveur refuse.
// ============================================
import i18n from "@/i18n";
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

// ---------- Onglet d'attente ----------
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function openWaitingTab(name: string | undefined): Window | null {
  let win: Window | null = null;
  try { win = window.open("", "_blank"); } catch { win = null; }
  if (!win) return null;
  try {
    win.opener = null;
    const rtl = (i18n.language || "fr").startsWith("ar");
    const title = i18n.t("common:documents.waiting_tab_title") as string;
    const body = i18n.t("common:documents.waiting_tab_body") as string;
    const d = win.document;
    d.title = title;
    d.documentElement.lang = rtl ? "ar" : "fr";
    d.documentElement.dir = rtl ? "rtl" : "ltr";
    d.body.innerHTML = `
      <style>
        body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f6f3;color:#1f3b2c}
        .box{text-align:center;padding:32px;max-width:420px}
        .spin{width:42px;height:42px;margin:0 auto 18px;border:4px solid #d7e2d9;border-top-color:#1f6b45;border-radius:50%;animation:s 0.9s linear infinite}
        h1{font-size:17px;margin:0 0 8px}
        p{font-size:13px;margin:0;color:#56695d;word-break:break-word}
        @keyframes s{to{transform:rotate(360deg)}}
      </style>
      <div class="box" role="status" aria-live="polite">
        <div class="spin"></div>
        <h1>${escapeHtml(title)}</h1>
        ${name ? `<p><strong>${escapeHtml(name)}</strong></p>` : ""}
        <p>${escapeHtml(body)}</p>
      </div>`;
  } catch { /* onglet non modifiable : il sera simplement remplacé */ }
  return win;
}

/** Types que le navigateur sait afficher dans un onglet (sinon : téléchargement). */
function isViewable(blob: Blob): boolean {
  const type = (blob.type || "").toLowerCase();
  return type === "application/pdf" || type.startsWith("image/") || type.startsWith("text/");
}

function displayName(doc: OpenableDoc): string | undefined {
  return doc.nomFichier || doc.nom || undefined;
}

/** Ouvre le document dans un nouvel onglet (auth JWT + bypass ngrok), avec attente visible. */
export function openDocument(doc: OpenableDoc): Promise<void> {
  const url = resolveDocumentUrl(doc);
  if (!url) return Promise.reject(new Error(i18n.t("common:documents.not_found") as string));
  const key = documentTaskKey(doc, "open");
  const name = displayName(doc);
  // Onglet ouvert tout de suite (geste utilisateur) ; un second clic ne rouvre rien.
  const tab = isDocumentTaskPending(key) ? null : openWaitingTab(name);
  return trackDocumentTask(key, "open", name, async () => {
    let blob: Blob;
    try {
      blob = await fetchAsBlob(url);
    } catch (e) {
      try { tab?.close(); } catch { /* noop */ }
      throw e;
    }
    const blobUrl = URL.createObjectURL(blob);
    const filename = name || "document";
    if (isViewable(blob)) {
      let shown = false;
      if (tab && !tab.closed) {
        try { tab.location.replace(blobUrl); shown = true; } catch { shown = false; }
      }
      if (!shown) shown = !!window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!shown) triggerDownloadFromBlob(blobUrl, filename); // popup bloquée -> téléchargement
    } else {
      try { tab?.close(); } catch { /* noop */ }
      triggerDownloadFromBlob(blobUrl, filename);
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  });
}

/** Force le téléchargement du document (auth JWT + bypass ngrok), avec attente visible. */
export function downloadDocument(doc: OpenableDoc): Promise<void> {
  const url = resolveDocumentUrl(doc);
  if (!url) return Promise.reject(new Error(i18n.t("common:documents.not_found") as string));
  const name = displayName(doc);
  return trackDocumentTask(documentTaskKey(doc, "download"), "download", name, async () => {
    const blob = await fetchAsBlob(url);
    const blobUrl = URL.createObjectURL(blob);
    triggerDownloadFromBlob(blobUrl, name || "document");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
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
