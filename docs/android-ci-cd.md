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
    ├── phoneScreenshots/     # ≥ 2 captures sinon elles ne sont pas envoyées
    └── featureGraphic.png    # bannière 1024×500 (optionnelle)
```

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
  (scripts/store-screenshots.mjs) : émulateurs Firebase éphémères + données
  de démo fixes (compte « Sarah Levy », session Tehilim, chiourim), puis
  l'app **native** (build debug Capacitor branché sur le Vite local via
  `CAP_SERVER_URL` + `adb reverse`) sur l'AVD dédié `pj-store` (1080×1920,
  créé automatiquement), pilotée par Playwright à travers sa webview et
  capturée par `adb screencap` (barre de statut en mode démo SystemUI,
  barre d'onglets native visible). Reproductible : mêmes données à chaque
  exécution, il suffit de committer les PNG produits. Variante rapide sans
  émulateur Android : `npm run store:screenshots -- --web` (rendu site
  mobile, sans la barre d'onglets).
- La CI n'attend pas ces commits : à chaque tag, le job `screenshots` de
  deploy-android.yml rejoue ce script sur un émulateur Android du runner et le
  job `listing` envoie les captures fraîches avec la fiche. Si l'émulateur
  flanche, la fiche part avec les captures committées dans le repo ; dans tous
  les cas la release, elle, n'attend pas les captures. Les PNG régénérés
  restent téléchargeables 90 jours en artifact du run, pour contrôle visuel ou
  pour les committer.
- **L'émulateur de la CI n'est pas ouvert par le script** mais par l'action
  [android-emulator-runner](https://github.com/ReactiveCircus/android-emulator-runner) :
  démarrer un émulateur sur un runner sans écran demande plus que trois
  options de ligne de commande (paquets SDK, AVD, attente du boot, reprise
  après un démarrage manqué), et le lancement maison y mourait sans un mot au
  tag v3.8.1. L'action pose l'émulateur, la variable `ANDROID_SERIAL` dit au
  script de s'y brancher au lieu d'en lancer un second. En local, rien ne
  change : sans `ANDROID_SERIAL`, le script ouvre son AVD `pj-store` comme
  avant, et affiche désormais le journal de l'émulateur si le démarrage
  échoue.
- Pour vérifier les captures sans rien publier : onglet Actions → Deploy
  Android → Run workflow, en cochant **screenshots_only**. Seul le job
  `screenshots` tourne, son artifact contient les PNG.

## Piste de publication

Le workflow publie sur la piste **production**, en statut « completed » :
dès que la review Google est passée, la version part chez tout le monde,
sans aucun geste dans la Play Console. La piste est codée en dur depuis que
l'app a sa première release production ; l'ancienne variable de repo
`ANDROID_PLAY_TRACK` (qui permettait de viser `internal` tant que l'app
était en test fermé et que l'API refusait la piste production) n'est plus
lue, la supprimer si elle traîne encore (Settings → Secrets and variables →
Actions → Variables).

## Notes

- Le `versionCode` est dérivé du semver du tag : re-publier exige un nouveau
  tag (patch +1). Le Play Store refuse tout `versionCode` déjà utilisé.
- Lancement manuel possible (onglet Actions → Deploy Android → Run workflow) :
  reprend le dernier tag atteignable depuis la branche choisie.
- JDK 21 et SDK Android sont fournis par le runner `ubuntu-latest`.
