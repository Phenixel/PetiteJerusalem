import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import {
  accuracyFromAndroidStatus,
  accuracyFromDegrees,
  accuracySpread,
  dialTilt,
  isFlat,
} from "../services/compassReading";

/**
 * La boussole du Kotel : la permission, la précision, la façon de la tenir.
 *
 * Trois défauts vus chez ceux qui s'en servaient, et que ces tests tiennent :
 *
 * - iOS réclamait un second appui sur « Activer la boussole » juste après
 *   celui qui ouvrait la fenêtre : la permission se demande désormais dans le
 *   geste d'ouverture, et le bouton, quand il reste, se pose sur le cadran
 *   éteint plutôt que sous un cadran qui a l'air de marcher ;
 * - une boussole mal étalonnée indiquait une fausse direction sans que rien
 *   ne le dise : la précision s'affiche, et le calibrage se propose ;
 * - le cap ne vaut qu'à plat : le cadran penche à l'opposé du téléphone tant
 *   qu'il ne l'est pas.
 */

const capture = vi.fn();
vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture },
}));

// L'étalonnage d'Android passe par un plugin natif, absent ici : son pont a
// son propre test (nativeCompassAccuracy.test.ts).
vi.mock("../services/nativeCompassAccuracy", () => ({
  watchNativeCompassAccuracy: () => () => {},
}));

import fr from "../locales/fr";

/** Un événement d'orientation, tel que Safari ou Chrome le donne. */
function oriente(props: Record<string, unknown>): void {
  const event = new Event("deviceorientation");
  Object.assign(event, { absolute: false, alpha: null, beta: 0, gamma: 0, ...props });
  window.dispatchEvent(event);
}

/** Le `requestPermission` d'iOS, posé sur un DeviceOrientationEvent factice. */
function iosDemande(reponse: () => Promise<string>) {
  const requestPermission = vi.fn(reponse);
  vi.stubGlobal(
    "DeviceOrientationEvent",
    class {
      static requestPermission = requestPermission;
    },
  );
  return requestPermission;
}

let montees: App[] = [];

/**
 * La fenêtre et son ouverture, chargées à neuf : la permission accordée se
 * garde dans le module, un test ne doit pas hériter de celle du précédent.
 */
async function monte() {
  vi.resetModules();
  const { default: KotelCompass } = await import("../components/KotelCompass.vue");
  const kotel = await import("../composables/useKotelCompass");
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(KotelCompass) });
  app.use(i18n);
  app.mount(host);
  montees.push(app);
  return kotel;
}

async function attend() {
  for (let i = 0; i < 4; i++) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

function boutonActiver(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.includes(fr.textReading.kotel.enable),
  );
}

beforeEach(() => {
  capture.mockClear();
  localStorage.clear();
});

afterEach(() => {
  for (const app of montees) app.unmount();
  montees = [];
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("boussole du Kotel : la permission", () => {
  it("se demande dans le geste même qui ouvre la fenêtre, sans second bouton", async () => {
    const requestPermission = iosDemande(() => Promise.resolve("granted"));
    const { openKotelCompass } = await monte();

    openKotelCompass("title");
    // Synchrone : un tour de boucle plus tard, Safari ne voit plus le geste.
    expect(requestPermission).toHaveBeenCalledTimes(1);

    await attend();
    oriente({ webkitCompassHeading: 90 });
    await attend();

    // La fenêtre a attendu la même réponse, sans redemander.
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(boutonActiver()).toBeUndefined();
    expect(document.body.textContent).toContain(fr.textReading.kotel.live);
  });

  it("pose le bouton sur le cadran éteint quand le geste n'a pas suffi", async () => {
    let appel = 0;
    const requestPermission = iosDemande(() =>
      ++appel === 1 ? Promise.reject(new Error("geste requis")) : Promise.resolve("granted"),
    );
    const { openKotelCompass } = await monte();

    openKotelCompass("title");
    await attend();

    const bouton = boutonActiver();
    expect(bouton).toBeDefined();
    // Le cadran est éteint et la flèche retirée : elle n'enverrait nulle part.
    expect(document.querySelector(".kotel-off")).not.toBeNull();
    expect(document.querySelector(".kotel-needle")).toBeNull();
    expect(document.querySelector(".kotel-stage")?.contains(bouton!)).toBe(true);

    bouton!.click();
    await attend();
    oriente({ webkitCompassHeading: 45 });
    await attend();

    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(boutonActiver()).toBeUndefined();
    expect(document.querySelector(".kotel-off")).toBeNull();
    expect(document.querySelector(".kotel-needle")).not.toBeNull();
  });

  it("ne demande rien là où la plateforme ne l'exige pas", async () => {
    vi.stubGlobal("DeviceOrientationEvent", class {});
    const { openKotelCompass } = await monte();

    openKotelCompass("menu");
    await attend();
    oriente({ absolute: true, alpha: 270 });
    await attend();

    expect(boutonActiver()).toBeUndefined();
    expect(document.body.textContent).toContain(fr.textReading.kotel.live);
  });
});

describe("boussole du Kotel : la précision", () => {
  it("dit une précision faible et propose de calibrer", async () => {
    iosDemande(() => Promise.resolve("granted"));
    const { openKotelCompass } = await monte();
    openKotelCompass("sidour");
    await attend();

    oriente({ webkitCompassHeading: 120, webkitCompassAccuracy: 45 });
    await attend();

    expect(document.body.textContent).toContain(fr.textReading.kotel.accuracy.lowLine);
    // Le secteur de l'incertitude est dessiné autour de la flèche.
    expect(document.querySelector(".kotel-spread")).not.toBeNull();

    const calibrer = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === fr.textReading.kotel.calibrate,
    );
    expect(calibrer?.classList.contains("btn-primary")).toBe(true);
    calibrer!.click();
    await attend();

    expect(document.body.textContent).toContain(fr.textReading.kotel.calibration.title);
    expect(capture).toHaveBeenCalledWith("kotel_compass_calibration_opened", { accuracy: "low" });

    // Le geste fait son effet : la fenêtre le dit.
    oriente({ webkitCompassHeading: 120, webkitCompassAccuracy: 10 });
    await attend();
    expect(document.body.textContent).toContain(fr.textReading.kotel.calibration.done);
  });

  it("chiffre une bonne précision quand l'appareil la donne", async () => {
    iosDemande(() => Promise.resolve("granted"));
    const { openKotelCompass } = await monte();
    openKotelCompass("title");
    await attend();

    oriente({ webkitCompassHeading: 120, webkitCompassAccuracy: 12 });
    await attend();

    expect(document.body.textContent).toContain("Précision bonne, à 12° près");
  });

  it("propose le calibrage même quand la précision est inconnue", async () => {
    vi.stubGlobal("DeviceOrientationEvent", class {});
    const { openKotelCompass } = await monte();
    openKotelCompass("title");
    await attend();

    oriente({ absolute: true, alpha: 10 });
    await attend();

    expect(document.body.textContent).toContain(fr.textReading.kotel.accuracy.unknown);
    expect(document.body.textContent).toContain(fr.textReading.kotel.calibrate);
    expect(document.querySelector(".kotel-spread")).toBeNull();
  });
});

describe("boussole du Kotel : à plat", () => {
  it("penche le cadran tant que le téléphone n'est pas à plat", async () => {
    vi.stubGlobal("DeviceOrientationEvent", class {});
    const { openKotelCompass } = await monte();
    openKotelCompass("title");
    await attend();

    oriente({ absolute: true, alpha: 0, beta: 40, gamma: -10 });
    await attend();
    const cadran = document.querySelector<HTMLElement>(".kotel-tilt")!;
    expect(cadran.style.transform).toBe("rotateX(40deg) rotateY(10deg)");
    expect(document.body.textContent).toContain(fr.textReading.kotel.flat);

    oriente({ absolute: true, alpha: 0, beta: 2, gamma: 1 });
    await attend();
    expect(document.body.textContent).toContain(fr.textReading.kotel.flatOk);
  });
});

describe("lecture de la boussole", () => {
  it("range la précision de Safari en trois niveaux", () => {
    expect(accuracyFromDegrees(10)).toBe("high");
    expect(accuracyFromDegrees(15)).toBe("high");
    expect(accuracyFromDegrees(25)).toBe("medium");
    expect(accuracyFromDegrees(45)).toBe("low");
    // Négative : le magnétomètre attend d'être étalonné.
    expect(accuracyFromDegrees(-1)).toBe("low");
  });

  it("lit le statut d'étalonnage d'Android", () => {
    expect(accuracyFromAndroidStatus(3)).toBe("high");
    expect(accuracyFromAndroidStatus(2)).toBe("medium");
    expect(accuracyFromAndroidStatus(1)).toBe("low");
    expect(accuracyFromAndroidStatus(0)).toBe("low");
    expect(accuracyFromAndroidStatus(-1)).toBe("unknown");
  });

  it("ne dessine pas d'écart qu'on ne connaît pas", () => {
    expect(accuracySpread("unknown", null)).toBeNull();
    expect(accuracySpread("high", 12)).toBe(12);
    expect(accuracySpread("medium", null)).toBe(20);
    // Borné : un secteur de 180° ne dirait plus rien.
    expect(accuracySpread("low", 90)).toBe(60);
  });

  it("penche le cadran à l'opposé du téléphone, sans le retourner", () => {
    expect(dialTilt({ beta: 0, gamma: 0 })).toEqual({ x: 0, y: 0 });
    expect(dialTilt({ beta: 30, gamma: 20 })).toEqual({ x: 30, y: -20 });
    expect(dialTilt({ beta: 85, gamma: -70 })).toEqual({ x: 55, y: 55 });
    expect(dialTilt({ beta: 150, gamma: 0 })).toEqual({ x: 55, y: 0 });
    expect(isFlat({ beta: 5, gamma: -6 })).toBe(true);
    expect(isFlat({ beta: 20, gamma: 0 })).toBe(false);
  });
});
