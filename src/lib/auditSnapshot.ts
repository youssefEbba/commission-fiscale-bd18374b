// Résumé lisible de l'instantané d'objet d'une entrée d'audit (A29).
// `objectSnapshot` arrive en objet ou en texte JSON ; on n'affiche que des champs simples,
// les plus parlants en tête, jamais le JSON brut.

const PRIORITY_KEYS = ["reference", "numero", "statut", "motif", "intitule", "raisonSociale", "nom", "montant"];
const HIDDEN_KEYS = /^(id|.*Id|.*Ids|version|password.*|motDePasse.*|token.*|chemin.*)$/;
const MAX_FIELDS = 5;
const MAX_VALUE = 60;

function parse(snapshot: unknown): Record<string, unknown> | null {
  if (snapshot == null || snapshot === "") return null;
  if (typeof snapshot === "string") {
    try {
      const parsed = JSON.parse(snapshot);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof snapshot === "object" && !Array.isArray(snapshot) ? (snapshot as Record<string, unknown>) : null;
}

function short(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE - 1)}…` : s;
}

/** « clé : valeur · … » sur au plus 5 champs simples ; `null` si rien d'exploitable. */
export function summarizeAuditSnapshot(snapshot: unknown): string | null {
  const obj = parse(snapshot);
  if (!obj) return null;
  const keys = Object.keys(obj).filter((k) => !HIDDEN_KEYS.test(k));
  const ordered = [
    ...PRIORITY_KEYS.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !PRIORITY_KEYS.includes(k)),
  ];
  const parts: string[] = [];
  for (const k of ordered) {
    const v = short(obj[k]);
    if (v == null) continue;
    parts.push(`${k} : ${v}`);
    if (parts.length >= MAX_FIELDS) break;
  }
  return parts.length ? parts.join(" · ") : null;
}
