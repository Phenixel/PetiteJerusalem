import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Télécharger un livre hors ligne, sous Android 11.
 *
 * `@capacitor/file-transfer` déclare un alias de permission « publicStorage »
 * (READ_EXTERNAL_STORAGE + WRITE_EXTERNAL_STORAGE) et le consulte avant tout
 * transfert, sauf à partir d'Android 11 (SDK 30), où il s'en passe. Son propre
 * manifest est vide : rien n'est fusionné dans celui de l'app. Quand l'app ne
 * les déclare pas non plus, Capacitor ne refuse pas la permission, il lève
 * « Missing the following permissions in AndroidManifest.xml » avant même de
 * commencer, et aucun téléchargement n'aboutit.
 *
 * C'est ce qui arrivait : toute la bibliothèque restait inaccessible hors
 * ligne sous Android 10, de la v3.8.1 à la v3.10.7, sur chaque tentative (un
 * Huawei STK-L22 et un Samsung SM-A205F dans l'Error tracking PostHog), pour
 * des fichiers qui vivent pourtant dans l'espace privé de l'app
 * (`Directory.Data`) et n'ont besoin d'aucune permission.
 *
 * Le dossier android/ est git-ignoré et régénéré par `cap add android` : la
 * règle ne peut vivre que dans scripts/setup-android.mjs, lu ici au texte,
 * comme dans widgetParity.test.ts.
 *
 * maxSdkVersion=29 se vérifie aussi : au-delà, le plugin ne consulte plus ces
 * permissions, et une demande de stockage large sur un Android récent est
 * exactement ce que le Play Store interroge.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Les permissions déclarées au manifest par le scaffold Android. */
function declaredPermissions(): { name: string; attributes: string }[] {
  const source = readFileSync(join(root, "scripts/setup-android.mjs"), "utf8");
  const start = source.indexOf("const PERMISSIONS = [");
  expect(start, "PERMISSIONS introuvable dans setup-android.mjs").toBeGreaterThan(-1);
  const block = source.slice(start, source.indexOf("\n];", start));
  return [...block.matchAll(/name: "(android\.permission\.[A-Z_]+)"/g)].map(([, name]) => ({
    name,
    attributes: attributesOf(block, name),
  }));
}

/** Les attributs XML écrits à côté du `android:name` d'une permission. */
function attributesOf(block: string, name: string): string {
  const after = block.slice(block.indexOf(`name: "${name}"`));
  const entry = after.slice(0, after.indexOf("\n  }"));
  return /attributes: '([^']*)'/.exec(entry)?.[1] ?? "";
}

describe("permissions de stockage Android", () => {
  const permissions = declaredPermissions();

  it.each(["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"])(
    "%s est déclarée, sinon aucun livre ne se télécharge sous Android 11",
    (name) => {
      expect(permissions.map((p) => p.name)).toContain(name);
    },
  );

  it.each(["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"])(
    "%s s'arrête à Android 10 (maxSdkVersion=29)",
    (name) => {
      const permission = permissions.find((p) => p.name === name);
      expect(permission?.attributes).toContain('android:maxSdkVersion="29"');
    },
  );

  it("écrit les attributs des permissions dans la ligne du manifest", () => {
    const source = readFileSync(join(root, "scripts/setup-android.mjs"), "utf8");
    // Sans cette interpolation, `attributes` serait lu puis perdu, et la
    // permission partirait sans son maxSdkVersion.
    expect(source).toContain('<uses-permission android:name="${name}"${extra} />');
  });
});
