import { describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";

/**
 * Aucune adresse email ne part vers PostHog par l'URL. L'invitation à créer un
 * compte, après une réservation d'invité, ouvrait `/login?email=<adresse>` :
 * le `$pageview` et chaque événement de la page l'emportaient dans
 * `$current_url`, et le replay aussi. L'adresse passe désormais par l'état de
 * la navigation, et `before_send` retire le paramètre de toute URL envoyée.
 */

const { posthog } = vi.hoisted(() => ({
  posthog: {
    init: vi.fn(),
    register: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    has_opted_out_capturing: vi.fn(() => false),
    stopSessionRecording: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("posthog-js", () => ({ default: posthog }));
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {}, isAuthResolved: () => true },
}));
vi.mock("../composables/useConsent", () => ({
  getConsentChoice: () => "granted",
  onConsentChange: vi.fn(),
}));

describe("les URL envoyées à PostHog", () => {
  it("perdent le paramètre email, et lui seul", async () => {
    const { withoutPersonalParams } = await import("../services/analyticsService");
    expect(
      withoutPersonalParams(
        "https://petite-jerusalem.fr/login?email=invite%40exemple.fr&redirect=%2Fshare-reading&mode=signup",
      ),
    ).toBe("https://petite-jerusalem.fr/login?redirect=%2Fshare-reading&mode=signup");
    expect(withoutPersonalParams("https://petite-jerusalem.fr/horaires")).toBe(
      "https://petite-jerusalem.fr/horaires",
    );
    expect(withoutPersonalParams("pas une url email=x")).toBe("pas une url email=x");
  });

  it("le sont dans before_send, $pageview compris", async () => {
    vi.resetModules();
    localStorage.setItem("ph_debug", "1");
    const { analyticsService } = await import("../services/analyticsService");
    analyticsService.init();
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    const beforeSend = posthog.init.mock.calls[0][1].before_send as (event: unknown) => {
      properties: Record<string, unknown>;
    };
    const sent = beforeSend({
      event: "$pageview",
      properties: {
        $current_url: "https://petite-jerusalem.fr/login?email=invite%40exemple.fr",
        $initial_current_url: "https://petite-jerusalem.fr/login?email=invite%40exemple.fr",
      },
    });
    expect(JSON.stringify(sent)).not.toContain("invite");
  });

  it("ni par l'adresse d'entrée de la session, que chaque événement recopie", async () => {
    // Une session ouverte sur un ancien lien : l'événement part d'une autre
    // page, mais posthog-js y joint l'adresse par où la session est entrée.
    vi.resetModules();
    posthog.init.mockClear();
    localStorage.setItem("ph_debug", "1");
    const { analyticsService } = await import("../services/analyticsService");
    analyticsService.init();
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    const beforeSend = posthog.init.mock.calls[0][1].before_send as (event: unknown) => {
      properties: Record<string, unknown>;
    };
    const sent = beforeSend({
      event: "zmanim_viewed",
      properties: {
        $current_url: "https://petite-jerusalem.fr/horaires",
        $session_entry_url: "https://petite-jerusalem.fr/login?email=invite%40exemple.fr",
        $session_entry_referrer: "https://exemple.fr/?email=invite%40exemple.fr",
      },
    });
    expect(JSON.stringify(sent)).not.toContain("invite");
    expect(sent?.properties?.$session_entry_url).toBe("https://petite-jerusalem.fr/login");
  });
});

describe("l'invitation à créer un compte", () => {
  it("pré-remplit l'adresse sans la mettre dans l'URL", async () => {
    const { default: SignupPromptModal } = await import("../components/SignupPromptModal.vue");
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
    });
    await router.push("/share-reading/session/une-chaine");
    await router.isReady();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const push = vi.spyOn(router, "push");
    createApp({
      render: () => h(SignupPromptModal, { show: true, guestEmail: "invite@exemple.fr" }),
    })
      .use(createI18n({ legacy: false, locale: "fr", messages: { fr } }))
      .use(router)
      .mount(host);
    await nextTick();

    const signup = [...document.querySelectorAll("button")].find(
      (b) => b.classList.contains("btn-primary") && b.closest("[role=dialog], .modal-panel"),
    ) as HTMLButtonElement;
    signup.click();
    await nextTick();

    const target = push.mock.calls.at(-1)?.[0] as {
      path: string;
      query: Record<string, string>;
      state?: { email?: string };
    };
    expect(target.path).toBe("/login");
    expect(JSON.stringify(target.query)).not.toContain("invite@exemple.fr");
    expect(target.state?.email).toBe("invite@exemple.fr");
    host.remove();
  });
});
