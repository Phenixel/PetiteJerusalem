// Retire du bundle natif (Capacitor) les corpus téléchargeables à la demande.
//
// L'app mobile ne doit pas embarquer les ~38 Mo de public/texts : elle garde
// seulement les petits fichiers transverses (tehilim.json, ~370 Ko, et
// talmud-chapters.json, ~40 Ko) et télécharge le reste depuis le site via
// offlineTextStore. À lancer entre `vite build` et `cap sync` — jamais pour
// le déploiement web, qui sert les textes depuis dist/.
import { existsSync, rmSync } from "node:fs";

const PRUNED_DIRS = ["dist/texts/talmud", "dist/texts/mishna", "dist/texts/tanakh"];

for (const dir of PRUNED_DIRS) {
  if (!existsSync(dir)) continue;
  rmSync(dir, { recursive: true });
  console.log(`prune-native-bundle: ${dir} retiré (téléchargeable à la demande dans l'app)`);
}
