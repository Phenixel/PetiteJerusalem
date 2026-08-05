// Slug public d'une session de lecture : translittère les accents français
// puis ne garde que [a-z0-9-]. À ne pas confondre avec le slug des
// chiourim/auteurs (chiourService.generateAuteurSlug) ni avec celui des
// Cloud Functions (functions/src/studio.ts), qui suivent leur propre logique.
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[éèêë]/g, "e")
    .replace(/[àâä]/g, "a")
    .replace(/[îï]/g, "i")
    .replace(/[ôö]/g, "o")
    .replace(/[ûüù]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
