# CI/CD Android : publication Play Store automatique

Le workflow [.github/workflows/deploy-android.yml](../.github/workflows/deploy-android.yml)
publie l'app Android sur le Play Store **à chaque tag `vX.Y.Z`**, en parallèle
du déploiement web (deploy.yml). Un seul geste met donc en prod le site et
l'app :

```bash
git tag v3.0.2 && git push origin v3.0.2
```

Pour mettre en prod le **site seul** (correctif front, contenu, SEO), poser
un tag `web-vX.Y.Z` : seul deploy.yml se déclenche, aucune release mobile ne
part.

Le dossier `android/` étant git-ignoré, la CI le régénère de zéro
(`npx cap add android` + `scripts/setup-android.mjs`), aligne
`versionName`/`versionCode` sur le tag (v3.0.1 → versionCode 3000100),
construit l'AAB signé et l'envoie au Play Store. L'AAB est aussi archivé en
artifact du run (90 jours).

Deux AAB, en fait : celui du téléphone et celui de l'app Wear OS, qui partent
dans la même release Play Store. Ils partagent l'applicationId, se signent avec
la même clé, et leurs `versionCode` diffèrent d'une unité ; c'est le Play Store
qui choisit lequel envoyer à quel appareil, d'après le `uses-feature` du
manifest. Voir `docs/app-watch.md`.

## Secrets GitHub à créer (une fois)

Depuis la racine du repo, sur la machine qui possède le keystore et
`google-services.json` :

```bash
# 1. Keystore de release (fichier binaire → base64)
gh secret set ANDROID_KEYSTORE_BASE64 --body "$(base64 -i ~/petite-jerusalem-release.keystore)"

# 2-4. Valeurs de android/keystore.properties (git-ignoré, présent en local)
gh secret set ANDROID_KEYSTORE_PASSWORD --body "$(grep '^storePassword=' android/keystore.properties | cut -d= -f2-)"
gh secret set ANDROID_KEY_ALIAS        --body "$(grep '^keyAlias='      android/keystore.properties | cut -d= -f2-)"
gh secret set ANDROID_KEY_PASSWORD     --body "$(grep '^keyPassword='   android/keystore.properties | cut -d= -f2-)"

# 5. Config Firebase de l'app Android (racine du repo, git-ignoré)
gh secret set GOOGLE_SERVICES_JSON < google-services.json

# 6. Compte de service Play (voir section suivante)
gh secret set PLAY_SERVICE_ACCOUNT_JSON < ~/Downloads/petite-jerusalem-play-ci.json

# 7. Empreinte SHA-256 du certificat de signature, pour que les liens du site
#    ouvrent l'app (Play Console → Intégrité de l'app → Signature de l'app ;
#    ajouter aussi celle du certificat d'importation, séparée par une virgule).
#    Ce secret est lu par le déploiement du site, pas par celui de l'app,
#    voir docs/app-links.md.
gh secret set ANDROID_APP_LINK_SHA256 --body "AB:CD:…:EF"
```

## Compte de service Play Console (une fois, clics)

1. [Console Google Cloud](https://console.cloud.google.com/iam-admin/serviceaccounts)
   → projet `petite-jerusalem-dev` (connecté en `admin@phenixel.fr`) →
   « Créer un compte de service », nom `play-ci`, sans rôle projet.
2. Sur le compte créé → « Clés » → « Ajouter une clé » → JSON → télécharger
   (c'est le fichier du secret n° 6).
3. [Play Console](https://play.google.com/console) → Utilisateurs et
   autorisations → Inviter un utilisateur → l'adresse e-mail du compte de
   service (`play-ci@….iam.gserviceaccount.com`) → autorisations sur l'app
   Petite Jérusalem : « Publier des releases en production » (et pistes de
   test) + « Modifier la fiche Play Store » (pour la synchronisation des
   descriptions et captures d'écran par la CI).

## Fiche Play Store et notes de version

La fiche (titre, descriptions, captures d'écran) et les notes de version
vivent dans le repo, au format fastlane, et sont synchronisées à chaque
publication :

```
store-assets/metadata/android/<locale>/   # fr-FR, en-US, iw-IL (hébreu)
├── title.txt                 # ≤ 30 caractères
├── short_description.txt     # ≤ 80
├── full_description.txt      # ≤ 4000
└── images/
    └── featureGraphic.png    # bannière 1024×500 (optionnelle)
```

Les captures d'écran, elles, sont communes aux fiches Play et App Store et
vivent à part, dans `store-assets/screenshots/<locale>/` (les `phone-*`
pour le Play Store, au moins 2 sinon elles ne sont pas envoyées) : voir
[store-assets/screenshots/README.md](../store-assets/screenshots/README.md).

- Les notes de version sont attachées à la release Play par
  `upload-google-play` (paramètre `whatsNewDirectory`), préparées par
  `scripts/prepare-whatsnew.mjs` :
  1. **si une release GitHub existe pour le tag** (créée depuis l'interface
     GitHub avec son texte), c'est ce texte qui part sur le Play Store
     (markdown allégé, tronqué à 500 caractères), en français, les autres
     langues retombent sur la langue par défaut dans la console ;
  2. **sinon**, la phrase par défaut de `scripts/release-notes.mjs`
     (« Correction de bugs mineurs. », traduite par langue), il n'y a plus
     de `changelogs/default.txt` dans le repo.

  La release GitHub est de toute façon créée/complétée par la CI avec l'AAB
  signé ; si elle existe déjà, son texte n'est pas touché.
- La fiche est envoyée par `node scripts/play-listing.mjs` (API Android
  Publisher, même compte de service). `node scripts/play-listing.mjs --check`
  vérifie les limites de caractères en local, sans réseau.
- Les captures d'une langue remplacent **tout** le jeu existant dans la
  console ; une langue sans captures dans le repo laisse la console
  intacte (les langues sans images retombent sur la langue par défaut).
- Les captures se régénèrent avec `npm run store:screenshots`
  (scripts/store-screenshots.mjs), en un seul passage pour les deux stores :
  émulateurs Firebase éphémères + données de démo fixes (compte « Sarah
  Levy », session Tehilim, chiourim), puis Chrome headless qui rend
  l'interface de l'**app** (barre d'onglets du bas, sans en-tête de site)
  grâce à une plateforme Capacitor « maison », dans les trois formats des
  fiches : téléphone Play (1080×1920), iPhone 6,9" et iPad 13". Ni émulateur
  Android, ni Gradle, ni barre système : le rendu est le même que la fiche
  App Store, et un passage tient en quelques minutes sur un runner Linux.
  Détails et choix dans
  [store-assets/screenshots/README.md](../store-assets/screenshots/README.md).
- La CI n'attend pas de commit : à chaque tag, le workflow
  `store-screenshots.yml` génère le jeu une fois et le publie en artifact ;
  le job `listing` de deploy-android.yml le récupère (action
  `.github/actions/fetch-store-screenshots`, qui attend la fin du run s'il
  tourne encore) et envoie les `phone-*` avec la fiche. Si la génération
  flanche, la fiche part avec les captures committées dans le repo ; dans
  tous les cas la release, elle, n'attend pas les captures.
- Pour vérifier les captures sans rien publier : onglet Actions → Store
  screenshots → Run workflow. Son artifact contient les trois formats.
  (L'ancienne option **screenshots_only** de Deploy Android n'existe plus.)

## Piste de publication

Le workflow publie sur la piste **production**, en statut « completed » :
dès que la review Google est passée, la version part chez tout le monde,
sans aucun geste dans la Play Console. La piste est codée en dur depuis que
l'app a sa première release production ; l'ancienne variable de repo
`ANDROID_PLAY_TRACK` (qui permettait de viser `internal` tant que l'app
était en test fermé et que l'API refusait la piste production) n'est plus
lue, la supprimer si elle traîne encore (Settings → Secrets and variables →
Actions → Variables).

## Minification (R8)

Le build de release passe par R8 : code mort supprimé, code restant optimisé
et renommé. C'est `scripts/setup-android.mjs` qui pose `minifyEnabled true`
sur android/app/, et `native/wear/build.gradle` qui fait de même pour la
montre ; les deux pointent sur `proguard-android-optimize.txt` (la variante
sans `-dontoptimize`) plus leurs propres règles, versionnées dans
`native/android/app/proguard-rules.pro` et `native/wear/proguard-rules.pro`.

Pourquoi : la Play Console note chaque bundle sur la part de code obscurci,
minifié et optimisé, avec un seuil à 25 %. L'AAB 3.9.5 était à 3 %, et la
console annonçait une sanction sur la visibilité de la fiche. Avec R8, le
bundle du téléphone est à 48 % de classes renommées (59 % de méthodes) et son
DEX passe de 14 Mo à 3,8 Mo ; celui de la montre à 88 %.

Deux choses à savoir avant de toucher au natif :

- Les plugins Capacitor sont chargés par leur nom, et leur `@CapacitorPlugin`
  est lue à l'exécution. Les règles livrées par Capacitor conservent les
  classes, pas les types d'annotations : nos règles s'en chargent. Sans elles,
  l'app démarre, puis meurt au premier appel de permission.
- Un nouveau plugin qui référence un SDK optionnel absent du bundle fait
  échouer R8 sur « Missing class ». Le rapport
  `android/app/build/outputs/mapping/release/missing_rules.txt` donne alors la
  ligne `-dontwarn` à ajouter (c'est le cas du SDK Facebook, que le plugin
  d'authentification référence sans qu'on l'embarque).

Tout changement natif se vérifie sur un build de release, pas de debug (R8 ne
tourne pas en debug) :

```bash
npm run app:build && cd android && ./gradlew :app:assembleRelease
```

puis installer l'APK sur l'émulateur et parcourir au moins une page qui
demande une permission (Horaires, « Utiliser ma position »).

## Notes

- Le `versionCode` est dérivé du semver du tag : re-publier exige un nouveau
  tag (patch +1). Le Play Store refuse tout `versionCode` déjà utilisé.
- Lancement manuel possible (onglet Actions → Deploy Android → Run workflow) :
  reprend le dernier tag atteignable depuis la branche choisie.
- JDK 21 et SDK Android sont fournis par le runner `ubuntu-latest`.
