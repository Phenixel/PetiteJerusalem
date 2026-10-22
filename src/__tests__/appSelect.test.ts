import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

/**
 * AppSelect opens its list where it can be read: below the field when it
 * fits there, above it when the field is the last row of a screen (the
 * « Avant une tefila » setting, above the tab bar of the app), where a list
 * opened downward showed its first line only.
 */

vi.mock("../composables/useAudioPlayer", () => ({ useMiniPlayerVisible: () => ref(false) }));
vi.mock("../composables/useReadingTable", () => ({ tableBarVisible: ref(false) }));

import AppSelect from "../components/AppSelect.vue";

const OPTIONS = [
  { value: "offer", label: "Me proposer les modes" },
  { value: "always", label: "Les activer d'office" },
  { value: "never", label: "Ne rien proposer" },
];

const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")!;

afterEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
  document.body.innerHTML = "";
});

/** The field `top` pixels from the top of a 800 px screen, its list 130 px tall. */
async function open(top: number): Promise<{ list: HTMLElement; unmount: () => void }> {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return (this as HTMLElement).getAttribute("role") === "listbox" ? 130 : 0;
    },
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const value = ref("offer");
  const app = createApp({
    render: () =>
      h(AppSelect, {
        options: OPTIONS,
        modelValue: value.value,
        "onUpdate:modelValue": (next: string) => (value.value = next),
      }),
  });
  app.mount(host);
  const field = host.querySelector<HTMLButtonElement>("button")!;
  field.getBoundingClientRect = () => ({ top, bottom: top + 48 }) as DOMRect;
  field.click();
  await nextTick();
  await nextTick();
  return { list: host.querySelector<HTMLElement>("[role=listbox]")!, unmount: () => app.unmount() };
}

describe("AppSelect, where its list opens", () => {
  it("opens below the field when the list fits there", async () => {
    const { list, unmount } = await open(200);
    expect(list.classList.contains("mt-1")).toBe(true);
    expect(list.classList.contains("bottom-full")).toBe(false);
    unmount();
  });

  it("opens above the field when it is at the bottom of the screen", async () => {
    const { list, unmount } = await open(720);
    expect(list.classList.contains("bottom-full")).toBe(true);
    expect(list.classList.contains("mt-1")).toBe(false);
    unmount();
  });
});
