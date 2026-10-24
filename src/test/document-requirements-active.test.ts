import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.mock("@/lib/apiConfig", async (orig) => ({ ...(await orig<object>()) }));

import { documentRequirementApi, isRequirementActive } from "@/lib/api";

describe("pièces de process désactivées", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("une pièce sans champ actif reste active", () => {
    expect(isRequirementActive({})).toBe(true);
  });

  it("une pièce actif:false est inactive", () => {
    expect(isRequirementActive({ actif: false })).toBe(false);
  });

  it("les écrans métier ne reçoivent pas les pièces désactivées, la configuration si", async () => {
    const rows = [
      { id: 1, processus: "MISE_EN_PLACE_CI", obligatoire: true, typesAutorises: [], actif: true },
      { id: 2, processus: "MISE_EN_PLACE_CI", obligatoire: true, typesAutorises: [], actif: false },
      { id: 3, processus: "MISE_EN_PLACE_CI", obligatoire: false, typesAutorises: [] },
    ];
    const respond = () =>
      Promise.resolve(new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } }));
    fetchMock.mockImplementation(respond);

    const metier = await documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI");
    expect(metier.map((r) => r.id)).toEqual([1, 3]);

    const config = await documentRequirementApi.getConfiguration("MISE_EN_PLACE_CI");
    expect(config.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});
