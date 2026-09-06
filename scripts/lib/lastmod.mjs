/**
 * La date de dernière modification d'un contenu, pour le `lastmod` du sitemap.
 *
 * Jusqu'ici chaque URL du sitemap portait la date du build : 2 000 pages
 * « modifiées » à chaque déploiement, y compris les 1 200 pages de lecture
 * dont le texte ne bouge jamais. Google dit ne tenir compte de `lastmod` que
 * s'il est constamment exact ; le mentir sur tout revenait à ne rien dire.
 * Avec le rafraîchissement hebdomadaire (refresh-seo.yml), la date du build
 * changerait chaque semaine sur des pages inchangées.
 *
 * La date vient donc de l'historique git : celle du dernier commit qui a
 * touché le fichier dont la page est faite (le fichier de texte pour une page
 * de lecture, `seoPages.ts` pour une page de contenu). Un seul `git log`, dont
 * on lit les fichiers commit par commit : le premier passage sur un fichier
 * est sa dernière modification.
 *
 * Les pages calculées (horaires, calendrier, paracha) changent réellement à
 * chaque build : elles gardent la date du jour, ce module ne les concerne pas.
 *
 * Sans git (archive sans historique) ou sur un clone superficiel qui ne
 * connaît que le commit de tête, on retombe sur la date du build : c'est ce
 * que faisait le sitemap jusqu'ici, jamais pire. Les workflows qui déploient
 * font donc leur checkout avec tout l'historique (fetch-depth: 0).
 */
import { execFileSync } from "node:child_process";

/** `2026-09-04T14:40:39+00:00` → `2026-09-04`. */
const toDay = (iso) => iso.slice(0, 10);

/**
 * Lit l'historique des chemins donnés et rend, pour chaque fichier, la date
 * (AAAA-MM-JJ) de son dernier commit. Une Map vide si git est indisponible.
 */
export function gitLastModified(paths, cwd = process.cwd()) {
  let out;
  try {
    out = execFileSync("git", ["log", "--format=%cI", "--name-only", "--", ...paths], {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return new Map();
  }
  const dates = new Map();
  let current = null;
  for (const line of out.split("\n")) {
    if (!line) continue;
    // Une ligne de date ouvre un commit ; les suivantes sont ses fichiers.
    if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
      current = toDay(line);
      continue;
    }
    if (current && !dates.has(line)) dates.set(line, current);
  }
  return dates;
}

/**
 * Un clone superficiel (`actions/checkout` sans fetch-depth) ne connaît qu'un
 * commit : tous les fichiers y semblent modifiés le même jour, ce qui vaut la
 * date du build. On le détecte pour ne pas présenter cette date comme une
 * vraie date de modification.
 */
export function isShallowClone(cwd = process.cwd()) {
  try {
    const out = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim() === "true";
  } catch {
    return true;
  }
}

/**
 * Fabrique `lastmodOf(files)` : la plus récente des dates des fichiers donnés,
 * ou `fallback` (la date du build) si aucun n'est connu de git.
 */
export function makeLastmod(paths, fallback, cwd = process.cwd()) {
  const dates = isShallowClone(cwd) ? new Map() : gitLastModified(paths, cwd);
  const known = dates.size > 0;
  const lastmodOf = (files) => {
    const list = Array.isArray(files) ? files : [files];
    const found = list.map((f) => dates.get(f)).filter(Boolean);
    return found.length ? found.sort().at(-1) : fallback;
  };
  return { lastmodOf, known };
}
