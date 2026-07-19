# Publication Play Store — plan d'exécution V1

> Plan à dérouler avec Claude Cowork, étape par étape, dans ce repo.
> Chaque tâche est marquée **[Cowork]** (exécutable par Claude sur cette machine)
> ou **[Toi]** (clics dans une console web, mots de passe, décisions).
> Contexte détaillé et dépannage : `docs/android-release-plan.md`.

## État au 19/07/2026 (vérifié)

- ✅ PR #73 (app Capacitor) mergée dans `main`, tag `v3.0.0` déployé par la CI
  (site + Cloud Function `dailyReadingReminder`)
- ✅ Compte Google Play Console créé, app « Petite Jérusalem » créée
  (package `fr.petitejerusalem.app`, gratuite)
- ✅ APK debug testé sur téléphone (lecture, téléchargements, auth)
- ✅ Icône « Livre-Cité » refondue sur `main` (commit 8dcea58)
- ⚠️ À vérifier en étape 0 : les **règles Firestore** (champs push) — la CI ne
  les déploie pas
- ℹ️ Compte développeur personnel neuf : Google impose un **test fermé
  (12 testeurs, 14 jours)** avant la production. L'objectif de ce plan est
  d'envoyer le test fermé en review ; la prod se débloquera après ce délai.

---

## Étape 0 — Vérifications préalables **[Cowork, 5 min]**

- [ ] `git checkout main && git pull` — tout part de `main` à jour
- [ ] Vérifier que les règles Firestore en prod acceptent les champs push :
  ```bash
  firebase deploy --only firestore:rules --project petite-jerusalem-dev
  ```
  (idempotent : si déjà déployées, ne change rien)
- [ ] Test de bout en bout des notifications depuis l'app installée :
  Profil → Notifications → choisir l'heure suivante → Activer → laisser une
  lecture du jour non cochée → la notification doit arriver à l'heure pile.
  Sinon, diagnostiquer avant de continuer (logs :
  `firebase functions:log --only dailyReadingReminder`).

## Étape 1 — Clé de signature release **[Toi + Cowork, 15 min]**

La clé signe toutes les mises à jour futures : **perdue = app morte**.

- [ ] **[Cowork]** générer le keystore (répondre aux questions d'identité) :
  ```bash
  keytool -genkeypair -v -keystore ~/petite-jerusalem-release.keystore \
    -alias petite-jerusalem -keyalg RSA -keysize 2048 -validity 10000
  ```
  ⚠️ Le générer **hors du repo** (`~/`), jamais dans le projet.
- [ ] **[Toi]** choisir le mot de passe, puis sauvegarder **le fichier keystore
  ET le mot de passe** dans ton gestionnaire de mots de passe / un coffre.
- [ ] **[Cowork]** créer `android/keystore.properties` (git-ignoré — vérifier
  qu'il l'est !) :
  ```properties
  storeFile=/Users/phenixel/petite-jerusalem-release.keystore
  storePassword=***
  keyAlias=petite-jerusalem
  keyPassword=***
  ```
- [ ] **[Cowork]** brancher `signingConfigs.release` dans
  `android/app/build.gradle` (lecture de `keystore.properties`, fallback debug
  si absent pour ne pas casser les builds des autres machines)
- [ ] **[Cowork]** reporter ces modifs dans `scripts/setup-android.mjs`
  (le dossier `android/` est git-ignoré : tout changement natif doit être
  scripté pour rester reproductible)

## Étape 2 — SHA-1 release dans Firebase **[Cowork + Toi, 10 min]**

Sans elle, le login Google échouera (`DEVELOPER_ERROR`) sur le build store.

- [ ] **[Cowork]** extraire la SHA-1 du keystore :
  ```bash
  keytool -list -v -keystore ~/petite-jerusalem-release.keystore -alias petite-jerusalem | grep SHA1
  ```
- [ ] **[Toi]** console Firebase → Paramètres du projet → app Android
  `fr.petitejerusalem.app` → « Ajouter une empreinte » → coller la SHA-1
  release → re-télécharger `google-services.json`
- [ ] **[Cowork]** remplacer `google-services.json` à la racine du repo **et**
  dans `android/app/` (les deux sont git-ignorés)
- [ ] 📌 **Après le premier upload sur la Play Console** (étape 6) : Google
  re-signe l'app (Play App Signing). Récupérer la SHA-1 « App signing key »
  dans Play Console → Configuration → Signature de l'app, l'ajouter aussi dans
  Firebase, re-télécharger `google-services.json` — sinon le login Google
  marchera en test interne mais **pas** sur la version distribuée par le store.

## Étape 3 — Build AAB de release **[Cowork, 10 min]**

- [ ] Aligner la version dans `android/app/build.gradle` :
  `versionCode 1`, `versionName "3.0.0"` (même numéro que le tag git)
- [ ] Builder :
  ```bash
  npm ci && npm run app:build
  cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    ./gradlew bundleRelease
  ```
  → AAB : `android/app/build/outputs/bundle/release/app-release.aab`
  (piège connu : si le plugin google-services semble ignoré, builder une fois
  avec `--no-configuration-cache`)
- [ ] Contrôle avant upload : builder aussi l'APK release
  (`./gradlew assembleRelease`), l'installer sur le téléphone et vérifier
  démarrage + login Google + lecture (c'est le même code signé que l'AAB)

## Étape 4 — Politique de confidentialité **[Cowork, 30 min]**

URL exigée par Google dans la fiche.

- [ ] Créer une page `/confidentialite` sur le site (fr, avec versions en/he
  via i18n) couvrant : données collectées (compte, email, nom affiché,
  préférences, progression de lecture, tokens de notification), Firebase
  (Google) comme sous-traitant, finalités, durée, contact
  (contact.phenixel@gmail.com), et la **suppression de compte disponible
  in-app** (Profil → Sécurité)
- [ ] Lien discret dans le footer du site
- [ ] PR → merge → tag `v3.0.1` pour déployer
- [ ] URL finale à donner à la console : `https://petite-jerusalem.fr/confidentialite`

## Étape 5 — Assets et textes de la fiche **[Cowork, 1 h]**

- [ ] **Icône 512×512 PNG** (sans transparence) — à partir de l'identité
  « Livre-Cité » (`assets/logo.png` / icônes générées)
- [ ] **Feature graphic 1024×500 PNG** — bannière avec l'emblème + le nom
  (réutiliser le travail de la bannière Open Graph, commit 3b271df)
- [ ] **4 à 8 captures d'écran téléphone** (1080×1920 min) : accueil, bibliothèque
  avec filtres, lecteur hébreu, téléchargement/mode avion, lecture du jour,
  notifications. Prendre sur l'émulateur `pj-test` :
  `adb exec-out screencap -p > capture1.png`
- [ ] **Textes de fiche en fr, en, he** :
  - titre ≤ 30 car. (ex. « Petite Jérusalem — Torah » )
  - description courte ≤ 80 car.
  - description longue ≤ 4000 car. (fonctionnalités : partage de lectures,
    bibliothèque Tehilim/Michna/Talmud/Tanakh, lecture hors ligne, rappel
    quotidien, chiourim ; gratuit, sans pub)
- [ ] Livrer le tout dans un dossier `store-assets/` local (pas commité, ou
  commité si tu veux le versionner)

## Étape 6 — Play Console : fiche + formulaires + upload **[Toi, ~45 min, textes fournis par l'étape 5]**

- [ ] **Fiche du store** : textes fr (par défaut), puis « Ajouter une
  traduction » en-US et he-IL ; icône, feature graphic, captures ;
  catégorie « Éducation » ; coordonnées de contact
- [ ] **Politique de confidentialité** : l'URL de l'étape 4
- [ ] **Sécurité des données** (questionnaire) : collecte = email +
  identifiants (auth), nom affiché, préférences/progression liées au compte,
  tokens push ; pas de partage à des tiers ; chiffrement en transit ;
  suppression de compte possible in-app ; compte facultatif (lecture sans compte)
- [ ] **Classification du contenu** : questionnaire — app éducative/religieuse,
  tout public, pas de contenu généré par les utilisateurs visible publiquement
  (les sessions sont sur invitation/lien)
- [ ] **Déclarations** : pas de publicité ; notifications = rappel de lecture
- [ ] **Pays** : tous les pays (ou au minimum France, Israël, US, Canada,
  Belgique, Suisse, UK)
- [ ] **Test interne** : créer la release, uploader `app-release.aab`,
  t'ajouter comme testeur, installer via le lien → vérifier login Google
  (→ ajouter la SHA-1 App Signing, étape 2 📌, puis re-uploader si besoin)
- [ ] **Test fermé** : promouvoir la même release, créer la liste des
  12 testeurs (emails Google de famille/communauté), envoyer les invitations
  → **Envoyer en review** 🎯

## Étape 7 — Pendant les 14 jours de test fermé **[Toi + Cowork]**

- [ ] Les 12 testeurs doivent **installer et rester opt-in 14 jours** — les
  relancer au besoin
- [ ] Collecter les retours, corriger avec Cowork, re-uploader des builds
  (incrémenter `versionCode` à chaque upload : 2, 3, …)
- [ ] Surveiller les notifications en réel :
  `firebase functions:log --only dailyReadingReminder`
- [ ] Au bout des 14 jours : Play Console propose « Publier en production » →
  review de production → l'app est publique 🎉

## Ensuite (hors périmètre de ce plan)

- iOS : compte Apple Developer (99 $/an), `npx cap add ios`, mêmes assets —
  la base (auth Apple native, offline) est déjà dans le code
- Mises à jour : à chaque release web taguée, décider si un build mobile
  suit (le contenu web est embarqué dans l'app)
