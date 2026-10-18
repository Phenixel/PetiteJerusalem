import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The books pinned to the home page (composables/useHomePinned.ts and
 * content/pinnedBooks.ts): the Sidour and the Tehilim until one chooses; up
 * to three, each once, a whole section or one text of the catalog found by
 * typing; « Les trois offices » puts Chaharit, Min'ha and Arvit in place of
 * the others; the device remembers. What another version kept is set
 * straight, and a text this one does not know stays off the shelf.
 */

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

const t = (key: string): string =>
  ({ "study.types.sidour": "Sidour", "study.types.tehilim": "Tehilim" })[key] ?? key;

describe("pinned books on the home page", () => {
  it("starts with the Sidour and the Tehilim", async () => {
    const { useHomePinned } = await import("../composables/useHomePinned");
    expect(useHomePinned().pinned.value).toEqual(["book:sidour", "book:tehilim"]);
  });

  it("pins up to three, each once, and the device remembers", async () => {
    const { useHomePinned, PRAYERS_PINNED } = await import("../composables/useHomePinned");
    const home = useHomePinned();
    home.pin("text:1");
    home.pin("text:1");
    home.pin("book:talmud");
    expect(home.pinned.value).toEqual(["book:sidour", "book:tehilim", "text:1"]);
    home.unpin("book:tehilim");
    home.pin("book:talmud");
    expect(home.pinned.value).toEqual(["book:sidour", "text:1", "book:talmud"]);
    home.replace(PRAYERS_PINNED);
    vi.resetModules();
    const again = (await import("../composables/useHomePinned")).useHomePinned();
    expect(again.pinned.value).toEqual(["text:345", "text:346", "text:347"]);
  });

  it("sets straight what another version kept", async () => {
    const { normalizePinned } = await import("../composables/useHomePinned");
    expect(normalizePinned(null)).toEqual(["book:sidour", "book:tehilim"]);
    expect(
      normalizePinned({ items: ["book:zohar", "text:2", "text:2", "audio:x", "book:tanakh"] }),
    ).toEqual(["text:2", "book:tanakh"]);
    expect(normalizePinned({ items: ["text:1", "text:2", "text:3", "text:4"] })).toHaveLength(3);
  });

  it("finds the services by name, and leaves out a text it does not know", async () => {
    const { resolvePin, searchPinnable } = await import("../content/pinnedBooks");
    const { PRAYERS_PINNED } = await import("../composables/useHomePinned");
    expect(PRAYERS_PINNED.map((ref) => resolvePin(ref, t, "fr")?.cover)).toEqual([
      "Chaharit",
      "Min'ha",
      "Arvit",
    ]);
    expect(searchPinnable("minha", t, "fr")[0]?.ref).toBe("text:346");
    expect(searchPinnable("berakhot", t, "fr").map((book) => book.ref)).toContain("text:1");
    expect(searchPinnable("sid", t, "fr")[0]?.ref).toBe("book:sidour");
    expect(resolvePin("text:999999", t, "fr")).toBeNull();
  });
});
