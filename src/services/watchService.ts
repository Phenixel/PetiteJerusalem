import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { isNativeApp } from "../composables/useNativeApp";
import { PayloadSink } from "./payloadSink";

/**
 * Alimente l'app de montre (Wear OS / Apple Watch).
 *
 * Même principe que les widgets d'écran d'accueil : la montre n'exécute pas le
 * code de la webview, l'app lui pousse des payloads JSON pré-calculés. Elle
 * reçoit les deux payloads des widgets tels quels, horaires et lecture du
 * jour, plus le sien (watchPayloads.ts) : libellés de ses écrans et Tehilim du
 * jour. Le texte des psaumes est embarqué dans l'app de montre, il ne transite
 * pas.
 *
 * Le transport est celui de chaque plateforme, et le plugin natif PjWatch le
 * cache : Data Layer (DataClient) côté Wear OS, WatchConnectivity
 * (applicationContext) côté watchOS. Les deux gardent le dernier état pour la
 * montre, même éteinte ou hors de portée : elle le trouve à son réveil.
 *
 * Le calcul, lui, n'est pas refait ici : c'est widgetService qui produit les
 * payloads et les propose à ses deux destinataires (voir PayloadSink).
 */

interface PjWatchBridge {
  /**
   * Payloads en JSON. Un champ omis laisse en place ce que la montre a déjà.
   * Résout même sans montre appairée : il n'y a alors rien à faire, et ce
   * n'est pas une erreur.
   */
  setPayloads(options: { zmanim?: string; daily?: string; watch?: string }): Promise<void>;
  /**
   * La montre demande tout : son app vient d'être ouverte pour la première
   * fois, ou elle vient d'être appairée. Le téléphone croit lui avoir déjà
   * donné ce qu'elle n'a jamais reçu, il doit donc tout renvoyer.
   */
  addListener(
    event: "watchRequest",
    listener: () => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

const PjWatch = registerPlugin<PjWatchBridge>("PjWatch");

class WatchService {
  private readonly sink = new PayloadSink((changed) => PjWatch.setPayloads(changed));

  /**
   * Branche la demande de la montre. Le rappel doit recalculer et republier :
   * c'est widgetService qui l'installe, seul producteur des payloads. No-op
   * sur le web, et sans conséquence si le binaire natif n'a pas le plugin.
   */
  onRequest(handler: () => void): void {
    if (!isNativeApp) return;
    try {
      // Vieux binaire sans le plugin : l'inscription échoue, de façon
      // synchrone ou non selon la plateforme. Les deux sont sans gravité, il
      // n'y a alors pas de montre à servir.
      void PjWatch.addListener("watchRequest", handler).catch(() => {});
    } catch {
      // Ne rien faire, voir ci-dessus.
    }
  }

  /** Remet à la montre ce qui a changé depuis le dernier envoi. */
  publish(payloads: { zmanim: string | null; daily: string | null; watch: string | null }) {
    if (!isNativeApp) return Promise.resolve();
    return this.sink.publish(payloads);
  }

  /** Oublie ce qui a été envoyé : le prochain `publish` renverra tout. */
  reset(): void {
    this.sink.reset();
  }
}

export const watchService = new WatchService();
