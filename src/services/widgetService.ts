import { registerPlugin } from "@capacitor/core";
import { watch } from "vue";
import { isNativeApp } from "../composables/useNativeApp";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { i18n } from "../i18n";
import { authService, type User } from "./authService";
import { userPreferencesService } from "./userPreferencesService";
import { buildDailyReadingWidgetPayload, buildZmanimWidgetPayload } from "./widgetPayloads";

/**
 * Alimente les widgets d'écran d'accueil (Android / iOS).
 *
 * Les widgets natifs ne peuvent pas exécuter le code de la webview : l'app
 * leur pousse des payloads JSON pré-calculés (voir widgetPayloads) via le
 * plugin natif PjWidgets — SharedPreferences côté Android, App Group côté iOS,
 * qui rafraîchit les widgets dans la foulée. Le natif se débrouille ensuite
 * seul : une semaine d'horaires est embarquée, et la lecture du jour porte sa
 * date pour se remettre à zéro à minuit sans rouvrir l'app.
 *
 * Rafraîchi au lancement, au retour au premier plan, au changement de lieu
 * des horaires, et à chaque progression de la lecture du jour.
 */

interface PjWidgetsBridge {
  /**
   * Payloads en JSON ; le natif stocke ceux qui sont fournis puis rafraîchit
   * les widgets. Un champ omis laisse le dernier état en place.
   */
  setPayloads(options: { zmanim?: string; daily?: string }): Promise<void>;
}

const PjWidgets = registerPlugin<PjWidgetsBridge>("PjWidgets");

class WidgetService {
  private user: User | null = null;
  private started = false;
  private inflight: Promise<void> | null = null;
  private queued = false;

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

    // Retour au premier plan : recharge la fenêtre d'horaires et la
    // progression éventuellement modifiée sur un autre appareil.
    import("@capacitor/app")
      .then(({ App }) => App.addListener("resume", () => void this.refresh()))
      .catch(() => {});
  }

  /**
   * Recalcule et pousse les deux payloads. Les appels qui se chevauchent sont
   * regroupés : un refresh en vol, au plus un autre en attente.
   */
  refresh(): Promise<void> {
    if (!isNativeApp) return Promise.resolve();
    if (this.inflight) {
      this.queued = true;
      return this.inflight;
    }
    this.inflight = this.push().finally(() => {
      this.inflight = null;
      if (this.queued) {
        this.queued = false;
        void this.refresh();
      }
    });
    return this.inflight;
  }

  private async push(): Promise<void> {
    try {
      const t = i18n.global.t as (key: string, params?: Record<string, unknown>) => string;
      const locale = i18n.global.locale.value;
      const { place } = useZmanimLocation();
      const zmanim = buildZmanimWidgetPayload(place.value, t, locale);

      // Sans compte, le widget lecture invite à ouvrir l'app. Connecté mais
      // préférences illisibles (hors ligne) : on n'écrase pas le dernier état
      // connu du widget, seuls les horaires — calculés en local — partent.
      let daily: string | undefined;
      if (!this.user) {
        daily = JSON.stringify(buildDailyReadingWidgetPayload(null, t));
      } else {
        try {
          const prefs = await userPreferencesService.getPreferences(this.user.id);
          daily = JSON.stringify(buildDailyReadingWidgetPayload(prefs, t));
        } catch {
          daily = undefined;
        }
      }

      await PjWidgets.setPayloads({ zmanim: JSON.stringify(zmanim), daily });
    } catch {
      // Plugin absent (vieux binaire, plateforme web du bridge) : sans gravité,
      // il n'y a alors pas de widget à alimenter.
    }
  }
}

export const widgetService = new WidgetService();
