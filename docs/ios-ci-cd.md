# CI/CD iOS : envoi automatique sur TestFlight

Le workflow [.github/workflows/deploy-ios.yml](../.github/workflows/deploy-ios.yml)
construit l'app iOS et l'envoie sur TestFlight **à chaque tag `vX.Y.Z`**, en
parallèle de `deploy.yml` (site) et `deploy-android.yml` (Play Store). Un seul
geste met donc en prod les trois :

```bash
git tag v3.7.0 && git push origin v3.7.0
```

Le dossier `ios/` étant git-ignoré, la CI le régénère de zéro
(`npx cap add ios` + `scripts/setup-ios.mjs`), aligne
`CFBundleShortVersionString`/`CFBundleVersion` sur le tag (v3.7.0 → build
3070000), archive, exporte l'IPA signé et l'envoie à Apple. L'IPA est aussi
archivé en artifact du run (90 jours).

**La soumission à l'examen est automatique** : après le job macOS, le job
`submit` (Linux) attend la fin du traitement du build par Apple (15 à 40 min),
l'attache à la version du tag et la soumet via l'API
(`scripts/asc-submit.mjs`). Il s'arrête proprement si une soumission
précédente est encore en examen, et se débraye avec la variable de repo
`IOS_AUTO_SUBMIT=false`. **Seule la mise en vente reste manuelle**
(publication en mode manuel, voir
[ios-release-plan.md](ios-release-plan.md#étape-8--soumission)).

## ⚠️ Limite connue : les widgets ne passent pas par cette CI

`docs/app-widgets.md` le dit : la cible `PjWidgets` se crée **à la main dans
Xcode**, une cible ne se scriptant pas comme un module Gradle. Or ce workflow
régénère `ios/` de zéro à chaque tag, il produit donc un build **sans les
widgets**, sans rien signaler.

Ce que `scripts/setup-ios.mjs` sait faire malgré tout, parce que c'est du
fichier et non de la structure de projet : l'entitlement App Group
`group.fr.petitejerusalem.app` sur la cible App, et le schéma d'URL
`petitejerusalem` des deep-links, aux côtés du `REVERSED_CLIENT_ID` de Google
(**dans le même tableau `CFBundleURLTypes`**, la clé étant unique).

Restent hors de portée : la cible d'extension, son entitlement App Group, le
glissement des sources de `native/ios/` et le changement de classe du view
controller dans `Main.storyboard`.

Trois issues possibles, à trancher avant de poser un tag :

| Option | Effet |
|---|---|
| **Builder les releases depuis le Mac** | le plus simple ; la CI ne sert plus qu'à vérifier que le projet se génère |
| **Versionner `ios/`** | la CI redevient fidèle, mais contredit le choix d'architecture de `docs/app-native.md` et alourdit le dépôt |
| **Scripter la cible** (gem `xcodeproj`) | garde tout automatique, mais c'est du vrai travail et une dépendance Ruby de plus |

Tant que ce n'est pas tranché, **ne pas utiliser ce workflow pour une release
publique** : il conviendrait à un build de test sans widget, pas à l'App Store.

## Signature « dans le nuage »

Aucun certificat ni profil de provisionnement n'est stocké dans le repo,
contrairement au keystore Android. `scripts/ios-signing.mjs` en fabrique un jeu
au début de chaque run à partir de la clé d'API App Store Connect : certificat
de distribution, profil « App Store », trousseau temporaire. Le nettoyage de
fin (`--cleanup`, exécuté même quand le build échoue) détruit le trousseau et
le profil ; le certificat, lui, ne part que si le run n'a rien envoyé chez
Apple, voir le quota plus bas. La même clé sert à l'envoi de l'IPA et à la
synchronisation de la fiche : c'est le seul secret sensible du workflow.

### Pourquoi manuelle et non automatique

`xcodebuild -allowProvisioningUpdates` (signature automatique) semblait plus
simple, mais il est inutilisable ici : pour **archiver**, Xcode réclame un
profil de *développement*, et Apple n'en délivre aucun à une équipe qui n'a pas
au moins un appareil enregistré, ce compte individuel n'en a aucun. L'erreur
remontait d'abord sous la forme trompeuse « Authentication failed: bearer
token », puis, une fois Xcode épinglé en 26.2, en clair : « No profiles for
'fr.petitejerusalem.app' were found ».

Forcer `CODE_SIGN_IDENTITY="Apple Distribution"` par-dessus le mode automatique
ne marche pas davantage : Xcode refuse le mélange (« has conflicting
provisioning settings »), sur la cible App **et** sur chacun des paquets SPM.

Un profil « App Store », lui, n'exige aucun appareil. D'où le mode manuel, avec
deux conséquences visibles dans `scripts/setup-ios.mjs` :

- les réglages de signature sont écrits dans la **cible App du pbxproj**, jamais
  passés en argument d'`xcodebuild` (un argument s'appliquerait aussi aux
  paquets SPM, qui le rejettent) ;
- l'entitlement `aps-environment` vaut `production` (il doit correspondre au
  profil qui signe), et l'App Group des widgets disparaît du build CI : l'API
  App Store Connect ne sait pas créer de groupe, et les widgets ne sont pas
  dans la v1 (`docs/app-widgets.md`).

Les capacités de l'App ID nécessaires au profil, notifications push et Sign in
with Apple, sont activées par le script lui-même, ce qu'Xcode faisait
auparavant tout seul en mode automatique.

### Le quota de trois certificats de distribution

Apple n'accepte que **trois certificats de distribution** par compte, et le
certificat d'un run ne peut pas toujours partir avec lui : contrairement à ce
qu'on a d'abord cru, Apple ne re-signe pas tout ce qui passe par TestFlight,
il re-valide la signature **d'origine** à la mise en file d'examen. Le build
3.7.3, accepté par TestFlight le 17 août 2026, a été rejeté à l'examen d'un
« ITMS-90035: Invalid Signature » pour cette raison : son certificat avait été
révoqué quelques minutes après l'envoi.

Un certificat doit donc vivre aussi longtemps qu'un binaire signé avec lui est
en examen ou en vente, mais pas plus, sinon le quota se remplit et le tag
suivant échoue sur « You already have a current Distribution certificate »
(c'est ce qui est arrivé au tag v3.7.8). Deux garde-fous s'en chargent, sans
qu'aucun geste manuel ne soit nécessaire :

- en fin de run, `--cleanup` révoque le certificat **si rien n'est parti chez
  Apple** : un run qui échoue avant l'envoi, ou un run de debug, ne laisse
  donc rien derrière lui. La variable `IOS_BUILD_UPLOADED`, posée par le
  workflow juste après l'envoi sur TestFlight, distingue les deux cas ;
- au run suivant, `--setup` révoque, avant de créer le sien, les certificats
  dont plus aucun binaire ne dépend. L'API ne dit pas quel certificat a signé
  quel build, mais elle date les deux : un binaire est signé par le dernier
  certificat créé avant son envoi. Sont protégés les binaires attachés à une
  version qu'Apple a encore en main (examen, traitement, publication en
  attente), celui de la version la plus récente de la fiche quel qu'en soit
  l'état, le dernier binaire envoyé et ceux qu'Apple traite encore.

Une version **déjà distribuée** ne retient rien, et c'est voulu : Apple le dit
au moment de révoquer un certificat, sont invalidées les apps *soumises à
l'examen* signées avec lui, celles déjà sur l'App Store ne sont pas touchées.
Protéger les versions en vente gelait une place du quota par release passée,
définitivement : au 23 août 2026, 3.7.5 et 3.7.6, toutes deux distribuées, en
occupaient deux sur trois.

Si plus rien n'est libérable, le run échoue en affichant la liste des
certificats et ce qui retient chacun ; la décision revient alors à un humain,
sur developer.apple.com.

Conséquence : la clé d'API doit avoir le rôle **Admin**. C'est contre-intuitif
pour une clé de CI, mais Apple réserve la création des certificats de
**distribution** à ce rôle, une clé « App Manager » suffit pour TestFlight et
la fiche, pas pour signer l'archive. Et le rôle d'une clé **ne peut pas être
modifié après création** : se tromper oblige à en générer une nouvelle.

## Clé d'API App Store Connect (une fois, clics)

1. [App Store Connect](https://appstoreconnect.apple.com) → **Utilisateurs et
   accès** → onglet **Intégrations** → **API App Store Connect** → **Clés de
   l'équipe** → `+`. La toute première fois, Apple demande d'abord d'activer
   l'accès à l'API (case à cocher + Soumettre, approbation immédiate).
2. Nom `github ci` (pas de tiret : Apple refuse les caractères spéciaux),
   accès **Admin** → Générer.
3. Télécharger le fichier `AuthKey_XXXXXXXXXX.p8`, **téléchargeable une seule
   fois**, le ranger dans le gestionnaire de mots de passe.
4. Noter sur la même page le **Key ID** (10 caractères) et l'**Issuer ID**
   (un UUID, commun à toutes les clés du compte).

## Secrets GitHub à créer (une fois)

Depuis la racine du repo, sur la machine qui possède la clé `.p8` et
`GoogleService-Info.plist` :

```bash
# 1-2. Identifiants de la clé d'API (page Clés API d'App Store Connect)
gh secret set ASC_KEY_ID    --body "XXXXXXXXXX"
gh secret set ASC_ISSUER_ID --body "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 3. Contenu de la clé privée (fichier .p8 téléchargé)
gh secret set ASC_PRIVATE_KEY < ~/Downloads/AuthKey_XXXXXXXXXX.p8

# 4. Team ID Apple (10 caractères, page Membership de developer.apple.com)
gh secret set IOS_DEVELOPMENT_TEAM --body "XXXXXXXXXX"

# 5. Config Firebase de l'app iOS (racine du repo, git-ignoré)
gh secret set GOOGLE_SERVICE_INFO_PLIST < GoogleService-Info.plist
```

## Fiche App Store

La fiche vit dans le repo, au format inspiré de fastlane, et est synchronisée à
chaque publication par `node scripts/appstore-listing.mjs` (API App Store
Connect, même clé) :

```
store-assets/metadata/ios/<locale>/   # fr-FR, en-US, he
├── name.txt                 # ≤ 30 caractères
├── subtitle.txt             # ≤ 30
├── keywords.txt             # ≤ 100, virgules SANS espace
├── promotional_text.txt     # ≤ 170, modifiable sans nouvelle version
├── description.txt          # ≤ 4000
├── support_url.txt          # obligatoire
├── marketing_url.txt        # optionnel
└── privacy_url.txt          # obligatoire
```

- Les « Nouveautés » ne viennent pas d'un fichier du repo : la CI passe au
  script le corps de la release GitHub du tag (`--release-notes`), et à
  défaut c'est la phrase par défaut de `scripts/release-notes.mjs`
  (« Correction de bugs mineurs. », traduite par langue) qui part, même
  logique que le Play Store. Le corps, rédigé en français, n'alimente que
  fr-FR ; les autres langues reçoivent la phrase par défaut.
- `node scripts/appstore-listing.mjs --check` vérifie en local, sans réseau,
  les limites de caractères **et** l'absence de caractères refusés par l'API
  App Store Connect (émojis, symboles hors BMP…) : la CI le fait en début de
  run et échoue avant les 40 minutes de build macOS, en indiquant fichier,
  ligne et caractère fautif. Le Play Store, lui, accepte les émojis, les
  fiches Android n'ont pas cette contrainte.
- Le script écrit sur la version App Store **modifiable** (état
  `PREPARE_FOR_SUBMISSION` et assimilés), et l'aligne sur le tag : il utilise
  la version portant le bon numéro, sinon renomme la version modifiable
  existante, sinon en crée une. Les versions en examen ou déjà publiées ne
  sont jamais touchées. En cas d'échec malgré tout, le binaire est déjà parti
  sur TestFlight : l'étape n'échoue pas le run, elle affiche un avertissement.
- Apple refuse le champ « Nouveautés » sur la toute première version : le
  script réessaie automatiquement sans.

### Captures d'écran

Elles ne sont **pas** envoyées par le script : l'API App Store Connect impose
un envoi en plusieurs morceaux avec somme de contrôle, pour un geste qui se
fait une fois. Les déposer à la main dans App Store Connect.

L'app est universelle (iPhone + iPad), donc **deux séries** sont exigées :

| Famille | Dimensions acceptées | Simulateur |
|---|---|---|
| iPhone 6,9" | 1320 × 2868, 1290 × 2796 ou 1260 × 2736 | iPhone 17 Pro Max |
| iPad 13" | 2064 × 2752 ou 2048 × 2732 | iPad Pro 13" |

PNG ou JPEG sRGB **sans canal alpha**. Apple redimensionne lui-même pour les
appareils plus petits de chaque famille.

Les captures Android du repo
(`store-assets/metadata/android/fr-FR/images/phoneScreenshots/`, 1080 × 1920)
montrent les mêmes écrans mais n'ont ni le bon ratio ni la bonne barre
système : les refaire avec le simulateur iOS (iPhone 17 Pro Max, `⌘S`) et les
ranger dans `store-assets/metadata/ios/screenshots/<locale>/`.

## Notes

- **Le numéro de version d'App Store Connect doit être identique au tag**,
  sans quoi le build arrive bien dans TestFlight mais n'est pas proposé au
  moment de choisir le build de la version. C'est désormais automatique :
  `appstore-listing.mjs` renomme la version modifiable (ou en crée une) pour
  qu'elle porte le numéro du tag. À la création de l'app, Apple ouvre une
  version « 1.0 », le premier tag la renomme. Le geste manuel ne subsiste que
  si la synchro de la fiche échoue (avertissement dans le journal du run).
- Le `CFBundleVersion` est dérivé du semver du tag : re-publier exige un
  nouveau tag (patch +1). App Store Connect refuse tout numéro de build déjà
  utilisé pour une même version marketing.
- Lancement manuel possible (onglet Actions → Deploy iOS → Run workflow) :
  reprend le dernier tag atteignable depuis la branche choisie.
- Le runner `macos-26` fournit Xcode 26, exigé par Capacitor 8 et par l'App
  Store depuis le 28 avril 2026. Le workflow échoue explicitement si la
  version de Xcode est plus ancienne.
- Les runners macOS consomment les minutes GitHub Actions **10× plus vite**
  que Linux (gratuit sur un repo public). Un build complet prend 10 à 20 min.
- `xcrun altool --upload-app` est marqué déprécié en faveur de
  `--upload-package` mais reste fonctionnel ; si Apple le retire, remplacer
  l'étape « Envoyer sur TestFlight » par `xcrun altool --upload-package` ou
  par `fastlane pilot upload`.
