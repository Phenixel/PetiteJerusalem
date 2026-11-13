import { describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

/**
 * Ce qui flotte au bas de l'écran (la pastille du défilement automatique, les
 * toasts) passe au-dessus d'un bottom sheet ouvert au lieu de disparaître
 * dessous, et le suit quand on le tire (useBottomChromeHeight).
 */

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));
vi.mock("../composables/useAudioPlayer", async () => {
  const { ref } = await import("vue");
  return { useMiniPlayerVisible: () => ref(false) };
});

import { bottomSheetSlot, useBottomChromeHeight } from "../composables/useBottomChrome";

describe("le bas de l'écran", () => {
  it("monte au-dessus d'un volet ouvert, et redescend quand il se ferme", () => {
    const scope = effectScope();
    scope.run(() => {
      const bottom = useBottomChromeHeight("1rem");
      expect(bottom.value).toBe("calc(1rem + env(safe-area-inset-bottom, 0px))");
      const volet = bottomSheetSlot();
      volet(212.4);
      expect(bottom.value).toBe("calc(1rem + 212px)");
      // Tiré plus haut : la pastille suit.
      volet(420);
      expect(bottom.value).toBe("calc(1rem + 420px)");
      volet(null);
      expect(bottom.value).toBe("calc(1rem + env(safe-area-inset-bottom, 0px))");
    });
    scope.stop();
  });
});
