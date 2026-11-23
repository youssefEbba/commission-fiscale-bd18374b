import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve, relative } from "path";
import { displayRef } from "@/lib/displayRef";
import { recuFileName, recuSousTraitance, recuUtilisation } from "@/lib/recuDepotPdf";
import type { SousTraitanceDto, UtilisationCreditDto } from "@/lib/api";

// Règle de l'utilisatrice : l'id technique n'est JAMAIS affiché (il reste dans les URL et les clés React).
const SRC = resolve(__dirname, "..");
const fichiers = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return ["test", "locales", "_unrouted"].includes(n) ? [] : fichiers(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
const locales = (lang: string): string[] =>
  readdirSync(join(SRC, "i18n/locales", lang)).map((n) => join(SRC, "i18n/locales", lang, n));

describe("l'id technique n'est jamais affiché", () => {
  it("displayRef : référence, sinon numéro, sinon « — »", () => {
    expect(displayRef({ reference: "DU-0825-11-2026", numero: "X" })).toBe("DU-0825-11-2026");
    expect(displayRef({ numero: "AV-12" })).toBe("AV-12");
    expect(displayRef({ reference: null } as never)).toBe("—");
    expect(displayRef({ id: 828 } as never)).toBe("—");
    expect(displayRef(null)).toBe("—");
  });

  it("reçu : référence ST-… pour la sous-traitance, aucun id dans le nom de fichier", () => {
    expect(recuSousTraitance({ id: 7, reference: "ST-0007-11-2026", statut: "DEMANDE", certificatCreditId: 1 } as SousTraitanceDto).reference).toBe("ST-0007-11-2026");
    const sansRef = recuUtilisation({ id: 828, type: "DOUANIER", statut: "DEMANDEE", certificatCreditId: 1 } as UtilisationCreditDto);
    expect(sansRef.reference).toBe("—");
    expect(recuFileName(sansRef)).toBe("recu-depot-utilisation-douane.pdf");
  });

  it("aucun repli `#${id}` ni `#{x.id}` dans le code affiché", () => {
    const fautifs: string[] = [];
    for (const f of fichiers(SRC)) {
      readFileSync(f, "utf8").split("\n").forEach((l, i) => {
        // `#${…}` (hors couleur hexadécimale) ou `#{x.id}` en JSX.
        if ((/`#\$\{/.test(l) && !/hex|#\$\{c\[/.test(l)) || /#\{[A-Za-z_.?!]*\b(id|Id)\}/.test(l)) {
          fautifs.push(`${relative(SRC, f)}:${i + 1}`);
        }
      });
    }
    expect(fautifs).toEqual([]);
  });

  it("aucun libellé « #{{id}} » / « {{id}} » de dossier en français ni en arabe", () => {
    const fautifs: string[] = [];
    for (const f of [...locales("fr"), ...locales("ar")]) {
      readFileSync(f, "utf8").split("\n").forEach((l, i) => {
        if (/\{\{\s*id\s*\}\}/.test(l)) fautifs.push(`${relative(SRC, f)}:${i + 1}`);
      });
    }
    expect(fautifs).toEqual([]);
  });
});
