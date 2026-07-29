/**
 * Segmentation des comptes dans PostHog (person property `user_type`).
 *
 * Tant que l'app est en test fermé, les stats produit sont noyées par nos
 * propres comptes : dev, testeurs invités, et le compte de démonstration
 * fourni à Google pour la review du Play Store. `user_type` est posé au
 * moment de l'identification (analyticsService.identify) et permet de les
 * exclure d'un clic dans les insights et les cohortes.
 *
 * ⚠️ C'EST CE FICHIER QU'ON ÉDITE quand un testeur arrive ou s'en va :
 * ajouter l'email dans la bonne liste, rien d'autre à toucher. Les emails
 * sont comparés en minuscules, sans espaces autour.
 *
 * Attention : la propriété ne vaut que pour les personnes CONNECTÉES. Un
 * appareil qui navigue sans compte (le device de review Google avant login,
 * par exemple) reste une personne anonyme non taguable ; pour ces cas, le
 * filtre fiable côté insight reste `$host = 'petite-jerusalem.fr'`.
 */

export type UserType = "internal" | "google_review" | "tester" | "real";

/** L'équipe : comptes de développement et d'administration. */
export const INTERNAL_EMAILS = ["admin@phenixel.fr", "contact.phenixel@gmail.com"];

/** Compte de démonstration remis à Google pour la review du Play Store. */
export const GOOGLE_REVIEW_EMAILS = ["testeur@exemple.com"];

/** Testeurs externes du test fermé (liste à compléter au fil des invitations). */
export const TESTER_EMAILS = ["milkshake.2734@gmail.com"];

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

const BY_EMAIL = new Map<string, UserType>([
  ...INTERNAL_EMAILS.map((email) => [normalize(email), "internal"] as const),
  ...GOOGLE_REVIEW_EMAILS.map((email) => [normalize(email), "google_review"] as const),
  ...TESTER_EMAILS.map((email) => [normalize(email), "tester"] as const),
]);

/** Tout compte inconnu de ces listes est un vrai utilisateur. */
export function resolveUserType(email: string | null | undefined): UserType {
  if (!email) return "real";
  return BY_EMAIL.get(normalize(email)) ?? "real";
}
