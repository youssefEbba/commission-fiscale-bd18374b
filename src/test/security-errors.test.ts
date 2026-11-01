import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sanitizeServerMessage, parseApiErrorBody, displayErrorText, formatErrorDetails } from "@/lib/apiErrorText";
import { endSession, registerSessionCloser, takeSessionNotice } from "@/lib/session";

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

describe("déconnexion et jetons invalidés", () => {
  beforeEach(() => {
    localStorage.setItem("auth_token", "jeton-courant");
    localStorage.setItem("auth_user", "{}");
    sessionStorage.clear();
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("Déconnexion : POST /auth/logout avec le jeton courant, puis session effacée", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    endSession({ reason: "logout", redirect: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/logout$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer jeton-courant");
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(takeSessionNotice()).toBeNull();
  });

  it("Déconnexion : un échec réseau n'empêche pas l'effacement local", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(() => endSession({ reason: "logout", redirect: false })).not.toThrow();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("401 : aucun appel de déconnexion, message « session expirée » pour la connexion", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    endSession({ redirect: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(takeSessionNotice()).toBe("expired");
    expect(takeSessionNotice()).toBeNull();
  });

  it("mot de passe changé : aucun appel de déconnexion, message dédié", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    endSession({ reason: "password_changed", redirect: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(takeSessionNotice()).toBe("password_changed");
  });
});
