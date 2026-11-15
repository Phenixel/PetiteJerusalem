import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp, h, nextTick, ref, type App } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import AliyaCheck from "../components/AliyaCheck.vue";
import { ALIYA_CHECK_HEIGHT, aliyaChecksShareScreen } from "../services/parcours/aliyot";

/**
 * The check of an aliyah of chnei mikra (docs/design.md, « Chnei mikra is
 * checked off aliyah by aliyah »): swiped right once read, back to the left
 * to undo it, a tap for whoever does not swipe; on one line, the aliyah's
 * name and « Lue » once read; only the end check on an aliyah short enough
 * for both to share the screen; and none at all when the day's single aliyah
 * already ends with the pull of Mon parcours.
 */

let app: App | null = null;
afterEach(() => {
  app?.unmount();
  app = null;
  document.body.innerHTML = "";
});

const pause = () => new Promise((done) => setTimeout(done, 5));

async function mount(initial: boolean) {
  const done = ref(initial);
  const toggles: boolean[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp({
    render: () =>
      h(AliyaCheck, {
        done: done.value,
        name: "Rishon",
        onToggle: (next: boolean) => {
          toggles.push(next);
          done.value = next;
        },
      }),
  });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.mount(host);
  await nextTick();
  const track = host.querySelector<HTMLButtonElement>(".aliya-check")!;
  Object.defineProperty(track, "offsetWidth", { value: 360 });
  track.setPointerCapture = () => {};
  // Vue ignores an event fired in the very millisecond its listener was
  // attached, which a finger never does: the gestures come a moment later.
  await pause();
  return { track, done, toggles };
}

/** A slow horizontal swipe on the track, of `dx` pixels. */
async function swipe(track: HTMLElement, dx: number) {
  const evt = (type: string, x: number, t: number) => {
    const e = new MouseEvent(type, { clientX: x, clientY: 20, bubbles: true, button: 0 });
    Object.defineProperty(e, "pointerId", { value: 1 });
    Object.defineProperty(e, "timeStamp", { value: t });
    track.dispatchEvent(e);
  };
  await pause();
  evt("pointerdown", 100, 0);
  evt("pointermove", 100 + dx / 2, 500);
  evt("pointermove", 100 + dx, 1000);
  evt("pointerup", 100 + dx, 1000);
  // The click that follows a swipe is not a tap.
  track.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await nextTick();
}

describe("AliyaCheck", () => {
  it("is checked by a swipe to the right, and says so", async () => {
    const { track, toggles } = await mount(false);
    expect(track.getAttribute("role")).toBe("checkbox");
    expect(track.getAttribute("aria-checked")).toBe("false");
    // One line: the aliyah's name, nothing to read besides it.
    expect(track.textContent?.trim()).toBe("Rishon");
    // At rest, the knob carries its chevron, not the check it will take.
    expect(track.querySelector(".aliya-check-knob.is-checked")).toBeNull();

    await swipe(track, 160);
    expect(toggles).toEqual([true]);
    expect(track.getAttribute("aria-checked")).toBe("true");
    expect(track.textContent?.replace(/\s+/g, " ").trim()).toBe("Rishon · Lue");
  });

  it("plays the fill and the drawn check only on the check just touched", async () => {
    // Opened already read: it shows its state, without the animation.
    const read = await mount(true);
    expect(read.track.classList.contains("is-fresh")).toBe(false);
    app?.unmount();
    document.body.innerHTML = "";

    const { track } = await mount(false);
    await pause();
    track.click();
    await nextTick();
    expect(track.classList.contains("is-done")).toBe(true);
    expect(track.classList.contains("is-fresh")).toBe(true);
    // Unchecked, nothing to celebrate.
    await pause();
    track.click();
    await nextTick();
    expect(track.classList.contains("is-fresh")).toBe(false);
  });

  it("comes back without acting when let go before the threshold", async () => {
    const { track, toggles } = await mount(false);
    await swipe(track, 60);
    expect(toggles).toEqual([]);
  });

  it("is unchecked by a swipe back to the left, not by another swipe right", async () => {
    const { track, toggles } = await mount(true);
    await swipe(track, 160);
    expect(toggles).toEqual([]);
    await swipe(track, -160);
    expect(toggles).toEqual([false]);
  });

  it("is also toggled by a tap, for whoever does not swipe", async () => {
    const { track, toggles } = await mount(false);
    const tap = async () => {
      await pause();
      track.click();
      await nextTick();
    };
    await tap();
    await tap();
    expect(toggles).toEqual([true, false]);
  });
});

describe("the chnei mikra page and its aliyah checks", () => {
  const page = readFileSync(resolve(__dirname, "../views/Library/ChneiMikraPage.vue"), "utf8");
  const item = readFileSync(resolve(__dirname, "../views/Library/DailyReadingItem.vue"), "utf8");

  it("puts the check above and below each aliyah", () => {
    expect(item.match(/<AliyaCheck\b/g)?.length).toBe(2);
  });

  it("drops the check above an aliyah whose two checks would share the screen", () => {
    expect(item).toContain('v-if="block.label && aliyaChecks && !isShortAliya(section, block)"');
    // On an 812 px phone, the checks and their gaps take 120 px.
    const both = 2 * ALIYA_CHECK_HEIGHT + 32;
    expect(aliyaChecksShareScreen(812 - both, 812)).toBe(true);
    expect(aliyaChecksShareScreen(812 - both + 1, 812)).toBe(false);
    // A text not laid out yet keeps its check above it.
    expect(aliyaChecksShareScreen(0, 812)).toBe(false);
  });

  it("hides them when a single aliyah ends with the pull of the day's portion", () => {
    expect(page).toMatch(
      /hideAliyaChecks = computed\(\(\) => endPull\.value && shownAliyot\.value === 1\)/,
    );
    expect(page).toContain(':hide-aliya-checks="hideAliyaChecks"');
    expect(item).toMatch(
      /aliyaChecks = computed\(\(\) => Boolean\(props\.aliyaWeek\) && !props\.hideAliyaChecks\)/,
    );
  });
});
