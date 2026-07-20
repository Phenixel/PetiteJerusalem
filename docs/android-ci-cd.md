# CI/CD Android — publication Play Store automatique

Le workflow [.github/workflows/deploy-android.yml](../.github/workflows/deploy-android.yml)
publie l'app Android sur le Play Store **à chaque tag `vX.Y.Z`**, en parallèle
du déploiement web (deploy.yml). Un seul geste met donc en prod le site et
l'app :

```bash
git tag v3.0.2 && git push origin v3.0.2
```

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
├── changelogs/default.txt    # ≤ 500 — notes « Nouveautés » de la release
└── images/
    ├── phoneScreenshots/     # ≥ 2 captures sinon elles ne sont pas envoyées
    └── featureGraphic.png    # bannière 1024×500 (optionnelle)
```

- Les notes de version sont attachées à la release Play par
  `upload-google-play` (paramètre `whatsNewDirectory`) : **mettre à jour les
  `changelogs/default.txt` avant de poser le tag**.
- La fiche est envoyée par `node scripts/play-listing.mjs` (API Android
  Publisher, même compte de service). `node scripts/play-listing.mjs --check`
  vérifie les limites de caractères en local, sans réseau.
- Les captures d'une langue remplacent **tout** le jeu existant dans la
  console ; une langue sans captures dans le repo laisse la console
  intacte (les langues sans images retombent sur la langue par défaut).

## Piste de publication

Par défaut le workflow publie sur la piste **production**. Tant que l'app n'a
pas eu une première release production validée à la main dans le Play Console
(elle est encore en test interne), l'API refuse cette piste : définir la
variable de repo `ANDROID_PLAY_TRACK=internal` (Settings → Secrets and
variables → Actions → Variables), puis la supprimer une fois l'app publiée.

## Notes

- Le `versionCode` est dérivé du semver du tag : re-publier exige un nouveau
  tag (patch +1). Le Play Store refuse tout `versionCode` déjà utilisé.
- Lancement manuel possible (onglet Actions → Deploy Android → Run workflow) :
  reprend le dernier tag atteignable depuis la branche choisie.
- JDK 21 et SDK Android sont fournis par le runner `ubuntu-latest`.
