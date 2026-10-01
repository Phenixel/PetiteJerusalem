/**
 * Ce qui a mené à l'écran de connexion : la propriété `reason` de
 * `login_viewed`.
 *
 * La garde des routes réservées envoie vers `/login?redirect=<la page>` ;
 * l'adresse disait donc déjà d'où l'on venait, mais dans un `$current_url`
 * qu'il fallait décortiquer à la main, et qui peut porter le slug d'une
 * chaîne (un nom de personne). On n'en garde que la fonction.
 */

export type LoginReason =
  | "direct"
  | "daily_reading"
  | "share_reading"
  | "profile"
  | "admin"
  | "other";

const LOCALE_PREFIX = /^\/(en|he)(?=\/|$)/;

export function loginReason(redirect: unknown): LoginReason {
  const raw = Array.isArray(redirect) ? redirect[0] : redirect;
  if (typeof raw !== "string" || raw === "") return "direct";
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    // Un `%` isolé : l'adresse se lit telle quelle.
  }
  path = path.split(/[?#]/)[0].replace(LOCALE_PREFIX, "") || "/";
  if (path.startsWith("/bibliotheque/lecture-du-jour")) return "daily_reading";
  if (path.startsWith("/share-reading") || path.startsWith("/session-management")) {
    return "share_reading";
  }
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/admin") || path.startsWith("/studio")) return "admin";
  return "other";
}
