import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";
import { createI18n } from "vue-i18n";
import type { PrayerName } from "../models/models";
import { PrayerNamePendingError } from "../services/appError";
import fr from "../locales/fr";

/**
 * Un nom resté en route (le serveur se tait), puis réessayé avant son
 * arrivée : il aboutit par deux chemins, l'attente posée au premier essai et
 * le second essai lui-même. La fenêtre l'annonçait deux fois (deux mots à
 * l'écran, deux événements de suivi), et l'arrivée tardive fermait la fenêtre
 * même rouverte sur un autre nom.
 */

const { add, capture, success } = vi.hoisted(() => ({
  add: vi.fn(),
  capture: vi.fn(),
  success: vi.fn(),
}));

vi.mock("../services/prayerNameService", () => ({ prayerNameService: { add } }));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture } }));
vi.mock("../composables/useToast", () => ({
  useToast: () => ({ success, errorFromException: () => {} }),
}));
vi.mock("../composables/useConfirm", () => ({ useConfirm: () => ({ confirm: () => true }) }));
vi.mock("../components/AppModal.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      props: { open: Boolean },
      setup:
        (props, { slots }) =>
        () =>
          props.open ? h("div", slots.default?.()) : null,
    }),
  };
});
vi.mock("../components/AppSelect.vue", () => ({ default: { render: () => null } }));

const landedName: PrayerName = {
  id: "arrive",
  ownerId: "u1",
  gender: "male",
  firstName: "David",
  motherName: "Sarah",
  kind: "refoua",
  createdAt: new Date(),
  updatedAt: new Date(),
  expiresAt: new Date(Date.now() + 86_400_000),
};

async function flush() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

async function mount() {
  const { default: PrayerNameModal } = await import("../components/PrayerNameModal.vue");
  const state = reactive({ open: true });
  const saved = vi.fn();
  const close = vi.fn(() => (state.open = false));
  const host = document.createElement("div");
  document.body.appendChild(host);
  const Root = defineComponent({
    setup: () => () =>
      h(PrayerNameModal, {
        open: state.open,
        sessionId: "chaine-perpetuelle",
        ownerId: "u1",
        name: null,
        ownedCount: 0,
        onSaved: saved,
        onClose: close,
      }),
  });
  const app = createApp(Root).use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.mount(host);
  await flush();
  const type = async (id: string, value: string) => {
    const field = host.querySelector<HTMLInputElement>(`#${id}`)!;
    field.value = value;
    field.dispatchEvent(new Event("input"));
    await flush();
  };
  const submit = async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit"));
    await flush();
  };
  return { state, saved, close, type, submit, unmount: () => (app.unmount(), host.remove()) };
}

/** Le premier essai : le serveur se tait, l'ajout reste en route. */
function pendingAdd() {
  let land: (name: PrayerName) => void = () => {};
  const landing = new Promise<PrayerName>((resolve) => (land = resolve));
  const pending = new PrayerNamePendingError();
  pending.landing = landing;
  add.mockRejectedValueOnce(pending);
  return { landing, land };
}

beforeEach(() => {
  add.mockReset();
  capture.mockReset();
  success.mockReset();
});

describe("un nom resté en route, à son arrivée", () => {
  it("ne s'annonce qu'une fois, même réessayé avant d'arriver", async () => {
    const modal = await mount();
    await modal.type("prayer-first-name", "David");
    await modal.type("prayer-mother-name", "Sarah");

    const { landing, land } = pendingAdd();
    await modal.submit();
    expect(modal.saved).not.toHaveBeenCalled();

    // Second essai du même nom : le service reprend l'écriture en route.
    add.mockReturnValueOnce(landing);
    await modal.submit();
    land(landedName);
    await flush();

    expect(add).toHaveBeenCalledTimes(2);
    expect(modal.saved).toHaveBeenCalledTimes(1);
    expect(modal.saved).toHaveBeenCalledWith(landedName);
    expect(success).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls.filter(([event]) => event === "prayer_name_saved")).toHaveLength(1);
    expect(modal.state.open).toBe(false);
    modal.unmount();
  });

  it("rejoint la liste et ferme la fenêtre restée sur la même saisie", async () => {
    const modal = await mount();
    await modal.type("prayer-first-name", "David");
    await modal.type("prayer-mother-name", "Sarah");

    const { land } = pendingAdd();
    await modal.submit();
    land(landedName);
    await flush();

    expect(modal.saved).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledTimes(1);
    expect(modal.state.open).toBe(false);
    modal.unmount();
  });

  it("ne ferme pas la fenêtre passée à un autre nom", async () => {
    const modal = await mount();
    await modal.type("prayer-first-name", "David");
    await modal.type("prayer-mother-name", "Sarah");

    const { land } = pendingAdd();
    await modal.submit();
    // En attendant, on saisit un second nom.
    await modal.type("prayer-first-name", "Rachel");
    land(landedName);
    await flush();

    expect(modal.saved).toHaveBeenCalledTimes(1);
    expect(modal.close).not.toHaveBeenCalled();
    expect(modal.state.open).toBe(true);
    modal.unmount();
  });
});
