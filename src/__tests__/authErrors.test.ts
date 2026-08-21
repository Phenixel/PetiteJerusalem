import { describe, expect, it } from "vitest";
import {
  isAppleSignInUnavailable,
  isAuthBrowserUnavailable,
  isAuthCancellation,
} from "../services/authErrors";

/**
 * Tri des erreurs de connexion Google/Apple. Les messages testés sont ceux
 * réellement observés dans l'Error tracking PostHog : ils viennent des
 * appareils (donc localisés pour Apple), pas de nous.
 */

function firebaseError(code: string): Error {
  const error = new Error(`Firebase: Error (${code}).`);
  (error as Error & { code: string }).code = code;
  return error;
}

describe("isAuthCancellation", () => {
  it("reconnaît la feuille Apple refusée (code 1001, message localisé)", () => {
    expect(
      isAuthCancellation(
        new Error(
          "L’opération n’a pas pu s’achever. (com.apple.AuthenticationServices.AuthorizationError erreur 1001.)",
        ),
      ),
    ).toBe(true);
    expect(
      isAuthCancellation(
        new Error(
          "The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)",
        ),
      ),
    ).toBe(true);
  });

  it("reconnaît le sélecteur Google quitté (Android et web)", () => {
    expect(isAuthCancellation(new Error("activity is cancelled by the user."))).toBe(true);
    expect(isAuthCancellation(new Error("User cancelled the selector"))).toBe(true);
  });

  it("reconnaît la popup Firebase fermée, dont le message ne dit pas « cancel »", () => {
    expect(isAuthCancellation(firebaseError("auth/popup-closed-by-user"))).toBe(true);
    expect(isAuthCancellation(firebaseError("auth/cancelled-popup-request"))).toBe(true);
    expect(isAuthCancellation(firebaseError("auth/user-cancelled"))).toBe(true);
  });

  it("laisse passer les vraies pannes", () => {
    // Code 1000 (ASAuthorizationErrorUnknown) : échec, pas un refus.
    expect(
      isAuthCancellation(
        new Error(
          "The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)",
        ),
      ),
    ).toBe(false);
    expect(isAuthCancellation(new Error("Unable to open Safari."))).toBe(false);
    expect(isAuthCancellation(firebaseError("auth/network-request-failed"))).toBe(false);
  });

  it("supporte les valeurs qui ne sont pas des Error", () => {
    expect(isAuthCancellation("User cancelled the selector")).toBe(true);
    expect(isAuthCancellation(null)).toBe(false);
    expect(isAuthCancellation(undefined)).toBe(false);
  });
});

describe("isAuthBrowserUnavailable", () => {
  it("reconnaît l'échec d'ouverture de la fenêtre de connexion Google (iOS)", () => {
    expect(isAuthBrowserUnavailable(new Error("Unable to open Safari."))).toBe(true);
  });

  it("laisse passer le reste", () => {
    expect(isAuthBrowserUnavailable(new Error("Firebase: Error (auth/network-request-failed)."))).toBe(
      false,
    );
  });
});

describe("isAppleSignInUnavailable", () => {
  it("reconnaît le code 1000 (feuille Apple imprésentable), message localisé", () => {
    expect(
      isAppleSignInUnavailable(
        new Error(
          "The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)",
        ),
      ),
    ).toBe(true);
    expect(
      isAppleSignInUnavailable(
        new Error(
          "L’opération n’a pas pu s’achever. (com.apple.AuthenticationServices.AuthorizationError erreur 1000.)",
        ),
      ),
    ).toBe(true);
  });

  it("ne confond pas le refus de l'utilisateur (1001) avec l'indisponibilité", () => {
    expect(
      isAppleSignInUnavailable(
        new Error(
          "The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)",
        ),
      ),
    ).toBe(false);
  });
});
