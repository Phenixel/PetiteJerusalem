import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";

/**
 * La vitesse d'écoute se choisit dans une liste : un appui sur la pastille
 * montre les vitesses, la sienne cochée, et on touche celle qu'on veut. Faire
 * défiler les vitesses d'appui en appui obligeait à passer par toutes pour
 * revenir en arrière (voir PlayerSpeed).
 */

vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));

import fr from "../locales/fr";
import PlayerSpeed from "../components/chiourim/PlayerSpeed.vue";
import { useAudioPlayer } from "../composables/useAudioPlayer";

let app: App | null = null;
let host: HTMLElement;

async function mountSpeed() {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp({ render: () => h(PlayerSpeed) });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.mount(host);
  await nextTick();
  const trigger = host.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
  if (!trigger) throw new Error("pastille de vitesse introuvable");
  return trigger;
}

/** Le menu sort avec une courte transition : on la laisse finir. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const options = () => [...host.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];

afterEach(() => {
  useAudioPlayer().setSpeed(1);
  app?.unmount();
  host?.remove();
});

describe("choisir la vitesse", () => {
  it("montre toutes les vitesses, la sienne cochée", async () => {
    const trigger = await mountSpeed();
    expect(options()).toHaveLength(0);
    trigger.click();
    await nextTick();
    expect(options().map((o) => o.textContent?.trim())).toEqual([
      "0,75×",
      "1×",
      "1,25×",
      "1,5×",
      "1,75×",
      "2×",
    ]);
    const checked = options().filter((o) => o.getAttribute("aria-checked") === "true");
    expect(checked.map((o) => o.textContent?.trim())).toEqual(["1×"]);
  });

  it("une vitesse touchée s'applique, et le menu se ferme", async () => {
    const trigger = await mountSpeed();
    trigger.click();
    await nextTick();
    options()[3].click();
    await settle();
    expect(useAudioPlayer().playbackRate.value).toBe(1.5);
    expect(options()).toHaveLength(0);
    expect(trigger.textContent?.trim()).toBe("1,5×");
  });

  it("Échap ferme le menu sans remonter plus haut (le plein écran reste ouvert)", async () => {
    const trigger = await mountSpeed();
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    trigger.click();
    await nextTick();
    options()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    document.removeEventListener("keydown", outer);
    expect(options()).toHaveLength(0);
    expect(outer).not.toHaveBeenCalled();
    expect(useAudioPlayer().playbackRate.value).toBe(1);
  });
});
