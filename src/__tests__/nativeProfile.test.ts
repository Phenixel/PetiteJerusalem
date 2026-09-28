import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

/**
 * Le profil de l'app native : une liste de lignes rangées par groupe, chacune
 * menant à une sous-page et disant ce qui y est réglé (docs/design.md, « Le
 * profil de l'app est une liste, pas un menu »).
 *
 * Ce qui doit tenir :
 * - sans compte, la page est celle des réglages : l'invitation au compte en
 *   tête, les réglages d'appareil, l'aide ; rien de ce qui suppose un compte
 *   (raccourcis, sécurité, déconnexion) ;
 * - connecté, le nom en titre, les raccourcis et le groupe du compte ;
 * - chaque ligne de réglage mène à sa sous-page et porte l'état en cours ;
 * - des notifications bloquées par le système le disent au lieu d'un nombre ;
 * - la déconnexion, une ligne parmi d'autres, pose la question avant d'agir.
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
vi.mock("../composables/useOnboarding", () => ({
  useOnboarding: () => ({ replayOnboarding: vi.fn() }),
}));
vi.mock("../composables/useFeatureTips", () => ({
  useFeatureTips: () => ({ resetFeatureTips: vi.fn() }),
}));
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
    expect(page.row("/bibliotheque/lecture-du-jour")).toBeNull();
    expect(page.text()).not.toContain(fr.common.logout);
  });

  it("connecté, le nom en titre, les raccourcis et le compte", async () => {
    const page = await mount(ALICE);
    expect(page.host.querySelector("h1")?.textContent).toContain("Alice");
    expect(page.text()).toContain("alice@example.com");
    expect(page.row("/profile/account")).not.toBeNull();
    expect(page.row("/profile/security")).not.toBeNull();
    expect(page.row("/bibliotheque/lecture-du-jour")).not.toBeNull();
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
