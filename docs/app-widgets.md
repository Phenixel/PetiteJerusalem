# Widgets d'écran d'accueil (Android / iOS)

Deux widgets accompagnent l'app native :

- **Horaires** : le prochain zman du lieu de l'utilisateur (et celui d'après),
  aux couleurs de l'app, mis à jour à chaque horaire passé. Toucher le widget
  ouvre la page `/horaires`.
- **Lecture du jour** : la progression de la liste quotidienne (« 2/4 », la
  prochaine lecture à faire, la paracha de la semaine), remise à zéro à minuit.
  Toucher le widget ouvre `/bibliotheque/lecture-du-jour`.

## Architecture : l'app calcule, le natif affiche

Un widget natif ne peut pas exécuter le code de la webview (hebcal, i18n,
Firestore). L'app pré-calcule donc **tout** ce que les widgets affichent et le
leur pousse en JSON :

```
webview (Vue)                        natif
─────────────                        ─────
widgetService.refresh()
  └─ widgetPayloads.ts        ──►    plugin PjWidgets
     (7 j d'horaires,                 ├─ Android : SharedPreferences "pj_widgets"
      lecture du jour,                │  + broadcast vers les 2 providers
      libellés localisés)             └─ iOS : App Group + reload WidgetKit
```

- **Contrat** : `src/services/widgetPayloads.ts` (champ `v` pour les évolutions
  incompatibles). Les libellés sont localisés côté app — le natif n'a aucune
  chaîne métier.
- **Rafraîchi** au lancement, au retour au premier plan, à la
  connexion/déconnexion, au changement de lieu des horaires, et à chaque
  progression de la lecture du jour (`src/services/widgetService.ts`).
- **Entre deux ouvertures de l'app**, le natif vit sur ses réserves : une
  semaine d'horaires est embarquée (le widget se replanifie au prochain zman),
  et le payload lecture porte sa date (passé minuit, les coches ne comptent
  plus). Fenêtre épuisée → le widget invite à rouvrir l'app.
- **Deep-links** : les widgets ouvrent l'app avec une URL ; le listener
  `appUrlOpen` de `src/main.ts` route vers la bonne page.

## Android — automatique

Le code natif est versionné dans `native/android/` (providers Java, layouts,
couleurs jour/nuit) et recopié dans `android/` (git-ignoré, régénéré par la CI)
par `scripts/setup-android.mjs`, qui déclare aussi les receivers dans le
manifest et enregistre le plugin dans MainActivity. Rien à faire de plus :

```bash
npx cap add android          # si android/ n'existe pas encore
node scripts/setup-android.mjs
npm run cap:android
```

Tester : builder sur un appareil, poser les widgets depuis le sélecteur du
launcher, ouvrir l'app une fois (elle pousse les payloads), vérifier que le
widget Horaires bascule au passage d'un zman et que « marquer comme lu » met à
jour le widget Lecture.

## iOS — étapes manuelles (une fois, sur macOS)

Le projet `ios/` est généré (`npx cap add ios`) et non versionné ; Xcode ne se
scripte pas comme Gradle, les cibles se créent à la main. Les sources sont
prêtes dans `native/ios/` :

| Fichier | Cible | Rôle |
|---|---|---|
| `native/ios/App/PjWidgetsPlugin.swift` | App | reçoit les payloads, écrit l'App Group, recharge WidgetKit |
| `native/ios/App/PjViewController.swift` | App | enregistre le plugin (obligatoire depuis Capacitor 5) |
| `native/ios/PjWidgets/PjWidgets.swift` | PjWidgets (extension) | les deux widgets SwiftUI + timelines |

1. **Extension** : File → New → Target… → *Widget Extension*, nom `PjWidgets`,
   sans configuration intent. Supprimer les fichiers d'exemple générés et y
   glisser `PjWidgets.swift`.
2. **App Group** : Signing & Capabilities → *App Groups* →
   `group.fr.petitejerusalem.app` — sur **les deux cibles** (App et PjWidgets).
   (À créer aussi dans le portail Apple Developer pour les builds signés.)
3. **Plugin** : glisser les deux fichiers de `native/ios/App/` dans la cible
   App, puis dans `Main.storyboard` remplacer la classe du view controller
   (`CAPBridgeViewController`) par `PjViewController` (Identity inspector →
   Custom Class).
4. **Deep-links** : dans `Info.plist` de l'App, déclarer le scheme utilisé par
   les widgets :

   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array><string>petitejerusalem</string></array>
     </dict>
   </array>
   ```

Tester : lancer l'app sur un appareil (simulateur : les widgets y sont
capricieux), poser les deux widgets, puis vérifier zman suivant et progression
comme sur Android.

## Évolutions

- Toute nouvelle donnée affichée par un widget passe par le payload
  (`widgetPayloads.ts`) — jamais de calcul métier côté natif.
- Champ retiré ou renommé : incrémenter `v` et faire lire les deux versions au
  natif le temps d'une release (les payloads persistent sur l'appareil).
- Les tests du contrat vivent dans `src/__tests__/widgetPayloads.test.ts`.
