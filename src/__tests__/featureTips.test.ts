import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import type { TourStep } from "../components/FeatureTour.vue";
import type { FeatureTipId } from "../composables/useFeatureTips";

/**
 * Les astuces des pages : le geste du rappel sur les horaires, le menu de
 * lecture, les gestes du texte. Quatre promesses : chacune ne se montre
 * qu'une fois par appareil et une seule par ouverture de l'app, « Plus
 * tard » la remet à la prochaine ouverture sans la compter vue, elle se
 * joue devant la commande qu'elle explique et cette commande reste vivante
 * sous le projecteur, et elle se tait sur le site.
 */

// Les astuces ne se montrent que dans l'app native : c'est la plateforme que
// ces tests jouent, sauf ceux qui vérifient justement le silence du web.
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "ios" }));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));
// Le plugin des préférences natives n'existe pas ici : la relecture rend rien.
vi.mock("@capacitor/preferences", () => ({
  Preferences: { get: () => Promise.resolve({ value: null }), set: () => Promise.resolve() },
}));

const SEEN_KEY = "pj_tips_seen";

/** Une commande posée dans la page, avec une taille : jsdom n'en mesure aucune. */
function commande(): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = "menu";
  button.getBoundingClientRect = () =>
    ({ top: 600, left: 300, width: 44, height: 44, bottom: 644, right: 344 }) as DOMRect;
  document.body.appendChild(button);
  return button;
}

async function monte(
  steps: TourStep[],
  handlers: {
    tip?: FeatureTipId;
    after?: FeatureTipId[];
    onStep?: (index: number) => void;
    onFinish?: (via: string) => void;
  } = {},
) {
  const { default: FeatureTour } = await import("../components/FeatureTour.vue");
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(FeatureTour, {
        tip: handlers.tip ?? "reading-menu",
        steps,
        after: handlers.after,
        delay: 0,
        onStep: handlers.onStep,
        onFinish: handlers.onFinish,
      }),
  });
  app.use(i18n);
  app.mount(host);
  await pose();
  return { app };
}

/**
 * Le temps que l'astuce se décide : la relecture des préférences natives (un
 * import, donc un vrai tour de boucle), puis le délai de pose, joué par les
 * horloges factices.
 */
async function pose() {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(10);
    await nextTick();
  }
}

const bulle = () => document.querySelector<HTMLElement>('[role="dialog"]');
const bouton = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === label) ??
  null;

describe("astuces des pages", () => {
  beforeEach(() => {
    localStorage.clear();
    // L'introduction a été vue : tant qu'elle occupe l'écran, aucune astuce.
    localStorage.setItem("pj_onboarding_seen", "1");
    document.body.innerHTML = "";
    window.innerWidth = 390;
    window.innerHeight = 844;
    vi.resetModules();
    // Seuls les délais sont joués : setImmediate reste réel, c'est lui qui
    // laisse passer l'import des préférences natives.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  it("ne montre chaque astuce qu'une fois, et « Revoir les astuces » les remet en jeu", async () => {
    const { useFeatureTips } = await import("../composables/useFeatureTips");
    const tips = useFeatureTips();
    expect(await tips.shouldShowTip("zmanim-reminder")).toBe(true);

    tips.markTipSeen("zmanim-reminder");
    expect(await tips.shouldShowTip("zmanim-reminder")).toBe(false);
    expect(await tips.shouldShowTip("reading-menu")).toBe(true);
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")).toEqual(["zmanim-reminder"]);

    // Un nouveau lancement relit le stockage : elle ne revient pas.
    vi.resetModules();
    const relaunched = await import("../composables/useFeatureTips");
    expect(await relaunched.useFeatureTips().shouldShowTip("zmanim-reminder")).toBe(false);

    relaunched.useFeatureTips().resetFeatureTips();
    expect(await relaunched.useFeatureTips().shouldShowTip("zmanim-reminder")).toBe(true);
  });

  it("ignore un stockage abîmé plutôt que de se taire pour de bon", async () => {
    localStorage.setItem(SEEN_KEY, '{"pas": "une liste"}');
    const { useFeatureTips } = await import("../composables/useFeatureTips");
    expect(await useFeatureTips().shouldShowTip("reading-menu")).toBe(true);
  });

  it("éclaire la commande, avance au pas suivant et note l'astuce vue", async () => {
    const menu = commande();
    const reglages = commande();
    const steps: TourStep[] = [
      { key: "menu", title: "Le menu", text: "Un.", target: () => menu, radius: 9999 },
      { key: "settings", title: "Les réglages", text: "Deux.", target: () => reglages },
    ];
    const onStep = vi.fn();
    const onFinish = vi.fn();
    await monte(steps, { onStep, onFinish });

    expect(bulle()?.textContent).toContain("Le menu");
    expect(onStep).toHaveBeenCalledWith(0, "menu");
    // Le projecteur est percé dans le voile, à la place de la commande.
    expect(document.querySelector("svg path")?.getAttribute("d")).toContain("294");
    // La page ne défile pas sous l'astuce.
    expect(document.documentElement.style.overflow).toBe("hidden");

    bouton(fr.tips.next)?.click();
    await nextTick();
    expect(onStep).toHaveBeenCalledWith(1, "settings");
    expect(bulle()?.textContent).toContain("Les réglages");
    expect(bouton(fr.tips.done)).not.toBeNull();

    bouton(fr.tips.done)?.click();
    await nextTick();
    expect(bulle()).toBeNull();
    expect(onFinish).toHaveBeenCalledWith("next", 1);
    expect(document.documentElement.style.overflow).toBe("");
    // Vue une fois close : elle ne reviendra pas.
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")).toEqual(["reading-menu"]);
  });

  it("pose la bulle au milieu, avec sa capture, quand le pas n'a rien à éclairer", async () => {
    const capture = { render: () => h("i", { class: "capture" }) };
    await monte([{ key: "pinch", title: "Pincez", text: "Deux doigts.", component: capture }]);
    expect(bulle()?.textContent).toContain("Pincez");
    expect(bulle()?.querySelector("i.capture")).not.toBeNull();
    expect(bulle()?.querySelector(".caret")).toBeNull();
    expect(bulle()?.style.top).toBe("50%");
  });

  it("revient à la prochaine ouverture quand on le lui demande, pas avant", async () => {
    const menu = commande();
    const onFinish = vi.fn();
    const pas = [{ key: "menu", title: "Le menu", text: "Un.", target: () => menu }];
    const { app } = await monte(pas, { onFinish });
    bouton(fr.tips.later)?.click();
    await nextTick();
    expect(onFinish).toHaveBeenCalledWith("later", 0);
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
    app.unmount();

    // La même ouverture : elle ne revient pas, on l'a remise à plus tard.
    const encore = await monte(pas);
    expect(bulle()).toBeNull();
    encore.app.unmount();

    // Une demi-heure en arrière-plan vaut une nouvelle ouverture.
    const { NEW_OPENING_AFTER_MS } = await import("../composables/useFeatureTips");
    vi.setSystemTime(new Date("2026-09-18T10:00:00Z"));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.setSystemTime(new Date("2026-09-18T10:00:00Z").getTime() + NEW_OPENING_AFTER_MS);
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await monte(pas);
    expect(bulle()).not.toBeNull();
  });

  it("ne montre qu'une astuce par ouverture, et laisse une astuce en attendre une autre", async () => {
    const menu = commande();
    const pas = [{ key: "menu", title: "Le menu", text: "Un.", target: () => menu }];
    // Les gestes attendent le menu : pas encore vu, ils se taisent.
    const gestes = await monte(pas, { tip: "reading-gestures", after: ["reading-menu"] });
    expect(bulle()).toBeNull();
    gestes.app.unmount();

    const { app } = await monte(pas);
    expect(bulle()?.textContent).toContain("Le menu");
    bouton(fr.tips.done)?.click();
    await nextTick();
    app.unmount();

    // Le menu vu, mais l'ouverture est prise : les gestes attendront la prochaine.
    const memeOuverture = await monte(pas, { tip: "reading-gestures", after: ["reading-menu"] });
    expect(bulle()).toBeNull();
    memeOuverture.app.unmount();

    const { resetFeatureTipsForTests } = await import("../composables/useFeatureTips");
    resetFeatureTipsForTests(); // Une nouvelle ouverture, le stockage relu.
    await monte(pas, { tip: "reading-gestures", after: ["reading-menu"] });
    expect(bulle()?.textContent).toContain("Le menu");
  });

  it("laisse la commande répondre sous le projecteur, et suit", async () => {
    const menu = commande();
    const touchee = vi.fn();
    menu.addEventListener("click", touchee);
    const onFinish = vi.fn();
    await monte([{ key: "menu", title: "Le menu", text: "Un.", target: () => menu }], {
      onFinish,
    });
    expect(bulle()).not.toBeNull();

    menu.click();
    await nextTick();
    expect(touchee).toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledWith("target", 0);
    expect(bulle()).toBeNull();
  });

  it("se passe d'un geste, et ne revient pas", async () => {
    const menu = commande();
    const onFinish = vi.fn();
    const { app } = await monte(
      [{ key: "menu", title: "Le menu", text: "Un.", target: () => menu }],
      {
        onFinish,
      },
    );
    bouton(fr.tips.skip)?.click();
    await nextTick();
    expect(onFinish).toHaveBeenCalledWith("skip", 0);
    expect(bulle()).toBeNull();
    app.unmount();

    await monte([{ key: "menu", title: "Le menu", text: "Un.", target: () => menu }]);
    expect(bulle()).toBeNull();
  });

  it("attend sous l'introduction, et paraît quand elle se ferme", async () => {
    localStorage.removeItem("pj_onboarding_seen");
    const menu = commande();
    await monte([{ key: "menu", title: "Le menu", text: "Un.", target: () => menu }]);
    expect(bulle()).toBeNull();
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();

    // L'introduction se ferme : l'astuce de l'accueil reprend son délai.
    const { useOnboarding } = await import("../composables/useOnboarding");
    useOnboarding().completeOnboarding();
    await pose();
    expect(bulle()?.textContent).toContain("Le menu");
  });

  it("attend que la commande soit à l'écran, sans la compter vue", async () => {
    const cachee = document.createElement("button");
    document.body.appendChild(cachee); // Sans taille : masquée, ou pas encore montée.
    await monte([{ key: "menu", title: "Le menu", text: "Un.", target: () => cachee }]);
    expect(bulle()).toBeNull();
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  // En dernier : la plateforme rejouée ici vaut pour tous les imports qui
  // suivent, elle ne doit pas déteindre sur les tests de l'app native.
  it("se tait sur le site, sauf à qui la demande par l'adresse", async () => {
    vi.doMock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));
    const web = await import("../composables/useFeatureTips");
    expect(web.tipsOffered.value).toBe(false);
    expect(await web.useFeatureTips().shouldShowTip("reading-menu")).toBe(false);

    vi.resetModules();
    window.history.replaceState({}, "", "/?tips");
    try {
      const forced = await import("../composables/useFeatureTips");
      expect(forced.tipsOffered.value).toBe(true);
      // Forcée, elle se montre même déjà vue : c'est le but.
      forced.useFeatureTips().markTipSeen("reading-menu");
      expect(await forced.useFeatureTips().shouldShowTip("reading-menu")).toBe(true);
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });
});
