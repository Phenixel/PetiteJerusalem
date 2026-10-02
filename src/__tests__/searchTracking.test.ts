import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import {
  normalizeSearchQuery,
  SEARCH_QUERY_MAX,
  SEARCH_SETTLE_MS,
  useSearchTracking,
} from "../composables/useSearchTracking";

/**
 * Les recherches « posées » (`library_search_performed`,
 * `chiourim_search_performed`) : une frappe n'est pas une recherche. Le terme
 * part quand il n'a plus bougé, quand un résultat s'ouvre, ou quand on quitte
 * la page ; jamais deux fois de suite le même, et jamais un terme vide.
 */

function monte(results = 3) {
  const term = ref("");
  const track = vi.fn();
  const scope = effectScope();
  const tracking = scope.run(() =>
    useSearchTracking({ term, resultsCount: () => results, track }),
  )!;
  return { term, track, tracking, stop: () => scope.stop() };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("normalizeSearchQuery", () => {
  it("met en minuscules, resserre les espaces et tronque", () => {
    expect(normalizeSearchQuery("  Tehilim   119 ")).toBe("tehilim 119");
    expect(normalizeSearchQuery("x".repeat(80))).toHaveLength(SEARCH_QUERY_MAX);
  });
});

describe("une recherche posée", () => {
  it("part une fois le terme immobile, avec ce qu'elle trouve", async () => {
    const { term, track } = monte(7);
    term.value = "Psaume";
    await nextTick();
    vi.advanceTimersByTime(SEARCH_SETTLE_MS - 1);
    expect(track).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(track).toHaveBeenCalledWith({ query: "psaume", query_length: 6, results_count: 7 });
  });

  it("ne compte pas chaque frappe", async () => {
    const { term, track } = monte();
    for (const value of ["b", "be", "ber", "bera", "berakh"]) {
      term.value = value;
      await nextTick();
      vi.advanceTimersByTime(300);
    }
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0][0].query).toBe("berakh");
  });

  it("part tout de suite quand un résultat s'ouvre, et pas une seconde fois", async () => {
    const { term, track, tracking } = monte();
    term.value = "souccot";
    await nextTick();
    tracking.flush();
    expect(track).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("part en quittant la page, et jamais vide", async () => {
    const { term, track, stop } = monte();
    term.value = "  ";
    await nextTick();
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    expect(track).not.toHaveBeenCalled();
    term.value = "hallel";
    await nextTick();
    stop();
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ query: "hallel" }));
  });
});
