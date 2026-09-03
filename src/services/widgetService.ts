import { registerPlugin } from "@capacitor/core";
import { watch } from "vue";
import { isNativeApp } from "../composables/useNativeApp";
import { useTheme } from "../composables/useTheme";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { i18n, loadLocaleMessages, type SupportedLocale } from "../i18n";
import { localDayKey } from "./dateService";
import { authService, type User } from "./authService";
import { userPreferencesService, type UserPreferences } from "./userPreferencesService";

/**
 * Alimente les widgets d'écran d'accueil (Android / iOS).
 *
 * Les widgets natifs ne peuvent pas exécuter le code de la webview : l'app
 * leur pousse des payloads JSON pré-calculés (voir widgetPayloads) via le
 * plugin natif PjWidgets, SharedPreferences côté Android, App Group côté iOS,
 * qui rafraîchit les widgets concernés dans la foulée. Le natif se débrouille
 * ensuite seul : une semaine d'horaires est embarquée, et la lecture du jour
 * porte son échéance (expiresAt) pour se remettre à zéro à minuit sans rouvrir
 * l'app.
 *
 * Rafraîchi au lancement, au retour au premier plan, au changement de lieu
 * des horaires, au changement de langue, au changement de thème (les widgets
 * portent l'accent choisi) et à chaque progression de la lecture du jour. Un
 * payload inchangé n'est pas renvoyé : le natif ne recharge pas ses widgets
 * pour rien.
 */

/** Le sous-ensemble des préférences dont dépend le widget de lecture. */
export type DailyWidgetPrefs = Pick<
  UserPreferences,
  "dailyReadingIds" | "dailyReadingOptions" | "dailyReadingProgress"
>;

interface PjWidgetsBridge {
  /**
   * Payloads en JSON ; le natif stocke ceux qui sont fournis puis rafraîchit
   * les widgets correspondants. Un champ omis laisse le dernier état en place.
   */
  setPayloads(options: { zmanim?: string; daily?: string; library?: string }): Promise<void>;
}

const PjWidgets = registerPlugin<PjWidgetsBridge>("PjWidgets");

/** Laisse le premier rendu passer avant les ~100 calculs solaires du payload. */
function nextIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve());
    else setTimeout(resolve, 200);
  });
}

class WidgetService {
  private user: User | null = null;
  private started = false;

  // File d'attente des push : les appels qui arrivent pendant un push en vol
  // partagent le suivant. La promesse rendue par refresh() ne se résout
  // qu'après un push démarré à ou après l'appel, jamais celle d'un push
  // antérieur porteur de données plus vieilles.
  private queue: Promise<void> = Promise.resolve();
  private queued = false;

  // Préférences fraîches confiées par la page Lecture du jour : évite de
  // relire dans Firestore un document qu'elle vient d'écrire.
  private pendingDaily: DailyWidgetPrefs | null = null;

  // Dernier état poussé, pour ne pas renvoyer un payload identique (chaque
  // envoi fait recharger les widgets natifs, budgété côté iOS). La clé des
  // horaires porte leurs seules entrées (lieu, jour, langue, accent) : tant
  // qu'elle ne bouge pas, les ~100 calculs solaires ne sont même pas refaits.
  private lastZmanimKey: string | null = null;
  private lastZmanimJson: string | null = null;
  private lastDailyJson: string | null = null;
  private lastLibraryJson: string | null = null;

  /** À appeler une fois au démarrage de l'app native (no-op sur le web). */
  init(): void {
    if (!isNativeApp || this.started) return;
    this.started = true;

    // Connexion / déconnexion : la lecture du jour dépend du compte. Le
    // premier événement d'auth sert aussi de rafraîchissement de lancement.
    authService.onAuthChanged((user) => {
      this.user = user;
      void this.refresh();
    });

    // Nouveau lieu choisi sur la page Horaires : le widget suit.
    const { place } = useZmanimLocation();
    watch(place, () => void this.refresh());

    // Changement de langue : les libellés des payloads doivent suivre.
    watch(i18n.global.locale, () => void this.refresh());

    // Changement de thème : l'accent des widgets est celui de l'app.
    const { currentThemeId } = useTheme();
    watch(currentThemeId, () => void this.refresh());

    // Retour au premier plan : recharge la fenêtre d'horaires et la
    // progression éventuellement modifiée sur un autre appareil.
    import("@capacitor/app")
      .then(({ App }) => App.addListener("resume", () => void this.refresh()))
      .catch(() => {});
  }

  /**
   * Recalcule et pousse ce qui a changé. `dailyPrefs` : préférences déjà en
   * mémoire chez l'appelant (page Lecture du jour), pour construire le payload
   * sans relire Firestore. Les appels qui se chevauchent sont regroupés.
   */
  refresh(dailyPrefs?: DailyWidgetPrefs): Promise<void> {
    if (!isNativeApp) return Promise.resolve();
    if (dailyPrefs) this.pendingDaily = dailyPrefs;
    if (this.queued) return this.queue;
    this.queued = true;
    this.queue = this.queue.then(() => {
      this.queued = false;
      return this.push();
    });
    return this.queue;
  }

  private async push(): Promise<void> {
    try {
      // Import différé : les payloads tirent le moteur d'horaires (hebcal) et
      // le catalogue des textes, qui n'ont rien à faire dans le chargement de
      // l'app avant son premier rendu.
      const {
        buildDailyReadingWidgetPayload,
        buildLibraryWidgetPayload,
        buildZmanimWidgetPayload,
      } = await import("./widgetPayloads");
      // Les libellés partent dans la langue de l'interface : attendre que son
      // chunk soit chargé (en/he arrivent par import dynamique), sans quoi le
      // premier payload d'un utilisateur en/he partirait en français.
      const locale = i18n.global.locale.value;
      await loadLocaleMessages(locale as SupportedLocale);
      const t = i18n.global.t as (key: string, params?: Record<string, unknown>) => string;

      // Horaires : recalculés seulement si une de leurs entrées a bougé
      // une coche de lecture, par exemple, ne les recalcule pas.
      const { place } = useZmanimLocation();
      const accent = useTheme().currentTheme.value.primary;
      const zmanimKey = `${locale}|${localDayKey()}|${accent}|${JSON.stringify(place.value)}`;
      let zmanim: string | undefined;
      let freshZmanimKey: string | null = null;
      if (zmanimKey !== this.lastZmanimKey) {
        await nextIdle();
        const json = JSON.stringify(
          buildZmanimWidgetPayload(place.value, t, locale, new Date(), accent),
        );
        freshZmanimKey = zmanimKey;
        zmanim = json === this.lastZmanimJson ? undefined : json;
      }

      // Lecture du jour : prefs fournies par la page si possible, Firestore
      // sinon. En cas d'échec de lecture (hors ligne), on n'écrase PAS le
      // dernier état du widget avec des préférences vides.
      let daily: string | undefined;
      const provided = this.pendingDaily;
      this.pendingDaily = null;
      if (!this.user) {
        daily = JSON.stringify(buildDailyReadingWidgetPayload(null, t, new Date(), accent));
      } else {
        try {
          const prefs =
            provided ?? (await userPreferencesService.getPreferencesOrThrow(this.user.id));
          daily = JSON.stringify(buildDailyReadingWidgetPayload(prefs, t, new Date(), accent));
        } catch {
          daily = undefined;
        }
      }
      if (daily === this.lastDailyJson) daily = undefined;

      // Bibliothèque : rien que des libellés, ils ne bougent qu'avec la
      // langue. Le calcul est immédiat, la comparaison suffit à ne pas
      // recharger les raccourcis pour rien.
      let library: string | undefined = JSON.stringify(buildLibraryWidgetPayload(t));
      if (library === this.lastLibraryJson) library = undefined;

      if (zmanim === undefined && daily === undefined && library === undefined) {
        // Rien de neuf à livrer : le calcul du jour peut quand même être acté.
        if (freshZmanimKey) this.lastZmanimKey = freshZmanimKey;
        return;
      }
      await PjWidgets.setPayloads({ zmanim, daily, library });
      // Mémorisé seulement après un envoi réussi : un échec (vieux binaire
      // sans le plugin) laissera le prochain push tout retenter.
      if (freshZmanimKey) this.lastZmanimKey = freshZmanimKey;
      if (zmanim !== undefined) this.lastZmanimJson = zmanim;
      if (daily !== undefined) this.lastDailyJson = daily;
      if (library !== undefined) this.lastLibraryJson = library;
    } catch {
      // Plugin absent (vieux binaire, plateforme web du bridge) : sans gravité,
      // il n'y a alors pas de widget à alimenter.
    }
  }
}

export const widgetService = new WidgetService();
