# Handoff Cowork → Claude Code : préparation publication Play Store

> Document de passation. But : expliquer précisément **pourquoi** chaque
> changement a été fait, pour que Claude Code (qui a accès complet à la
> machine — Android SDK, Firebase CLI, `~/`, réseau) puisse vérifier chaque
> point et enchaîner sur ce que Cowork n'a pas pu faire depuis son sandbox.
>
> Contexte complet du plan : `docs/plan-play-store.md` et
> `docs/android-release-plan.md`. Ce document ne couvre que le travail fait
> lors de cette session Cowork, branche **`play-store-launch-prep`**
> (commit `6158c2e`, non pushé — SSH GitHub non accessible depuis le
> sandbox Cowork).

## Pourquoi ces changements ont été nécessaires

L'objectif de la session : avancer le plus possible vers l'envoi de la
« review » du test fermé Play Store (Étapes 0 à 5 du plan), en sachant que
Cowork tourne dans un sandbox Linux isolé qui n'a **ni Android SDK/adb, ni
accès réseau à Firebase/Google (donc pas de `firebase login`/`deploy`), ni
accès au `$HOME` réel de l'utilisateur** — seulement au dossier du repo
mounté. Tout ce qui suit a donc été fait au niveau code, pas en exécutant
les commandes qui nécessitent ces accès.

---

## 1. Correctif : suppression de compte incomplète

**Pourquoi c'est important.** Le plan (Étape 6) prévoit de déclarer dans le
formulaire « Sécurité des données » de la Play Console que la
« suppression de compte [est] possible in-app ». En creusant le code
(`src/services/authService.ts`, fonction `deleteAccount()`), j'ai constaté
qu'elle appelait seulement `deleteUser(auth.currentUser)` — c'est-à-dire
qu'elle supprimait le compte Firebase Auth, mais **pas** le document
Firestore `userPreferences/{uid}` (thème, polices, `dailyReadingIds`,
`dailyReadingProgress`, `fcmTokens`, `pushReminderEnabled/Hour/Locale`).
Déclarer une suppression de compte à Google alors que des données
personnelles survivent à cette suppression aurait été inexact — à la fois
dans le formulaire Play Console et dans la politique de confidentialité
(point 2 ci-dessous).

**Ce qui a changé.**
- `src/services/userPreferencesService.ts` : nouvelle méthode
  `deletePreferences(userId)` (`deleteDoc` sur `userPreferences/{userId}`).
- `src/services/authService.ts` : `deleteAccount()` appelle maintenant
  `userPreferencesService.deletePreferences(user.uid)` **avant**
  `deleteUser(user)` — l'ordre compte : les règles Firestore
  (`firestore.rules` ligne 102 : `allow delete: if isAuthenticated() &&
  request.auth.uid == userId`) exigent que l'utilisateur soit encore
  authentifié pour supprimer son propre document. L'appel est en
  `try/catch` (best-effort) pour qu'un échec Firestore ne bloque pas la
  suppression du compte Auth lui-même.

**À vérifier avec Claude Code :**
- Relire `authService.ts` (fonction `deleteAccount`) et confirmer l'ordre
  des appels (préférences supprimées avant `deleteUser`).
- Test manuel de bout en bout : créer un compte de test, modifier une
  préférence (ex. thème), le supprimer depuis Profil → Sécurité, puis
  vérifier dans la console Firebase (Firestore → collection
  `userPreferences`) que le document a bien disparu.
- Vérifier qu'aucune autre donnée personnelle par utilisateur n'a été
  oubliée (j'ai vérifié qu'il n'existe **pas** de collection Firestore
  `users/{uid}` séparée — le type `User` de `src/models/models.ts` est
  juste la représentation en mémoire du `FirebaseUser` d'Auth, pas un
  document Firestore. Les sessions de lecture partagée créées par
  l'utilisateur, elles, sont volontairement conservées — elles sont
  publiques/partagées par nature, cf. point 2).

---

## 2. Nouvelle page `/confidentialite` (politique de confidentialité)

**Pourquoi c'est nécessaire.** La Play Console exige une URL de politique
de confidentialité (Étape 4 du plan). Le lien existant dans le footer
(« Mentions légales ») pointe vers une page Notion externe et ne couvre pas
les données réellement traitées par l'app.

**Comment le contenu a été établi.** Plutôt que d'écrire un texte
générique, j'ai fait auditer le code (auth, Firestore, Cloud Functions,
Storage) pour ne déclarer que ce qui est réellement vrai à ce jour :
- **Authentification** (`src/services/authService.ts`) : email/mot de
  passe, Google, Apple (Apple visible uniquement sur iOS, pas encore dans
  le périmètre Android). Pas d'authentification anonyme.
- **Données stockées** : uniquement `userPreferences/{uid}` (voir point 1)
  — pas de collection `users` séparée.
- **Partage de lecture** (`src/services/reservationService.ts`) : le nom
  indiqué (et l'email si l'utilisateur participe en tant qu'invité sans
  compte, champ `chosenByGuestId`) est stocké dans le document
  `sessions/{sessionId}`, qui est **lisible publiquement**
  (`firestore.rules` : `match /sessions/{sessionId} { allow read: if true;
  }`) — donc visible par quiconque a le lien de la session. C'est
  volontaire (le partage de lecture est conçu pour être ouvert), mais ça
  doit être dit dans la politique.
- **Pas de tracking tiers** : recherche de `analytics`, `gtag`, `sentry`,
  `mixpanel`, `posthog` dans `src/` et `functions/` → aucun résultat.
- **Sous-traitant** : Firebase (Auth, Firestore, Cloud Functions, Cloud
  Storage pour les fichiers audio des chiourim — pas de données
  personnelles dedans), hébergé sur l'infra Google, région `nam5` (donc
  principalement États-Unis, cf. `firebase.json`).

**Ce qui a changé.**
- `src/content/seoPages.ts` : nouveau type `LegalStrings` + fonction
  `buildLegal()` (plus simple que `buildLanding()`, pas de structure
  why/how/faq) + contenu `PRIVACY_FR/EN/HE` + entrée dans `landingPages`
  (`path: "/confidentialite"`, `sitemap: { priority: 0.1, changefreq:
  "yearly" }`).
- `src/router/routes.ts` : route `/confidentialite` → `ContentPage.vue`
  (même composant que `/finir-le-chass` et `/partage-tehilim`, qui rend le
  `bodyHtml` du `seoPages.ts` selon la langue active).
- `src/components/SiteFooter.vue` + `src/locales/{fr,en,he}.ts` : nouveau
  lien « Confidentialité » (clé `footer.privacy`) à côté de « Mentions
  légales », vers la route interne (pas Notion).

**À vérifier avec Claude Code :**
- `npm run build` (ou `npm run dev`) puis visiter `/confidentialite` dans
  les 3 langues, vérifier l'affichage (RTL correct en hébreu) et le lien
  dans le footer.
- Lancer `npx vitest run src/__tests__/prerenderSeo.test.ts` — n'a pas pu
  être exécuté depuis le sandbox Cowork (erreur `@rollup/rollup-linux-arm64-gnu`
  manquant, un problème d'environnement lié aux binaires natifs de Rollup
  installés pour macOS, sans rapport avec les changements de contenu — à
  confirmer que ça passe sur ta machine). Ce test vérifie entre autres que
  chaque page a un `path` unique et des champs non vides.
  vérifier que la CI génère bien `dist/confidentialite.html` via
  `scripts/prerender-seo.mjs` au prochain build/déploiement.
- Relire le contenu de la politique (`PRIVACY_FR/EN/HE` dans
  `src/content/seoPages.ts`) et confirmer qu'il reste synchronisé avec le
  code si l'un des points ci-dessus change (nouvelle collection Firestore,
  nouveau provider d'auth, ajout d'un outil d'analytics, etc.).
- Une fois déployé (tag), donner `https://petite-jerusalem.fr/confidentialite`
  comme URL de politique de confidentialité dans la Play Console.

---

## 3. Signature de release Android (`signingConfigs.release`)

**Pourquoi c'est critique.** Toute mise à jour future de l'app doit être
signée avec la **même** clé privée que la première publication — sinon
Google refuse l'update et l'app devient impossible à mettre à jour
(« perdue = app morte », cf. plan Étape 1). Le `build.gradle` généré par
défaut par Capacitor (`npx cap add android`) n'a pas de config de signature
release : sans elle, `./gradlew bundleRelease` produit un artefact non
signé ou signé avec une clé de debug, inutilisable pour la Play Console.

**Contrainte technique : `android/` est git-ignoré.** Le dossier
`android/` entier est régénéré via `npx cap add android` et n'est pas
versionné (cf. `.gitignore` ligne 51 `/android`). Donc modifier
`android/app/build.gradle` directement ne suffit pas : la modif serait
perdue au prochain `npx cap add android`. D'où la nécessité de la répliquer
dans `scripts/setup-android.mjs`, le script (lui, versionné) qui réapplique
tous les ajustements natifs après régénération du dossier.

**Ce qui a changé.**
- `android/app/build.gradle` (généré, non commité — modifié directement
  pour cette session) : ajout d'un bloc `signingConfigs.release` qui lit
  `android/keystore.properties` (git-ignoré, doit être créé/rempli à la
  main avec le vrai keystore) ; `buildTypes.release.signingConfig` utilise
  `signingConfigs.release` **si le fichier existe**, sinon retombe sur
  `signingConfigs.debug` — pour ne pas casser les builds sur une machine
  qui n'a pas le keystore (autre dev, CI). `versionName` aligné sur
  `"3.0.0"` (au lieu du `"1.0"` par défaut du template Capacitor), pour
  matcher le tag git `v3.0.0`.
- `scripts/setup-android.mjs` : nouvelle étape (4) qui applique le même
  patch par remplacement de texte (idempotent — vérifie la présence du
  marqueur `keystorePropertiesFile` avant d'agir) si le dossier `android/`
  est régénéré ; nouvelle étape (5) qui génère
  `android/keystore.properties.example` (modèle, valeurs `***` à remplir).
- **Je n'ai pas généré le vrai keystore** (`keytool -genkeypair ...`) : le
  sandbox Cowork n'a pas accès au `$HOME` réel de la machine (seulement au
  dossier du projet), et c'est un secret que l'utilisateur doit générer et
  sauvegarder lui-même (mot de passe + fichier) dans son propre coffre.

**À vérifier avec Claude Code :**
- Lire `android/app/build.gradle` et confirmer que le bloc
  `signingConfigs` + le `signingConfig` conditionnel dans
  `buildTypes.release` sont corrects syntaxiquement (Groovy).
- Si `android/keystore.properties` n'existe pas encore : guider
  l'utilisateur pour générer le keystore (`keytool -genkeypair -v -keystore
  ~/petite-jerusalem-release.keystore -alias petite-jerusalem -keyalg RSA
  -keysize 2048 -validity 10000`, **hors du repo**), puis créer
  `android/keystore.properties` à partir de
  `android/keystore.properties.example` avec les vraies valeurs.
- Builder : `cd android && ./gradlew bundleRelease` puis
  `./gradlew assembleRelease`, installer l'APK sur un téléphone/émulateur
  et vérifier que ça démarre (signe que le build fonctionne avec la config
  ajoutée).
- Vérifier avec `jarsigner -verify -verbose -certs
  app/build/outputs/apk/release/app-release.apk` (ou l'outil `apksigner`
  du SDK) que l'APK est bien signé avec le certificat du keystore release
  et pas le certificat debug Android par défaut.
- Confirmer que `android/keystore.properties` et `*.keystore` restent
  hors de git (`git check-ignore -v android/keystore.properties` doit
  afficher une règle du `.gitignore`).

---

## 4. Textes de fiche Play Store (`store-assets/`)

**Pourquoi.** La Play Console (Étape 6) demande un titre (≤ 30 caractères),
une description courte (≤ 80) et une description longue (≤ 4000), par
langue. Rédigés en fr/en/he à partir des fonctionnalités réellement
présentes dans le code (bibliothèque Tehilim/Michna/Talmud/Tanakh, partage
de lecture, téléchargement hors ligne, rappel quotidien, chiourim — pas de
fonctionnalité inventée). Limites de caractères vérifiées
programmatiquement (`len()` Python) — pas juste à l'œil.

**À vérifier avec Claude Code :**
- Recompter les caractères des titres/descriptions courtes si le texte est
  retouché (les limites Play Console comptent les caractères Unicode, pas
  les octets — attention à l'hébreu).
- Confirmer qu'aucune fonctionnalité annoncée n'a été retirée du code
  depuis (ex. si les chiourim ou le mode hors ligne changent).

---

## Limites du sandbox Cowork (pour comprendre ce qui n'a pas pu être fait)

Cowork tourne dans un environnement Linux isolé, séparé de cette machine
Mac, avec :
- **pas d'Android SDK / adb / émulateur** → impossible de builder l'AAB/APK
  ou de prendre des captures d'écran ;
- **pas d'accès réseau à Firebase/Google APIs** (testé : `curl
  firebase.google.com` time out) → impossible d'exécuter `firebase
  deploy`, `firebase functions:log`, ou d'installer `firebase-tools` de
  façon utile ;
- **pas d'accès SSH à GitHub** (`git pull`/`git push` échouent avec « Host
  key verification failed ») → le commit `6158c2e` est fait localement sur
  la branche `play-store-launch-prep`, **pas encore pushé** ;
- **pas d'accès au `$HOME` réel** (`~/`) de la machine, seulement au
  dossier du projet monté → impossible de générer le keystore au bon
  endroit (`~/petite-jerusalem-release.keystore`).

C'est pour ça que ces points restent à faire par toi / Claude Code
directement sur la machine : `git push` + PR, `firebase deploy --only
firestore:rules`, test des notifications sur le téléphone, génération du
keystore, `./gradlew bundleRelease`, et tout ce qui suit dans le plan
(Étape 2 SHA-1, Étape 6 Play Console).
