import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";

/**
 * Le miroir des téfilines : la caméra frontale, le temps de poser le bayit.
 *
 * Ce qui se teste ici n'est pas l'image, c'est l'appareil photo lui-même. Une
 * caméra qu'on allume et qu'on n'éteint pas, c'est une pastille verte qui
 * reste allumée sur le téléphone de quelqu'un qui prie, et une batterie qui
 * fond : la fermeture, la sortie de page et la fenêtre refermée pendant
 * l'allumage doivent toutes la rendre.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));

import fr from "../locales/fr";
import TefilinMirror from "../components/TefilinMirror.vue";
import { closeTefilinMirror, openTefilinMirror } from "../composables/useTefilinMirror";

/** Une piste vidéo qui sait dire si on l'a éteinte. */
function piste() {
  return { stop: vi.fn(), kind: "video" };
}

/**
 * Les fenêtres montées, démontées après chaque test : la fenêtre se téléporte
 * dans <body>, vider celui-ci à la main arracherait ses ancres sous les pieds
 * de Vue.
 */
let montees: App[] = [];

function monte() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(TefilinMirror) });
  app.use(i18n);
  app.mount(host);
  montees.push(app);
  return app;
}

/** Laisse passer l'allumage : le composant attend une frame avant l'image. */
async function attend() {
  for (let i = 0; i < 4; i++) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

afterEach(() => {
  for (const app of montees) app.unmount();
  montees = [];
  document.body.innerHTML = "";
});

beforeEach(() => {
  closeTefilinMirror();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    setTimeout(() => fn(0), 0);
    return 0;
  });
  // jsdom ne sait pas lire une vidéo.
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

describe("miroir des téfilines", () => {
  it("demande la caméra frontale à l'ouverture, et la rend à la fermeture", async () => {
    const track = piste();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track] });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    monte();

    openTefilinMirror("title");
    await attend();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia.mock.calls[0][0]).toEqual({ video: { facingMode: "user" }, audio: false });
    expect(document.querySelector("video")).not.toBeNull();
    // Les repères sont là : sans eux, le miroir ne dit rien de la place.
    expect(document.querySelector(".guide-v")).not.toBeNull();
    expect(document.querySelector(".guide-h")).not.toBeNull();

    closeTefilinMirror();
    await attend();
    expect(track.stop).toHaveBeenCalled();
    // L'élément peut s'attarder le temps du fondu de sortie ; le flux, lui,
    // est rendu et détaché.
    const image = document.querySelector<HTMLVideoElement>("video");
    expect(image?.srcObject ?? null).toBeNull();
  });

  it("rend la caméra quand la fenêtre s'est refermée pendant l'allumage", async () => {
    const track = piste();
    let donne: (flux: unknown) => void = () => {};
    const getUserMedia = vi.fn(() => new Promise((resolve) => (donne = resolve)));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    monte();

    openTefilinMirror("title");
    await nextTick();
    closeTefilinMirror();
    donne({ getTracks: () => [track] });
    await attend();

    expect(track.stop).toHaveBeenCalled();
    expect(document.querySelector("video")).toBeNull();
  });

  it("rend la caméra quand la page de lecture est quittée", async () => {
    const track = piste();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
    });
    const app = monte();

    openTefilinMirror("title");
    await attend();
    app.unmount();
    montees = montees.filter((montee) => montee !== app);

    expect(track.stop).toHaveBeenCalled();
  });

  it("se referme au toucher hors du miroir, mais pas sur l'image", async () => {
    const track = piste();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
    });
    monte();
    openTefilinMirror("title");
    await attend();

    // Sur l'image : rien ne bouge, on ajuste le bayit sans crainte.
    document.querySelector<HTMLElement>(".mirror-card")!.click();
    await attend();
    expect(track.stop).not.toHaveBeenCalled();

    // Autour : la fenêtre se ferme et la caméra s'éteint.
    document.querySelector<HTMLElement>(".mirror-overlay")!.click();
    await attend();
    expect(track.stop).toHaveBeenCalled();
  });

  it("dit ce qui manque quand la caméra est refusée", async () => {
    const refus = Object.assign(new Error("refus"), { name: "NotAllowedError" });
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(refus) },
    });
    monte();

    openTefilinMirror("title");
    await attend();

    expect(document.querySelector("video")).toBeNull();
    expect(document.body.textContent).toContain(fr.textReading.mirror.denied);
  });

  it("dit ce qui manque quand l'appareil n'a pas de caméra à donner", async () => {
    vi.stubGlobal("navigator", {});
    monte();

    openTefilinMirror("title");
    await attend();

    expect(document.body.textContent).toContain(fr.textReading.mirror.unavailable);
  });
});
