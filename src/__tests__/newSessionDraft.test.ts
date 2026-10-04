import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";

/**
 * Un visiteur sans compte remplit tout le formulaire de création, clique
 * « Créer », et l'invite l'envoie se connecter. Au retour, tous les champs
 * étaient vides. La saisie se garde désormais pour l'onglet, et s'efface à
 * la création.
 */

const { state, createSessionWithValidation } = vi.hoisted(() => ({
  state: { user: null as { id: string; name: string; email: string } | null },
  createSessionWithValidation: vi.fn(),
}));

vi.mock("../services/authService", () => ({
  authService: { getCurrentUser: () => Promise.resolve(state.user) },
}));
vi.mock("../services/sessionService", () => ({
  sessionService: {
    getBooksByType: () => Promise.resolve(["Livre 1", "Livre 2", "Livre 3"]),
    formatBookName: (book: string) => book,
    getPerpetualSession: () => Promise.resolve(null),
    createSessionWithValidation,
  },
}));
vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: () => {}, captureException: () => {} },
}));
vi.mock("../services/seoService", () => ({ seoService: { setMeta: () => {} } }));
vi.mock("../composables/useConfirm", () => ({ useConfirm: () => ({ confirm: () => true }) }));
vi.mock("../components/SignupPromptModal.vue", () => ({ default: { render: () => null } }));

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

// Node >= 22 masque le stockage de jsdom : stub mémoire minimal.
beforeAll(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
});

async function flush() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
}

async function mount() {
  const { default: NewSession } = await import("../views/ShareReading/NewSession.vue");
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
  });
  await router.push("/share-reading/new-session");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(NewSession) })
    .use(createI18n({ legacy: false, locale: "fr", messages: { fr } }))
    .use(router);
  app.directive("click-outside", {});
  app.mount(host);
  await flush();
  const field = (id: string) => host.querySelector<HTMLInputElement>(`#${id}`)!;
  const set = (id: string, value: string) => {
    field(id).value = value;
    field(id).dispatchEvent(new Event("input"));
  };
  const submit = async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit"));
    await flush();
  };
  return { host, field, set, submit, unmount: () => (app.unmount(), host.remove()) };
}

beforeEach(() => {
  sessionStorage.clear();
  state.user = null;
  createSessionWithValidation.mockReset();
  createSessionWithValidation.mockResolvedValue("chaine-1");
});

describe("le formulaire de création, le temps de se connecter", () => {
  it("retrouve la saisie au retour de la connexion, puis l'oublie une fois la chaîne créée", async () => {
    const before = await mount();
    before.set("name", "Tehilim pour refoua");
    before.set("description", "Une lecture partagée");
    before.set("type", "Tehilim");
    before.set("dateLimit", "2099-01-15");
    await flush();
    // On décoche un livre.
    const books = [...before.host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const second = books.find((box) => box.closest("label")?.textContent?.includes("Livre 2"));
    expect(second).toBeTruthy();
    second!.click();
    await flush();
    await before.submit();
    expect(createSessionWithValidation).not.toHaveBeenCalled();
    before.unmount();

    // Retour de /login, connecté.
    state.user = { id: "u1", name: "Sarah", email: "s@exemple.fr" };
    const after = await mount();
    expect(after.field("name").value).toBe("Tehilim pour refoua");
    expect(after.field("description").value).toBe("Une lecture partagée");
    expect(after.field("dateLimit").value).toBe("2099-01-15");

    await after.submit();
    expect(createSessionWithValidation).toHaveBeenCalledTimes(1);
    const args = createSessionWithValidation.mock.calls[0];
    expect(args[0]).toBe("Tehilim pour refoua");
    expect(args[6]).toEqual(["Livre 1", "Livre 3"]);
    after.unmount();

    // La chaîne créée, le brouillon ne revient plus.
    const again = await mount();
    expect(again.field("name").value).toBe("");
    again.unmount();
  });

  it("un brouillon sans type ne décoche pas les livres du type choisi au retour", async () => {
    // Le compte est vérifié avant les champs : « Créer » garde un brouillon
    // sans type, donc sans livres.
    const before = await mount();
    before.set("name", "Tehilim pour refoua");
    before.set("description", "Une lecture partagée");
    await before.submit();
    before.unmount();

    state.user = { id: "u1", name: "Sarah", email: "s@exemple.fr" };
    const after = await mount();
    expect(after.field("name").value).toBe("Tehilim pour refoua");
    after.set("type", "Tehilim");
    after.set("dateLimit", "2099-01-15");
    await flush();

    await after.submit();
    expect(createSessionWithValidation).toHaveBeenCalledTimes(1);
    expect(createSessionWithValidation.mock.calls[0][6]).toEqual(["Livre 1", "Livre 2", "Livre 3"]);
    after.unmount();
  });
});
