import { describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";

/**
 * Le profil : l'adresse email et l'identifiant du compte ne se modifient pas.
 * Encadrés comme des champs, ils étaient touchés à répétition (audit PostHog
 * d'octobre 2026, 2.7) : ils se lisent maintenant comme un texte. Seul le nom
 * affiché garde son champ (docs/design.md, « Ce qui ne se modifie pas n'a pas
 * l'air d'un champ »).
 */

vi.mock("../services/authService", () => ({ authService: { updateDisplayName: vi.fn() } }));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));

describe("les informations du profil", () => {
  it("ne montrent comme champ que ce qui se modifie", async () => {
    const { default: UserInfoForm } = await import("../views/profilePage/UserInfoForm.vue");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
    createApp({
      render: () =>
        h(UserInfoForm, { user: { id: "uid-123", name: "David", email: "david@exemple.fr" } }),
    })
      .use(i18n)
      .mount(host);
    await nextTick();

    const fields = [...host.querySelectorAll(".field")];
    expect(fields).toHaveLength(1);
    expect(fields[0].id).toBe("profile-display-name");
    // L'adresse et l'identifiant restent lisibles, hors de tout champ.
    expect(host.textContent).toContain("david@exemple.fr");
    expect(host.textContent).toContain("uid-123");
    host.remove();
  });
});
