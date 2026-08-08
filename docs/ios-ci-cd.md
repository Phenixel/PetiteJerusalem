# CI/CD iOS — envoi automatique sur TestFlight

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

**La mise en vente reste manuelle** : Apple exige une soumission explicite à
l'examen depuis App Store Connect. La CI s'arrête à TestFlight (voir
[ios-release-plan.md](ios-release-plan.md#étape-8--soumission)).

## Signature « dans le nuage »

Aucun certificat ni profil de provisionnement n'est stocké dans le repo,
contrairement au keystore Android. `xcodebuild -allowProvisioningUpdates`
demande à Apple de créer ou renouveler ce qu'il faut à partir de la clé d'API
App Store Connect, à chaque build. La même clé sert à l'envoi de l'IPA et à la
synchronisation de la fiche : c'est le seul secret sensible du workflow.

Conséquence : la clé d'API doit avoir le rôle **Admin**. C'est contre-intuitif
pour une clé de CI, mais Apple réserve la création des certificats de
**distribution** à ce rôle — une clé « App Manager » suffit pour TestFlight et
la fiche, pas pour signer l'archive. Et le rôle d'une clé **ne peut pas être
modifié après création** : se tromper oblige à en générer une nouvelle.

## Clé d'API App Store Connect (une fois, clics)

1. [App Store Connect](https://appstoreconnect.apple.com) → **Utilisateurs et
   accès** → onglet **Intégrations** → **API App Store Connect** → **Clés de
   l'équipe** → `+`. La toute première fois, Apple demande d'abord d'activer
   l'accès à l'API (case à cocher + Soumettre, approbation immédiate).
2. Nom `github ci` (pas de tiret : Apple refuse les caractères spéciaux),
   accès **Admin** → Générer.
3. Télécharger le fichier `AuthKey_XXXXXXXXXX.p8` — **téléchargeable une seule
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
├── promotional_text.txt     # ≤ 170 — modifiable sans nouvelle version
├── description.txt          # ≤ 4000
├── release_notes.txt        # ≤ 4000 — « Nouveautés »
├── support_url.txt          # obligatoire
├── marketing_url.txt        # optionnel
└── privacy_url.txt          # obligatoire
```

- `node scripts/appstore-listing.mjs --check` vérifie les limites de
  caractères en local, sans réseau (la CI le fait en début de run et échoue
  vite si un texte est trop long).
- Le script écrit sur la version App Store **modifiable** (état
  `PREPARE_FOR_SUBMISSION` et assimilés). Si aucune version n'est ouverte dans
  App Store Connect, il s'arrête sans rien casser : l'étape est
  `continue-on-error`, le binaire est déjà parti sur TestFlight.
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

- ⚠️ **Le numéro de version d'App Store Connect doit être identique au tag.**
  À la création, Apple ouvre une version « 1.0 ». Le build produit par la CI
  porte le numéro du tag (`v3.7.0` → `3.7.0`) : tant que les deux ne
  correspondent pas, le build arrive bien dans TestFlight mais **n'est pas
  proposé** au moment de choisir le build de la version. Corriger le champ
  *Version* dans App Store Connect (modifiable tant que la version est « À
  finaliser avant soumission ») **avant** de poser le tag.
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
