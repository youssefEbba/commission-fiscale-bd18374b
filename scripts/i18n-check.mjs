#!/usr/bin/env node
/**
 * Compare les clés FR vs AR pour chaque namespace et liste les différences.
 * Usage: node scripts/i18n-check.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "src", "i18n", "locales");

function flatten(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...flatten(v, key));
    else out.push(key);
  }
  return out;
}

const fr = readdirSync(join(ROOT, "fr")).filter((f) => f.endsWith(".json"));
let totalKeys = 0;
let totalMissing = 0;
let totalOrphan = 0;

for (const file of fr) {
  const ns = file.replace(/\.json$/, "");
  const frObj = JSON.parse(readFileSync(join(ROOT, "fr", file), "utf8"));
  let arObj = {};
  try {
    arObj = JSON.parse(readFileSync(join(ROOT, "ar", file), "utf8"));
  } catch {
    console.log(`\n[${ns}] AR file missing`);
  }
  const frKeys = new Set(flatten(frObj));
  const arKeys = new Set(flatten(arObj));
  const missing = [...frKeys].filter((k) => !arKeys.has(k));
  const orphan = [...arKeys].filter((k) => !frKeys.has(k));
  totalKeys += frKeys.size;
  totalMissing += missing.length;
  totalOrphan += orphan.length;
  console.log(`\n[${ns}] fr=${frKeys.size}  ar=${arKeys.size}  missing=${missing.length}  orphan=${orphan.length}`);
  if (missing.length) console.log("  missing in AR:", missing.slice(0, 20).join(", ") + (missing.length > 20 ? " …" : ""));
  if (orphan.length) console.log("  orphan in AR :", orphan.slice(0, 20).join(", ") + (orphan.length > 20 ? " …" : ""));
}

console.log(`\n===\nTotal FR keys: ${totalKeys}  missing AR: ${totalMissing}  orphan AR: ${totalOrphan}`);
process.exit(totalMissing > 0 ? 1 : 0);
