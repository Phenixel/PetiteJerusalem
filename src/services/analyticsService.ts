import type { BeforeSendFn, PostHog, Properties } from "posthog-js";
import { appPlatform, isNativeApp } from "../composables/useNativeApp";
import { getConsentChoice, onConsentChange } from "../composables/useConsent";
import { i18n } from "../i18n";
import type { User } from "../models/models";

/**
 * Suivi produit et traque d'erreurs via PostHog (instance EU).
 *
 * - Chargé uniquement en production, par import dynamique : le SDK ne rentre
 *   pas dans le bundle initial et ne bloque jamais le démarrage (même schéma
 *   que Firebase Analytics dans firebase.ts).
 * - La clé du projet est publique (elle part dans le bundle, comme la config
 *   Firebase) : ce n'est pas un secret.
 * - Tant que PostHog n'est pas chargé (dev, adblock, échec réseau), toutes les
 *   méthodes sont des no-ops silencieux : aucun appel ne doit jamais casser
 *   l'app.
 */

// Clé publique du projet PostHog (project settings → Project API key).
const POSTHOG_KEY = "phc_qV5GtjgB46gGmPGpXq8edRXRK94jmgGkiNLdFA6tyRSW";
const POSTHOG_HOST = "https://eu.i.posthog.com";

/**
 * Dans l'app, la webview Capacitor sert le bundle depuis `https://localhost` :
 * les événements arrivent avec la même URL que du vrai trafic web local, et
 * `$lib` vaut « web » (c'est bien posthog-js qui tourne). On réécrit donc
 * l'origine en `app://android` / `app://ios` pour que l'app soit lisible d'un
 * coup d'œil dans PostHog, sans toucher au chemin (les insights par page
 * restent comparables entre le site et l'app).
 */
const NATIVE_ORIGIN = /^https?:\/\/localhost(?::\d+)?/;
const APP_ORIGIN = `app://${appPlatform}`;
const APP_HOST = `app.${appPlatform}`;
const URL_KEYS = ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"];
const HOST_KEYS = ["$host", "$initial_host", "$referring_domain", "$initial_referring_domain"];

function rewriteNativeUrls(bag: Properties | undefined): void {
  if (!bag) return;
  for (const key of URL_KEYS) {
    if (typeof bag[key] === "string") bag[key] = bag[key].replace(NATIVE_ORIGIN, APP_ORIGIN);
  }
  for (const key of HOST_KEYS) {
    if (typeof bag[key] === "string" && bag[key].startsWith("localhost")) bag[key] = APP_HOST;
  }
}

/**
 * Estampille chaque événement avec la plateforme d'exécution.
 *
 * Passe par `before_send` plutôt que par `posthog.register()` : les super
 * propriétés ne couvrent ni le `$pageview` initial (capturé pendant `init()`,
 * donc avant tout `register()`), ni les événements qui suivent un `reset()`
 * de déconnexion, qui vide la persistance. `before_send` s'applique à tout,
 * y compris aux `$exception` d'Error tracking.
 */
/**
 * Le backoffice admin et le studio auteurs sont des outils internes : leurs
 * événements pollueraient les stats produit (funnels, pageviews, replays).
 */
const INTERNAL_PATHS = /^\/(admin|studio)(\/|$)/;

const stampPlatform: BeforeSendFn = (event) => {
  if (!event) return event;
  if (INTERNAL_PATHS.test(window.location.pathname)) return null;
  event.properties.app_platform = appPlatform;
  // Segmentation anonyme/connecté et par langue sur tous les événements, y
  // compris les $pageview automatiques (mêmes raisons que app_platform).
  event.properties.is_logged_in = isLoggedIn;
  event.properties.locale = i18n.global.locale.value;
  if (isNativeApp) {
    rewriteNativeUrls(event.properties);
    rewriteNativeUrls(event.$set);
    rewriteNativeUrls(event.$set_once);
  }
  return event;
};

// Tenu à jour par l'abonnement auth de load() ; false tant que Firebase n'a
// pas restauré la session (les tout premiers événements d'un utilisateur
// connecté peuvent donc partir en anonyme, c'est assumé).
let isLoggedIn = false;

class AnalyticsService {
  private posthog: PostHog | null = null;

  /**
   * ePrivacy/RGPD : rien ne se charge tant que l'utilisateur n'a pas accepté
   * la mesure d'audience (bannière ConsentBanner). Un refus après coup coupe
   * la capture ; un nouvel accord la réactive.
   */
  init(): void {
    if (!import.meta.env.PROD || !POSTHOG_KEY) return;
    if (getConsentChoice() === "granted") {
      void this.load();
    }
    onConsentChange((choice) => {
      if (choice === "granted") {
        if (this.posthog) {
          this.posthog.opt_in_capturing();
        } else {
          void this.load();
        }
      } else if (this.posthog) {
        this.posthog.opt_out_capturing();
      }
    });
  }

  private async load(): Promise<void> {
    try {
      const { default: posthog } = await import("posthog-js");
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // Active les comportements par défaut récents du SDK, dont la capture
        // automatique des pageviews SPA au changement d'historique (vue-router).
        defaults: "2026-05-30",
        // Pas de profil serveur pour les visiteurs anonymes : moins de données
        // personnelles stockées, et un coût par événement plus bas.
        person_profiles: "identified_only",
        // Erreurs JS non attrapées + promesses rejetées → produit Error tracking.
        capture_exceptions: true,
        // Core Web Vitals (LCP, INP, CLS, FCP) → onglet Web vitals de Web
        // analytics : mesure terrain des performances réelles, page par page.
        capture_performance: { web_vitals: true },
        // Session replay : les saisies sont masquées par défaut, on ne relâche
        // pas ce masquage (mots de passe, emails...).
        session_recording: {
          maskAllInputs: true,
        },
        // Dans la webview Capacitor, les cookies sur https://localhost sont
        // fragiles : localStorage est le stockage fiable.
        persistence: isNativeApp ? "localStorage" : "localStorage+cookie",
        // Plateforme + URL lisible sur chaque événement (voir stampPlatform).
        before_send: stampPlatform,
      });
      this.posthog = posthog;

      // Rattache les événements au compte dès qu'une session existe (connexion
      // ou session restaurée au démarrage). Import dynamique pour ne pas tirer
      // Firebase dans le chemin de chargement de PostHog.
      const { authService } = await import("./authService");
      authService.onAuthChanged((user) => {
        isLoggedIn = user != null;
        if (user) this.identify(user);
      });
    } catch {
      // PostHog bloqué (adblock...) : sans impact sur l'app.
    }
  }

  /** Événement métier nommé. Convention : snake_case, verbe au passé. */
  capture(event: string, properties?: Record<string, unknown>): void {
    this.posthog?.capture(event, properties);
  }

  /**
   * Erreur attrapée dans un catch mais qu'on veut voir dans Error tracking
   * (échec de connexion Google, échec de réservation...). Le contexte passé en
   * propriétés permet de trier sans avoir les logs de l'appareil.
   */
  captureException(error: unknown, properties?: Record<string, unknown>): void {
    this.posthog?.captureException(error, properties);
  }

  /** À la connexion : rattache les événements au compte (id Firebase). */
  identify(user: User): void {
    this.posthog?.identify(user.id, { email: user.email, name: user.name });
  }

  /**
   * À la déconnexion explicite uniquement (pas au simple démarrage sans
   * session) : repart sur un visiteur anonyme neuf.
   */
  reset(): void {
    this.posthog?.reset();
  }
}

export const analyticsService = new AnalyticsService();
