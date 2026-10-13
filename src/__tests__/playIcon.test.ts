import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ICONS } from "../components/icons/registry";

/**
 * Le triangle de lecture dans son rond (voir components/icons/registry.ts).
 *
 * Un triangle centré sur sa boîte paraît décalé vers sa base : son poids est
 * au tiers de sa largeur. L'icône est donc dessinée centrée sur son centre de
 * gravité, et c'est tout : un bouton qui la pousse encore d'une marge la fait
 * paraître décalée de l'autre côté.
 */

/** Les sommets du tracé, coins arrondis compris par leurs extrémités. */
function vertices(path: string): [number, number][] {
  const tokens = path.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];
  const points: [number, number][] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  let command = "";
  const next = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++];
    const relative = command === command.toLowerCase();
    switch (command.toLowerCase()) {
      case "m":
      case "l": {
        const [dx, dy] = [next(), next()];
        [x, y] = relative ? [x + dx, y + dy] : [dx, dy];
        break;
      }
      case "h": {
        const dx = next();
        x = relative ? x + dx : dx;
        break;
      }
      case "v": {
        const dy = next();
        y = relative ? y + dy : dy;
        break;
      }
      case "a": {
        i += 5; // rayons, rotation, drapeaux : seule l'extrémité compte ici.
        const [dx, dy] = [next(), next()];
        [x, y] = relative ? [x + dx, y + dy] : [dx, dy];
        break;
      }
      case "z":
        continue;
      default:
        throw new Error(`commande de tracé non lue : ${command}`);
    }
    points.push([x, y]);
  }
  return points;
}

/** Le centre de gravité d'un polygone (formule du lacet). */
function centroid(points: [number, number][]): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  points.forEach(([x0, y0], k) => {
    const [x1, y1] = points[(k + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  });
  area /= 2;
  return [cx / (6 * area), cy / (6 * area)];
}

describe("le triangle de lecture", () => {
  it("a son centre de gravité au milieu de l'icône, pas sa boîte", () => {
    const path = ICONS["play-solid"].body.match(/ d="([^"]+)"/)![1];
    const points = vertices(path);
    const [cx, cy] = centroid(points);
    const xs = points.map(([x]) => x);
    const boxCenter = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect({ cx: Math.abs(cx - 12) < 0.4, cy: Math.abs(cy - 12) < 0.2 }).toEqual({
      cx: true,
      cy: true,
    });
    // La boîte, elle, est poussée vers la pointe.
    expect(boxCenter).toBeGreaterThan(13);
  });

  it("n'est poussé d'aucune marge par le bouton qui le porte", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "__tests__" ? [] : files(path);
        return name.endsWith(".vue") ? [path] : [];
      });
    const offenders: string[] = [];
    for (const file of files("src")) {
      for (const [tag] of readFileSync(file, "utf8").matchAll(/<AppIcon\b[^>]*?\/>/gs)) {
        if (!tag.includes("play-solid")) continue;
        if (/(^|[\s"'{:])-?(m[lrsex]|p[lrse]|translate-x)-/.test(tag)) {
          offenders.push(`${file} : ${tag.replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
