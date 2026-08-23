# Liens d'application : un lien du site ouvre l'app installée

Un lien vers `https://petite-jerusalem.fr/...`, reçu par message ou trouvé
dans une page, ouvre directement l'app quand elle est installée sur
l'appareil ; sinon il s'ouvre dans le navigateur, comme avant. Rien à faire
côté utilisateur, aucune bannière, aucun clic supplémentaire : c'est le
système qui décide, à partir d'une preuve que le site publie.

Deux mécanismes, un par plateforme, mais le même principe :

| Plateforme | Mécanisme | Fichier servi par le site |
| --- | --- | --- |
| Android | App Links | `/.well-known/assetlinks.json` |
| iOS | Universal Links | `/.well-known/apple-app-site-association` |

À l'installation (Android) ou au premier lancement (iOS), le système va lire
ce fichier sur le domaine et vérifie qu'il désigne bien l'app installée. Le
domaine prouve ainsi qu'il appartient à l'app, et l'app qu'elle appartient au
domaine : personne ne peut détourner les liens du site en publiant une app qui
les revendique.

## Ce que le dépôt en tient

Une seule source, `scripts/lib/app-links.mjs` : le domaine, l'identifiant de
l'app, et **la liste des chemins** qui ouvrent l'app. Trois consommateurs :

- `scripts/well-known.mjs` écrit les deux fichiers de preuve dans `dist/` à
  la fin de `npm run build` ; `firebase.json` les sert avec le bon type de
  contenu ;
- `scripts/setup-android.mjs` pose l'intent-filter `autoVerify` du manifest ;
- `scripts/setup-ios.mjs` déclare `applinks:petite-jerusalem.fr` dans les
  entitlements, et `scripts/ios-signing.mjs` active la capacité Associated
  Domains sur l'App ID avant de créer le profil de signature.

Une fois l'app ouverte, c'est le listener `appUrlOpen` de `src/main.ts` qui
navigue jusqu'à la page demandée, le même que celui des widgets.

Les pages traduites vivent sous un préfixe de langue (`/en`, `/he` ; le
français reste à la racine) et leurs routes ne sont pas écrites en dur dans le
routeur, elles sont dérivées de `SECTION_SLUGS`. Le test les reconstruit à
partir de cette table plutôt que de lire `routes.ts` : sans quoi une section
traduite ajoutée plus tard s'ouvrirait dans le navigateur sans que rien ne le
signale.

La liste des chemins est **positive** : ce qui n'y figure pas reste au
navigateur. Ce n'est pas un détail de forme. `/__/auth/` est la redirection de
Firebase Auth (`authDomain` vaut le domaine du site) : capturée par l'app,
elle couperait une connexion Google en plein vol sur le web mobile. Même
chose pour `/og/`, `/texts/`, `/assets/` et `/fonts/`, qui ne sont pas des
pages. Un test tient la liste à jour dans les deux sens
(`src/__tests__/appLinks.test.ts`) : toute route ajoutée au routeur sans son
préfixe fait échouer la vérification.

## Les deux valeurs à fournir

Elles décrivent des clés de signature, qui ne sont pas dans le dépôt. Elles
sont publiques une fois servies (n'importe qui peut lire les fichiers
`.well-known` du site), mais elles doivent être exactes : une empreinte fausse
et le système refuse silencieusement d'ouvrir l'app.

| Valeur | D'où elle vient |
| --- | --- |
| `ANDROID_APP_LINK_SHA256` | Play Console → Test et publication → Intégrité de l'app → Signature de l'app : l'empreinte **SHA-256** du certificat de signature d'application. Y ajouter, séparée par une virgule, celle du certificat d'importation, sinon les builds installés hors Play Store (APK de test) ne vérifient pas. |
| `IOS_DEVELOPMENT_TEAM` | Team ID Apple (10 caractères), déjà utilisé par `scripts/setup-ios.mjs` et déjà présent en secret GitHub. |

Deux façons de les fournir, au choix :

- **par l'environnement** (ce que fait la CI) : le workflow `deploy.yml` les
  passe au build depuis les secrets du dépôt. Il reste donc à créer le secret
  `ANDROID_APP_LINK_SHA256` ;
- **en dur** dans `scripts/lib/app-links.mjs` (`ANDROID_SHA256_DEFAULT` et
  `APPLE_TEAM_ID_DEFAULT`), si on préfère que le dépôt se suffise à lui-même.

Sans elles, le build passe quand même : le script écrit un avertissement et
n'écrit pas le fichier concerné. Un fichier absent laisse les liens dans le
navigateur ; un fichier présent mais faux ferait croire au système que la
vérification a eu lieu.

```bash
# Vérifier ce que le build produit, sans rien déployer
ANDROID_APP_LINK_SHA256="AB:CD:…:EF" IOS_DEVELOPMENT_TEAM=XXXXXXXXXX npm run build
cat dist/.well-known/assetlinks.json
```

## Vérifier en vrai

Une fois le site déployé et l'app installée :

```bash
# Ce que le site sert (les deux doivent répondre en JSON, sans redirection)
curl -sI https://petite-jerusalem.fr/.well-known/assetlinks.json
curl -s  https://petite-jerusalem.fr/.well-known/apple-app-site-association

# Ce qu'Android a vérifié sur l'appareil branché
adb shell pm get-app-links fr.petitejerusalem.app
# « verified » attendu pour petite-jerusalem.fr ; sinon, forcer une nouvelle
# vérification : adb shell pm verify-app-links --re-verify fr.petitejerusalem.app

# Ouvrir un lien comme le ferait un message
adb shell am start -a android.intent.action.VIEW -d "https://petite-jerusalem.fr/tehilim"
```

Sur iOS, le fichier est récupéré par le CDN d'Apple, pas par l'appareil : le
délai de propagation se compte en heures après un changement. Pour tester
sans attendre, installer un profil de développement et activer
Réglages → Développeur → Associated Domains Development.

## Pièges connus

- **Le fichier doit être servi sans redirection ni authentification**, en
  HTTPS, avec `Content-Type: application/json`. C'est pour cela que
  `firebase.json` déclare un en-tête explicite pour
  `apple-app-site-association`, qui n'a pas d'extension, et que la liste
  `ignore` du hosting ne masque plus les fichiers commençant par un point :
  `.well-known/` en fait partie.
- **Changer la clé de signature change l'empreinte.** Un passage à une
  nouvelle clé de signature Play (ou l'activation de Play App Signing) casse
  les liens tant que `assetlinks.json` n'est pas mis à jour ; les deux
  empreintes peuvent coexister dans le fichier.
- **Android ne vérifie qu'à l'installation** et lors des mises à jour de
  l'app : un fichier corrigé après coup ne prend effet qu'à la réinstallation
  ou après `pm verify-app-links --re-verify`.
- **Un seul host déclaré** (`petite-jerusalem.fr`) : tout host ajouté à
  l'intent-filter doit servir sa propre preuve, faute de quoi la vérification
  échoue pour l'ensemble.
