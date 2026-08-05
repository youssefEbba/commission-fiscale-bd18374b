import { signatureApi, SIGNATURE_CONSTRAINTS, type SignatureDto } from "@/lib/api";

/**
 * Récupération des signatures actives pour la génération PDF (jsPDF).
 * jsPDF ne sait pas suivre une URL protégée par JWT : on passe donc par
 * `GET /api/signatures/{id}/base64` qui renvoie une data URL exploitable
 * directement par `doc.addImage(dataUrl, "PNG", ...)`.
 */

export interface ActiveSignature {
  dto: SignatureDto;
  dataUrl: string;
}

const cache = new Map<string, Promise<ActiveSignature | null>>();

const keyOf = (role: string, utilisateurId?: number) => `${role}|${utilisateurId ?? ""}`;

/**
 * Signature active d'un rôle (et optionnellement d'un utilisateur précis).
 * Retourne `null` si aucune signature n'est configurée ou si l'API échoue :
 * la génération du document ne doit jamais être bloquée.
 */
export function getActiveSignature(role: string, utilisateurId?: number): Promise<ActiveSignature | null> {
  const key = keyOf(role, utilisateurId);
  const hit = cache.get(key);
  if (hit) return hit;

  const p = (async (): Promise<ActiveSignature | null> => {
    try {
      const dto = await signatureApi.getActive(role, utilisateurId);
      if (!dto?.id) return null;
      const { dataUrl } = await signatureApi.getBase64(dto.id);
      if (!dataUrl) return null;
      return { dto, dataUrl };
    } catch {
      return null;
    }
  })();

  cache.set(key, p);
  // Ne pas mémoriser un échec définitivement
  void p.then((v) => {
    if (!v) cache.delete(key);
  });
  return p;
}

/** Data URL seule (raccourci pour les générateurs PDF). */
export async function getActiveSignatureDataUrl(role: string, utilisateurId?: number): Promise<string | null> {
  const s = await getActiveSignature(role, utilisateurId);
  return s?.dataUrl ?? null;
}

/** À appeler après un upload / remplacement / désactivation. */
export function clearSignatureCache() {
  cache.clear();
}

export interface SignatureFileCheck {
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
  dataUrl?: string;
}

/**
 * Validation côté client (feedback immédiat) — le serveur reste la source de vérité.
 * Vérifie le type PNG (extension + signature magique), la taille et les dimensions.
 */
export async function validateSignatureFile(file: File): Promise<SignatureFileCheck> {
  if (file.size > SIGNATURE_CONSTRAINTS.maxBytes) {
    return { ok: false, error: "Fichier trop volumineux : 1 Mo maximum." };
  }

  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isPng = head.length === 8 && PNG_MAGIC.every((b, i) => head[i] === b);
  if (!isPng) {
    return { ok: false, error: "Format invalide : seules les images PNG (fond transparent) sont acceptées." };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  }).catch(() => "");

  if (!dataUrl) return { ok: false, error: "Impossible de lire le fichier." };

  const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

  if (!dims) return { ok: false, error: "Image illisible." };
  if (dims.w > SIGNATURE_CONSTRAINTS.maxWidth || dims.h > SIGNATURE_CONSTRAINTS.maxHeight) {
    return {
      ok: false,
      error: `Dimensions trop grandes (${dims.w}x${dims.h}) : maximum ${SIGNATURE_CONSTRAINTS.maxWidth}x${SIGNATURE_CONSTRAINTS.maxHeight} px.`,
    };
  }

  return { ok: true, width: dims.w, height: dims.h, dataUrl };
}
