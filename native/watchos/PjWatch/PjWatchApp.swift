import SwiftUI
import WatchConnectivity

/**
 * L'app Apple Watch (pendant watchOS de native/wear/, l'app Wear OS).
 *
 * Elle n'exécute rien de l'app web et ne va nulle part sur le réseau : le
 * téléphone lui envoie des payloads déjà calculés (contrat :
 * src/services/watchPayloads.ts et widgetPayloads.ts), et les 150 Tehilim sont
 * embarqués dans son paquet. Elle fonctionne donc téléphone éteint, ce que
 * watchOS exige d'ailleurs d'une app d'un seul tenant.
 *
 * Le transport est le « contexte d'application » de WatchConnectivity : il ne
 * garde que le dernier état, il ne fait pas la queue, et le système le remet
 * dès que la montre est joignable. La montre, au premier lancement, réclame
 * quand même tout au téléphone : il croit sinon lui avoir déjà donné ce
 * qu'elle n'a jamais reçu (voir PayloadSink, côté webview).
 *
 * Fichier ajouté à la cible « PjWatch » du projet Xcode par
 * scripts/setup-ios.mjs, voir docs/app-watch.md.
 */
@main
struct PjWatchApp: App {
    @StateObject private var store = PayloadStore()
    @State private var link: WatchLink?

    var body: some Scene {
        WindowGroup {
            RootScreen()
                .environmentObject(store)
                .onAppear {
                    // Activée une seule fois, à la première apparition : le
                    // delegate doit vivre aussi longtemps que la session.
                    if link == nil { link = WatchLink(store: store) }
                }
        }
    }
}

/**
 * La session WatchConnectivity, côté montre.
 *
 * Objet à part du magasin : WCSession retient fortement son delegate, et le
 * magasin est observé par les vues, qui vont et viennent.
 */
final class WatchLink: NSObject, WCSessionDelegate {
    private let store: PayloadStore

    init(store: PayloadStore) {
        self.store = store
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        guard activationState == .activated else { return }
        // Le dernier contexte reçu est disponible tout de suite, même si le
        // téléphone n'est pas joignable : le système en garde une copie.
        deliver(session.receivedApplicationContext)
        // Et on réclame le reste, au cas où le téléphone croie avoir déjà
        // tout donné. Sans effet s'il n'est pas joignable, c'est un bonus.
        guard session.isReachable else { return }
        session.sendMessage(["request": true], replyHandler: nil, errorHandler: { _ in })
    }

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        deliver(context)
    }

    private func deliver(_ context: [String: Any]) {
        guard !context.isEmpty else { return }
        Task { @MainActor in store.store(context) }
    }
}
