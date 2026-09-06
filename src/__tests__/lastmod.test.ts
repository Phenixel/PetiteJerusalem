// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

/**
 * Le `lastmod` du sitemap vient de git (scripts/lib/lastmod.mjs) : la date du
 * dernier commit qui a touché le fichier dont la page est faite. On le vérifie
 * sur un dépôt jetable à deux commits, datés à la main.
 */
const jiti = createJiti(import.meta.url);
const { gitLastModified, makeLastmod, isShallowClone } = (await jiti.import(
  "../../scripts/lib/lastmod.mjs",
)) as {
  gitLastModified: (paths: string[], cwd?: string) => Map<string, string>;
  makeLastmod: (
    paths: string[],
    fallback: string,
    cwd?: string,
  ) => { lastmodOf: (files: string | string[]) => string; known: boolean };
  isShallowClone: (cwd?: string) => boolean;
};

let repo: string;

function git(args: string[], date: string): void {
  execFileSync("git", args, {
    cwd: repo,
    stdio: "ignore",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "pj-lastmod-"));
  mkdirSync(join(repo, "texts"), { recursive: true });
  git(["init", "-q"], "2026-01-01T10:00:00+00:00");
  writeFileSync(join(repo, "texts", "a.json"), "a");
  writeFileSync(join(repo, "texts", "b.json"), "b");
  git(["add", "."], "2026-01-01T10:00:00+00:00");
  git(["commit", "-q", "-m", "premier"], "2026-01-01T10:00:00+00:00");
  writeFileSync(join(repo, "texts", "b.json"), "b2");
  git(["add", "."], "2026-03-15T10:00:00+00:00");
  git(["commit", "-q", "-m", "second"], "2026-03-15T10:00:00+00:00");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("lastmod (dates git du sitemap)", () => {
  it("date chaque fichier de son dernier commit", () => {
    const dates = gitLastModified(["texts"], repo);
    expect(dates.get("texts/a.json")).toBe("2026-01-01");
    expect(dates.get("texts/b.json")).toBe("2026-03-15");
  });

  it("prend la plus récente des dates d'une page faite de plusieurs fichiers", () => {
    const { lastmodOf, known } = makeLastmod(["texts"], "2026-09-06", repo);
    expect(known).toBe(true);
    expect(lastmodOf(["texts/a.json", "texts/b.json"])).toBe("2026-03-15");
    expect(lastmodOf("texts/a.json")).toBe("2026-01-01");
  });

  it("se replie sur la date du build pour un fichier inconnu de git", () => {
    const { lastmodOf } = makeLastmod(["texts"], "2026-09-06", repo);
    expect(lastmodOf("texts/inconnu.json")).toBe("2026-09-06");
  });

  it("se replie sur la date du build sans dépôt git", () => {
    const nowhere = mkdtempSync(join(tmpdir(), "pj-nogit-"));
    try {
      expect(gitLastModified(["texts"], nowhere).size).toBe(0);
      const { lastmodOf, known } = makeLastmod(["texts"], "2026-09-06", nowhere);
      expect(known).toBe(false);
      expect(lastmodOf("texts/a.json")).toBe("2026-09-06");
    } finally {
      rmSync(nowhere, { recursive: true, force: true });
    }
  });

  it("un dépôt complet n'est pas superficiel", () => {
    expect(isShallowClone(repo)).toBe(false);
  });
});
