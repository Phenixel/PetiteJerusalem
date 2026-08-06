import Capacitor
import UIKit

/**
 * Depuis Capacitor 5, un plugin défini dans le projet de l'app (et non dans un
 * pod) doit être enregistré à la main : ce contrôleur remplace
 * CAPBridgeViewController dans Main.storyboard (champ « Custom Class » du
 * view controller) — voir docs/app-widgets.md.
 */
class PjViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PjWidgetsPlugin())
    }
}
