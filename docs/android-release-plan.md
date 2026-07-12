# Plan d'exécution — APK testable aujourd'hui + review Android lancée

> Objectif : un **APK installable dans l'heure**, puis un **AAB envoyé en review
> sur le Play Store aujourd'hui**. Chaque étape est marquée
> **[Cowork]** (exécutable par Claude sur ta machine, dans le dossier du repo)
> ou **[Toi]** (clics dans une console, paiement, décision).
> iOS viendra ensuite (voir la fin du doc) — rien ici ne le bloque.

---

## État au 12/07/2026 — Phase A quasi terminée ✅

Fait (vérifié sur émulateur Pixel 7 / Android 16) :
- `android/` généré, JDK 21 installé (`brew install openjdk@21`), `local.properties` créé
- Permission `POST_NOTIFICATIONS` ajoutée au manifest
- **APK debug construit** : `android/app/build/outputs/apk/debug/app-debug.apk`
- App lancée sur émulateur : home, Bibliothèque, lecture Tehilim (hébreu + nikkoud) OK
- **Fix bouton retour Android** : plugin `@capacitor/app` + listener `backButton`
  dans `main.ts` (avant : le bouton retour quittait l'app)
- **Icônes + splash** générées depuis le logo (`assets/logo.png`,
  `npx @capacitor/assets generate --android`)
- `npm run verify` vert (ignores `android/`, `ios/`, `.claude/` ajoutés à ESLint/Vitest)
- `scripts/setup-android.mjs` : réapplique les modifs natives après un futur `cap add android`
- SHA-1 debug : `5A:AF:2D:F2:E8:85:34:E3:9B:66:33:14:FB:0A:4F:A2:DA:A3:37:89`

Reste (bloqué sur credentials Google expirés sur la machine) :
- Enregistrer l'app Android dans Firebase + `google-services.json` (étape A3)
  → sans lui, **seuls** le login Google natif et le push ne marchent pas ;
  tout le reste de l'APK actuel est fonctionnel (email/mdp inclus)
- À surveiller sur vrai téléphone : léger ghosting visuel constaté sur la page
  Bibliothèque **sur émulateur uniquement** (rendu logiciel swiftshader,
  probablement lié aux effets de flou) — pages Accueil et lecture impeccables

## Phase A — APK de test sur ton téléphone (~30-45 min)

### A1. Prérequis machine **[Toi, une fois]**
- [ ] Node ≥ 22 (`node -v`)
- [ ] Android Studio récent (Otter/2025.2.1+) avec SDK Platform 36 + Build-Tools
- [ ] JDK 21 (celui embarqué par Android Studio convient ; sinon Temurin 21)
- [ ] Variable `ANDROID_HOME` (ou laisser Android Studio gérer)

### A2. Préparer le projet **[Cowork]**
```bash
git fetch origin && git checkout claude/capacitor-poc && git pull
npm install
npx cap add android          # génère android/ (git-ignoré)
```

### A3. Enregistrer l'app Android dans Firebase **[Toi, ~5 min — BLOQUANT pour le build]**
Les plugins `@capacitor-firebase/*` exigent `google-services.json` : sans lui,
le build Gradle échoue.
1. [Console Firebase](https://console.firebase.google.com) → projet
   `petite-jerusalem-dev` → ⚙️ Paramètres du projet → « Ajouter une application » → Android.
2. Nom de package : **`fr.petitejerusalem.app`** (doit correspondre à
   `appId` de `capacitor.config.ts` — ne pas improviser ici).
3. Empreinte SHA-1 : celle du keystore **debug** pour commencer —
   **[Cowork]** la calcule :
   ```bash
   keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android | grep SHA1
   ```
4. Télécharger `google-services.json` → le donner à Cowork.

### A4. Câbler Google Services + permissions dans le projet natif **[Cowork]**
- [ ] Copier `google-services.json` dans `android/app/`
- [ ] `android/build.gradle` : ajouter le classpath
      `com.google.gms:google-services` (version courante 4.4.x)
- [ ] `android/app/build.gradle` : `apply plugin: 'com.google.gms.google-services'`
- [ ] `android/app/src/main/AndroidManifest.xml` : ajouter
      `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>`
- [ ] Vérifier `minSdkVersion`/`targetSdkVersion` hérités de Capacitor 8 (min 23 / target 36)

### A5. Construire et installer l'APK de test **[Cowork]**
```bash
npm run app:build            # build web + retrait des 38 Mo de textes + cap sync
cd android && ./gradlew assembleDebug
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```
Installation : téléphone en mode développeur branché (`./gradlew installDebug`
ou `adb install`), ou envoi de l'APK par n'importe quel canal.

### A6. Recette rapide sur téléphone **[Toi, ~15 min]**
Checklist complète dans `docs/capacitor-test-plan.md`. Le strict minimum :
- [ ] Bibliothèque → un texte s'ouvre (réseau requis la 1re fois)
- [ ] `/telechargements` (lien navbar) → télécharger un livre → **mode avion** → il se lit
- [ ] Lecture quotidienne : choisir des textes, couper le réseau, marquer « lu », rallumer → ça se synchronise
- [ ] Login email/mot de passe, et login Google natif (sélecteur de compte système)
- [ ] Profil → « Rappel de lecture » : la permission de notification est demandée
- [ ] Hébreu RTL, dark mode, bouton retour Android
- [ ] Le bouton Apple n'apparaît PAS sur Android

> Si le login Google échoue avec une erreur DEVELOPER_ERROR : SHA-1 manquante
> ou mauvaise dans Firebase (étape A3.3), re-télécharger `google-services.json`.

### Dépannage (constaté au premier test APK)

| Symptôme | Cause | Remède |
|---|---|---|
| `"FirebaseAuthentication" plugin is not implemented on android` (idem pour les notifications) | Le projet `android/` a été généré/synchronisé avant l'installation des plugins : ils ne sont pas enregistrés côté natif | `npm install && npx cap sync android`, puis rebuild. Vérifier que `android/capacitor.settings.gradle` liste `capacitor-firebase-authentication`, `capacitor-firebase-messaging`, `capacitor-file-transfer`, `capacitor-text-zoom` |
| « Impossible de modifier le réglage des notifications » | Plugin messaging absent (cf. ci-dessus) **ou** `google-services.json` manquant (étapes A3/A4) | Sync + config Firebase, rebuild |
| Textes agrandis, pages qui débordent à droite, menu coupé en bas | La WebView applique l'échelle de police système (textZoom) | Corrigé dans le code (`@capacitor/text-zoom` remis à 100 % au démarrage + garde-fous CSS) — nécessite `npm install && npx cap sync android` + rebuild |

**Après chaque `git pull` : `npm install && npm run app:build` avant de rebuilder
dans Android Studio** — c'est le `cap sync` inclus qui pousse plugins et bundle
web dans `android/`.

---

## Phase B — Lancer la review Play Store aujourd'hui

### B1. Compte Google Play Console **[Toi — à faire en premier, la vérification peut prendre du temps]**
- [ ] [play.google.com/console](https://play.google.com/console) → compte développeur (25 $ une fois)
- [ ] Vérification d'identité : instantanée à quelques jours selon les cas — **démarre-la maintenant**
- ⚠️ Réalité 2026 pour un **compte personnel neuf** : Google impose une phase de
  **test fermé (12 testeurs pendant 14 jours)** avant de pouvoir publier en
  production. « Lancer la review aujourd'hui » = **uploader en test interne/fermé
  aujourd'hui** ; la production suivra ce délai. Un compte organisation existant
  n'a pas cette contrainte.

### B2. Clé de signature release **[Cowork, avec ta validation]**
```bash
keytool -genkeypair -v -keystore petite-jerusalem-release.keystore \
  -alias petite-jerusalem -keyalg RSA -keysize 2048 -validity 10000
```
- [ ] **[Toi]** choisir le mot de passe et **sauvegarder le keystore hors du repo**
  (gestionnaire de mots de passe / coffre). Perdu = app impossible à mettre à jour.
- [ ] **[Cowork]** configurer `signingConfigs` dans `android/app/build.gradle`
  (mots de passe via `keystore.properties` git-ignoré), et activer
  **Play App Signing** au premier upload (recommandé : Google garde la clé d'app).
- [ ] **[Toi]** ajouter la SHA-1 **release** dans Firebase (même écran qu'A3) —
  sinon le login Google ne marchera pas sur le build store. Re-télécharger
  `google-services.json`. Avec Play App Signing, ajouter aussi la SHA-1
  « App signing key » affichée par la Play Console après le premier upload.

### B3. Build de release **[Cowork]**
```bash
npm run app:build
cd android && ./gradlew bundleRelease
# AAB : android/app/build/outputs/bundle/release/app-release.aab
```
- [ ] Vérifier `versionCode: 1`, `versionName: "1.0.0"` dans `android/app/build.gradle`

### B4. Assets de la fiche Play Store
- [ ] **[Cowork]** icône 512×512 PNG + bannière « feature graphic » 1024×500
      (à partir du logo/de l'identité du site)
- [ ] **[Toi ou Cowork]** 4-8 captures d'écran téléphone (celles de la recette A6
      conviennent : bibliothèque, lecteur hébreu, téléchargements, lecture du jour)
- [ ] **[Cowork]** textes : titre (30 car.), description courte (80 car.),
      description longue (4000 car.) — fr + en
- [ ] **[Cowork]** page **politique de confidentialité** sur le site
      (`petite-jerusalem.fr/confidentialite`) : données collectées (compte,
      email, préférences, tokens de notification, analytics), Firebase comme
      sous-traitant, contact, suppression de compte in-app. URL exigée par Google.

### B5. Fiche + formulaires Play Console **[Toi, ~45 min, textes fournis par Cowork]**
- [ ] Créer l'app (nom : Petite Jérusalem, gratuite, app)
- [ ] Fiche du store : textes + assets de B4, catégorie « Éducation » (ou « Style de vie »)
- [ ] **Sécurité des données** : compte requis optionnel (lecture sans compte) ;
      collecte : email + identifiants (auth), préférences liées au compte,
      tokens push ; pas de partage à des tiers ; chiffrement en transit ;
      suppression de compte disponible dans l'app ✅
- [ ] **Classification du contenu** : questionnaire (app religieuse/éducative, tout public)
- [ ] Déclarations : pas de pub, accès « Notifications » justifié (rappel de lecture)
- [ ] Track **Test interne** → uploader l'AAB → s'ajouter comme testeur → lien d'install
- [ ] Track **Test fermé** → même AAB → inviter les 12 testeurs (famille,
      communauté…) → **Envoyer en review** ← 🎯 l'objectif du jour

### B6. Après l'upload **[Cowork]**
- [ ] Committer les ajustements natifs reproductibles (gradle, manifest) dans la PR #73
      — `android/` est git-ignoré, donc documenter les modifs dans ce fichier ou
      les scripter (`scripts/setup-android.mjs`) pour qu'un `cap add android` futur
      soit reproductible
- [ ] Tester le rappel push de bout en bout : activer le rappel dans le profil,
      puis déclencher la function à la main —
      `firebase functions:shell` → `dailyReadingReminder()`, ou attendre 18h
- [ ] Déployer règles + function si pas déjà fait :
      `firebase deploy --only firestore:rules,functions:dailyReadingReminder`

---

## Ce qui peut se faire en parallèle (pendant que la vérification Play tourne)

| Quoi | Qui |
|---|---|
| B2-B4 (keystore, AAB, assets, textes, page confidentialité) | Cowork |
| A6 (recette téléphone) | Toi |
| Invitations des 12 testeurs (emails à préparer) | Toi + Cowork (texte d'invitation) |

## iOS ensuite (pour mémoire — semaine prochaine)
1. **[Toi]** compte Apple Developer (99 $/an) — la validation peut prendre 24-48 h : **démarre-la aujourd'hui aussi**
2. **[Toi]** Mac avec Xcode 26 → `npx cap add ios` **[Cowork sur le Mac]**
3. **[Toi]** consoles : App ID + capabilities (Sign in with Apple, Push), Service ID + clé « Sign in with Apple » reliée à Firebase, clé APNs uploadée dans Firebase (pour le push), `GoogleService-Info.plist`
4. TestFlight = l'équivalent du test interne, puis review App Store
