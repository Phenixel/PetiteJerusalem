// Miroir client de la fonction isAdmin() des règles Firestore/Storage.
// Sert uniquement de garde UX (afficher/masquer le backoffice, rediriger) :
// la sécurité réelle est appliquée par les règles côté serveur.
export const ADMIN_EMAILS = ["admin@phenixel.fr"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
