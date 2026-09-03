import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Le bundle initial du site ne doit tirer que l'indispensable.
 *
 * Firestore (~170 kB gzip), le moteur d'horaires hebcal (~55 kB gzip) et
 * PostHog (~75 kB gzip) sont chargés à la demande : leur poids réuni dépasse
 * celui de tout le premier rendu. Un simple import statique ajouté dans un
 * service que la racine de l'app touche (authService, useToast…) suffit à
 * les ramener dans le chargement de la première page, sans qu'aucun test
 * fonctionnel ne le voie : c'est arrivé une fois par moderationService.
 *
 * Ce test suit les imports STATIQUES depuis src/main.ts (les `import()` sont
 * ignorés, c'est justement la frontière) et refuse ces modules dans le graphe.
 */

const SRC = resolve(__dirname, "..");

/** Modules qui n'ont rien à faire dans le chargement initial. */
const FORBIDDEN = [
  { id: "firebase/firestore", label: "Firestore" },
  { id: "src/firebase/firestore.ts", label: "src/firebase/firestore" },
  { id: "firebase/storage", label: "Storage" },
  { id: "firebase/functions", label: "Functions" },
  { id: "@hebcal/core", label: "hebcal" },
  { id: "@hebcal/locales", label: "hebcal (locales)" },
  { id: "posthog-js", label: "PostHog" },
];

/** Imports statiques d'un fichier : `import … from "x"`, `import "x"`, `export … from "x"`. */
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/gm;

/** Les `import type` ne pèsent rien dans le bundle. */
const TYPE_ONLY = /^\s*import\s+type\s/;

function scriptOf(path: string): string {
  const source = readFileSync(path, "utf8");
  if (!path.endsWith(".vue")) return source;
  return [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = resolve(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // paquet npm : on ne descend pas dedans
  for (const candidate of [base, `${base}.ts`, `${base}.vue`, `${base}/index.ts`]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      try {
        readFileSync(candidate);
        return candidate;
      } catch {
        // dossier : on essaie le suivant
      }
    }
  }
  return null;
}

/** Parcourt le graphe statique et renvoie, par module interdit, le chemin qui y mène. */
function forbiddenPaths(entry: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const seen = new Set<string>();
  const stack: Array<{ file: string; trail: string[] }> = [{ file: entry, trail: [] }];
  while (stack.length) {
    const { file, trail } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const script = scriptOf(file);
    for (const match of script.matchAll(STATIC_IMPORT)) {
      if (TYPE_ONLY.test(match[0])) continue;
      const spec = match[1];
      const here = [...trail, file.replace(`${SRC}/`, "src/")];
      const bad = FORBIDDEN.find((f) => spec === f.id || spec.startsWith(`${f.id}/`));
      if (bad && !found.has(bad.label)) found.set(bad.label, [...here, spec]);
      const next = resolveImport(file, spec);
      if (!next) continue;
      const rel = next.replace(`${SRC}/`, "src/");
      const badFile = FORBIDDEN.find((f) => rel === f.id);
      if (badFile && !found.has(badFile.label)) found.set(badFile.label, [...here, rel]);
      stack.push({ file: next, trail: here });
    }
  }
  return found;
}

describe("bundle initial", () => {
  it("n'importe ni Firestore, ni hebcal, ni PostHog en statique depuis main.ts", () => {
    const found = forbiddenPaths(resolve(SRC, "main.ts"));
    const report = [...found]
      .map(([label, trail]) => `${label} :\n    ${trail.join("\n    -> ")}`)
      .join("\n");
    expect(report, `modules lourds atteints en statique depuis src/main.ts :\n${report}`).toBe("");
  });
});
