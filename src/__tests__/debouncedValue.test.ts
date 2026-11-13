import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useDebouncedValue } from "../composables/useDebouncedValue";

/**
 * The catalog searches of the parcours creation (StepText) and of the studio
 * (ChiourTexteField) ran on every key press: up to 30 ms on a desktop for a
 * word with no match. They now filter on a copy of the field that follows it
 * once typing pauses.
 */
describe("a debounced value", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("follows its source once the changes pause", async () => {
    const scope = effectScope();
    await scope.run(async () => {
      const term = ref("");
      const searched = useDebouncedValue(term, 150);
      term.value = "b";
      await nextTick();
      vi.advanceTimersByTime(100);
      term.value = "be";
      await nextTick();
      term.value = "ber";
      await nextTick();
      vi.advanceTimersByTime(149);
      expect(searched.value).toBe("");
      vi.advanceTimersByTime(1);
      expect(searched.value).toBe("ber");
    });
    scope.stop();
  });

  it("stops with its scope", async () => {
    const scope = effectScope();
    const term = ref("a");
    const searched = scope.run(() => useDebouncedValue(term, 150))!;
    term.value = "ab";
    await nextTick();
    scope.stop();
    vi.advanceTimersByTime(500);
    expect(searched.value).toBe("a");
  });
});
