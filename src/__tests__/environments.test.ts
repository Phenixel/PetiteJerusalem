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
    const env = readFileSync(join(root, `functions/.env.${ENVIRONMENTS.staging.firebase.projectId}`), "utf8");
    expect(env).toContain(`SITE_URL=${ENVIRONMENTS.staging.siteUrl}`);
    expect(env).toContain(`STORAGE_BUCKET=${ENVIRONMENTS.staging.firebase.storageBucket}`);
  });
});
