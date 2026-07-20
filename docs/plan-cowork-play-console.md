# Plan Cowork : publier Petite Jérusalem sur le Play Store (test fermé)

Passation Claude Code → Cowork, 19/07/2026. Objectif : créer l'app dans la Play Console, remplir la fiche et les formulaires, uploader l'AAB en test fermé et envoyer en review.

Rôle de Cowork : guider Yonathan écran par écran dans la Play Console (et remplir à sa place ce que son navigateur permet), en utilisant les valeurs exactes ci-dessous. Tout est prêt côté code et fichiers ; il n'y a plus rien à builder ni à rédiger.

## État : tout ce qui suit est FAIT (ne pas refaire)

- **AAB signé prêt à uploader** : `android/app/build/outputs/bundle/release/app-release.aab` (25,8 Mo, versionCode 1, versionName 3.0.0). Signé avec le keystore release (`CN=Yonathan Cardoso, OU=Phenixel, C=FR`, SHA-1 `FC:05:F3:FC:06:C5:E7:1C:0C:E7:97:8C:0C:D0:11:F5:45:35:94:38`). Vérifié avec apksigner et jarsigner.
- **SHA-1 release déclarée dans Firebase** et `google-services.json` à jour embarqué dans l'AAB (login Google natif fonctionnel en release).
- **Politique de confidentialité en ligne** : https://petite-jerusalem.fr/confidentialite (aussi /a-propos et /mentions-legales, site déployé en v3.0.1).
- **Règles Firestore déployées** (la suppression de compte purge bien `userPreferences/{uid}` en prod).
- **Textes de fiche prêts** dans `store-assets/` : `store-listing-fr.txt`, `store-listing-en.txt`, `store-listing-he.txt` (titre ≤30, description courte ≤80, longue ≤4000, limites vérifiées). Ne jamais utiliser de tiret cadratin « — » si un texte doit être retouché.
- **Visuels prêts** dans `store-assets/` : `icon-512.png` (512x512 PNG) et `feature-graphic.png` (1024x500 PNG).

## Prérequis manquants (à traiter avant ou pendant)

1. **Captures d'écran : FAIT.** 5 captures 1080x2400 (build release sur émulateur Pixel 7) dans `store-assets/screenshots/` : accueil, bibliothèque, lecture Tehilim en hébreu, session de partage, chiourim. Si la Play Console refuse le ratio 9:20, utiliser les variantes 1080x1920 (9:16) dans `store-assets/screenshots/9x16/`. ⚠️ `04-partage-session.png` montre une vraie session (« Créé par : Phenixel Cardoso » et une description liée à la guerre) : préférer l'écarter, ou demander une re-capture avec une session de démonstration neutre. Les 4 autres suffisent (minimum Play : 2). Le dossier `old/` contient d'anciennes captures basse résolution : ne pas les utiliser.
2. **Compte développeur Play Console** : si Yonathan n'en a pas encore, il doit le créer lui-même sur https://play.google.com/console (frais uniques de 25 USD, vérification d'identité qui peut prendre quelques jours). Cowork ne doit jamais saisir de moyen de paiement ni de pièce d'identité : c'est à Yonathan de le faire.

## Étape A : créer l'app

Play Console → « Créer une application » :
- Nom de l'app : `Petite Jérusalem - Torah` (le titre exact de `store-listing-fr.txt`)
- Langue par défaut : Français (France)
- Type : Application. Prix : Gratuite.
- Cocher les déclarations (conformité aux règles Play, lois d'exportation US).

## Étape B : fiche du store (Croissance → Fiche du Play Store principale)

- Coller depuis `store-assets/store-listing-fr.txt` : titre, description courte, description longue.
- « Ajouter une traduction » : en-US (fichier `store-listing-en.txt`) puis he-IL (fichier `store-listing-he.txt`).
- Icône : `store-assets/icon-512.png`. Bannière (feature graphic) : `store-assets/feature-graphic.png`.
- Captures d'écran téléphone : voir prérequis 1.
- Catégorie : Application → Éducation. Balises libres : Éducation, Livres et références.
- Coordonnées : email `contact@phenixel.fr`, site `https://petite-jerusalem.fr`.

## Étape C : questionnaires « Contenu de l'application » (Règles → Contenu de l'application)

Réponses exactes, cohérentes avec le code audité et la politique de confidentialité. Ne rien déclarer d'autre.

1. **Politique de confidentialité** : `https://petite-jerusalem.fr/confidentialite`
2. **Annonces** : l'app ne contient PAS de publicité.
3. **Accès à l'app** : certaines fonctionnalités demandent un compte, mais la lecture est libre. Choisir « Toutes les fonctionnalités sont disponibles sans restriction particulière » si le formulaire le permet sans identifiants de test ; sinon fournir un compte de test créé pour l'occasion (email + mot de passe à créer par Yonathan, jamais par Cowork).
4. **Classification du contenu (IARC)** : email `contact@phenixel.fr` ; catégorie « Référence, actualités ou éducation ». Répondre NON à : violence, sexualité, langage grossier, substances, jeux d'argent, achats intégrés. Interaction entre utilisateurs : les sessions partagées sont accessibles uniquement par lien d'invitation, il n'y a pas de messagerie ni de profil public. Résultat attendu : tout public / PEGI 3.
5. **Public cible** : 13 ans et plus (ne pas cocher les tranches enfants, ça déclencherait la politique Familles).
6. **Sécurité des données** (le formulaire le plus long, réponses ci-dessous) :
   - Collecte de données : OUI. Chiffrement en transit : OUI. L'utilisateur peut demander la suppression : OUI, via l'app (Profil → Sécurité) et via `https://petite-jerusalem.fr/confidentialite`.
   - Données collectées, toutes avec finalité « Fonctionnement de l'application » et « Gestion du compte », aucune partagée avec des tiers, collecte facultative (compte non obligatoire) :
     - Informations personnelles → Adresse e-mail (compte)
     - Informations personnelles → Nom (nom affiché du compte ou saisi dans une session partagée)
     - Identifiants de l'appareil ou autres → jeton de notification FCM (uniquement si le rappel quotidien est activé)
     - Activité dans l'application → Autres contenus générés par l'utilisateur (liste et progression de lecture liées au compte)
   - Ne PAS déclarer : localisation, contacts, fichiers, données financières, historique web, données de santé (rien de tout ça n'est collecté).
7. **App gouvernementale / actualités / covid** : NON partout. **Fonctionnalité financière** : aucune.

## Étape D : test interne (Tests → Tests internes)

1. Créer une release, uploader `android/app/build/outputs/bundle/release/app-release.aab`.
2. À l'upload, accepter **Play App Signing** (Google gère la clé de signature de distribution ; notre keystore devient la clé d'upload). C'est irréversible et c'est le comportement voulu.
3. 📌 IMPORTANT après l'upload : Play Console → Configuration (Setup) → Signature d'application (App integrity) → copier la **SHA-1 du certificat de la clé de signature d'app** (celle de Google, différente de la nôtre). L'ajouter dans Firebase (console Firebase → paramètres du projet → app Android `fr.petitejerusalem.app` → Ajouter une empreinte). Sans ça, le login Google échouera sur les builds distribués par le Play Store. Pas besoin de re-uploader l'AAB : re-télécharger `google-services.json` n'est nécessaire que pour les builds futurs.
4. Ajouter `contact.phenixel@gmail.com` (et l'email du compte dev si différent) comme testeur interne, installer via le lien sur un vrai téléphone, vérifier : démarrage, login Google, lecture d'un texte, rappel de lecture.

## Étape E : test fermé + review

1. Tests → Test fermé : créer une piste, promouvoir la release du test interne.
2. Liste de testeurs : au moins **12 adresses Gmail** (famille/communauté). Google exige 12 testeurs actifs pendant **14 jours consécutifs** avant de pouvoir passer en production (compte développeur individuel).
3. Sélectionner les pays (au minimum : France, Israël, États-Unis, Canada, Belgique, Suisse, Royaume-Uni ; « tous les pays » est plus simple).
4. Vérifier que le tableau de bord ne signale plus aucune tâche bloquante, puis **« Envoyer en review »** 🎯. La review Google prend de quelques heures à quelques jours.

## Garde-fous pour Cowork

- Ne jamais saisir mot de passe, moyen de paiement ou pièce d'identité : toujours Yonathan.
- Le clic final « Envoyer en review » et l'acceptation de Play App Signing : demander confirmation explicite à Yonathan avant.
- Ne pas modifier les textes de `store-assets/` sans redemander (limites de caractères déjà vérifiées, pas de tiret cadratin).
- Si un formulaire pose une question non couverte ici, ne pas improviser une déclaration : vérifier dans le code ou demander.

## Après la mise en test fermé (pour mémoire, étape 7 du plan général)

Suivre les crashs (Play Console → Qualité), relancer les testeurs pour tenir les 14 jours, préparer le passage en production. Le keystore d'upload (`~/petite-jerusalem-release.keystore` + mot de passe) doit être sauvegardé dans un coffre : sans lui, plus de mises à jour possibles.
