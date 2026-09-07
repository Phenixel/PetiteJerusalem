# Montres connectées (Wear OS / Apple Watch)

Une app de montre accompagne l'app de téléphone, sur les deux plateformes.
Trois écrans, les mêmes des deux côtés :

- **Horaires** : la date hébraïque, le lieu, le prochain zman en grand (à
  l'accent du thème de l'utilisateur), les suivants, la paracha de la semaine
  et le ta'hanoun. C'est ce que montre le widget d'écran d'accueil, déroulé.
- **Lecture du jour** : l'avancement du jour (« 2 sur 3 lus aujourd'hui », la
  barre à l'accent) et les lectures qui le composent, cochées ou non, plus la
  paracha du chnei mikra, hors décompte. **Consultation seule**, voir plus bas.
- **Textes** : les 150 Tehilim, ceux du jour en tête. Embarqués dans l'app de
  montre, donc lisibles sans téléphone à portée.

L'écran d'accueil de la montre porte déjà le prochain horaire, en grand : c'est
ce pour quoi on lève le poignet, il ne demande pas d'ouvrir un écran de plus.

Sur Wear OS s'y ajoutent deux **complications de cadran**, qui ne demandent même
pas d'ouvrir l'app : « Prochain horaire » (l'heure, et le nom du zman en titre)
et « Lecture du jour » (l'avancement, en anneau ou en « 2/3 »). Elles n'ont pas
encore de pendant watchOS : une complication watchOS est une extension WidgetKit
de plus dans le projet Xcode, à écrire dans le pbxproj comme les deux cibles
existantes.

## Architecture : le téléphone calcule, la montre affiche

C'est celle des widgets d'écran d'accueil, à la lettre, et pour la même raison :
une app de montre ne peut pas exécuter le code de la webview (hebcal, i18n,
Firestore). Le téléphone pré-calcule donc **tout** ce qui s'affiche et le pousse
en JSON.

```
webview (Vue)                     téléphone natif              montre
─────────────                     ───────────────              ──────
widgetService.push()
  ├─ widgetPayloads.ts   ──►  plugin PjWidgets   ──► widgets d'écran d'accueil
  └─ watchPayloads.ts    ──►  plugin PjWatch     ──► Data Layer (Wear OS)
                                                 └─► WatchConnectivity (watchOS)
```

**Un seul producteur, deux destinataires.** `widgetService` calcule les payloads
une fois et les propose aux deux ; chacun retient ce qu'il a déjà reçu et ne se
voit remettre que ce qui a changé (`src/services/payloadSink.ts`). Un widget
rechargé pour rien coûte du budget WidgetKit ; un octet envoyé pour rien à la
montre coûte de la batterie sur les deux appareils. La mémoire d'un destinataire
n'est mise à jour qu'après un envoi réussi : un échec d'un côté (vieux binaire,
montre injoignable) n'empêche pas l'autre et sera retenté au passage suivant.

Trois clés voyagent jusqu'à la montre :

| Clé | Contrat | Ce qu'elle porte |
|---|---|---|
| `zmanim` | `src/services/widgetPayloads.ts` | une semaine d'horaires et de jours hébraïques, le même payload que le widget Horaires |
| `daily` | `src/services/widgetPayloads.ts` | la lecture du jour et son échéance, le même payload que le widget Lecture |
| `watch` | `src/services/watchPayloads.ts` | les libellés des écrans de la montre, et les psaumes du jour |

Les deux premiers sont réutilisés **tels quels** : ils sont déjà exactement ce
qu'un écran de montre demande, déjà localisés et déjà formatés, heures
comprises. Les recalculer autrement ne ferait que deux contrats à tenir au lieu
d'un. Le natif ne traduit rien, ne formate rien, ne compare que des epochs ; les
formateurs de date natifs subiraient le réglage 12 h/24 h et le calendrier de
l'appareil (hébraïque chez une partie du public), qui fausseraient l'affichage.

Seule exception, des deux côtés : l'état « rien reçu » (montre posée avant le
premier lancement de l'app sur le téléphone) et les noms des complications dans
leur sélecteur, portés par des ressources natives.

## Le transport, et pourquoi celui-là

| | Wear OS | watchOS |
|---|---|---|
| Primitif | Data Layer, `DataClient.putDataItem` | WatchConnectivity, `updateApplicationContext` |
| Chemin / clés | `/pj/payloads` | les trois clés du contrat |
| Persistance | l'élément reste, la montre le retrouve à son réveil | le système garde le dernier contexte |
| Montre absente | le dépôt réussit quand même | l'envoi est simplement sauté |

Les deux ont la propriété qui compte ici : ils ne gardent que le **dernier**
état, ils ne font pas la queue, et le système le remet à la montre dès qu'elle
est joignable, éteinte ou hors de portée au moment de l'envoi. Le téléphone n'a
donc jamais à attendre la montre.

Un élément (ou un contexte) est remplacé d'un bloc, jamais fusionné : chaque
plugin conserve donc les payloads déjà envoyés pour les redéposer avec celui qui
change. Les trois tiennent très largement sous les limites (100 ko pour un
DataItem, de l'ordre de 256 ko pour un contexte) : les horaires, les plus gros,
pèsent une dizaine de kilo-octets pour leur semaine. Un test le vérifie
(`src/__tests__/watchPayloads.test.ts`).

**Le cas de la toute première fois.** Le téléphone croit avoir déjà donné ce que
la montre n'a jamais reçu : son destinataire retient un payload identique et ne
le renvoie pas. Trois choses répondent à ça :

1. au lancement, la montre relit ce que le système a **déjà** synchronisé pour
   elle (`getDataItems` côté Wear OS, `receivedApplicationContext` côté
   watchOS) : disponible tout de suite, sans rien attendre du téléphone ;
2. elle demande quand même tout au téléphone (`/pj/request`, ou un message
   `request`) ; le plugin le relaie à la webview (événement `watchRequest`),
   qui oublie ce qu'elle croyait avoir envoyé et republie. Best-effort : cela ne
   marche que si l'app du téléphone tourne, elle seule sachant calculer ;
3. côté iOS, l'appairage d'une montre déclenche `sessionWatchStateDidChange`,
   qui republie sans qu'elle ait à demander.

## Les Tehilim sont embarqués, pas envoyés

Les 150 psaumes voyagent dans l'APK Wear et dans le paquet de l'app watchOS, pas
dans le Data Layer : ils ne changent jamais, ils pèsent trois cents kilo-octets,
et les faire transiter à chaque changement de langue coûterait de la bande
passante et de la batterie pour rien. Embarqués, ils se lisent dès la première
seconde, sans téléphone à portée, et c'est ce qu'on attend d'un livre.

Le fichier est produit au setup depuis `public/texts/tehilim.json`, débarrassé
de la mise en forme de la source Sefaria (balises, entités, marqueurs de
paracha) par `scripts/lib/watch-tehilim.mjs`. Le natif n'a donc aucune règle de
texte à tenir. Ce nettoyage doit rester d'accord avec celui que l'app applique à
l'écran (`cleanText`, `src/services/textService.ts`), sans quoi un verset se
lirait autrement au poignet que sur le téléphone :
`src/__tests__/watchTehilim.test.ts` compare les deux sur le corpus entier.

Les autres corpus (Talmud, Michna, Tanakh, Sidour) restent sur le téléphone :
ils pèsent une quarantaine de méga-octets et se lisent par pages, ce qu'un
poignet ne rend pas. Le Sidour, en plus, dépend des occasions du calendrier et
des horaires du lieu : ce serait un deuxième moteur à porter sur la montre.

## Pourquoi on ne coche pas depuis la montre

La lecture du jour est en consultation seule, et c'est un choix. Cocher
demanderait un chemin d'écriture en sens inverse, montre → téléphone →
Firestore, dont le maillon central est la webview : elle seule sait écrire les
préférences. Or elle ne tourne que quand l'app du téléphone est ouverte. Une
coche faite au poignet, téléphone en veille, serait donc avalée en silence, ou
demanderait une file d'attente et une résolution de conflits avec ce qui a pu
être coché ailleurs entre-temps. Une coche avalée en silence vaut moins qu'une
coche qu'on n'a pas proposée.

Le jour où ce sera fait, ce sera un chemin de bout en bout : file d'attente côté
montre, remise à la webview au premier réveil, et la fusion des progressions qui
existe déjà (`src/__tests__/mergeDailyProgress.test.ts`).

## L'apparence : noir, sauf l'accent

Une montre s'affiche sur fond noir, et pas seulement par habitude : l'écran est
OLED, un pixel noir ne consomme rien, et l'écran toujours allumé y passe le plus
clair de sa vie. Le thème du téléphone ne voyage donc pas jusqu'ici. Seul son
**accent** le fait, sur l'heure mise en avant et sur l'avancement de la lecture,
exactement comme dans les widgets, et il arrive dans le payload : le natif ne
connaît aucune couleur de thème.

## Wear OS : automatique

Le code natif est versionné dans `native/wear/` (module Gradle complet) et dans
`native/android/` (le plugin `PjWatchPlugin`), et recopié dans `android/`
(git-ignoré, régénéré par la CI) par `scripts/setup-android.mjs`, qui déclare
aussi le module dans `settings.gradle`, ajoute `play-services-wearable` aux
dépendances de l'app, enregistre le plugin dans `MainActivity`, reprend les
icônes de l'app et écrit les Tehilim dans les assets de la montre.

```bash
npx cap add android          # si android/ n'existe pas encore
node scripts/setup-android.mjs
cd android && ./gradlew :wear:installDebug
```

**Distribution.** L'app de montre est un artefact **à part**, avec le même
`applicationId` que le téléphone : le Play Store livre les deux depuis une seule
fiche et se sert du `uses-feature android.hardware.type.watch` du manifest pour
savoir lequel envoyer à quel appareil. L'APK embarqué dans celui du téléphone
(`wearApp`) ne concerne plus que Wear OS 2, que l'app ne vise pas (plancher
API 30, Wear OS 3). Les deux `versionCode` doivent différer : la CI donne à la
montre celui du téléphone + 1
(`.github/workflows/deploy-android.yml`), et les deux AAB partent dans la même
release.

Tester : installer sur une montre (ou l'émulateur Wear OS d'Android Studio,
appairé au téléphone), ouvrir l'app du téléphone une fois pour qu'elle pousse
les payloads, puis vérifier que le prochain zman bascule au passage d'un
horaire, qu'une coche sur le téléphone se voit au poignet, et qu'un psaume
s'ouvre téléphone éteint.

## watchOS : automatique aussi

Même histoire que les widgets, et même piège : le projet `ios/` est généré et
non versionné, une cible créée à la main dans Xcode ne survivrait à aucun `cap
add ios`, et les builds partiraient sur l'App Store sans app de montre, sans
rien signaler. `scripts/setup-ios.mjs` écrit donc la cible lui-même, via
`scripts/lib/xcode-watch.mjs` (transformation de texte pure, testée sans macOS
dans `src/__tests__/xcodeWatch.test.ts`).

| Fichier de `native/` | Destination | Rôle |
|---|---|---|
| `ios/App/PjWatchPlugin.swift` | cible App | reçoit les payloads, tient la session WatchConnectivity |
| `ios/App/PjViewController.swift` | cible App | enregistre les deux plugins (obligatoire depuis Capacitor 5) |
| `watchos/PjWatch/Payloads.swift` | cible PjWatch | le contrat, son rangement, les couleurs |
| `watchos/PjWatch/PjWatchApp.swift` | cible PjWatch | le point d'entrée et la session côté montre |
| `watchos/PjWatch/Screens.swift` | cible PjWatch | les trois écrans, et les Tehilim embarqués |

Le script pose aussi l'`Info.plist` de la montre, son catalogue d'icônes et son
fichier de Tehilim.

Trois différences avec une extension de widgets, que la cible doit porter :

1. c'est une **application** (`com.apple.product-type.application`), pas un
   appex : elle a son propre SDK (`SDKROOT = watchos`), sa propre famille
   d'appareils (4) et sa propre cible de déploiement (watchOS 10) ;
2. elle s'embarque dans `App.app/Watch/`, et non dans `PlugIns/` : la phase de
   copie vise `$(CONTENTS_FOLDER_PATH)/Watch`, `dstSubfolderSpec = 16`. C'est
   là, et nulle part ailleurs, qu'iOS va chercher l'app à installer au poignet ;
3. elle a un **catalogue d'icônes**, sans lequel l'App Store refuse l'archive,
   et rien avant ne le signale. Une seule image de 1024 points suffit depuis
   Xcode 14 ; c'est `assets/logo.png`, tel quel.

> **`WKApplication`, et pas `WKWatchKitApp`.** L'app d'un seul tenant qu'Apple
> demande depuis watchOS 9 se déclare avec la première clé ; la seconde décrit
> l'ancienne paire app + extension. Et sans
> `WKCompanionAppBundleIdentifier`, l'app de montre ne s'installe pas avec
> celle du téléphone. Les deux sont posées par `watchInfoPlist`, et
> `src/__tests__/xcodeWatch.test.ts` le vérifie.

```bash
npx cap add ios              # si ios/ n'existe pas encore
node scripts/setup-ios.mjs
npm run cap:ios
```

**Signature.** L'app de montre a son propre App ID
(`fr.petitejerusalem.app.watchkitapp`, le suffixe est imposé par Apple), donc
son propre profil. `scripts/ios-signing.mjs` crée les deux au premier run de la
CI et expose `IOS_WATCH_PROVISIONING_PROFILE` ; en local, Xcode s'en charge à la
première signature. Rien à faire à la main dans le portail Apple, contrairement
à l'App Group des widgets : la montre ne parle qu'au téléphone, par
WatchConnectivity, qui ne demande aucune capacité.

Tester : lancer sur une Apple Watch appairée (ou le simulateur de montre lié au
simulateur d'iPhone), puis les mêmes vérifications que sur Wear OS.

## Ce qui reste à faire à la main, une fois

Le code est scripté de bout en bout ; les fiches des magasins, non.

- **Play Console** : une app Wear OS n'est distribuée que si la fiche déclare le
  facteur de forme « Wear OS » et porte ses propres captures d'écran (écran
  rond). Tant que ce n'est pas fait, l'AAB de la montre monte dans la release
  sans être servi aux montres. La fiche du téléphone
  (`store-assets/metadata/android/`, `scripts/play-listing.mjs`) ne couvre pas
  cette partie.
- **App Store Connect** : de même, l'app de montre demande son propre jeu de
  captures. `scripts/asc-screenshots.mjs` ne produit que celles de l'iPhone et
  de l'iPad.

Rien de tout cela n'empêche un build : les deux artefacts partent, s'installent
et fonctionnent en test interne. C'est la distribution publique aux montres qui
attend ces deux fiches.

## Évolutions

- Toute nouvelle donnée affichée par la montre passe par un payload, jamais de
  calcul métier côté natif : `watchPayloads.ts` pour ce qui lui est propre,
  `widgetPayloads.ts` pour ce qu'elle partage avec les widgets.
- Champ retiré ou renommé : incrémenter `v` et faire lire les deux versions au
  natif le temps d'une release (les payloads persistent sur l'appareil).
- Les tests du contrat vivent dans `src/__tests__/watchPayloads.test.ts`, ceux
  de la remise dans `src/__tests__/payloadSink.test.ts`.
- Restent à faire : les complications watchOS, une tuile Wear OS, et le chemin
  d'écriture des coches décrit plus haut.
