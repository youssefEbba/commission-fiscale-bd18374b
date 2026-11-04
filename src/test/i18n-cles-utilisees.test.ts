import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

// Chaque clé « espace:chemin » écrite en clair dans le code doit exister en français : sinon la
// console se remplit d'avertissements et l'arabe affiche le texte de repli français.
const SRC = resolve(__dirname, "..");
const fichiers = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "test" || n === "locales" ? [] : fichiers(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

const fr: Record<string, unknown> = {};
for (const n of readdirSync(join(SRC, "i18n/locales/fr"))) {
  fr[n.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(SRC, "i18n/locales/fr", n), "utf8"));
}

const existe = (ns: string, chemin: string) => {
  let d: unknown = fr[ns];
  const parts = chemin.split(".");
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (d && typeof d === "object" && p in (d as object)) { d = (d as Record<string, unknown>)[p]; continue; }
    const pluriel = i === parts.length - 1 && d && typeof d === "object"
      && ["_one", "_other", "_plural"].some((s) => `${p}${s}` in (d as object));
    return !!pluriel;
  }
  return d !== undefined;
};

describe("clés de traduction citées dans le code", () => {
  it("existent toutes dans les fichiers français", () => {
    const manquantes = new Set<string>();
    for (const f of fichiers(SRC)) {
      for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*["']([a-z_]+):([A-Za-z0-9_.]+)["']/g)) {
        if (!existe(m[1], m[2])) manquantes.add(`${m[1]}:${m[2]}`);
      }
    }
    expect([...manquantes].sort()).toEqual([]);
  });
});
