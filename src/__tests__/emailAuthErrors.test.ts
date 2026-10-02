import { beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../locales/fr";
import { describeEmailAuthError, EMAIL_AUTH_ERROR_KEYS } from "../services/authErrors";
import { loginReason } from "../services/loginReason";
import {
  authMethodOfProvider,
  lastAuthMethod,
  rememberAuthMethod,
} from "../services/lastAuthMethod";
import { locationOutcome } from "../composables/useZmanimLocation";

/**
 * L'écran de connexion parle français : chaque code Firebase connu a sa
 * phrase et sa sortie (créer le compte, s'y connecter, le bouton de la
 * dernière méthode utilisée sur l'appareil), et aucune clé rendue ne manque
 * à la locale. Avec lui, les petites lectures du suivi : ce qui a mené à la
 * connexion, et l'issue d'une demande de position.
 */

vi.mock("@capacitor/preferences", () => ({
  Preferences: { get: () => Promise.resolve({ value: null }), set: () => Promise.resolve() },
}));

type Messages = { [key: string]: string | Messages };

function lookup(path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node as Messages | undefined)?.[key], fr as Messages);
}

beforeEach(() => localStorage.clear());

describe("describeEmailAuthError", () => {
  it("rend des clés qui existent toutes dans la locale française", () => {
    const missing = EMAIL_AUTH_ERROR_KEYS.filter((key) => typeof lookup(key) !== "string");
    expect(missing).toEqual([]);
  });

  it("propose de créer le compte quand la connexion refuse l'adresse", () => {
    expect(describeEmailAuthError("auth/invalid-credential", null)).toEqual({
      key: "login.errors.invalidCredential",
      help: "signup",
    });
  });

  it("rappelle Google ou Apple quand c'est ainsi qu'on s'est connecté ici", () => {
    expect(describeEmailAuthError("auth/invalid-credential", "google").help).toBe("provider");
    expect(describeEmailAuthError("auth/wrong-password", "apple").key).toBe(
      "login.errors.invalidCredentialApple",
    );
  });

  it("propose de se connecter quand l'inscription trouve l'adresse déjà prise", () => {
    expect(describeEmailAuthError("auth/email-already-in-use", "google")).toEqual({
      key: "login.errors.emailInUse",
      help: "login",
    });
  });

  it("dit le reste en clair, sans sortie", () => {
    expect(describeEmailAuthError("auth/too-many-requests", null)).toEqual({
      key: "login.errors.tooManyRequests",
      help: null,
    });
    expect(describeEmailAuthError("auth/inconnu", null).key).toBe("login.loginError");
    expect(describeEmailAuthError(null, null).key).toBe("login.loginError");
  });
});

describe("la dernière méthode de connexion de l'appareil", () => {
  it("se retient et se relit", () => {
    expect(lastAuthMethod()).toBeNull();
    rememberAuthMethod("google");
    expect(lastAuthMethod()).toBe("google");
  });

  it("se déduit du fournisseur Firebase d'un compte déjà connecté", () => {
    expect(authMethodOfProvider("google.com")).toBe("google");
    expect(authMethodOfProvider("apple.com")).toBe("apple");
    expect(authMethodOfProvider("password")).toBe("email");
    expect(authMethodOfProvider("phone")).toBeNull();
  });
});

describe("loginReason", () => {
  it.each([
    [undefined, "direct"],
    ["/bibliotheque/lecture-du-jour", "daily_reading"],
    ["%2Fbibliotheque%2Flecture-du-jour", "daily_reading"],
    ["/share-reading/session/un-nom", "share_reading"],
    ["/en/profile", "profile"],
    ["/admin", "admin"],
    ["/bibliotheque", "other"],
  ])("%s → %s", (redirect, reason) => {
    expect(loginReason(redirect)).toBe(reason);
  });
});

describe("locationOutcome", () => {
  it("sépare le refus de la panne, et mesure l'attente", () => {
    expect(locationOutcome(true, "idle", 1_000, 1_400)).toEqual({
      outcome: "granted",
      duration_ms: 400,
    });
    expect(locationOutcome(false, "denied", 0, 10).outcome).toBe("denied");
    expect(locationOutcome(false, "unavailable", 0, 10).outcome).toBe("unavailable");
  });
});
