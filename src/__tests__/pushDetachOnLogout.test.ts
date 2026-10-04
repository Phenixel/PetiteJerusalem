import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * À la déconnexion, l'appareil cesse de recevoir les rappels du compte qui
 * part. Le jeton FCM restait dans `userPreferences/<compte>.fcmTokens` : le
 * téléphone recevait les rappels du compte parti une fois quelqu'un d'autre
 * connecté, et les deux comptes à la fois si le suivant activait les siens.
 */

const { setDoc, deleteToken, signOut, order, messaging, prefs } = vi.hoisted(() => ({
  setDoc: vi.fn(),
  deleteToken: vi.fn(),
  signOut: vi.fn(),
  order: [] as string[],
  messaging: { permission: "granted", token: "jeton-du-telephone", subscribed: [] as string[] },
  prefs: { pushReminderEnabled: true },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
  registerPlugin: () => ({}),
}));
vi.mock("@capacitor-firebase/messaging", () => ({
  FirebaseMessaging: {
    deleteToken,
    getToken: async () => ({ token: messaging.token }),
    checkPermissions: async () => ({ receive: messaging.permission }),
    subscribeToTopic: async ({ topic }: { topic: string }) => void messaging.subscribed.push(topic),
    unsubscribeFromTopic: async () => {},
    addListener: vi.fn(),
  },
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
vi.mock("../services/userPreferencesService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/userPreferencesService")>();
  return {
    ...actual,
    userPreferencesService: { getPreferencesOrThrow: async () => ({ ...prefs }) },
  };
});

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  setOnline(true);
  order.length = 0;
  messaging.permission = "granted";
  messaging.token = "jeton-du-telephone";
  messaging.subscribed.length = 0;
  prefs.pushReminderEnabled = true;
  setDoc.mockReset().mockImplementation(async () => void order.push("setDoc"));
  deleteToken.mockReset().mockImplementation(async () => void order.push("deleteToken"));
  signOut.mockReset().mockImplementation(async () => void order.push("signOut"));
});

describe("pushService.detachDevice", () => {
  it("retire le jeton du compte, sans couper ses autres appareils, et le garde sur l'appareil", async () => {
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
    // Retiré du compte, le jeton reste : les informations de l'équipe y sont abonnées.
    expect(deleteToken).not.toHaveBeenCalled();
    expect(localStorage.getItem("pj_fcm_token")).toBe("jeton-du-telephone");
    // L'appareil retient le compte parti, pour lui rendre ses rappels s'il revient.
    expect(localStorage.getItem("pj_fcm_detached_from")).toBe("compte-a");
  });

  it("n'attend pas un serveur muet plus de quelques secondes, et efface alors le jeton", async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem("pj_fcm_token", "jeton");
      setDoc.mockReturnValue(new Promise(() => {}));
      const { pushService } = await import("../services/pushService");
      const detaching = pushService.detachDevice("compte-a");
      await vi.advanceTimersByTimeAsync(3000);
      await detaching;
      // Resté dans le document : effacé de l'appareil, il ne mène plus nulle part.
      expect(deleteToken).toHaveBeenCalled();
      expect(localStorage.getItem("pj_fcm_token")).toBeNull();
      expect(localStorage.getItem("pj_fcm_token_stale")).toBeNull();
      // Les informations de l'équipe se réabonnent, avec le nouveau jeton.
      expect(messaging.subscribed).toHaveLength(1);
      expect(messaging.subscribed[0]).toMatch(/^announcements-/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("hors ligne, l'effacement du jeton attend le réseau au lieu d'être perdu", async () => {
    setOnline(false);
    localStorage.setItem("pj_fcm_token", "jeton");
    const { pushService } = await import("../services/pushService");
    await pushService.detachDevice("compte-a");
    // Ni l'écriture ni l'effacement ne passent sans réseau : le repère reste.
    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteToken).not.toHaveBeenCalled();
    expect(localStorage.getItem("pj_fcm_token_stale")).toBe("1");

    setOnline(true);
    await pushService.dropStaleToken();
    expect(deleteToken).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("pj_fcm_token_stale")).toBeNull();
  });
});

describe("pushService.reattachDevice", () => {
  it("le même compte qui revient retrouve ses rappels sur l'appareil", async () => {
    localStorage.setItem("pj_fcm_token", "jeton-du-telephone");
    const { pushService } = await import("../services/pushService");
    await pushService.detachDevice("compte-a");
    setDoc.mockClear();

    await pushService.reattachDevice("compte-a");

    expect(setDoc).toHaveBeenCalledWith(
      "userPreferences/compte-a",
      { fcmTokens: { union: "jeton-du-telephone" } },
      { merge: true },
    );
    expect(localStorage.getItem("pj_fcm_detached_from")).toBeNull();
  });

  it("un autre compte ne reçoit pas l'appareil : il s'inscrira en activant ses rappels", async () => {
    localStorage.setItem("pj_fcm_token", "jeton-du-telephone");
    const { pushService } = await import("../services/pushService");
    await pushService.detachDevice("compte-a");
    setDoc.mockClear();

    await pushService.reattachDevice("compte-b");
    expect(setDoc).not.toHaveBeenCalled();
    expect(localStorage.getItem("pj_fcm_detached_from")).toBeNull();
    // Et le premier, revenu plus tard, n'est plus rattaché d'office.
    await pushService.reattachDevice("compte-a");
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("ne rattache rien si les rappels sont coupés ou la notification refusée", async () => {
    const { pushService } = await import("../services/pushService");
    localStorage.setItem("pj_fcm_detached_from", "compte-a");
    prefs.pushReminderEnabled = false;
    await pushService.reattachDevice("compte-a");
    expect(setDoc).not.toHaveBeenCalled();

    localStorage.setItem("pj_fcm_detached_from", "compte-a");
    prefs.pushReminderEnabled = true;
    messaging.permission = "denied";
    await pushService.reattachDevice("compte-a");
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("sans déconnexion préalable, une connexion n'inscrit pas l'appareil", async () => {
    const { pushService } = await import("../services/pushService");
    await pushService.reattachDevice("compte-a");
    expect(setDoc).not.toHaveBeenCalled();
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
