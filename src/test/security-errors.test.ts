import { describe, it, expect, beforeEach } from "vitest";
import { sanitizeServerMessage, parseApiErrorBody, displayErrorText, formatErrorDetails } from "@/lib/apiErrorText";
import { endSession, registerSessionCloser } from "@/lib/session";

describe("messages d'erreur affichables", () => {
  it("refuse une page HTML", () => {
    expect(sanitizeServerMessage("<!DOCTYPE html><html><body>502</body></html>")).toBeNull();
    expect(parseApiErrorBody(502, "<html><body>Bad gateway</body></html>").message).toBe("Erreur 502");
  });

  it("refuse une pile d'appels", () => {
    const stack = "java.lang.IllegalStateException: boom\n\tat fr.cf.Service.run(Service.java:42)";
    expect(sanitizeServerMessage(stack)).toBeNull();
  });

  it("garde le message du serveur pour le blocage de connexion (429)", () => {
    const body = JSON.stringify({ status: 429, code: "TOO_MANY_ATTEMPTS", message: "Trop de tentatives de connexion : réessayez dans 15 minute(s)" });
    expect(parseApiErrorBody(429, body).message).toBe("Trop de tentatives de connexion : réessayez dans 15 minute(s)");
  });

  it("ajoute la liste des champs ou pièces de details", () => {
    const body = JSON.stringify({ code: "VALIDATION_FAILED", message: "Données invalides", details: { montant: "doit être positif" } });
    expect(parseApiErrorBody(400, body).message).toBe("Données invalides — montant : doit être positif");
    expect(formatErrorDetails(["DECISION_COMMISSION"])).toEqual(["DECISION_COMMISSION"]);
  });

  it("n'affiche jamais un objet brut", () => {
    expect(displayErrorText({ foo: 1 }, "Erreur")).toBe("Erreur");
  });
});

describe("fin de session", () => {
  beforeEach(() => {
    localStorage.setItem("auth_token", "x");
    localStorage.setItem("auth_user", "{}");
  });

  it("efface jeton et utilisateur et ferme les connexions temps réel", () => {
    let closed = 0;
    registerSessionCloser(() => { closed += 1; });
    endSession({ redirect: false });
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(closed).toBe(1);
  });
});
