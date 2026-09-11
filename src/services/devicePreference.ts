import { isNativeApp } from "../composables/useNativeApp";

/**
 * Un réglage gardé sur l'APPAREIL, et non dans le compte : la taille du texte,
 * l'avis suivi pour les horaires, l'interrupteur du défilement automatique.
 *
 * Deux stockages, et c'est voulu :
 *
 *  - Le `localStorage` se lit en SYNCHRONE, donc dès le premier rendu, avant
 *    que la page ne s'affiche. Sans lui, elle s'ouvrirait avec la valeur
 *    d'origine puis sauterait sous les yeux.
 *  - Mais celui d'une webview n'est pas durable : le système peut le vider
 *    sous la pression mémoire, et l'utilisateur au vidage du cache de l'app.
 *    Les préférences natives (@capacitor/preferences : SharedPreferences côté
 *    Android, UserDefaults côté iOS) survivent, elles, mais ne se lisent qu'en
 *    asynchrone. Elles servent de filet, relu au premier usage du réglage.
 *
 * Ce module n'a aucune réactivité : il ne fait que lire et écrire. C'est
 * l'appelant qui tient la valeur à l'écran, et qui décide quand la relire.
 */

/** Un réglage d'appareil, tel que l'appelant s'en sert. */
export interface DevicePreference<T> {
  /** Ce que l'appareil porte, tout de suite, ou null s'il ne porte rien. */
  read(): T | null;
  /** Écrit la valeur dans les deux stockages. */
  write(value: T): void;
  /**
   * Ce que le natif garde, quand le `localStorage` n'a rien à dire (il a été
   * vidé, ou l'app vient d'être réinstallée par-dessus). La valeur retrouvée
   * y est remise au passage, pour que la prochaine ouverture la lise sans
   * attendre le plugin. Null hors app native, et quand il n'y a rien.
   */
  restore(): Promise<T | null>;
}

/**
 * @param key La clé, la même dans les deux stockages.
 * @param parse Ce que vaut une valeur lue, ou null si elle n'a plus de sens
 *   (version antérieure, stockage trafiqué).
 * @param serialize Comment l'écrire.
 */
export function devicePreference<T>(
  key: string,
  parse: (raw: string | null) => T | null,
  serialize: (value: T) => string,
): DevicePreference<T> {
  function read(): T | null {
    try {
      return parse(localStorage.getItem(key));
    } catch {
      return null; // Stockage indisponible (navigation privée).
    }
  }

  function write(value: T): void {
    const raw = serialize(value);
    try {
      localStorage.setItem(key, raw);
    } catch {
      // Stockage indisponible : le réglage vaut pour la session en cours.
    }
    if (!isNativeApp) return;
    void import("@capacitor/preferences")
      .then(({ Preferences }) => Preferences.set({ key, value: raw }))
      .catch(() => {
        // Plugin absent (vieux binaire) : le localStorage fait seul, comme avant.
      });
  }

  async function restore(): Promise<T | null> {
    if (!isNativeApp) return null;
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const saved = parse((await Preferences.get({ key })).value);
      if (saved === null) return null;
      write(saved);
      return saved;
    } catch {
      return null; // Plugin absent : rien à reprendre.
    }
  }

  return { read, write, restore };
}
