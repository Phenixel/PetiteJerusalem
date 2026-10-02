import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * À la déconnexion, l'appareil cesse de recevoir les rappels du compte qui
 * part. Le jeton FCM restait dans `userPreferences/<compte>.fcmTokens` : le
 * téléphone recevait les rappels du compte parti une fois quelqu'un d'autre
 * connecté, et les deux comptes à la fois si le suivant activait les siens.
 */

const { setDoc, deleteToken, signOut, order } = vi.hoisted(() => ({
  setDoc: vi.fn(),
  deleteToken: vi.fn(),
  signOut: vi.fn(),
  order: [] as string[],
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
  registerPlugin: () => ({}),
}));
vi.mock("@capacitor-firebase/messaging", () => ({
  FirebaseMessaging: { deleteToken, getToken: vi.fn(), addListener: vi.fn() },
}));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  setDoc: (...args: unknown[]) => setDoc(...args),
  arrayRemove: (value: string) => ({ remove: value }),
  arrayUnion: (value: string) => ({ union: value }),
}));
vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../firebase/core", () => ({
  auth: { currentUser: { uid: "compte-a" } },
  googleAuthProvider: {},
}));
vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn(), reset: vi.fn() },
}));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  setOnline(true);
  order.length = 0;
  setDoc.mockReset().mockImplementation(async () => void order.push("setDoc"));
  deleteToken.mockReset().mockImplementation(async () => void order.push("deleteToken"));
  signOut.mockReset().mockImplementation(async () => void order.push("signOut"));
});

describe("pushService.detachDevice", () => {
  it("retire le jeton du compte, sans couper ses autres appareils, puis l'efface", async () => {
    localStorage.setItem("pj_fcm_token", "jeton-du-telephone");
    const { pushService } = await import("../services/pushService");
    await pushService.detachDevice("compte-a");

    expect(setDoc).toHaveBeenCalledWith(
      "userPreferences/compte-a",
      { fcmTokens: { remove: "jeton-du-telephone" } },
      { merge: true },
    );
    // pushReminderEnabled n'est pas touché : les autres appareils gardent leurs rappels.
    expect(JSON.stringify(setDoc.mock.calls[0][1])).not.toContain("pushReminderEnabled");
    expect(order).toEqual(["setDoc", "deleteToken"]);
    expect(localStorage.getItem("pj_fcm_token")).toBeNull();
  });

  it("n'attend pas un serveur muet plus de quelques secondes", async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem("pj_fcm_token", "jeton");
      setDoc.mockReturnValue(new Promise(() => {}));
      const { pushService } = await import("../services/pushService");
      const detaching = pushService.detachDevice("compte-a");
      await vi.advanceTimersByTimeAsync(3000);
      await detaching;
      expect(deleteToken).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hors ligne, efface quand même le jeton de l'appareil", async () => {
    setOnline(false);
    localStorage.setItem("pj_fcm_token", "jeton");
    const { pushService } = await import("../services/pushService");
    await pushService.detachDevice("compte-a");
    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteToken).toHaveBeenCalled();
  });
});

describe("la déconnexion", () => {
  it("détache l'appareil du compte avant de se déconnecter", async () => {
    vi.doMock("firebase/auth", () => ({
      signOut: (...args: unknown[]) => signOut(...args),
      onAuthStateChanged: () => () => {},
      GoogleAuthProvider: class {},
      OAuthProvider: class {},
      EmailAuthProvider: {},
    }));
    vi.doMock("@capacitor-firebase/authentication", () => ({
      FirebaseAuthentication: { signOut: async () => {} },
    }));
    localStorage.setItem("pj_fcm_token", "jeton");
    vi.resetModules();
    const { authService } = await import("../services/authService");
    await authService.logout();
    expect(order.indexOf("setDoc")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("setDoc")).toBeLessThan(order.indexOf("signOut"));
  });
});
