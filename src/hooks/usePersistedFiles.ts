import { useEffect, useRef, useState } from "react";

/**
 * Persiste un dictionnaire de fichiers (Record<string, File>) dans IndexedDB
 * pour résister à la mise en arrière-plan d'un navigateur mobile (bascule
 * vers WhatsApp, appel, etc.) qui décharge l'onglet et perd les File objects.
 *
 * - Utilise IndexedDB (capacité largement supérieure à sessionStorage/localStorage,
 *   typiquement plusieurs centaines de Mo) pour stocker les blobs natifs.
 * - Restauration automatique au montage : les File sont reconstruits à partir
 *   des blobs et exposés à l'état React.
 * - L'utilisateur appelle `clear()` après un submit réussi.
 */

const DB_NAME = "lvbl-form-files";
const STORE = "files";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface StoredFile {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

async function idbSet(key: string, value: Record<string, StoredFile>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(key: string): Promise<Record<string, StoredFile> | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export function usePersistedFiles(
  key: string,
  enabled = true
): [Record<string, File>, React.Dispatch<React.SetStateAction<Record<string, File>>>, () => void, boolean] {
  const storageKey = `lvbl:files:${key}`;
  const [files, setFiles] = useState<Record<string, File>>({});
  const [restored, setRestored] = useState(false);
  const isFirstRender = useRef(true);

  // Restauration au montage
  useEffect(() => {
    if (!enabled) { setRestored(true); return; }
    let cancelled = false;
    idbGet(storageKey)
      .then((stored) => {
        if (cancelled || !stored) return;
        const reconstructed: Record<string, File> = {};
        for (const [k, sf] of Object.entries(stored)) {
          try {
            reconstructed[k] = new File([sf.blob], sf.name, { type: sf.type, lastModified: sf.lastModified });
          } catch { /* ignore */ }
        }
        if (Object.keys(reconstructed).length > 0) setFiles(reconstructed);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRestored(true); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistance à chaque changement
  useEffect(() => {
    if (!enabled || !restored) return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (Object.keys(files).length === 0) {
      idbDelete(storageKey).catch(() => {});
      return;
    }
    const stored: Record<string, StoredFile> = {};
    for (const [k, f] of Object.entries(files)) {
      stored[k] = { name: f.name, type: f.type, lastModified: f.lastModified, blob: f };
    }
    idbSet(storageKey, stored).catch(() => {/* quota — ignorer */});
  }, [files, storageKey, enabled, restored]);

  const clear = () => {
    setFiles({});
    idbDelete(storageKey).catch(() => {});
  };

  return [files, setFiles, clear, restored];
}
