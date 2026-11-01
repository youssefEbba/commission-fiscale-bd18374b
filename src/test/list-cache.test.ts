import { describe, it, expect, beforeEach, vi } from "vitest";
import { cachedList, invalidateList, clearListCache, LIST_CACHE_TTL_MS } from "@/lib/listCache";
import { SESSION_ENDED_EVENT } from "@/lib/session";

describe("cache court des listes du formulaire", () => {
  beforeEach(() => clearListCache());

  it("réutilise la liste si le formulaire est rouvert avant 2 minutes", async () => {
    let t = 0;
    const fetcher = vi.fn().mockResolvedValue([1, 2]);
    await cachedList("k", fetcher, LIST_CACHE_TTL_MS, () => t);
    t = LIST_CACHE_TTL_MS - 1;
    await cachedList("k", fetcher, LIST_CACHE_TTL_MS, () => t);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("relit la liste après 2 minutes", async () => {
    let t = 0;
    const fetcher = vi.fn().mockResolvedValue([1]);
    await cachedList("k", fetcher, LIST_CACHE_TTL_MS, () => t);
    t = LIST_CACHE_TTL_MS;
    await cachedList("k", fetcher, LIST_CACHE_TTL_MS, () => t);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("ne garde jamais un échec", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("403"));
    await expect(cachedList("k", failing)).rejects.toThrow("403");
    const ok = vi.fn().mockResolvedValue(["a"]);
    await expect(cachedList("k", ok)).resolves.toEqual(["a"]);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("relit après une création (invalidation)", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    await cachedList("k", fetcher);
    invalidateList("k");
    await cachedList("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("est vidé en fin de session", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    await cachedList("k", fetcher);
    window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
    await cachedList("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
