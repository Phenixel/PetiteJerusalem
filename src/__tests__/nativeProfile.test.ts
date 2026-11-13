import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

/**
 * The native app's profile: a list of rows grouped by kind, each leading to a
 * sub-page and telling what is set there (docs/design.md, "The app profile is
 * a list, not a menu").
 *
 * What must hold:
 * - without an account, the page is the settings page: the account offer at
 *   the top, the device settings, help (the help center, « Nous écrire »);
 *   nothing that needs an account (shortcuts, security, sign-out);
 * - signed in, the name as title, the shortcuts and the account group;
 * - each settings row leads to its sub-page and carries the current state;
 * - notifications blocked by the system say so instead of a number;
 * - sign-out, a row among others, asks before acting.
 */

type FakeUser = { id: string; name: string; email: string };

const { authCallbacks, permission, reminders, logout, confirm } = vi.hoisted(() => ({
  authCallbacks: [] as Array<(user: FakeUser | null) => void>,
  permission: { value: "granted" },
  reminders: { value: [] as Array<{ key: string; minutesBefore: number }> },
  logout: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("../services/authService", () => ({
  authService: {
    onAuthChanged: (callback: (user: FakeUser | null) => void) => {
      authCallbacks.push(callback);
      return () => {};
    },
    logout,
  },
}));
vi.mock("../composables/useConfirm", () => ({ useConfirm: () => ({ confirm }) }));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));
vi.mock("../services/seoService", () => ({ seoService: { setMeta: vi.fn() } }));
vi.mock("../services/feedbackService", () => ({
  feedbackContext: async () => ({ support: "app", platform: "android", version: "3.12.0 (120)" }),
  // Nous écrire : cet appareil n'a jamais écrit, rien à relire.
  hasSupportHistory: () => false,
  listSupportThreads: async () => [],
}));
vi.mock("../composables/useTheme", async () => {
  const { ref } = await import("vue");
  return { useTheme: () => ({ currentThemeId: ref("ocean") }) };
});
vi.mock("../composables/useColorScheme", async () => {
  const { ref } = await import("vue");
  return { useColorScheme: () => ({ currentSchemeId: ref("system") }) };
});
vi.mock("../composables/useLocale", async () => {
  const { ref } = await import("vue");
  return {
    useLocale: () => ({
      currentLocale: ref("fr"),
      availableLocales: [
        { code: "fr", label: "Français", flag: "", dir: "ltr" },
        { code: "en", label: "English", flag: "", dir: "ltr" },
      ],
    }),
  };
});
vi.mock("../composables/useZmanReminders", async () => {
  const { computed, ref } = await import("vue");
  const permissionRef = ref(permission.value);
  const remindersRef = ref(reminders.value);
  return {
    refreshPermission: async () => {
      permissionRef.value = permission.value;
      remindersRef.value = reminders.value;
    },
    useZmanReminders: () => ({
      reminders: computed(() => remindersRef.value),
      restEnabled: computed(() => false),
      permission: permissionRef,
    }),
  };
});
vi.mock("../composables/useZmanimOpinion", async () => {
  const { ref } = await import("vue");
  return { useZmanimOpinion: () => ({ opinion: ref("posen") }) };
});
vi.mock("../composables/useConsent", () => ({ useConsent: () => ({ reopen: vi.fn() }) }));
vi.mock("../composables/useHolidayTheme", async () => {
  const { ref } = await import("vue");
  return { useHolidayTheme: () => ({ activeHolidayTheme: ref(null) }) };
});

import fr from "../locales/fr";
import NativeProfileHome from "../views/profilePage/native/NativeProfileHome.vue";

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

async function mount(user: FakeUser | null) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(NativeProfileHome) });
  app.use(i18n);
  app.use(router);
  await router.push("/profile");
  app.mount(host);
  await flush();
  for (const callback of authCallbacks) callback(user);
  await flush();

  const row = (href: string) => host.querySelector(`a[href="${href}"]`) as HTMLAnchorElement | null;
  const text = () => host.textContent ?? "";
  return { host, row, text };
}

const ALICE: FakeUser = { id: "u1", name: "Alice", email: "alice@example.com" };

describe("profil de l'app native", () => {
  beforeEach(() => {
    authCallbacks.length = 0;
    permission.value = "granted";
    reminders.value = [];
    logout.mockReset();
    confirm.mockReset();
    document.body.innerHTML = "";
  });

  it("sans compte, la page est celle des réglages", async () => {
    const page = await mount(null);
    expect(page.host.querySelector("h1")?.textContent).toContain("Réglages");
    expect(page.row("/login?mode=signup")).not.toBeNull();
    for (const section of ["appearance", "language", "notifications", "preferences"]) {
      expect(page.row(`/profile/${section}`)?.getAttribute("href")).toBe(`/profile/${section}`);
    }
    // Rien de ce qui suppose un compte.
    expect(page.row("/profile/security")).toBeNull();
    expect(page.row("/profile/account")).toBeNull();
    expect(page.row("/share-reading")).toBeNull();
    expect(page.text()).not.toContain(fr.common.logout);
    // Mon parcours se tient sans compte, sur le téléphone : sa carte, chargée à la demande.
    await vi.waitFor(() => expect(page.row("/parcours")).not.toBeNull());
    // Help: the help center (guides, the "what's new" video, the introduction
    // and the tips to see again) and « Nous écrire ».
    expect(page.row("/aide")?.textContent).toContain(fr.help.title);
    expect(page.row("/contact")).not.toBeNull();
  });

  it("connecté, le nom en titre, les raccourcis et le compte", async () => {
    const page = await mount(ALICE);
    expect(page.host.querySelector("h1")?.textContent).toContain("Alice");
    expect(page.text()).toContain("alice@example.com");
    expect(page.row("/profile/account")).not.toBeNull();
    expect(page.row("/profile/security")).not.toBeNull();
    await vi.waitFor(() => expect(page.row("/parcours")).not.toBeNull());
    expect(page.row("/share-reading")).not.toBeNull();
    expect(page.text()).toContain(fr.common.logout);
    expect(page.row("/login?mode=signup")).toBeNull();
  });

  it("chaque ligne de réglage porte l'état en cours", async () => {
    reminders.value = [
      { key: "sunset", minutesBefore: 15 },
      { key: "tzeit", minutesBefore: 0 },
    ];
    const page = await mount(null);
    expect(page.row("/profile/appearance")?.textContent).toContain("Océan · Système");
    expect(page.row("/profile/language")?.textContent).toContain("Français");
    expect(page.row("/profile/notifications")?.textContent).toContain("2 rappels");
    expect(page.row("/profile/preferences")?.textContent).toContain("Rav Posen");
    // La version installée, au pied de la page.
    expect(page.text()).toContain("Version 3.12.0 (120)");
  });

  it("des notifications bloquées le disent au lieu d'un nombre", async () => {
    permission.value = "denied";
    reminders.value = [{ key: "sunset", minutesBefore: 15 }];
    const page = await mount(null);
    const notifications = page.row("/profile/notifications")?.textContent ?? "";
    expect(notifications).toContain("Bloquées");
    expect(notifications).not.toContain("rappel");
  });

  it("la déconnexion pose la question avant d'agir", async () => {
    const page = await mount(ALICE);
    const button = [...page.host.querySelectorAll("button")].find((el) =>
      el.textContent?.includes(fr.common.logout),
    )!;

    confirm.mockResolvedValueOnce(false);
    button.click();
    await flush();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();

    confirm.mockResolvedValueOnce(true);
    button.click();
    await flush();
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
