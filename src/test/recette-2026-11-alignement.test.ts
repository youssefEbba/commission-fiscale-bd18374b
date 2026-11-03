import { describe, it, expect, vi } from "vitest";
import { submitIfDraft, draftOutcomeMessage, isRouteUnavailable } from "@/lib/submission";
import { summarizeAuditSnapshot } from "@/lib/auditSnapshot";
import { miseEnPlaceDepotRequirements } from "@/lib/certificatEditability";

const t = (key: string, opts?: Record<string, unknown>) => (opts?.list ? `${key}:${opts.list}` : key);

describe("A42/A16/A31 — soumettre seulement un brouillon", () => {
  it("n'appelle pas /soumettre sur une demande déjà envoyée", async () => {
    const soumettre = vi.fn();
    const outcome = await submitIfDraft({ statut: "ENVOYEE" }, soumettre);
    expect(outcome.kind).toBe("already_sent");
    expect(soumettre).not.toHaveBeenCalled();
    expect(draftOutcomeMessage(outcome, t, (c) => c)).toBeNull();
  });

  it("liste les pièces manquantes et laisse la demande en brouillon", async () => {
    const err = { status: 400, message: "Documents obligatoires manquants: [FACTURE]", details: ["FACTURE", "CONTRAT"] };
    const outcome = await submitIfDraft({ statut: "BROUILLON" }, () => Promise.reject(err));
    expect(outcome).toMatchObject({ kind: "missing_documents", codes: ["FACTURE", "CONTRAT"] });
    expect(draftOutcomeMessage(outcome, t, (c) => c.toLowerCase())?.description).toBe("common:submission.missing_docs_desc:facture, contrat");
  });

  it("une route absente (405, 404 sans code) ne casse pas l'écran", async () => {
    expect(isRouteUnavailable({ status: 405 })).toBe(true);
    expect(isRouteUnavailable({ status: 404, code: "RESOURCE_NOT_FOUND" })).toBe(false);
    const outcome = await submitIfDraft({ statut: "BROUILLON" }, () => Promise.reject({ status: 404 }));
    expect(outcome.kind).toBe("route_unavailable");
    expect(draftOutcomeMessage(outcome, t, (c) => c)?.title).toBe("common:submission.unavailable_title");
  });

  it("relance les autres erreurs", async () => {
    await expect(submitIfDraft({ statut: "BROUILLON" }, () => Promise.reject({ status: 409, message: "x" }))).rejects.toMatchObject({ status: 409 });
  });
});

describe("A43 — certificat signé hors du dépôt de la mise en place", () => {
  it("retire CERTIFICAT_CREDIT_IMPOTS (code ou type)", () => {
    const reqs = [{ codeDocument: "CONTRAT" }, { codeDocument: "CERTIFICAT_CREDIT_IMPOTS" }, { typeDocument: "CERTIFICAT_CREDIT_IMPOTS" }];
    expect(miseEnPlaceDepotRequirements(reqs)).toEqual([{ codeDocument: "CONTRAT" }]);
  });
});

describe("A29 — résumé de l'instantané d'audit", () => {
  it("met les champs parlants en tête et masque les identifiants", () => {
    const resume = summarizeAuditSnapshot(JSON.stringify({ id: 49, entrepriseId: 3, montant: 1200, statut: "RECUE", reference: "DC-0049-2026", lignes: [1] }));
    expect(resume).toBe("reference : DC-0049-2026 · statut : RECUE · montant : 1200");
  });
  it("renvoie null pour un instantané absent ou illisible", () => {
    expect(summarizeAuditSnapshot(null)).toBeNull();
    expect(summarizeAuditSnapshot("{pas du json")).toBeNull();
    expect(summarizeAuditSnapshot([1, 2])).toBeNull();
  });
});
