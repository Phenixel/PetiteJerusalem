import { registerPlugin } from "@capacitor/core";
import { watch } from "vue";
import { isNativeApp } from "../composables/useNativeApp";
import { useTheme } from "../composables/useTheme";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { i18n, loadLocaleMessages, type SupportedLocale } from "../i18n";
import { localDayKey } from "./dateService";
import { authService, type User } from "./authService";
import { userPreferencesService, type UserPreferences } from "./userPreferencesService";
import { PayloadSink } from "./payloadSink";
import { watchService } from "./watchService";
import { buildWatchPayload } from "./watchPayloads";
import {
  buildDailyReadingWidgetPayload,
  buildLibraryWidgetPayload,
  buildZmanimWidgetPayload,
} from "./widgetPayloads";

/**
 * Alimente les surfaces natives qui affichent l'app sans l'exécuter : les
 * widgets d'écran d'accueil (Android / iOS) et la montre (Wear OS / Apple
 * Watch).
 *
 * Aucune d'elles ne peut faire tourner le code de la webview : l'app leur
 * pousse des payloads JSON pré-calculés (voir widgetPayloads et watchPayloads)
 * via deux plugins natifs. PjWidgets range les siens en SharedPreferences côté
 * Android, dans l'App Group côté iOS, et rafraîchit les widgets concernés ;
 * PjWatch remet les siens à la montre par le Data Layer (Wear OS) ou
 * WatchConnectivity (watchOS). Le natif se débrouille ensuite seul : une
 * semaine d'horaires est embarquée, et la lecture du jour porte son échéance
 * (expiresAt) pour se remettre à zéro à minuit sans rouvrir l'app.
 *
 * Un seul producteur, donc, et deux destinataires : les payloads ne sont
 * calculés qu'une fois, et chaque destinataire ne se voit remettre que ce qui
 * a changé pour lui (voir PayloadSink). Les horaires et la lecture du jour
 * vont aux deux ; les libellés de la bibliothèque n'intéressent que les
 * raccourcis d'écran d'accueil, ceux des écrans de la montre qu'elle seule.
 *
 * Rafraîchi au lancement, au retour au premier plan, au changement de lieu
 * des horaires, au changement de langue, au changement de thème (les widgets
 * et la montre portent l'accent choisi), à chaque progression de la lecture du
 * jour, et quand la montre réclame tout (app de montre ouverte pour la
 * première fois). Un payload inchangé n'est pas renvoyé : le natif ne recharge
 * pas ses widgets pour rien.
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

  // Les destinataires. Chacun retient ce qu'il a déjà reçu : un payload
  // identique ne repart pas (chaque envoi fait recharger les widgets natifs,
  // budgété côté iOS, et réveille la montre).
  private readonly widgets = new PayloadSink((changed) => PjWidgets.setPayloads(changed));

  // Derniers payloads CALCULÉS (à ne pas confondre avec ce que chaque
  // destinataire a reçu, qu'il tient lui-même). La clé des horaires porte
  // leurs seules entrées (lieu, jour, langue, accent) : tant qu'elle ne bouge
  // pas, les ~100 calculs solaires ne sont même pas refaits.
  private zmanimKey: string | null = null;
  private zmanimJson: string | null = null;
  private dailyJson: string | null = null;
  private libraryJson: string | null = null;
  private watchJson: string | null = null;

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

    // La montre réclame tout : son app vient d'être ouverte pour la première
    // fois, ou elle vient d'être appairée. Elle n'a rien de ce que le
    // téléphone croit lui avoir donné, on oublie donc ce qu'il en sait avant
    // de republier.
    watchService.onRequest(() => {
      watchService.reset();
      void this.refresh();
    });
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
      if (zmanimKey !== this.zmanimKey) {
        await nextIdle();
        this.zmanimJson = JSON.stringify(
          buildZmanimWidgetPayload(place.value, t, locale, new Date(), accent),
        );
        this.zmanimKey = zmanimKey;
      }

      // Lecture du jour : prefs fournies par la page si possible, Firestore
      // sinon. En cas d'échec de lecture (hors ligne), on garde le dernier
      // payload calculé plutôt que d'écraser les surfaces par du vide.
      const provided = this.pendingDaily;
      this.pendingDaily = null;
      if (!this.user) {
        this.dailyJson = JSON.stringify(buildDailyReadingWidgetPayload(null, t, new Date(), accent));
      } else {
        try {
          const prefs =
            provided ?? (await userPreferencesService.getPreferencesOrThrow(this.user.id));
          this.dailyJson = JSON.stringify(
            buildDailyReadingWidgetPayload(prefs, t, new Date(), accent),
          );
        } catch {
          // Hors ligne : le dernier payload tient.
        }
      }

      // Bibliothèque (raccourcis d'écran d'accueil) et écrans de la montre :
      // rien que des libellés et les psaumes du jour, le calcul est immédiat.
      this.libraryJson = JSON.stringify(buildLibraryWidgetPayload(t));
      this.watchJson = JSON.stringify(buildWatchPayload(t, locale, new Date(), accent));

      // Chaque destinataire ne prend que ce qui a changé pour lui, et ne
      // retient un payload qu'une fois reçu : un envoi échoué d'un côté (vieux
      // binaire, montre injoignable) n'empêche pas l'autre et sera retenté.
      await Promise.allSettled([
        this.widgets.publish({
          zmanim: this.zmanimJson,
          daily: this.dailyJson,
          library: this.libraryJson,
        }),
        watchService.publish({
          zmanim: this.zmanimJson,
          daily: this.dailyJson,
          watch: this.watchJson,
        }),
      ]);
    } catch {
      // Plugin absent (vieux binaire, plateforme web du bridge) : sans gravité,
      // il n'y a alors ni widget ni montre à alimenter.
    }
  }
}

export const widgetService = new WidgetService();
