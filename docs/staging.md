# Environnement de staging

Un second environnement, complet et séparé de la production, pour essayer
« pour de vrai » ce qui partira à la prochaine release : sur le téléphone,
avec un vrai backend, sans que personne d'autre ne le voie.

|                  | Production                         | Staging                                          |
| ---------------- | ---------------------------------- | ------------------------------------------------ |
| Projet Firebase  | `petite-jerusalem-dev` (oui, c'est la prod) | `petite-jerusalem-staging`              |
| Site             | https://petite-jerusalem.fr        | https://petite-jerusalem-staging.web.app         |
| App              | « Petite Jérusalem », `fr.petitejerusalem.app` | « PJ Staging », `fr.petitejerusalem.app.staging` |
| iOS              | App Store                          | TestFlight seulement (testeurs internes)         |
| Android          | Play Store, piste production       | Play Store, piste de test interne                |
| Mise à jour      | tag `vX.Y.Z`                       | chaque fusion sur `main`                         |
| Mesure d'audience | PostHog                           | coupée                                           |

Les deux apps ont des identifiants différents : elles s'installent côte à
côte sur le même téléphone, et l'icône de staging porte un bandeau orange
« STAGING » (`assets/staging/`). Chacune a ses comptes, ses sessions et ses
données : un compte créé en staging n'existe pas en production.

## Comment ça se met à jour

[deploy-staging.yml](../.github/workflows/deploy-staging.yml) part à chaque
fusion sur `main` (sauf si seule la documentation change) :

1. le site et tout le backend de staging : hosting, règles et index
   Firestore, règles Storage, functions ;
2. l'app Android, construite par `deploy-android.yml` avec
   `environment: staging`, envoyée sur la piste de test interne ;
3. l'app iOS, construite par `deploy-ios.yml` avec `environment: staging`,
   envoyée sur TestFlight, sans fiche ni soumission à l'examen.

Ce sont les workflows de production qui construisent les apps de staging :
ce qui est testé en staging est ce qui partira au tag suivant. La version
affichée est celle du prochain correctif (3.10.12 quand 3.10.11 est la
dernière release), le numéro de build croît à chaque fusion.

Pour essayer une branche **avant** de la fusionner : Actions, « Deploy
Staging », « Run workflow », choisir la branche. La case « Construire aussi
les apps » décochée ne déploie que le site et le backend.

La production n'est pas concernée : elle part toujours, et seulement, aux
tags `vX.Y.Z` et `web-vX.Y.Z`.

## Installer l'app de staging sur son téléphone

- **iPhone** : installer TestFlight depuis l'App Store, accepter l'invitation
  reçue par e-mail (groupe de testeurs internes de « PJ Staging »). Dans
  TestFlight, activer les mises à jour automatiques : chaque fusion arrive
  seule, une dizaine de minutes après la fin du run.
- **Android** : ouvrir le lien d'inscription des testeurs internes (Play
  Console, « PJ Staging », Tests internes, Testeurs, « Copier le lien »),
  accepter, puis installer depuis le Play Store. Les mises à jour suivent
  comme pour n'importe quelle app.

## Mise en place, une fois pour toutes

### Déjà fait (14 octobre 2026)

- Projet Firebase `petite-jerusalem-staging` créé, rattaché au compte de
  facturation « Firebase Payment » (Blaze, indispensable aux functions).
- Apps Firebase enregistrées : web, Android et iOS
  (`fr.petitejerusalem.app.staging`).
- API activées, base Firestore `(default)` en `nam5` comme la production,
  bucket Storage par défaut.
- Authentification : e-mail et mot de passe, anonyme, Apple. Domaines
  autorisés : `localhost` et les deux domaines Firebase du projet.
- Règles Firestore, index et règles Storage déployés.
- Secret `NOTION_API_KEY` créé avec une valeur factice : le formulaire de
  retour échoue en staging au lieu d'écrire dans la base Notion des vrais
  retours.
- Contenu public recopié depuis la production (voir plus bas).

### À faire par le propriétaire

1. **Droits IAM.** `bash scripts/setup-staging-iam.sh` : compte de service de
   la CI et ses rôles, rôles des agents de service (sans eux le build des
   functions échoue), fédération d'identité de GitHub (l'organisation
   interdit les clés de compte de service : la CI n'en a pas besoin). Puis
   `firebase deploy --only functions --project petite-jerusalem-staging`.

   Fait le 14 octobre 2026. Le script s'arrête encore à son étape 3 (il
   tente une clé, que l'organisation refuse) : la fédération d'identité a été
   posée à la main, avec `gcloud iam workload-identity-pools create github`,
   `providers create-oidc github` (condition
   `assertion.repository == 'Phenixel/PetiteJerusalem'`) et le rôle
   `roles/iam.workloadIdentityUser` du compte `github-staging@` pour ce dépôt.
   Les functions HTTP et appelables ont aussi reçu `roles/run.invoker` pour
   `allUsers` (un premier déploiement raté les avait créées sans) : à rejouer
   si elles sont un jour recréées, comme `socialPreview` en production.
2. **Connexion Google.** Console Firebase, `petite-jerusalem-staging`,
   Authentication, Sign-in method, Google, Activer. Le client OAuth que cela
   crée ne s'obtient pas par l'API.
3. **Notifications iOS.** Console Firebase, Paramètres du projet, Cloud
   Messaging, app iOS : téléverser la clé APNs (`.p8`), la même que celle de
   la production.
4. **Apple** (developer.apple.com puis App Store Connect) :
   - Identifiers, App Groups : créer `group.fr.petitejerusalem.app.staging` ;
   - Identifiers, App IDs : créer `fr.petitejerusalem.app.staging` (capacités
     Push Notifications, Sign in with Apple, Associated Domains, App Groups,
     avec le groupe ci-dessus) et `fr.petitejerusalem.app.staging.PjWidgets`
     (App Groups, même groupe). Le premier run crée l'App ID de la montre ;
   - App Store Connect, Apps, « + », Nouvelle app : nom « PJ Staging », bundle
     id `fr.petitejerusalem.app.staging`, SKU `pj-staging`. Elle ne sera
     jamais soumise à l'examen ;
   - TestFlight, Tests internes : créer un groupe, s'y ajouter, cocher la
     distribution automatique.
5. **Google Play** (Play Console) :
   - Créer une app « PJ Staging », package `fr.petitejerusalem.app.staging`
     (le package est fixé au premier AAB envoyé) ;
   - Utilisateurs et autorisations : donner au compte de service de la CI
     (celui de `PLAY_SERVICE_ACCOUNT_JSON`) les droits de publication sur
     cette app ;
   - Tests internes : créer la liste de testeurs, s'y inscrire ;
   - Tant que l'app n'a jamais été publiée, Google n'accepte que des
     brouillons : poser la variable de repo `STAGING_PLAY_STATUS=draft`,
     lancer le workflow, publier à la main la première version interne dans
     la Play Console, puis supprimer la variable ;
   - Intégrité de l'app : relever les empreintes SHA-1 et SHA-256 de la clé
     de signature de l'app (et de la clé d'importation), ajouter les SHA-1 à
     l'app Android dans Firebase
     (`firebase apps:android:sha:create <appId> <sha1> --project petite-jerusalem-staging`),
     sans quoi la connexion Google échoue sur Android.
6. **Secrets GitHub**, une fois les étapes 2 et 5 faites (les fichiers
   contiennent alors les clients OAuth) :

   ```bash
   firebase apps:sdkconfig IOS 1:388713166885:ios:212434ccb7ae259b8967cc --project petite-jerusalem-staging -o GoogleService-Info.staging.plist
   gh secret set GOOGLE_SERVICE_INFO_PLIST_STAGING < GoogleService-Info.staging.plist
   firebase apps:sdkconfig ANDROID 1:388713166885:android:925b74bbec5396e48967cc --project petite-jerusalem-staging -o google-services.staging.json
   gh secret set GOOGLE_SERVICES_JSON_STAGING < google-services.staging.json
   rm GoogleService-Info.staging.plist google-services.staging.json
   ```

   Facultatif : `ANDROID_APP_LINK_SHA256_STAGING` (empreintes SHA-256 de
   l'étape 5, séparées par des virgules), pour que les liens du site de
   staging ouvrent l'app de staging sur Android.

Les autres secrets (clé App Store Connect, signature Android, compte Play)
sont ceux de la production : même compte développeur, même clé
d'importation.

## Le contenu

La base de staging part avec le contenu **public** de la production :
chiourim, auteurs, séries et informations. Jamais les sessions, les
signalements, les jetons du studio ni les préférences des comptes : ce sont
des données personnelles (RGPD). Pour recopier :

```bash
node scripts/staging-sync.mjs --compte admin@phenixel.fr              # essai
node scripts/staging-sync.mjs --compte admin@phenixel.fr --confirmer  # copie
```

Sans `--compte`, le script prend l'ADC du poste. Les fichiers audio ne sont
pas copiés : les chiourim de staging lisent ceux de la production.

## Construire en staging sur le poste

Tout ce qui dépend de l'environnement se lit dans
[scripts/lib/environments.mjs](../scripts/lib/environments.mjs), selon la
variable `PJ_ENV` (`staging`, ou rien pour la production) :

```bash
PJ_ENV=staging npm run build
PJ_ENV=staging npx cap add ios && cp -R assets/staging/. assets/ && PJ_ENV=staging node scripts/setup-ios.mjs
```

`npm run dev` reste branché sur les émulateurs locaux, quel que soit
`PJ_ENV`. Les dossiers `ios/` et `android/` gardent l'identité de
l'environnement qui les a générés : les régénérer pour passer de l'un à
l'autre (et remettre les icônes avec `git checkout assets/`).

## Ce qui diffère encore de la production

- Les liens de partage et les adresses canoniques pointent vers
  `petite-jerusalem.fr` : une session de staging partagée s'ouvre sur le site
  de production, qui ne la connaît pas.
- Le formulaire de retour échoue (secret Notion factice).
- Le site de staging est fermé aux robots (`robots.txt`).
- Les widgets iOS ouvrent l'app par le schéma `petitejerusalem://`, commun aux
  deux apps : avec les deux installées, iOS choisit l'une ou l'autre.
- L'App Store Connect plafonne le compte à trois certificats de
  distribution : un run iOS de staging crée le sien et le révoque à la fin,
  et les runs de signature (production et staging) passent l'un après
  l'autre (groupe de concurrence `apple-signing`, voir
  `scripts/ios-signing.mjs`).

## Coût

Le projet est sur le forfait Blaze, comme la production. Au volume d'un
testeur, tout tient dans les quotas gratuits (Firestore, Storage, functions,
Hosting, Identity Platform jusqu'à 50 000 utilisateurs actifs par mois).
Les runners macOS des builds iOS sont gratuits tant que le dépôt est public.
