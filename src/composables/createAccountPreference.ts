import { ref, type Ref } from "vue";
import { userPreferencesService, type GuestPreferences } from "../services/userPreferencesService";
import { analyticsService } from "../services/analyticsService";

/**
 * Un réglage qui suit le compte : thème, apparence, polices.
 *
 * Les trois composables (useTheme, useFonts, useColorScheme) faisaient la
 * même chose en trois copies : charger pour un compte avec la copie locale
 * d'abord et une garde de version contre les réponses périmées, écrire en
 * optimiste puis revenir en arrière si le serveur refuse, charger sans compte
 * depuis l'appareil, et mesurer chaque changement. La mécanique vit ici, les
 * composables ne gardent que ce qui leur est propre (les options, ce que la
 * valeur applique au document, les propriétés des événements).
 */

export type PreferenceScope = "account" | "device";

export interface AccountPreferenceSpec<T extends string> {
  /** Le champ du document de préférences (et du réglage d'appareil). */
  field: keyof GuestPreferences;
  defaultValue: T;
  isValid: (value: unknown) => value is T;
  /** Applique la valeur au document (variables CSS, feuilles de polices). */
  apply?: (value: T) => void;
  /** L'événement d'un changement réussi, et ses propriétés. */
  eventName: string;
  eventProps: (value: T, previous: T, scope: PreferenceScope) => Record<string, unknown>;
  /** L'événement d'une écriture refusée par le serveur (valeur revenue à l'écran). */
  failedEventName: string;
  failedEventProps: (value: T, previous: T) => Record<string, unknown>;
}

export interface AccountPreference<T extends string> {
  current: Ref<T>;
  /** Réglage du compte : copie locale tout de suite, réponse du serveur ensuite. */
  loadForUser(userId: string): Promise<void>;
  /** Sans compte : le réglage gardé sur l'appareil, ou la valeur d'origine. */
  loadForGuest(): void;
  /**
   * Change le réglage. Sans compte (userId null : réglages de l'app native),
   * il est appliqué et gardé sur l'appareil ; avec un compte, il part chez
   * Firestore et suit l'utilisateur. L'erreur du serveur remonte à l'appelant
   * une fois la valeur d'avant revenue à l'écran.
   */
  set(userId: string | null, value: string): Promise<void>;
  reset(): void;
}

export function createAccountPreference<T extends string>(
  spec: AccountPreferenceSpec<T>,
): AccountPreference<T> {
  const current = ref(spec.defaultValue) as Ref<T>;
  // Le compte dont la valeur courante est celle du serveur : un chargement
  // pour ce compte ne relit rien. Remis à null dès qu'un doute existe
  // (écriture refusée, chargement en échec), sinon une reconnexion ne relirait
  // jamais le serveur.
  let loadedForUserId: string | null = null;
  // Incrémenté à chaque changement de source : une réponse du serveur partie
  // avant ne doit pas écraser ce qui a été choisi depuis.
  let version = 0;

  function applyValue(value: T): void {
    current.value = value;
    spec.apply?.(value);
  }

  async function loadForUser(userId: string): Promise<void> {
    if (loadedForUserId === userId) return;
    const versionAtStart = ++version;
    // Copie locale d'abord, en synchrone : le réglage du compte tient dès le
    // premier rendu au lieu d'arriver après le chargement de Firestore et
    // l'aller-retour réseau. Le serveur, en dessous, confirme ou corrige.
    const cached = userPreferencesService.getCachedPreferences(userId)?.[spec.field];
    if (spec.isValid(cached)) applyValue(cached);
    try {
      const prefs = await userPreferencesService.getPreferences(userId);
      if (version !== versionAtStart) return;
      const value = prefs[spec.field];
      applyValue(spec.isValid(value) ? value : spec.defaultValue);
      loadedForUserId = userId;
    } catch {
      if (version !== versionAtStart) return;
      applyValue(spec.defaultValue);
      loadedForUserId = null;
    }
  }

  function loadForGuest(): void {
    version++;
    loadedForUserId = null;
    const guest = userPreferencesService.getGuestPreferences()?.[spec.field];
    applyValue(spec.isValid(guest) ? guest : spec.defaultValue);
  }

  function track(value: T, previous: T, scope: PreferenceScope): void {
    if (value === previous) return;
    analyticsService.capture(spec.eventName, spec.eventProps(value, previous, scope));
  }

  async function set(userId: string | null, value: string): Promise<void> {
    if (!spec.isValid(value)) return;
    const previous = current.value;
    version++;

    if (!userId) {
      loadedForUserId = null;
      applyValue(value);
      userPreferencesService.saveGuestPreferences({ [spec.field]: value });
      track(value, previous, "device");
      return;
    }

    loadedForUserId = userId;
    applyValue(value);
    try {
      await userPreferencesService.savePreferences(userId, { [spec.field]: value });
      track(value, previous, "account");
    } catch (error) {
      // Le réglage revient à sa valeur d'avant sous les yeux de l'utilisateur :
      // sans cet événement, l'écart entre « choisi » et « réellement porté par
      // le compte » resterait invisible.
      applyValue(previous);
      loadedForUserId = null;
      analyticsService.capture(spec.failedEventName, spec.failedEventProps(value, previous));
      throw error;
    }
  }

  function reset(): void {
    loadedForUserId = null;
    applyValue(spec.defaultValue);
  }

  return { current, loadForUser, loadForGuest, set, reset };
}
