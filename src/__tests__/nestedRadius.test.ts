// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "vue/compiler-sfc";

/**
 * Two nested roundings are never equal (docs/design.md, "Radii"): an element
 * that hugs its parent's corners takes the parent's radius minus the padding
 * between them. Two concentric curves of the same radius are not parallel,
 * and the eye sees the gap widen at the corners.
 *
 * This test holds the rule where it is easy to break without seeing it: a
 * shell padded by a hair (`p-0.5`, `p-1`) and the children it holds, such as
 * a segmented group and its buttons, or the sliding pill of the tabs. Its
 * children are close enough to the edge to share its corners.
 */

/** The radius tokens of main.css, in px: a value or `calc(var(--radius-x) - Npx)`. */
function radiusTokens(): Map<string, number> {
  const css = readFileSync("src/assets/main.css", "utf8");
  const raw = new Map<string, string>();
  for (const [, name, value] of css.matchAll(/--radius-([\w-]+):\s*([^;]+);/g)) {
    if (name && value && !raw.has(name)) raw.set(name, value.trim());
  }
  const resolve = (value: string): number | null => {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(value);
    if (px) return Number(px[1]);
    const calc = /^calc\(var\(--radius-([\w-]+)\)\s*-\s*(\d+(?:\.\d+)?)px\)$/.exec(value);
    const base = calc?.[1] ? raw.get(calc[1]) : undefined;
    const outer = base ? resolve(base) : null;
    return calc && outer !== null ? outer - Number(calc[2]) : null;
  };
  const tokens = new Map<string, number>();
  for (const [name, value] of raw) {
    const px = resolve(value);
    if (px !== null) tokens.set(name, px);
  }
  return tokens;
}

/** The thin paddings, where the children reach the corners (Tailwind spacing, 4 px a step). */
const THIN_PADDING: Record<string, number> = { "p-0.5": 2, "p-1": 4 };

interface TemplateNode {
  type: number;
  tag?: string;
  loc: { start: { line: number } };
  props?: { type: number; name: string; value?: { content: string } }[];
  children?: TemplateNode[];
}

const ELEMENT = 1;
const ATTRIBUTE = 6;

function staticClasses(node: TemplateNode): string[] {
  const attr = node.props?.find((p) => p.type === ATTRIBUTE && p.name === "class");
  return attr?.value?.content.split(/\s+/).filter(Boolean) ?? [];
}

/** The elements a node lays out directly, looking through `<template>` (v-for, v-if). */
function laidOutChildren(node: TemplateNode): TemplateNode[] {
  return (node.children ?? []).flatMap((child) => {
    if (child.type !== ELEMENT) return [];
    return child.tag === "template" ? laidOutChildren(child) : [child];
  });
}

function vueFiles(): string[] {
  return execFileSync("git", ["ls-files", "src/**/*.vue"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

describe("nested roundings", () => {
  it("give what hugs a thin shell its radius minus the padding", () => {
    const tokens = radiusTokens();
    const radiusOf = (classes: string[]): { name: string; px: number } | null => {
      for (const cls of classes) {
        const name = /^rounded-([\w-]+)$/.exec(cls)?.[1];
        const px = name ? tokens.get(name) : undefined;
        if (name && px !== undefined) return { name, px };
      }
      return null;
    };

    const offenders: string[] = [];
    for (const path of vueFiles()) {
      const ast = parse(readFileSync(path, "utf8")).descriptor.template?.ast as
        | TemplateNode
        | undefined;
      if (!ast) continue;
      const visit = (node: TemplateNode): void => {
        const classes = staticClasses(node);
        const shell = radiusOf(classes);
        const padding = classes.map((cls) => THIN_PADDING[cls]).find((px) => px !== undefined);
        if (shell && padding !== undefined) {
          const expected = shell.px - padding;
          for (const child of laidOutChildren(node)) {
            const inner = radiusOf(staticClasses(child));
            // A pill or a circle is round everywhere: always concentric.
            if (!inner || inner.name === "pill" || inner.name === "full") continue;
            if (inner.px !== expected) {
              offenders.push(
                `${path}:${child.loc.start.line} rounded-${inner.name} (${inner.px} px) in rounded-${shell.name} with ${padding} px of padding: wants ${expected} px`,
              );
            }
          }
        }
        laidOutChildren(node).forEach(visit);
      };
      visit(ast);
    }
    expect(offenders, "See docs/design.md, Two nested roundings are never equal").toEqual([]);
  });
});
