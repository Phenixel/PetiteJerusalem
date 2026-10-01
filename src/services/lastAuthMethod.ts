import { devicePreference } from "./devicePreference";

/**
 * La dernière façon de se connecter sur CET appareil : Google, Apple ou
 * l'email.
 *
 * Firebase ne dit pas avec quoi une adresse a été inscrite (la protection
 * contre l'énumération des comptes répond `auth/invalid-credential` qu'il
 * n'y ait pas de compte, que le mot de passe soit faux ou que le compte soit
 * un compte Google). Or c'est le piège le plus courant de l'écran de
 * connexion : un compte créé d'un toucher avec Google, puis, des semaines
 * plus tard, une adresse et un mot de passe qui n'ont jamais existé (voir
 * docs/audit-usage-posthog-2026-10.md, 2.1). L'appareil, lui, s'en
 * souvient : le bouton de la dernière méthode porte « Dernière
 * utilisation », et l'erreur le rappelle.
 *
 * Gardée dans les deux stockages (devicePreference) : la déconnexion n'y
 * touche pas, c'est justement après elle qu'on en a besoin.
 */

export type AuthMethod = "google" | "apple" | "email";

const AUTH_METHODS: readonly AuthMethod[] = ["google", "apple", "email"];

function parse(raw: string | null): AuthMethod | null {
  return AUTH_METHODS.includes(raw as AuthMethod) ? (raw as AuthMethod) : null;
}

const store = devicePreference<AuthMethod>("pj_last_auth_method", parse, (method) => method);

/** Une connexion ou une inscription vient d'aboutir avec cette méthode. */
export function rememberAuthMethod(method: AuthMethod): void {
  store.write(method);
}

/** La dernière méthode connue de l'appareil, tout de suite. */
export function lastAuthMethod(): AuthMethod | null {
  return store.read();
}

/** Le filet natif, quand le `localStorage` a été vidé (voir devicePreference). */
export function restoreLastAuthMethod(): Promise<AuthMethod | null> {
  return store.restore();
}

/**
 * La méthode d'un fournisseur Firebase (`providerData[].providerId`) : pour
 * les comptes déjà connectés avant que l'appareil ne retienne la méthode.
 */
export function authMethodOfProvider(providerId: string | null | undefined): AuthMethod | null {
  if (providerId === "google.com") return "google";
  if (providerId === "apple.com") return "apple";
  if (providerId === "password") return "email";
  return null;
}
