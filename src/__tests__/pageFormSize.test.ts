import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { MIN_DAF_PAGE, pageZoomFrame } from "../services/pageZoom";

/**
 * The form of the page (the Vilna daf, the Sefer Torah column) has a size of
 * its own, apart from the text's: the size that suits a prayer is not the one
 * that keeps the lines of a page, and going from one to the other used to
 * undo the one that had been set. A− / A+ and the pinch drive the page's
 * size while a page is on screen, between bounds that keep its lines.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));

const { analyticsService } = await import("../services/analyticsService");
const {
  PAGE_FORM_SCALES,
  usePageFormShown,
  usePageFormSize,
  useReadingSize,
  useReadingSizeControl,
} = await import("../composables/useReadingSize");

/** Mounts a stand-in for TalmudDafPages / TorahScroll while `shown` is true. */
function mountPageForm(kind: "daf" | "scroll") {
  const shown = ref(true);
  const Page = defineComponent({
    setup() {
      usePageFormShown(kind);
      return () => h("div");
    },
  });
  const host = document.createElement("div");
  const app = createApp({ render: () => (shown.value ? h(Page) : null) });
  app.mount(host);
  return { shown, unmount: () => app.unmount() };
}

function reset() {
  const text = useReadingSize();
  const page = usePageFormSize();
  text.level.value = 1;
  page.level.value = 0;
}

describe("la taille de la forme de la page", () => {
  beforeEach(() => {
    reset();
    localStorage.clear();
    vi.mocked(analyticsService.capture).mockClear();
  });

  it("part de la page à sa largeur ordinaire, et ne descend pas plus bas", () => {
    const page = usePageFormSize();
    expect(page.scale.value).toBe(1);
    expect(page.canDecrease.value).toBe(false);
    page.decrease();
    expect(page.scale.value).toBe(1);
    expect(Math.min(...PAGE_FORM_SCALES)).toBe(1);
  });

  it("s'arrête à son plus grand cran", () => {
    const page = usePageFormSize();
    for (let i = 0; i < PAGE_FORM_SCALES.length + 2; i++) page.increase();
    expect(page.scale.value).toBe(Math.max(...PAGE_FORM_SCALES));
    expect(page.canIncrease.value).toBe(false);
  });

  it("ne touche pas à la taille du texte, ni l'inverse", () => {
    const text = useReadingSize();
    const page = usePageFormSize();
    page.increase();
    page.increase();
    expect(text.scale.value).toBe(1);
    text.decrease();
    expect(page.scale.value).toBe(PAGE_FORM_SCALES[2]);
  });

  it("se garde sur l'appareil, sous sa propre clé", () => {
    usePageFormSize().increase();
    expect(localStorage.getItem("pj-page-form-size")).toBe("1");
    expect(localStorage.getItem("pj-reading-size")).toBeNull();
  });

  it("est ce que pilotent A− / A+ tant qu'une page est à l'écran", async () => {
    const control = useReadingSizeControl();
    const text = useReadingSize();
    const page = usePageFormSize();

    control.increase();
    expect(text.level.value).toBe(2);

    const daf = mountPageForm("daf");
    await nextTick();
    expect(control.scale.value).toBe(1);
    expect(control.canDecrease.value).toBe(false);
    control.increase();
    expect(page.level.value).toBe(1);
    expect(text.level.value).toBe(2);

    // Back to a prayer: the text's size is where it was left.
    daf.shown.value = false;
    await nextTick();
    expect(control.scale.value).toBe(text.scale.value);
    control.decrease();
    expect(text.level.value).toBe(1);
    expect(page.level.value).toBe(1);
    daf.unmount();
  });

  it("dit au suivi laquelle des deux tailles a bougé", async () => {
    const control = useReadingSizeControl();
    control.increase();
    const scroll = mountPageForm("scroll");
    await nextTick();
    control.increase();
    scroll.unmount();
    const forms = vi
      .mocked(analyticsService.capture)
      .mock.calls.map(([, props]) => (props as { form: string }).form);
    expect(forms).toEqual(["text", "scroll"]);
  });
});

describe("la page du daf la plus étroite", () => {
  it("est plus large qu'un téléphone : ses commentaires ne passent pas sous 8 px", () => {
    // Rachi and Tossafot are written at about 2 % of the page's width.
    expect(MIN_DAF_PAGE * 0.02).toBeGreaterThanOrEqual(8);
    expect(pageZoomFrame(1, 328, 0, 0, 328, MIN_DAF_PAGE).page).toBe(MIN_DAF_PAGE);
  });

  it("et chaque cran agrandit à partir d'elle", () => {
    const steps = PAGE_FORM_SCALES.map(
      (scale) => pageZoomFrame(scale, 328, 0, 0, 328, MIN_DAF_PAGE).page,
    );
    expect(steps[1]).toBeCloseTo(MIN_DAF_PAGE * PAGE_FORM_SCALES[1]);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
  });

  it("ne change rien quand la colonne est déjà plus large : un ordinateur", () => {
    expect(pageZoomFrame(1.35, 650, 0, 0, 650, MIN_DAF_PAGE).page).toBeCloseTo(650 * 1.35);
  });
});
