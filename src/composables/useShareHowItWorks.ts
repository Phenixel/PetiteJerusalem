import { ref } from "vue";
import { devicePreference } from "../services/devicePreference";

/**
 * « Comment ça marche », sur la page du partage de lecture : une explication
 * pour qui découvre, pas un mobilier de toutes les visites. Elle se retire
 * pour de bon dès que le principe est connu :
 *
 *  - un appui sur « J'ai compris », sous la frise ;
 *  - ou une première session créée ou rejointe : qui a déjà lu dans une
 *    chaîne sait comment elle marche (ShareHomePage le constate).
 *
 * Gardé sur l'appareil (devicePreference), comme les astuces : la frise ne
 * revient pas après une mise à jour ni un cache vidé.
 */
const store = devicePreference(
  "pj-share-how-it-works-known",
  (raw) => (raw === "1" ? true : null),
  () => "1",
);

const known = ref(store.read() ?? false);
let restored = known.value;

async function restore(): Promise<void> {
  if (restored) return;
  restored = true;
  if ((await store.restore()) === true) known.value = true;
}

export function useShareHowItWorks() {
  void restore();

  function markKnown(): void {
    if (known.value) return;
    known.value = true;
    store.write(true);
  }

  return { known, markKnown };
}
