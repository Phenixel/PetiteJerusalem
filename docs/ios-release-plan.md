# Plan de publication iOS (App Store)

Chemin complet, de « aucun compte Apple » à « app en vente », pour la même
base de code que le site et l'app Android (Capacitor — voir
[app-native.md](app-native.md)). La CI/CD est décrite à part dans
[ios-ci-cd.md](ios-ci-cd.md).

Le code est **déjà prêt** : connexion Apple (`authService.signInWithApple`,
bouton affiché uniquement sur iOS), suppression de compte dans l'app, push,
lecture hors ligne, géolocalisation locale. Il ne reste que des démarches de
comptes et de consoles, plus un premier build.

## Ce qui bloque le calendrier

| Étape | Durée |
|---|---|
| Inscription Apple Developer (individuel) | 24 à 48 h |
| Consoles Apple + Firebase | 1 h |
| Premier build local + TestFlight | 1 demi-journée |
| Examen App Store | 24 h à 3 jours (1re soumission souvent plus longue) |

Phenixel étant une **entreprise individuelle**, il n'y a ni D-U-N-S ni
vérification d'entité à attendre : tout peut être bouclé en quelques jours.

---

## Étape 1 — Compte Apple Developer (individuel)

Apple réserve l'inscription « organisation » aux **personnes morales** :
[sa documentation](https://developer.apple.com/help/account/membership/program-enrollment/)
est explicite — une entreprise individuelle ou une société unipersonnelle sans
personnalité morale distincte doit s'inscrire en **individuel**, et c'est le
**nom légal de la personne** qui apparaît comme vendeur sur la fiche App
Store. Ni les noms commerciaux, ni les DBA, ni les enseignes ne sont acceptés
pour une inscription organisation.

Conséquences concrètes :

- Le vendeur affiché sera **Yonathan Cardoso**, pas « Phenixel ».
- Sur les fiches App Store européennes, le règlement DSA impose de toute façon
  d'afficher l'adresse, le téléphone et l'e-mail du développeur dès qu'il est
  déclaré « professionnel » (*trader*). Une micro-entreprise qui publie dans
  le cadre de son activité entre dans cette catégorie ; la déclaration se fait
  dans App Store Connect (Entreprise → Conformité DSA) et **conditionne la
  distribution dans l'UE**. Le statut à déclarer dépend de la situation
  réelle — en cas de doute, un conseil juridique est préférable, je ne suis
  pas juriste.
- Si Phenixel devient une société (SASU, EURL…), la bascule individuel →
  organisation est possible plus tard, sans perdre l'app ni ses avis.

**Ce qu'il faut faire :**

1. Un **Apple ID dédié sur `admin@phenixel.fr`**, avec authentification à deux
   facteurs. C'est l'ancre permanente du compte : un Apple ID ne peut être
   rattaché qu'à un seul compte développeur, et c'est lui qui détient le rôle
   d'Account Holder, les clés de signature, App Store Connect et la
   facturation. Migrer un compte développeur vers un autre Apple ID n'existe
   pas — d'où le choix d'une adresse pérenne, sur le domaine de l'entreprise
   (ce qu'Apple recommande de toute façon pour une inscription organisation,
   la conversion visée à terme).

   - **Prénom et nom = état civil**, pas « Phenixel » : l'inscription
     individuelle vérifie l'identité, un nom commercial dans ces champs fait
     rejeter ou traîner le dossier. Seule l'adresse est « pro ».
   - Ne pas en faire le compte iCloud de l'iPhone : il sert uniquement à se
     connecter (Xcode → Réglages → Comptes, App Store Connect, app Apple
     Developer).
   - Récupération : 2FA sur un numéro durable, contact de secours ou clé de
     récupération, et **maintenir le domaine `phenixel.fr` renouvelé** — c'est
     la boîte de récupération du compte qui détient l'app.
2. **Inscription** sur
   [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/)
   ou depuis l'app **Apple Developer** sur iPhone (vérification d'identité plus
   rapide : elle scanne la pièce d'identité).
3. **99 $/an** (≈ 99 €), renouvellement automatique.
4. Validation en 24 à 48 h en général.

> ⚠️ Ne pas créer l'app dans App Store Connect avant que le compte soit
> validé : le bundle id se réserve dans le compte, pas avant.

### Changer le nom du vendeur plus tard

Le choix du compte individuel n'est pas un cul-de-sac. Deux chemins officiels,
tous deux documentés sur
[Updating your account information](https://developer.apple.com/help/account/membership/updating-your-account-information/) :

| Besoin | Démarche | Ce qu'Apple demande |
|---|---|---|
| Nouveau **nom légal** (changement d'état civil) | Compte développeur → *Membership details* → soumettre une demande | Justificatif du changement de nom |
| Passer à **« Phenixel »** (société créée depuis) | [Formulaire de migration individuel → organisation](https://developer.apple.com/contact/request/migrate-individual-account) | Être fondateur, D-U-N-S, documents d'entreprise |

Modifier son nom sur `account.apple.com` ne suffit **pas** : ça change le nom
affiché sur les sites Apple, pas le nom vendeur de l'App Store. Il faut passer
par la demande ci-dessus.

Dans les deux cas, l'app garde son identifiant, ses avis, ses notes et ses
téléchargements — c'est le **même compte** qui change de nom.

> ⚠️ À ne pas confondre avec un **transfert d'app** vers un autre compte.
> Celui-là est bien plus risqué ici : les identifiants « Sign in with Apple »
> et les adresses e-mail relais sont liés à l'équipe. Sans migration explicite
> ([TN3159](https://developer.apple.com/documentation/technotes/tn3159-migrating-sign-in-with-apple-users-for-an-app-transfer)),
> tous les comptes créés via Apple seraient perdus. Toujours préférer la
> **conversion du compte** au transfert de l'app.
>
> Autre effet documenté du changement de nom vendeur : l'`identifierForVendor`
> (IDFV) est réinitialisé à la mise à jour suivante. Sans conséquence ici,
> l'app identifiant ses utilisateurs par leur UID Firebase.

## Étape 2 — Identifiants Apple (après validation)

Sur [developer.apple.com/account](https://developer.apple.com/account) →
**Certificates, Identifiers & Profiles**.

1. **App ID** : Identifiers → `+` → App IDs → App → Bundle ID **explicite**
   `fr.petitejerusalem.app` (le même que sur le Play Store).
   Cocher les capacités :
   - **Push Notifications**
   - **Sign in with Apple**
2. **Clé APNs** : Keys → `+` → nom sans caractère spécial (les tirets sont
   refusés), cocher **Apple Push Notifications service**, puis **Configure** :
   environnement **Sandbox & Production** et restriction **Team Scoped (All
   Topics)** — une seule clé couvre alors dev, TestFlight, App Store et toutes
   les apps du compte. Ces deux réglages sont **définitifs**.
   Le `.p8` n'est téléchargeable **qu'une fois** : le ranger dans le
   gestionnaire de mots de passe avec son **Key ID** et le **Team ID**.
3. **Sign in with Apple** : la capacité sur l'App ID suffit pour le flux natif
   iOS. Le *Service ID* et la *Sign in with Apple Key* ne servent qu'au flux
   web ; les créer seulement si la connexion Apple doit aussi marcher sur
   `petite-jerusalem.fr` (Return URL fourni par Firebase).
4. Noter le **Team ID** (10 caractères, en haut à droite de la page
   Membership) : il sera demandé partout.

## Étape 3 — Firebase

Console Firebase, projet `petite-jerusalem-dev` (le même que l'app Android).

1. **Ajouter une app iOS** : bundle ID `fr.petitejerusalem.app` →
   télécharger **GoogleService-Info.plist** → le déposer **à la racine du
   repo** (il est git-ignoré ; `scripts/setup-ios.mjs` le copie dans le
   projet Xcode et en extrait le `REVERSED_CLIENT_ID` pour le schéma d'URL
   Google).
2. **Cloud Messaging** → onglet Apple → **importer la clé APNs** (`.p8`, Key
   ID, Team ID). Sans ça, `pushService` obtient un token FCM mais aucune
   notification n'arrive.
3. **Authentication → Sign-in method** → activer le fournisseur **Apple**.
4. **Authentication → Settings → Authorized domains** : rien à ajouter, le
   flux natif ne passe pas par un domaine.

## Étape 4 — Premier build local

Prérequis : macOS + **Xcode 26** (exigé à la fois par Capacitor 8 et par
l'App Store depuis le 28 avril 2026). Capacitor 8 construit avec Swift Package
Manager, mais la CLI vérifie quand même la présence de CocoaPods avant
`cap add ios` : `sudo gem install cocoapods` une fois si `pod --version`
échoue.

```bash
npm install
npx cap add ios
IOS_DEVELOPMENT_TEAM=XXXXXXXXXX node scripts/setup-ios.mjs
npm run cap:ios          # build web + sync + ouvre Xcode
```

`scripts/setup-ios.mjs` applique tout ce qui doit être reproductible (le
dossier `ios/` est git-ignoré) : description d'usage de la position,
`remote-notification`, déclaration de chiffrement, schéma d'URL Google,
entitlements Sign in with Apple + APNs, `PrivacyInfo.xcprivacy`, hooks APNs
dans `AppDelegate.swift`, icônes, schéma Xcode partagé, bundle id, équipe et
versions.

Dans Xcode : sélectionner un iPhone branché → **Run**. À vérifier sur
l'appareil :

- [ ] connexion Google et connexion Apple (le bouton Apple n'apparaît que sur iOS)
- [ ] suppression de compte (Profil → Sécurité)
- [ ] page Horaires : la demande de position s'affiche et l'app ne se ferme pas
- [ ] téléchargement d'un livre puis lecture en mode avion
- [ ] rappel de lecture : réception d'une notification
- [ ] affichage de la barre d'état et des zones sûres (encoche, Dynamic Island)

## Étape 5 — App Store Connect

Sur [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Mes apps
→ `+` → Nouvelle app.

- Plateforme **iOS**, nom **Petite Jérusalem - Torah**, langue principale
  **français**, bundle ID `fr.petitejerusalem.app`, SKU `petite-jerusalem`.
- **Prix** : gratuit. **Disponibilité** : tous les pays.
- **Conformité DSA** (onglet Entreprise) : déclarer le statut *trader* et les
  coordonnées affichées dans l'UE. Sans cette déclaration, la distribution
  européenne est bloquée — c'est-à-dire le marché principal de l'app.
- **Catégorie** : Références (principale) ; Style de vie (secondaire).
- **Classification par âge** : répondre au questionnaire — l'app ne contient
  ni contenu généré par les utilisateurs public, ni violence, ni achats ;
  attendu **4+**.
- **Confidentialité de l'app** (« nutrition labels ») — à déclarer,
  cohérent avec `PrivacyInfo.xcprivacy` généré par le script :

  | Donnée | Liée à l'utilisateur | Suivi publicitaire | Usage |
  |---|---|---|---|
  | Adresse e-mail, nom, identifiant | oui | non | fonctionnement de l'app |
  | Position approximative | oui | non | rappel avant la chkia (arrondie au dixième de degré, effacée dès que le rappel est coupé) |
  | Interactions avec l'app | oui | non | analytics (PostHog) |
  | Données de plantage | non | non | fonctionnement de l'app |

  URL de politique de confidentialité :
  `https://petite-jerusalem.fr/confidentialite`.
- **Textes de la fiche** : ils vivent dans le repo
  (`store-assets/metadata/ios/<locale>/`) et sont poussés par
  `node scripts/appstore-listing.mjs` — inutile de les retaper.
  Vérifier avant : `node scripts/appstore-listing.mjs --check`.
- **Captures d'écran** : deux séries, l'app étant universelle (iPhone + iPad).
  - **iPhone 6,9 pouces** : 1320 × 2868, 1290 × 2796 ou 1260 × 2736.
  - **iPad 13 pouces** : 2064 × 2752 ou 2048 × 2732.

  PNG ou JPEG sRGB **sans transparence**. Apple redimensionne pour les
  appareils plus petits de chaque famille. À déposer à la main la première
  fois (l'API impose un envoi en plusieurs morceaux, hors périmètre du
  script) — voir [ios-ci-cd.md](ios-ci-cd.md#captures-décran).

## Étape 6 — CI/CD

Créer les cinq secrets GitHub et vérifier le workflow : tout est dans
[ios-ci-cd.md](ios-ci-cd.md). Une fois en place, un tag `vX.Y.Z` publie le
site, l'app Android **et** envoie le build iOS sur TestFlight.

## Étape 7 — TestFlight

1. Poser un tag (`git tag v3.7.0 && git push origin v3.7.0`) ou lancer
   « Deploy iOS » à la main depuis l'onglet Actions.
2. Le build apparaît dans TestFlight après 5 à 30 min de traitement.
3. **Test interne** : s'ajouter comme testeur interne, installer TestFlight
   sur l'iPhone, refaire la liste de vérification de l'étape 4 sur le build
   signé pour la distribution (c'est là que se voient les erreurs
   d'entitlements : push en production, Sign in with Apple).
4. Facultatif : test externe (jusqu'à 10 000 testeurs, demande un examen
   Apple léger, ~24 h).

## Étape 8 — Soumission

Dans App Store Connect, sur la version : sélectionner le build TestFlight,
puis **Ajouter pour examen**.

**Notes pour l'examen** (champ « Notes »), à recopier :

> L'app est gratuite, sans publicité ni achat intégré. La lecture des textes
> ne demande pas de compte : vous pouvez tester la bibliothèque, les horaires
> et les chiourim sans vous connecter.
>
> Pour les fonctions liées à un compte (session de lecture partagée,
> progression, rappels), un compte de test est fourni ci-dessous. La
> connexion « Sign in with Apple » est proposée à côté de la connexion
> Google, et le compte peut être supprimé depuis Profil → Sécurité →
> Supprimer mon compte.
>
> Deux fonctions **n'existent que dans l'application** et sont absentes du
> site web :
>
> 1. **Lecture hors ligne** — les textes (Talmud, Michna, Tanakh) se
>    téléchargent sur l'appareil depuis l'onglet Téléchargements et se lisent
>    sans aucune connexion. Pour le vérifier : télécharger un livre, activer
>    le mode avion, l'ouvrir.
> 2. **Notifications de rappel de lecture** (APNs) — réglables depuis la
>    cloche de la page « Lecture du jour » : un rappel à l'heure choisie, et
>    un second 20 minutes avant le coucher du soleil, calculé pour la
>    position de l'appareil.
>
> S'y ajoutent la connexion « Sign in with Apple » native et le calcul des
> horaires (zmanim) à partir de la position de l'appareil, effectué localement.

Renseigner aussi un **compte de démonstration** (identifiant + mot de passe)
dans la section prévue : sans lui, l'examen est refusé au premier tour.

### Les motifs de refus probables, et ce qui est déjà fait contre

| Règle | Risque | État |
|---|---|---|
| **4.2 Minimum Functionality** — « site web emballé » | le plus probable pour une app Capacitor, mais l'app fait bien plus que le site | lecture hors ligne et notifications de rappel **n'existent que dans l'app** ; s'y ajoutent la géolocalisation et la connexion Apple natives. Les deux premières sont détaillées dans les notes d'examen, avec la manip pour les vérifier |
| **4.8 Sign in with Apple** — obligatoire dès qu'un autre login tiers existe | élevé si oublié | implémenté, bouton visible uniquement sur iOS |
| **5.1.1(v) Suppression de compte** dans l'app | élevé si oublié | Profil → Sécurité → Supprimer mon compte |
| **2.1** compte de démonstration manquant | quasi systématique | à remplir dans le formulaire de soumission |
| **5.1.2** étiquettes de confidentialité incohérentes | moyen | tableau de l'étape 5 aligné sur `PrivacyInfo.xcprivacy` |
| **2.3** captures d'écran non représentatives | faible | mêmes écrans que la fiche Play Store |

En cas de refus, Apple répond dans le **Resolution Center** : corriger, poser
un nouveau tag (patch +1) et resoumettre — pas besoin de recommencer la fiche.

## Récapitulatif

- [ ] Apple ID avec 2FA, nom identique à la pièce d'identité
- [ ] Apple Developer Program (individuel) validé — 99 $/an
- [ ] Statut DSA (*trader*) déclaré dans App Store Connect
- [ ] App ID `fr.petitejerusalem.app` + capacités Push et Sign in with Apple
- [ ] Clé APNs `.p8` créée et sauvegardée
- [ ] App iOS Firebase créée, `GoogleService-Info.plist` à la racine du repo
- [ ] Clé APNs importée dans Firebase, fournisseur Apple activé
- [ ] `npx cap add ios` + `node scripts/setup-ios.mjs` + build sur iPhone OK
- [ ] App créée dans App Store Connect, confidentialité et classification remplies
- [ ] Captures 6,9" déposées
- [ ] Secrets GitHub créés, workflow « Deploy iOS » vert
- [ ] Build validé en TestFlight
- [ ] Compte de démo + notes d'examen renseignés, version soumise
