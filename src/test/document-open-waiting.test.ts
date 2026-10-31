import { afterEach, describe, expect, it, vi } from "vitest";
import { documentTaskKey, getDocumentTasks, openDocument, resolveDocumentUrl, trackDocumentTask } from "@/lib/openDocument";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("attente à l'ouverture des documents", () => {
  it("un second clic sur le même document réutilise la tâche en cours (une seule requête)", async () => {
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const p1 = trackDocumentTask("open:x", "open", "a.pdf", run);
    const p2 = trackDocumentTask("open:x", "open", "a.pdf", run);
    expect(p2).toBe(p1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(getDocumentTasks().map((t) => t.key)).toContain("open:x");
    release();
    await p1;
    expect(getDocumentTasks().map((t) => t.key)).not.toContain("open:x");
  });

  it("la tâche est retirée de l'attente même si le serveur refuse", async () => {
    await expect(trackDocumentTask("open:err", "open", undefined, () => Promise.reject(new Error("403")))).rejects.toThrow("403");
    expect(getDocumentTasks()).toHaveLength(0);
  });

  it("aucun onglet n'est ouvert avant la réception du fichier, ni si le serveur refuse", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "ACCES_REFUSE", message: "Pièce non communicable" }), { status: 403 })));
    await expect(openDocument({ id: 42, nomFichier: "quittance.pdf" })).rejects.toThrow("Pièce non communicable");
    expect(open).not.toHaveBeenCalled();
  });

  it("ouvrir et télécharger le même document sont deux attentes distinctes", () => {
    expect(documentTaskKey({ id: 7 }, "open")).not.toBe(documentTaskKey({ id: 7 }, "download"));
  });

  it("un chemin disque du serveur passe par l'identifiant du document", () => {
    expect(resolveDocumentUrl({ id: 9, chemin: "C:\\uploads\\a.pdf" })).toMatch(/\/documents\/9\/download$/);
  });
});
