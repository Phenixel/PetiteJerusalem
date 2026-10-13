import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Écouter un cours écran éteint, et le commander depuis la notification ou
 * l'écran verrouillé (voir services/mediaSession.ts). Les dossiers android/ et
 * ios/ sont git-ignorés et régénérés : ce qui le rend possible vit dans
 * scripts/setup-android.mjs, scripts/setup-ios.mjs et native/android/, lus
 * ici au texte, comme dans androidStoragePermissions.test.ts.
 *
 * - Android : @capgo/capacitor-media-session tient la notification dans un
 *   service de premier plan de type « mediaPlayback ». Depuis Android 14,
 *   démarrer ce service sans FOREGROUND_SERVICE_MEDIA_PLAYBACK lève une
 *   SecurityException : l'app se fermerait à la première lecture. Le plugin
 *   ne déclare que FOREGROUND_SERVICE ; l'app doit ajouter l'autre.
 * - Android : deux icônes du plugin sont remplacées par des ressources de même
 *   nom dans native/android/ (la silhouette de l'app à la place d'un
 *   haut-parleur, un « reculer » sans le « 30 » qui mentirait : le lecteur
 *   recule de 15 secondes). Si le plugin les renomme, le remplacement ne
 *   prend plus, sans bruit : ce test le dit.
 * - iOS : sans le mode d'arrière-plan « audio », iOS coupe le son dès que
 *   l'app passe en arrière-plan.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const PLUGIN = "node_modules/@capgo/capacitor-media-session/android/src/main";

describe("écoute en arrière-plan, Android", () => {
  it("le plugin tient la lecture dans un service de premier plan « mediaPlayback »", () => {
    expect(read(`${PLUGIN}/AndroidManifest.xml`)).toMatch(
      /android:foregroundServiceType="mediaPlayback"/,
    );
  });

  it("l'app déclare FOREGROUND_SERVICE_MEDIA_PLAYBACK, sans quoi Android 14 ferme l'app", () => {
    const setup = read("scripts/setup-android.mjs");
    const block = setup.slice(setup.indexOf("const PERMISSIONS = ["), setup.indexOf("\n];"));
    expect(block).toContain('name: "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"');
  });

  it.each(["ic_baseline_volume_up_24", "ic_baseline_replay_30_24"])(
    "%s du plugin est remplacée par celle de l'app",
    (name) => {
      expect(existsSync(join(root, `${PLUGIN}/res/drawable/${name}.xml`))).toBe(true);
      expect(existsSync(join(root, `native/android/app/src/main/res/drawable/${name}.xml`))).toBe(
        true,
      );
    },
  );
});

describe("écoute en arrière-plan, iOS", () => {
  it("le mode d'arrière-plan « audio » est déclaré", () => {
    const setup = read("scripts/setup-ios.mjs");
    expect(setup).toMatch(/const BACKGROUND_MODES = \[[^\]]*"audio"[^\]]*\]/);
  });
});
