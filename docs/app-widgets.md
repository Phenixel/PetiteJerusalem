# Widgets d'écran d'accueil (Android / iOS)

Trois widgets accompagnent l'app native :

- **Horaires** : la date hébraïque, le prochain zman du lieu de l'utilisateur
  (à l'accent de son thème, comme la carte « prochain horaire » de la page),
  ceux d'après, la paracha de la semaine et le ta'hanoun (en gras les jours où
  l'on n'en dit pas), mis à jour à chaque horaire passé. Toucher le widget
  ouvre la page `/horaires`.
- **Horaires essentiels** (iOS seulement) : les quatre horaires que l'on vient
  vérifier le plus souvent, et rien d'autre : fin du Chéma et fin de la Amida
  (au Gaon de Vilna, l'opinion la plus tardive, celle qui fait la limite), plag
  haMin'ha, tsét haKokhavim. C'est un tableau du jour, pas une annonce : ses
  quatre lignes ne tournent qu'à la chkia, et la limite du Chéma reste
  affichée une fois passée, puisque c'est son heure d'aujourd'hui que l'on
  vient lire.
- **Lecture du jour** : une ligne, le dessin de la carte du tableau de bord
  (`src/components/DailyReadingCard.vue`) : titre, « 2 sur 3 lus aujourd'hui »,
  pourcentage et barre de progression, remise à zéro à minuit. Toucher le
  widget ouvre `/bibliotheque/lecture-du-jour`.

S'y ajoutent cinq **raccourcis** (iOS seulement), au plus petit format que
l'écran d'accueil propose, qui n'ouvrent chacun qu'une page :

| Raccourci | Ouvre | Ce qu'il montre |
|---|---|---|
| Bibliothèque | `/bibliotheque` | une étagère de volumes reliés ; en format moyen, les quatre livres portent leur titre |
| Sidour | `/bibliotheque/sidour` | le livre du sidour, titre sur la couverture |
| Tehilim | `/bibliotheque/tehilim` | le livre des Tehilim, idem |
| Prochain horaire | `/horaires` | l'heure du prochain zman, en grand, et son nom en dessous |
| Avancement de la lecture | `/bibliotheque/lecture-du-jour` | un anneau qui se remplit au fil des coches, et son pourcentage |

Les livres reprennent le dessin de `src/components/LibraryShelf.vue`, trait
pour trait : reliure chaude, pli du dos, tranche de pages ivoire, cadre
estampé et titre en serif. Comme dans l'app, ils sont **hors du thème** de
l'utilisateur et identiques en mode sombre : ce sont des objets, pas de
l'interface.

Tout le reste porte l'accent du thème choisi par l'utilisateur : il voyage
dans le payload, le natif ne connaît aucune couleur de thème.

## Les formats, et ce qu'ils imposent

Sur iOS, un widget d'écran d'accueil n'a que les tailles du système, et le
format moyen est exactement aussi **haut** que le petit, deux fois plus large
seulement : il n'existe pas d'équivalent au 4×1 d'Android. Ce qu'un format
moyen a en trop est de la largeur, jamais de la hauteur, et un dessin qui
l'oublie déborde du cadre (les horaires suivants sont passés à côté de l'heure
mise en avant pour cette raison).

Les trois widgets acceptent aussi l'**écran verrouillé** (et StandBy), depuis
iOS 16, en `accessoryRectangular`. Là, tout change : 72 pt de haut au lieu de
164, aucun fond à nous (le système pose le sien), et le rendu « vibrant »
délave les couleurs, l'accent du thème compris. Chaque widget y a donc un
dessin à part, dépouillé, qui ne fait porter aucun sens à la couleur : la
règle vaut aussi pour le vert de « tout est lu », qui n'y survit pas.

Côté Android, ce sont les tailles du launcher qui décident, et les deux
providers historiques suffisent : « Horaires essentiels » n'a pas encore de
pendant Android.

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
      titres de la biblio,            └─ iOS : App Group + reload WidgetKit
      libellés localisés)
```

Trois clés voyagent : `zmanim`, `daily` et `library`. La dernière ne porte que
des titres (« Bibliothèque », « Sidour », « Tehilim »…) : ils ne bougent
qu'avec la langue, mais ils ne peuvent pas pour autant s'écrire en dur côté
natif, « Sidour » se disant « Siddur » en anglais et « סידור » en hébreu.
Android range cette clé sans encore la lire : aucun de ses widgets n'en a
besoin, mais le contrat reste le même des deux côtés.

- **Contrat** : `src/services/widgetPayloads.ts` (champ `v` pour les évolutions
  incompatibles). Tout ce qui s'affiche vient du payload, déjà localisé ET
  déjà formaté, heures comprises (`time: "17:42"`, date hébraïque, libellé du
  ta'hanoun, `expiresAt` pour l'échéance de minuit) : le natif ne traduit rien,
  ne formate rien, ne compare que des epochs. Les repères qui changent à la
  chkia (date hébraïque, paracha, ta'hanoun) sont livrés jour par jour dans
  `days`, chacun borné par les chkiot qui l'ouvrent et le ferment : le widget
  choisit celui qui couvre l'instant affiché, et reste juste une semaine sans
  que l'app soit rouverte. Les DateFormatter
  natifs subiraient le réglage 12 h/24 h et le calendrier de l'appareil
  (hébraïque chez une partie du public), qui fausseraient l'affichage. Seule
  exception : le sélecteur de widgets du launcher et l'état « aucun payload »
  (avant le premier lancement), portés par des ressources natives.
  Deux valeurs échappent à la règle du « déjà formaté », faute de pouvoir être
  calculées à l'avance : les nombres de la ligne de progression, qui dépendent
  de l'heure qu'il sera (`progressTemplate` part avec ses `{done}`/`{total}`
  intacts, comme le `then` des horaires), et l'accent du thème (`accent`), une
  couleur et non un texte.
- **Rafraîchi** au lancement, au retour au premier plan, à la
  connexion/déconnexion, au changement de lieu des horaires, au changement de
  langue, au changement de thème, et à chaque progression de la lecture du jour
  (`src/services/widgetService.ts`). Un payload inchangé n'est pas renvoyé, et
  le natif ne recharge que le widget dont le payload a changé (le budget de
  rafraîchissement WidgetKit n'est pas extensible) ; la page Lecture du jour
  fournit ses préférences en mémoire pour éviter une relecture Firestore.
- **Entre deux ouvertures de l'app**, le natif vit sur ses réserves : une
  semaine d'horaires est embarquée (le widget se replanifie au prochain zman),
  et le payload lecture porte son échéance (passé `expiresAt`, les coches ne
  comptent plus). Fenêtre épuisée → le widget invite à rouvrir l'app et cesse
  de se replanifier jusqu'au prochain payload.
- **Deep-links** : les widgets ouvrent l'app avec une URL du site ; le
  listener `appUrlOpen` de `src/main.ts` ne route QUE les URLs de
  `petite-jerusalem.fr` (un callback OAuth natif ou un intent tiers ne doit
  pas naviguer) et attend `router.isReady()` pour survivre au démarrage à
  froid.
- **Cas particulier** : un utilisateur dont la seule lecture est la paracha
  (chnei mikra hebdomadaire) est bien « configuré » ; la paracha devient alors
  la lecture, et c'est son avancement, hebdomadaire, qui remplit la barre.

## Android : automatique

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

## iOS : automatique aussi, sauf trois clics chez Apple

Le projet `ios/` est généré (`npx cap add ios`) et non versionné. Longtemps la
cible d'extension s'y créait **à la main dans Xcode** : elle ne survivait donc
à aucun `cap add ios`, et les builds de la CI partaient sur l'App Store sans le
moindre widget, sans rien signaler. C'est la raison, et la seule, pour laquelle
les widgets n'existaient pas sur iPhone.

`scripts/setup-ios.mjs` écrit désormais la cible lui-même, via
`scripts/lib/xcode-widgets.mjs` (transformation de texte pure, testée sans
macOS dans `src/__tests__/xcodeWidgets.test.ts`) :

| Fichier de `native/ios/` | Destination | Rôle |
|---|---|---|
| `App/PjWidgetsPlugin.swift` | cible App | reçoit les payloads, écrit l'App Group, recharge WidgetKit |
| `App/PjViewController.swift` | cible App | enregistre le plugin (obligatoire depuis Capacitor 5) |
| `PjWidgets/PjWidgets.swift` | cible PjWidgets | les deux widgets SwiftUI et leurs timelines |

Le script pose aussi l'`Info.plist` de l'extension (point d'extension
WidgetKit, versions alignées sur celles de l'app), ses entitlements (l'App
Group), l'App Group sur la cible App, la classe `PjViewController` dans
`Main.storyboard`, et le schéma d'URL `petitejerusalem` des deep-links, aux
côtés du `REVERSED_CLIENT_ID` de Google (dans le **même** tableau
`CFBundleURLTypes`, la clé étant unique).

```bash
npx cap add ios              # si ios/ n'existe pas encore
node scripts/setup-ios.mjs
npm run cap:ios
```

**La seule chose qui reste à faire à la main**, une fois pour toutes :
l'App Group côté Apple. L'API App Store Connect sait activer la capacité
`APP_GROUPS`, mais ni créer un groupe ni l'attacher à un App ID. Sur
developer.apple.com → Certificates, Identifiers & Profiles :

1. Identifiers → **App Groups** → + → identifiant `group.fr.petitejerusalem.app` ;
2. Identifiers → `fr.petitejerusalem.app` → App Groups → Configure → cocher le groupe ;
3. Identifiers → `fr.petitejerusalem.app.PjWidgets` → App Groups → Configure → idem.

L'App ID de l'extension est créé par `scripts/ios-signing.mjs` au premier run
de la CI ; en local, Xcode s'en charge à la première signature. Le script relit
ensuite les profils et refuse de continuer si l'App Group n'y est pas
(`docs/ios-ci-cd.md`).

Tester : lancer l'app sur un appareil, poser les widgets, puis vérifier zman
suivant et progression comme sur Android.

### Revoir le rendu sur simulateur

Le simulateur convient très bien à une passe visuelle, à deux conditions qui
ne se devinent pas :

1. **Les entitlements.** Un `xcodebuild -sdk iphonesimulator` en ligne de
   commande n'embarque aucun entitlement : l'App Group n'existe donc pas, et
   les widgets restent sur « ouvrez l'app » quoi qu'on pousse. Il faut
   resigner l'app ET son `.appex` à la main avant d'installer :

   ```bash
   codesign --force --sign - --entitlements ios/App/PjWidgets/PjWidgets.entitlements \
     Build/Products/Debug-iphonesimulator/App.app/PlugIns/PjWidgets.appex
   codesign --force --sign - --entitlements ios/App/App/App.entitlements \
     Build/Products/Debug-iphonesimulator/App.app
   ```

   `xcrun simctl get_app_container booted fr.petitejerusalem.app groups` doit
   alors répondre un chemin ; tant qu'il répond le vide, rien ne marchera.

2. **Le rechargement.** Écrire un payload dans le plist de l'App Group ne
   suffit pas : l'entrée déjà archivée par WidgetKit porte sa copie du
   payload, et tuer `chronod` ne fait que la redessiner. Seule une
   réinstallation de l'app (`xcrun simctl install`) invalide les timelines.
   Écrire le payload **puis** réinstaller, dans cet ordre.

Le reste se pilote en ligne de commande : `xcrun simctl io booted screenshot`
pour regarder, `xcrun simctl ui booted appearance dark|light` pour l'autre
mode. Poser un widget, en revanche, ne s'automatise pas : c'est le seul geste
qui reste à faire à la main.

## Évolutions

- Toute nouvelle donnée affichée par un widget passe par le payload
  (`widgetPayloads.ts`), jamais de calcul métier côté natif.
- Champ retiré ou renommé : incrémenter `v` et faire lire les deux versions au
  natif le temps d'une release (les payloads persistent sur l'appareil).
- Les tests du contrat vivent dans `src/__tests__/widgetPayloads.test.ts`.
