import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";
import { createI18n } from "vue-i18n";

/**
 * Le bouton de téléchargement du site web : il doit mener au store de
 * l'appareil qui le regarde. Envoyer un visiteur iPhone sur Google Play, ou
 * l'inverse, c'est une impasse ; ne rien deviner du tout et proposer les deux
 * liens, non.
 */

import fr from "../locales/fr";
import AppDownloadButton from "../components/AppDownloadButton.vue";
import { storesForUserAgent } from "../composables/useAppDownload";
import { APP_STORE_URL, PLAY_STORE_URL } from "../config/stores";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
// iPadOS 13+ en mode « site pour ordinateur » : l'agent est celui d'un Mac.
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const MAC = IPAD_DESKTOP_MODE;
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function urls(userAgent: string, touchPoints = 0): string[] {
  return storesForUserAgent(userAgent, touchPoints).map((store) => store.url);
}

describe("stores proposés selon l'appareil", () => {
  it("envoie les appareils Apple sur l'App Store", () => {
    expect(urls(IPHONE)).toEqual([APP_STORE_URL]);
    expect(urls(IPAD)).toEqual([APP_STORE_URL]);
    // Un iPad qui se fait passer pour un Mac : l'écran tactile le trahit.
    expect(urls(IPAD_DESKTOP_MODE, 5)).toEqual([APP_STORE_URL]);
  });

  it("envoie les appareils Android sur le Play Store", () => {
    expect(urls(ANDROID)).toEqual([PLAY_STORE_URL]);
  });

  it("propose les deux quand l'appareil ne dit rien", () => {
    // Un ordinateur n'installe ni l'un ni l'autre : au visiteur de choisir.
    expect(urls(MAC)).toEqual([APP_STORE_URL, PLAY_STORE_URL]);
    expect(urls(WINDOWS)).toEqual([APP_STORE_URL, PLAY_STORE_URL]);
    expect(urls("")).toEqual([APP_STORE_URL, PLAY_STORE_URL]);
  });

  it("vise bien les deux fiches publiées", () => {
    expect(APP_STORE_URL).toBe("https://apps.apple.com/app/id6798778029");
    expect(PLAY_STORE_URL).toBe(
      "https://play.google.com/store/apps/details?id=fr.petitejerusalem.app",
    );
  });
});

function mount() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(AppDownloadButton) });
  app.use(i18n);
  app.mount(host);
  return host;
}

describe("AppDownloadButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("n'affiche que le lien App Store sur iPhone", () => {
    vi.stubGlobal("navigator", { userAgent: IPHONE, maxTouchPoints: 5 });
    const links = mount().querySelectorAll("a");
    expect([...links].map((link) => link.getAttribute("href"))).toEqual([APP_STORE_URL]);
    expect(links[0].getAttribute("aria-label")).toBe(fr.appDownload.appleAria);
  });

  it("affiche les deux liens sur un ordinateur", () => {
    vi.stubGlobal("navigator", { userAgent: WINDOWS, maxTouchPoints: 0 });
    const host = mount();
    expect([...host.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual([
      APP_STORE_URL,
      PLAY_STORE_URL,
    ]);
    expect(host.textContent).toContain(fr.appDownload.title);
  });
});
