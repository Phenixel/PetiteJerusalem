import { describe, expect, it, vi } from "vitest";

/**
 * La permission des notifications, lue auprès du plugin Capacitor.
 *
 * Ce qui se joue ici n'est pas la valeur rendue mais le FAIT qu'elle le soit.
 * Un plugin Capacitor est un `Proxy` : toute propriété inconnue devient un
 * appel natif, `then` compris. Le faire traverser une promesse (le rendre
 * depuis une fonction `async`, par exemple) le fait passer pour une promesse
 * aux yeux du moteur, qui appelle alors `LocalNotifications.then(resolve,
 * reject)` : l'appel natif n'existe pas, la promesse rendue est rejetée dans
 * le vide, et comme `resolve` et `reject` ne sont jamais appelés, l'attente ne
 * se règle jamais. Le `try` qui l'entoure n'attrape rien, et les rappels ne
 * sont jamais programmés.
 *
 * C'est ce qui est arrivé en 3.10.0. Le leurre ci-dessous se comporte comme le
 * vrai plugin, `then` compris : si la règle est enfreinte de nouveau, ces
 * tests ne rendent pas la main, et le garde-fou le dit franchement.
 */

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "android" }));

/** Ce que le plugin sait vraiment faire ; le reste part en appel natif. */
const IMPLEMENTED: Record<string, () => Promise<unknown>> = {
  checkPermissions: async () => ({ display: "granted" }),
  requestPermissions: async () => ({ display: "granted" }),
  checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
  changeExactNotificationSetting: async () => undefined,
};

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop in IMPLEMENTED) return IMPLEMENTED[prop];
        // Capacitor rend une fonction pour TOUTE propriété, et cette fonction
        // rend une promesse rejetée quand la méthode native n'existe pas.
        return () =>
          Promise.reject(new Error(`"LocalNotifications.${prop}()" is not implemented on android`));
      },
    },
  ),
}));

/**
 * Échoue franchement au lieu d'attendre le délai du test : une promesse qui ne
 * se règle jamais est précisément le symptôme qu'on surveille.
 */
function within<T>(promise: Promise<T>, ms = 1000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "la promesse ne s'est jamais réglée : le plugin a traversé une promesse et son proxy a été pris pour un thenable",
            ),
          ),
        ms,
      ),
    ),
  ]);
}

describe("permission des notifications", () => {
  it("relit la permission auprès du système", async () => {
    const { refreshPermission } = await import("../composables/useZmanReminders");

    await expect(within(refreshPermission())).resolves.toBe("granted");
  });

  it("demande la permission sans rester en plan", async () => {
    const { ensureNotificationPermission } = await import("../composables/useZmanReminders");

    await expect(within(ensureNotificationPermission(true))).resolves.toBe(true);
  });

  it("ouvre le réglage des alarmes exactes sans rester en plan", async () => {
    const { openExactAlarmSetting } = await import("../composables/useZmanReminders");

    await expect(within(openExactAlarmSetting())).resolves.toBeUndefined();
  });
});
