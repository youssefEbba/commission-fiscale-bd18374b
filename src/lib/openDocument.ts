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
import { parseApiErrorBody } from "./apiErrorText";
import { endSession } from "./session";

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

/** Hôte de l'API (et de l'application) : une URL absolue vers un autre hôte est un stockage interne. */
const HOTES_APPLICATION = (() => {
  const hotes = new Set<string>(["commission-fiscale.gov.mr"]);
  try { hotes.add(new URL(API_BASE).host); } catch { /* API_BASE relative */ }
  if (typeof window !== "undefined") hotes.add(window.location.host);
  return hotes;
})();

/**
 * Fichier stocké dans MinIO : son chemin est l'adresse interne du serveur MinIO
 * (`http://commission-minio:9000/{bucket}/{nom}`), que le navigateur ne peut pas joindre et que la
 * politique de sécurité du site bloque. On passe par l'API, qui lit l'objet côté serveur.
 */
function viaApiSiStockageInterne(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (HOTES_APPLICATION.has(u.host)) return null;
  const segments = u.pathname.split("/").filter(Boolean);
  const nom = segments.length >= 2 ? decodeURIComponent(segments[segments.length - 1]) : null;
  return nom && /^[A-Za-z0-9._-]+$/.test(nom) ? `${API_BASE}/fichiers/${nom}` : null;
}

/** Construit l'URL absolue de téléchargement d'un document. */
export function resolveDocumentUrl(doc: OpenableDoc): string | null {
  if (doc.url && /^https?:\/\//i.test(doc.url)) return viaApiSiStockageInterne(doc.url) ?? doc.url;
  const raw = doc.url || doc.chemin;

  if (raw) {
    if (/^https?:\/\//i.test(raw)) {
      return viaApiSiStockageInterne(raw) ?? raw.replace(
        /^http:\/\/commission-fiscale\.gov\.mr(?=\/|$)/i,
        "https://commission-fiscale.gov.mr"
      );
    }
    // Chemin disque Windows : le navigateur ne peut pas l'ouvrir ; on passe par l'API.
    if (WINDOWS_PATH.test(raw)) {
      if (doc.id != null) return `${API_BASE}/documents/${doc.id}/download`;
      return null;
    }
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
    // Le serveur renvoie une erreur structurée : afficher son message lisible, jamais le corps brut (JSON/HTML).
    let text = "";
    try { text = await res.text(); } catch { /* noop */ }
    if (res.status === 401 && token) endSession({ redirect: true });
    const parsed = parseApiErrorBody(res.status, text);
    throw new ApiRequestError({ ...parsed, code: parsed.code === "UNKNOWN" ? `HTTP_${res.status}` : parsed.code });
  }
  return res.blob();
}

/** Types que le navigateur sait afficher dans un onglet (sinon : téléchargement). */
export function isViewable(blob: Blob): boolean {
  // « application/pdf;charset=UTF-8 » : seul le type compte, pas ses paramètres.
  const type = (blob.type || "").toLowerCase().split(";")[0].trim();
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
