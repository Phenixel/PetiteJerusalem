import Capacitor
import Foundation
import WatchConnectivity

/**
 * Pont app → Apple Watch (pendant iOS de
 * native/android/.../PjWatchPlugin.java, et petit frère de PjWidgetsPlugin
 * pour l'écran d'accueil).
 *
 * La webview pousse ici les payloads JSON pré-calculés
 * (src/services/watchService.ts) ; ils partent en « contexte d'application »
 * WatchConnectivity. C'est le primitif qui correspond exactement à ce qu'on
 * veut : il ne garde que le DERNIER état, il ne fait pas la queue, et le
 * système le remet à la montre dès qu'elle est joignable, même si elle était
 * hors de portée ou l'app fermée au moment de l'envoi. Le téléphone n'a donc
 * jamais à attendre la montre.
 *
 * Un contexte est remplacé d'un bloc, jamais fusionné : les payloads déjà
 * envoyés sont donc conservés ici pour repartir avec celui qui change. Les
 * trois tiennent très largement sous la limite (de l'ordre de 256 ko) ; les
 * horaires, les plus gros, pèsent une dizaine de kilo-octets pour leur
 * semaine.
 *
 * Fichier copié dans la cible App du projet Xcode (généré, non versionné) par
 * scripts/setup-ios.mjs, qui l'y enregistre aussi via PjViewController, voir
 * docs/app-watch.md.
 */
@objc(PjWatchPlugin)
public class PjWatchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PjWatchPlugin"
    public let jsName = "PjWatch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setPayloads", returnType: CAPPluginReturnPromise)
    ]

    /// Les clés du contrat, les mêmes des deux côtés (voir watchService.ts).
    static let keys = ["zmanim", "daily", "watch"]

    /// Dernier contexte envoyé : un contexte partiel effacerait le reste.
    private var payloads: [String: String] = [:]

    private let delegate = SessionDelegate()

    override public func load() {
        guard WCSession.isSupported() else { return }
        delegate.plugin = self
        WCSession.default.delegate = delegate
        WCSession.default.activate()
    }

    @objc func setPayloads(_ call: CAPPluginCall) {
        for key in Self.keys {
            if let value = call.getString(key) { payloads[key] = value }
        }
        guard WCSession.isSupported() else {
            // iPad, ou simulateur sans WatchConnectivity : il n'y a pas de
            // montre à servir, et ce n'est pas une erreur.
            call.resolve()
            return
        }
        let session = WCSession.default
        guard session.activationState == .activated else {
            // Pas encore activée : rejeter fait retenter au passage suivant
            // (PayloadSink côté webview), plutôt que de perdre le payload.
            session.activate()
            call.reject("Session WatchConnectivity pas encore activée.")
            return
        }
        guard session.isPaired else {
            // Aucune montre appairée : rien à faire. Le jour où il y en aura
            // une, son app réclamera tout à son premier lancement (voir
            // « watchRequest » plus bas), et sessionWatchStateDidChange
            // préviendra même sans qu'elle le demande.
            call.resolve()
            return
        }
        do {
            try session.updateApplicationContext(payloads)
            call.resolve()
        } catch {
            call.reject("Contexte WatchConnectivity refusé", nil, error)
        }
    }

    /// La montre n'a rien de ce que le téléphone croit lui avoir donné.
    fileprivate func requestFromWatch() {
        notifyListeners("watchRequest", data: nil)
    }

    /**
     * Le delegate est un objet à part, et non le plugin lui-même : WCSession
     * retient fortement son delegate, et un CAPPlugin ne doit pas survivre au
     * bridge qui le porte.
     */
    private class SessionDelegate: NSObject, WCSessionDelegate {
        weak var plugin: PjWatchPlugin?

        func session(
            _ session: WCSession,
            activationDidCompleteWith activationState: WCSessionActivationState,
            error: Error?
        ) {}

        /// Montre appairée, ou app de montre installée : elle n'a rien encore.
        func sessionWatchStateDidChange(_ session: WCSession) {
            guard session.isPaired, session.isWatchAppInstalled else { return }
            DispatchQueue.main.async { self.plugin?.requestFromWatch() }
        }

        func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
            guard message["request"] != nil else { return }
            DispatchQueue.main.async { self.plugin?.requestFromWatch() }
        }

        /// Changement de montre appairée : iOS impose de réactiver la session.
        func sessionDidBecomeInactive(_ session: WCSession) {}

        func sessionDidDeactivate(_ session: WCSession) {
            WCSession.default.activate()
        }
    }
}
