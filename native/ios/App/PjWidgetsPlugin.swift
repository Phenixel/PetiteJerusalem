import Capacitor
import Foundation
import WidgetKit

/**
 * Pont app → widgets d'écran d'accueil (pendant iOS de
 * native/android/.../PjWidgetsPlugin.java).
 *
 * La webview pousse ici les payloads JSON pré-calculés
 * (src/services/widgetService.ts) ; ils sont stockés dans l'App Group, seul
 * espace lisible par l'extension de widgets, puis WidgetKit recharge les
 * timelines.
 *
 * Fichier copié dans la cible App du projet Xcode (généré, non versionné) par
 * scripts/setup-ios.mjs, qui l'y enregistre aussi via PjViewController, voir
 * docs/app-widgets.md.
 */
@objc(PjWidgetsPlugin)
public class PjWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PjWidgetsPlugin"
    public let jsName = "PjWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setPayloads", returnType: CAPPluginReturnPromise)
    ]

    /// Doit exister dans Signing & Capabilities des DEUX cibles (App + widgets).
    static let appGroup = "group.fr.petitejerusalem.app"

    @objc func setPayloads(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            call.reject("App Group \(Self.appGroup) indisponible, vérifier la capability App Groups.")
            return
        }
        // Seuls les widgets dont le payload a changé sont rechargés : chaque
        // reload consomme le budget de rafraîchissement WidgetKit.
        if let zmanim = call.getString("zmanim") {
            defaults.set(zmanim, forKey: "zmanim")
            for kind in ["HorairesWidget", "EssentialsWidget", "ZmanimShortcutWidget"] {
                WidgetCenter.shared.reloadTimelines(ofKind: kind)
            }
        }
        if let daily = call.getString("daily") {
            defaults.set(daily, forKey: "daily")
            WidgetCenter.shared.reloadTimelines(ofKind: "LectureWidget")
            WidgetCenter.shared.reloadTimelines(ofKind: "LectureShortcutWidget")
        }
        // Bibliothèque : les libellés des raccourcis. Ils ne bougent qu'avec
        // la langue, l'app ne les renvoie donc presque jamais.
        if let library = call.getString("library") {
            defaults.set(library, forKey: "library")
            for kind in ["LibraryWidget", "SidourWidget", "TehilimWidget"] {
                WidgetCenter.shared.reloadTimelines(ofKind: kind)
            }
        }
        call.resolve()
    }
}
