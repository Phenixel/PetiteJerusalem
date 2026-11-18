/**
 * Segmentation des comptes dans PostHog (person property `user_type`).
 *
 * Tant que l'app est en test fermé, les stats produit sont noyées par nos
 * propres comptes : dev, testeurs invités, et le compte de démonstration
 * fourni à Google pour la review du Play Store. `user_type` est posé au
 * moment de l'identification (analyticsService.identify) et permet de les
 * exclure d'un clic dans les insights et les cohortes.
 *
 * The lists hold the SHA-256 of each address, not the address: this file is
 * part of the public bundle, and a tester's email is theirs, not ours to
 * publish. To add someone, hash the address in lower case, without spaces
 * around it, and add the result to the right list:
 *
 *   printf '%s' 'someone@example.com' | shasum -a 256
 *
 * Attention : la propriété ne vaut que pour les personnes CONNECTÉES. Un
 * appareil qui navigue sans compte (le device de review Google avant login,
 * par exemple) reste une personne anonyme non taguable ; pour ces cas, le
 * filtre fiable côté insight reste `$host = 'petite-jerusalem.fr'`.
 */

export type UserType = "internal" | "google_review" | "tester" | "real";

/** L'équipe : comptes de développement et d'administration. */
const INTERNAL_HASHES = [
  "606500e905a6ef645a91725f639b496eaca60e24c0f08175f8d02be76941aff3",
  "02ef49bb58d9c9b8b961074cc027fa6a7bd95e8fe93fc63a3e1e0bb72e310839",
];

/** Compte de démonstration remis à Google pour la review du Play Store. */
const GOOGLE_REVIEW_HASHES = ["eb11c9ceb345f67fc9a393324212c3274ad3e6c4d96accb1cf749f25eb9e8073"];

/** Testeurs externes du test fermé (liste à compléter au fil des invitations). */
const TESTER_HASHES = ["faac76be1ec567aeb04c9ac006c3741dbea039d01ca717c6ea0c111f113a6b72"];

const BY_HASH = new Map<string, UserType>([
  ...INTERNAL_HASHES.map((hash) => [hash, "internal"] as const),
  ...GOOGLE_REVIEW_HASHES.map((hash) => [hash, "google_review"] as const),
  ...TESTER_HASHES.map((hash) => [hash, "tester"] as const),
]);

/** The SHA-256 of an address as the lists write it: lower case, trimmed, in hex. */
export async function emailHash(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Tout compte inconnu de ces listes est un vrai utilisateur. So is every
 * account where the hash cannot be computed (no Web Crypto): a tester counted
 * as a real user skews a figure, nothing more.
 */
export async function resolveUserType(email: string | null | undefined): Promise<UserType> {
  if (!email) return "real";
  try {
    return BY_HASH.get(await emailHash(email)) ?? "real";
  } catch {
    return "real";
  }
}
