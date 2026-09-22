import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, effectScope, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Le passage choisi dans un texte, et la bulle qui prend la place du menu du
 * système.
 *
 * Ce qui se joue ici ne se voit dans aucun rendu : que la sélection du système
 * soit bien coupée sur les passages (sans quoi son menu, copier et traduire en
 * tête, s'ouvre par-dessus le nôtre), que la couleur de la sélection vienne du
 * thème et non du navigateur, et surtout que le signalement parte avec de quoi
 * retrouver le passage. C'est cette dernière ligne qui décide si une erreur
 * signalée se corrige ou se cherche.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

import fr from "../locales/fr";
import ReadingSelectionMenu from "../components/ReadingSelectionMenu.vue";
import {
  clearPassage,
  readingPassage,
  selectPassage,
  selectedPassageKey,
  usePassageLongPress,
  type ReadingPassage,
} from "../composables/useReadingSelection";
import { closeFeedback, feedbackPrefill, isFeedbackOpen } from "../composables/useFeedback";

/** « Au commencement Dieu créa » : de l'hébreu vocalisé, donc translittérable. */
const HEBREU = "בְּרֵאשִׁית בָּרָא אֱלֹהִים";

function passage(extra: Partial<ReadingPassage> = {}): ReadingPassage {
  const el = document.createElement("p");
  el.className = "reading-pick";
  el.textContent = HEBREU;
  document.body.appendChild(el);
  return {
    key: "1#0#3",
    el,
    hebrew: HEBREU,
    place: "Tehilim 23 · verset 4",
    url: "https://petitejerusalem.fr/bibliotheque/tehilim/tehilim-23?verset=3",
    bookmarked: null,
    ...extra,
  };
}

/**
 * Monte la bulle, un passage choisi, et rend ses commandes. L'application
 * montée est démontée après chaque cas : elle téléporte la fenêtre de partage
 * dans le <body>, qu'un simple vidage laisserait sans ses repères.
 */
let monte: App | null = null;

async function ouvre(choisi: ReadingPassage) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(ReadingSelectionMenu) });
  app.use(i18n).use(router);
  app.mount(host);
  monte = app;
  await router.isReady();
  selectPassage(choisi);
  await nextTick();
  return host;
}

/** Les commandes de la bulle, par leur intitulé. */
function commandes(host: HTMLElement): string[] {
  return [...host.querySelectorAll<HTMLElement>(".bubble-action")].map((b) =>
    (b.textContent ?? "").trim(),
  );
}

function commande(host: HTMLElement, intitule: string): HTMLElement {
  const trouve = [...host.querySelectorAll<HTMLElement>(".bubble-action")].find(
    (b) => (b.textContent ?? "").trim() === intitule,
  );
  if (!trouve) throw new Error(`commande introuvable : ${intitule} (${commandes(host)})`);
  return trouve;
}

function repart(): void {
  clearPassage();
  closeFeedback();
  feedbackPrefill.value = null;
}

afterEach(() => {
  monte?.unmount();
  monte = null;
  document.body.innerHTML = "";
});

describe("le passage choisi", () => {
  beforeEach(repart);

  it("se relâche quand on rappuie dessus, et pas quand on en choisit un autre", () => {
    const premier = passage();
    selectPassage(premier);
    expect(selectedPassageKey.value).toBe("1#0#3");

    selectPassage(passage({ key: "1#0#7" }));
    expect(selectedPassageKey.value).toBe("1#0#7");

    selectPassage(passage({ key: "1#0#7" }));
    expect(readingPassage.value).toBeNull();
  });
});

describe("la bulle de commandes", () => {
  beforeEach(repart);

  it("propose les trois gestes d'un texte, et pas le marque-page d'une tefila", async () => {
    const host = await ouvre(passage());
    expect(commandes(host)).toEqual(["Partager", "Phonétique", "Signaler"]);
  });

  it("ajoute le marque-page là où le texte en prend", async () => {
    const host = await ouvre(passage({ bookmarked: false }));
    expect(commandes(host)).toContain("Marque-page");
  });

  it("ne propose pas la phonétique d'un texte sans voyelles", async () => {
    const host = await ouvre(passage({ hebrew: "בראשית ברא" }));
    expect(commandes(host)).not.toContain("Phonétique");
  });

  it("montre la phonétique du seul passage choisi", async () => {
    const host = await ouvre(passage());
    commande(host, "Phonétique").click();
    await nextTick();
    const bulle = host.querySelector(".bubble-tl");
    // La translittération est française (voir hebrewTransliteration) : « ch »
    // et non « sh », comme partout ailleurs dans la lecture phonétique.
    expect(bulle?.textContent?.trim()).toBe("beréchit bara elohim");
    // L'endroit reste écrit au-dessus : on sait de quel passage on lit la
    // phonétique quand plusieurs se ressemblent.
    expect(host.querySelector(".bubble-place")?.textContent).toContain("Tehilim 23");
  });

  it("ouvre le signalement sur « une erreur », avec de quoi retrouver le passage", async () => {
    const host = await ouvre(passage());
    commande(host, "Signaler").click();
    await nextTick();

    expect(isFeedbackOpen.value).toBe(true);
    expect(feedbackPrefill.value?.kind).toBe("error");
    const details = feedbackPrefill.value?.details ?? "";
    expect(details).toContain("Tehilim 23 · verset 4");
    expect(details).toContain(HEBREU);
    expect(details).toContain("?verset=3");
    // La personne écrit à la suite, sans avoir à pousser le texte devant elle.
    expect(details.endsWith("\n\n")).toBe(true);
    // Le passage est relâché : la bulle ne reste pas derrière le formulaire.
    expect(readingPassage.value).toBeNull();
  });

  it("pose le marque-page et relâche le passage", async () => {
    const pose = vi.fn();
    const host = await ouvre(passage({ bookmarked: false, toggleBookmark: pose }));
    commande(host, "Marque-page").click();
    await nextTick();
    expect(pose).toHaveBeenCalledOnce();
    expect(readingPassage.value).toBeNull();
  });
});

describe("la couleur de la sélection", () => {
  const css = readFileSync(resolve(__dirname, "../assets/main.css"), "utf8");

  it("vient du thème, en clair comme en sombre", () => {
    expect(css).toMatch(/::selection\s*{\s*background-color:\s*var\(--color-selection\);/);
    // Les deux définitions du jeton, et toutes deux tirées de --color-primary,
    // que useTheme réécrit au vol : une couleur en dur ne suivrait pas le duo
    // choisi, ni la fête en cours.
    const jetons = [...css.matchAll(/--color-selection:\s*([^;]+);/g)].map((m) => m[1]);
    expect(jetons).toHaveLength(2);
    expect(jetons.every((valeur) => valeur.includes("var(--color-primary)"))).toBe(true);
  });

  it("coupe la sélection du système sur les passages, et nulle part ailleurs", () => {
    const regle = css.match(/\.reading-pick\s*{([^}]+)}/)?.[1] ?? "";
    expect(regle).toContain("user-select: none");
    expect(regle).toContain("-webkit-touch-callout: none");
    // Le fond du passage choisi est celui de la sélection : les deux façons de
    // désigner un passage se voient pareil.
    expect(css).toMatch(/\.reading-selected\s*{\s*background-color:\s*var\(--color-selection\);/);
  });
});

/**
 * L'appui long. Couper la sélection du système coupe le geste qui l'ouvrait :
 * sans ce qui suit, appuyer longuement sur un verset ne ferait plus rien du
 * tout sur un téléphone, et le geste que tout le monde connaît serait mort.
 */
describe("l'appui long sur un passage", () => {
  /** Un évènement tactile tel que jsdom sait en porter un. */
  function touche(type: string, cible: Element, x: number, y: number): void {
    const event = new Event(type, { bubbles: true });
    const points =
      type === "touchend" || type === "touchcancel" ? [] : [{ clientX: x, clientY: y }];
    Object.defineProperty(event, "touches", { value: points });
    cible.dispatchEvent(event);
  }

  let scope: ReturnType<typeof effectScope> | null = null;
  let passage: HTMLElement;
  let choisi: number;

  beforeEach(() => {
    vi.useFakeTimers();
    clearPassage();
    choisi = 0;
    passage = document.createElement("div");
    passage.className = "reading-pick";
    // Le fil répond au clic, comme les vrais passages : l'appui long n'a rien
    // à savoir de ce qu'un passage fait, il lui envoie un clic.
    passage.addEventListener("click", () => (choisi += 1));
    passage.append(document.createElement("p"));
    document.body.append(passage);
    scope = effectScope();
    scope.run(() => usePassageLongPress());
  });

  afterEach(() => {
    scope?.stop();
    scope = null;
    vi.useRealTimers();
  });

  /** Le texte du passage : c'est lui qu'un doigt touche, pas le bloc. */
  const dedans = (): Element => passage.firstElementChild as Element;

  it("ouvre le passage, et le relâchement ne le referme pas", () => {
    touche("touchstart", dedans(), 100, 200);
    vi.advanceTimersByTime(500);
    expect(choisi, "l'appui long choisit le passage").toBe(1);

    // Selon les navigateurs, relâcher envoie un clic ou non : celui qui vient
    // est le même geste, il ne doit pas rejouer le choix (ce qui le relâcherait).
    touche("touchend", dedans(), 100, 200);
    dedans().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(choisi, "le clic du relâchement ne compte pas").toBe(1);
  });

  it("ne déclenche rien quand le doigt part en défilement", () => {
    touche("touchstart", dedans(), 100, 200);
    touche("touchmove", dedans(), 100, 260);
    vi.advanceTimersByTime(500);
    touche("touchend", dedans(), 100, 260);
    expect(choisi).toBe(0);
  });

  it("laisse l'appui bref au clic ordinaire", () => {
    touche("touchstart", dedans(), 100, 200);
    vi.advanceTimersByTime(120);
    touche("touchend", dedans(), 100, 200);
    dedans().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(choisi, "le clic du navigateur passe, l'appui long n'a rien envoyé").toBe(1);
  });

  it("ne regarde pas ce qui n'est pas un passage", () => {
    const ailleurs = document.createElement("div");
    let clics = 0;
    ailleurs.addEventListener("click", () => (clics += 1));
    document.body.append(ailleurs);
    touche("touchstart", ailleurs, 10, 10);
    vi.advanceTimersByTime(500);
    expect(clics).toBe(0);
  });
});
