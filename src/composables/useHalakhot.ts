import { readonly, ref } from "vue";
import { analyticsService } from "../services/analyticsService";
import { devicePreference } from "../services/devicePreference";

/**
 * « Masquer les halakhot » : les consignes de loi qui accompagnent un passage
 * de tefila (« en cas d'oubli, on reprend au début de la bénédiction »)
 * disparaissent du fil du texte.
 *
 * Elles sont là pour qui doute, et elles encombrent qui sait. Un office se dit
 * tous les jours : celui qui le connaît par cœur relit la même règle matin
 * après matin, au milieu des mots qu'il est venu dire. Le réglage vit dans le
 * menu de lecture, à côté des autres réglages de lecture, et il est éteint au
 * départ : personne ne doit découvrir qu'une halakha existait le jour où il en
 * aurait eu besoin.
 *
 * Contrairement à « sans tahanoun », qui ne vaut que la journée, celui-ci est
 * un parti pris de lecture : il tient jusqu'à ce qu'on le change. Il est gardé
 * sur l'appareil, et deux fois plutôt qu'une (voir devicePreference) : le
 * `localStorage` d'une webview se vide, et un réglage posé pour ne plus voir
 * les halakhot ne doit pas les faire revenir tout seul.
 */
const STORAGE_KEY = "pj-hide-halakhot";

/** L'interrupteur lu d'un stockage : « 1 » ou « 0 », rien d'autre. */
function parseHidden(value: string | null): boolean | null {
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

const store = devicePreference(STORAGE_KEY, parseHidden, (value) => (value ? "1" : "0"));

const stored = store.read();
const hidden = ref(stored ?? false);

/** Le choix est-il déjà celui d'une personne ? Sinon, le natif a son mot à dire. */
let restored = stored !== null;

/** Les halakhot sont-elles retirées du texte ? Le lecteur de tefila le demande. */
export const halakhotHidden = readonly(hidden);

export function setHalakhotHidden(value: boolean): void {
  restored = true;
  if (value === hidden.value) return;
  hidden.value = value;
  store.write(value);
  analyticsService.capture("halakhot_hidden_changed", { hidden: value });
}

/**
 * Reprend l'interrupteur gardé par le natif quand le localStorage n'a rien.
 * Appelé à l'ouverture des réglages de lecture, comme celui du défilement :
 * le plugin n'a pas à peser sur le démarrage de l'app.
 */
export async function restoreHalakhotHiddenFromDevice(): Promise<void> {
  if (restored) return;
  restored = true;
  const saved = await store.restore();
  if (saved === null) return;
  hidden.value = saved;
}
