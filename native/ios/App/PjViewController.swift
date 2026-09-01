import Capacitor
import UIKit

/**
 * Depuis Capacitor 5, un plugin défini dans le projet de l'app (et non dans un
 * pod) doit être enregistré à la main : ce contrôleur remplace
 * CAPBridgeViewController dans Main.storyboard (champ « Custom Class » du
 * view controller), ce que scripts/setup-ios.mjs pose au scaffold, voir
 * docs/app-widgets.md.
 *
 * Deux plugins passent par là : les widgets d'écran d'accueil
 * (docs/app-widgets.md) et la montre (docs/app-watch.md).
 */
class PjViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PjWidgetsPlugin())
        bridge?.registerPluginInstance(PjWatchPlugin())
    }
}
