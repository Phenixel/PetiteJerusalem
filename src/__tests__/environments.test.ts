import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ENVIRONMENTS, resolveEnvironment } from "../../scripts/lib/environments.mjs";

/**
 * Les deux environnements (docs/staging.md) : la production reste la valeur
 * par défaut, et l'app de staging ne peut jamais prendre l'identité de la
 * vraie.
 */
const root = join(__dirname, "../..");

describe("environnements", () => {
  it("vise la production quand PJ_ENV est absent ou vide", () => {
    expect(resolveEnvironment(undefined).name).toBe("production");
    expect(resolveEnvironment("").name).toBe("production");
    expect(resolveEnvironment(" staging ").name).toBe("staging");
  });

  it("refuse un nom inconnu plutôt que de retomber sur la production", () => {
    expect(() => resolveEnvironment("stagng")).toThrow(/PJ_ENV inconnu/);
  });

  it("donne au staging une identité entièrement distincte", () => {
    const { production, staging } = ENVIRONMENTS;
    expect(staging.appId).not.toBe(production.appId);
    expect(staging.appGroup).not.toBe(production.appGroup);
    expect(staging.firebase.projectId).not.toBe(production.firebase.projectId);
    expect(staging.siteUrl).not.toBe(production.siteUrl);
    expect(staging.appName).not.toBe(production.appName);
  });

  it("garde les identifiants de production historiques", () => {
    const { production } = ENVIRONMENTS;
    expect(production.appId).toBe("fr.petitejerusalem.app");
    expect(production.firebase.projectId).toBe("petite-jerusalem-dev");
    expect(production.siteUrl).toBe("https://petite-jerusalem.fr");
  });

  it("publie sur le Play Store sous les identifiants de environments.mjs", () => {
    const workflow = readFileSync(join(root, ".github/workflows/deploy-android.yml"), "utf8");
    expect(workflow).toContain(
      `inputs.environment == 'staging' && '${ENVIRONMENTS.staging.appId}' || '${ENVIRONMENTS.production.appId}'`,
    );
  });

  it("déploie les functions de staging avec le site et le bucket de staging", () => {
    const env = readFileSync(
      join(root, `functions/.env.${ENVIRONMENTS.staging.firebase.projectId}`),
      "utf8",
    );
    expect(env).toContain(`SITE_URL=${ENVIRONMENTS.staging.siteUrl}`);
    expect(env).toContain(`STORAGE_BUCKET=${ENVIRONMENTS.staging.firebase.storageBucket}`);
  });
});

/**
 * Le staging vit tout seul : son app lit les textes que son site sert, et ses
 * liens de partage mènent à son site (src/config/environment.ts). Une adresse
 * de production écrite en dur dans le code de l'app y renverrait l'app de
 * staging : on n'en tolère qu'aux endroits qui parlent de la production
 * elle-même (adresse canonique, mesure d'audience, contenus prérendus).
 */
describe("le staging vit tout seul", () => {
  const PRODUCTION_ALLOWED = [
    "src/config/site.ts",
    "src/content/etudeTexts.ts",
    "src/services/analyticsService.ts",
    "src/config/analyticsAudience.ts",
  ];

  it("ne lit ni ne partage rien sur une adresse de production écrite en dur", async () => {
    const { readdirSync, statSync } = await import("node:fs");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const rel = `${dir}/${name}`;
        if (name === "__tests__") continue;
        if (statSync(join(root, rel)).isDirectory()) walk(rel);
        else if (/\.(ts|vue)$/.test(name)) files.push(rel);
      }
    };
    walk("src");
    const offenders = files.filter(
      (f) =>
        !PRODUCTION_ALLOWED.includes(f) &&
        /["'`]https:\/\/(www\.)?petite-jerusalem\.fr/.test(readFileSync(join(root, f), "utf8")),
    );
    expect(offenders, "passer par APP_SITE_URL (src/config/environment.ts)").toEqual([]);
  });

  it("donne à l'app le site de son environnement, et celui-ci aux textes", async () => {
    const { APP_SITE_URL } = await import("../config/environment");
    expect(APP_SITE_URL).toBe(__PJ_ENV__.siteUrl);
    const store = readFileSync(join(root, "src/services/offlineTextStore.ts"), "utf8");
    expect(store).toMatch(/const REMOTE_TEXTS_BASE = APP_SITE_URL;/);
  });
});
