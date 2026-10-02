import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import fr from "../locales/fr";
import { localDayKey } from "../services/dateService";
import NewSession from "../views/ShareReading/NewSession.vue";

/**
 * Créer une chaîne qui se termine ce soir ou demain soir demande une
 * confirmation (docs/design.md, « Une chaîne courte se confirme ») : la
 * refuser ramène au champ de la date sans rien créer. Une fois créée, la
 * chaîne s'ouvre sur sa page avec `?partager=1`, qui y appelle la fenêtre de
 * partage.
 */

const { captured, confirm, createSessionWithValidation } = vi.hoisted(() => ({
  captured: [] as { event: string; props?: Record<string, unknown> }[],
  confirm: vi.fn(),
  createSessionWithValidation: vi.fn(),
}));

vi.mock("../services/authService", () => ({
  authService: {
    getCurrentUser: () => Promise.resolve({ id: "u1", name: "Lecteur", email: "l@example.com" }),
  },
}));
vi.mock("../services/sessionService", () => ({
  sessionService: {
    getBooksByType: () => Promise.resolve([]),
    formatBookName: (book: string) => book,
    createSessionWithValidation,
  },
}));
vi.mock("../services/analyticsService", () => ({
  analyticsService: {
    capture: (event: string, props?: Record<string, unknown>) => captured.push({ event, props }),
    captureException: () => {},
  },
}));
vi.mock("../services/seoService", () => ({ seoService: { setMeta: () => {} } }));
vi.mock("../composables/useConfirm", () => ({ useConfirm: () => ({ confirm }) }));

// Le type et la date sont des commandes de la maison, à panneaux : ici, de
// simples champs qui tiennent le même `v-model`.
async function plainField() {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      props: { modelValue: { type: String, default: "" } },
      emits: ["update:modelValue"],
      setup(props, { emit, attrs }) {
        return () =>
          h("input", {
            id: attrs.id,
            value: props.modelValue,
            onInput: (event: Event) =>
              emit("update:modelValue", (event.target as HTMLInputElement).value),
          });
      },
    }),
  };
}
vi.mock("../components/AppSelect.vue", plainField);
vi.mock("../components/AppDateField.vue", plainField);

let router: Router;

async function mount() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
  });
  await router.push("/share-reading/new-session");
  await router.isReady();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(NewSession) });
  app.use(i18n);
  app.use(router);
  app.directive("click-outside", {});
  app.mount(host);
  await flush();

  const set = (id: string, value: string) => {
    const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event("input"));
  };
  return {
    async create(dateLimit: string) {
      set("name", "Tehilim pour refoua");
      set("description", "Une lecture partagée");
      set("type", "Tehilim");
      set("dateLimit", dateLimit);
      await flush();
      host.querySelector("form")!.dispatchEvent(new Event("submit"));
      await flush();
    },
    unmount: () => app.unmount(),
  };
}

async function flush() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDayKey(date);
}

beforeEach(() => {
  captured.length = 0;
  confirm.mockReset();
  createSessionWithValidation.mockReset();
  createSessionWithValidation.mockResolvedValue("chaine-1");
});

describe("une chaîne qui se termine ce soir ou demain soir", () => {
  it("demande confirmation, et ne crée rien si l'on veut changer la date", async () => {
    confirm.mockResolvedValue(false);
    const form = await mount();
    await form.create(inDays(0));

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: fr.newSession.shortDeadline.title,
        message: fr.newSession.shortDeadline.today,
      }),
    );
    expect(createSessionWithValidation).not.toHaveBeenCalled();
    expect(captured).toContainEqual({
      event: "session_deadline_warned",
      props: { deadline_days: 1, confirmed: false },
    });
    form.unmount();
  });

  it("se crée une fois confirmée, et s'ouvre sur la fenêtre de partage", async () => {
    confirm.mockResolvedValue(true);
    const form = await mount();
    await form.create(inDays(1));

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: fr.newSession.shortDeadline.tomorrow }),
    );
    expect(createSessionWithValidation).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe("/share-reading/session/chaine-1"),
    );
    expect(router.currentRoute.value.query.partager).toBe("1");
    form.unmount();
  });
});

describe("une chaîne au long cours", () => {
  it("se crée sans question", async () => {
    const form = await mount();
    await form.create(inDays(10));

    expect(confirm).not.toHaveBeenCalled();
    expect(createSessionWithValidation).toHaveBeenCalledTimes(1);
    form.unmount();
  });
});
