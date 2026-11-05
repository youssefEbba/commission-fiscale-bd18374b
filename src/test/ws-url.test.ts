import { describe, it, expect } from "vitest";
import { wsDeveloppement } from "@/lib/apiConfig";

describe("adresse WebSocket en développement", () => {
  it("suit le port de la page au lieu de viser 127.0.0.1:5173", () => {
    expect(wsDeveloppement({ protocol: "http:", host: "localhost:5174" })).toBe("ws://localhost:5174/ws");
    expect(wsDeveloppement({ protocol: "http:", host: "localhost:5173" })).toBe("ws://localhost:5173/ws");
    expect(wsDeveloppement({ protocol: "https:", host: "recette.local" })).toBe("wss://recette.local/ws");
  });
});
