import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La mécanique commune des réglages qui suivent le compte (thème, apparence,
 * polices). Ce qui doit tenir :
 * - une écriture refusée par le serveur ramène la valeur d'avant et remonte
 *   l'erreur ;
 * - après un échec, le compte n'est plus tenu pour « chargé » : la prochaine
 *   connexion relit le serveur (avant, une écriture en échec figeait le
 *   compte comme chargé, et une reconnexion ne relisait jamais rien) ;
 * - une réponse du serveur arrivée après un changement ne l'écrase pas.
 */

const { service, capture } = vi.hoisted(() => ({
  service: {
    getPreferences: vi.fn(),
    getCachedPreferences: vi.fn(),
    getGuestPreferences: vi.fn(),
    saveGuestPreferences: vi.fn(),
    savePreferences: vi.fn(),
  },
  capture: vi.fn(),
}));

vi.mock("../services/userPreferencesService", () => ({ userPreferencesService: service }));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture } }));

import { createAccountPreference } from "../composables/createAccountPreference";

function preference() {
  const applied: string[] = [];
  const pref = createAccountPreference<string>({
    field: "theme",
    defaultValue: "ocean",
    isValid: (value): value is string => value === "ocean" || value === "sunset",
    apply: (value) => applied.push(value),
    eventName: "theme_changed",
    eventProps: (theme, previous, scope) => ({ theme, previous_theme: previous, scope }),
    failedEventName: "theme_change_failed",
    failedEventProps: (theme, previous) => ({ theme, previous_theme: previous }),
  });
  return { pref, applied };
}

describe("réglage qui suit le compte", () => {
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    capture.mockReset();
    service.getCachedPreferences.mockReturnValue(null);
    service.getGuestPreferences.mockReturnValue(null);
  });

  it("revient en arrière quand le serveur refuse, et remonte l'erreur", async () => {
    const { pref, applied } = preference();
    const refusal = new Error("refusé");
    service.savePreferences.mockRejectedValue(refusal);

    await expect(pref.set("u1", "sunset")).rejects.toBe(refusal);

    expect(pref.current.value).toBe("ocean");
    expect(applied).toEqual(["sunset", "ocean"]);
    expect(capture).toHaveBeenCalledWith("theme_change_failed", {
      theme: "sunset",
      previous_theme: "ocean",
    });
  });

  it("relit le serveur à la connexion suivante après une écriture en échec", async () => {
    const { pref } = preference();
    service.savePreferences.mockRejectedValue(new Error("refusé"));
    await pref.set("u1", "sunset").catch(() => {});

    service.getPreferences.mockResolvedValue({ theme: "sunset" });
    await pref.loadForUser("u1");
    expect(service.getPreferences).toHaveBeenCalledWith("u1");
    expect(pref.current.value).toBe("sunset");

    // Chargé pour ce compte : un second chargement ne relit rien.
    await pref.loadForUser("u1");
    expect(service.getPreferences).toHaveBeenCalledTimes(1);
  });

  it("ne tient pas un compte pour chargé quand la lecture a échoué", async () => {
    const { pref } = preference();
    service.getPreferences.mockRejectedValueOnce(new Error("réseau"));
    await pref.loadForUser("u2");
    expect(pref.current.value).toBe("ocean");

    service.getPreferences.mockResolvedValue({ theme: "sunset" });
    await pref.loadForUser("u2");
    expect(pref.current.value).toBe("sunset");
  });

  it("laisse un choix récent l'emporter sur une réponse du serveur en retard", async () => {
    const { pref } = preference();
    let serve: (prefs: { theme: string }) => void = () => {};
    service.getPreferences.mockReturnValue(new Promise((resolve) => (serve = resolve)));
    service.savePreferences.mockResolvedValue(undefined);

    const loading = pref.loadForUser("u3");
    await pref.set("u3", "sunset");
    serve({ theme: "ocean" });
    await loading;

    expect(pref.current.value).toBe("sunset");
    expect(capture).toHaveBeenCalledWith("theme_changed", {
      theme: "sunset",
      previous_theme: "ocean",
      scope: "account",
    });
  });

  it("garde sur l'appareil le choix fait sans compte, sans toucher au serveur", async () => {
    const { pref } = preference();
    await pref.set(null, "sunset");
    expect(service.saveGuestPreferences).toHaveBeenCalledWith({ theme: "sunset" });
    expect(service.savePreferences).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith("theme_changed", {
      theme: "sunset",
      previous_theme: "ocean",
      scope: "device",
    });
  });
});
