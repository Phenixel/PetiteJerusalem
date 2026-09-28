import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import fr from "../locales/fr";
import NewSession from "../views/ShareReading/NewSession.vue";

/**
 * Ce que le formulaire de création répond quand un champ manque.
 *
 * Le nom et la description sont des champs natifs marqués `required` : le
 * navigateur les retient tout seul. Le type et la date limite sont des
 * commandes de la maison, sans validation native, et c'étaient justement
 * elles qu'on oubliait : en production, des formulaires remplis, des livres
 * choisis, et « Veuillez remplir tous les champs » pour seule réponse. La
 * chaîne n'était jamais créée.
 */

const captured: { event: string; props?: Record<string, unknown> }[] = [];

vi.mock("../services/authService", () => ({
  authService: {
    getCurrentUser: () => Promise.resolve({ id: "u1", name: "Lecteur", email: "l@example.com" }),
  },
}));

vi.mock("../services/sessionService", () => ({
  sessionService: {
    getBooksByType: () => Promise.resolve([]),
    formatBookName: (book: string) => book,
    createSessionWithValidation: vi.fn(() => Promise.resolve("id")),
  },
}));

vi.mock("../services/analyticsService", () => ({
  analyticsService: {
    capture: (event: string, props?: Record<string, unknown>) => {
      captured.push({ event, props });
    },
    captureException: () => {},
  },
}));

vi.mock("../services/seoService", () => ({ seoService: { setMeta: () => {} } }));

async function mount() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router: Router = createRouter({
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
  // Le compte est lu dans onMounted : sans cette attente, le formulaire
  // croirait encore avoir affaire à un visiteur.
  await nextTick();
  await nextTick();

  const field = <T extends HTMLElement>(id: string) => host.querySelector<T>(`#${id}`)!;
  return {
    host,
    field,
    fill(values: { name?: string; description?: string; type?: string; dateLimit?: string }) {
      // Le titre et la description sont de vrais champs : on les remplit comme
      // l'utilisateur. Le type et la date passent par leurs commandes, dont le
      // test n'ouvre pas les panneaux ; on pose leur valeur au montage à la
      // place, via les événements de leur `v-model`.
      if (values.name !== undefined) {
        const input = field<HTMLInputElement>("name");
        input.value = values.name;
        input.dispatchEvent(new Event("input"));
      }
      if (values.description !== undefined) {
        const input = field<HTMLTextAreaElement>("description");
        input.value = values.description;
        input.dispatchEvent(new Event("input"));
      }
    },
    submit: async () => {
      host.querySelector("form")!.dispatchEvent(new Event("submit"));
      await nextTick();
      await nextTick();
    },
    message: () => host.querySelector('[role="alert"]')?.textContent?.trim() ?? null,
    unmount: () => app.unmount(),
  };
}

describe("création d'une chaîne : les champs qui manquent", () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it("nomme le champ qui manque plutôt que de renvoyer à tout le formulaire", async () => {
    const form = await mount();
    form.fill({ name: "Tehilim pour refoua", description: "Une lecture partagée" });
    await form.submit();

    // Reste le type de texte : c'est le premier champ non renseigné dans
    // l'ordre du formulaire.
    expect(form.message()).toContain("Type de texte");
    form.unmount();
  });

  it("dit lequel à l'Error tracking, et non un « missing_fields » muet", async () => {
    const form = await mount();
    form.fill({ name: "Tehilim pour refoua", description: "Une lecture partagée" });
    await form.submit();

    const failed = captured.filter((entry) => entry.event === "session_create_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].props).toMatchObject({ reason: "validation", detail: "missing_type" });
    form.unmount();
  });

  it("ne crée pas la chaîne tant qu'un champ manque", async () => {
    const form = await mount();
    form.fill({ name: "Tehilim pour refoua", description: "Une lecture partagée" });
    await form.submit();

    expect(captured.some((entry) => entry.event === "session_created")).toBe(false);
    form.unmount();
  });
});
