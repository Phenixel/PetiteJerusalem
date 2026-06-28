# Passation Cowork — Migration des chiourim vers Firebase

> Document autoportant. Le destinataire n'a pas le contexte de la conversation : tout est ici.

## 1. Contexte

L'app **petite-jerusalem** (Vue 3 + Firebase, projet `petite-jerusalem-dev`) servait ses « chiourim »
(cours audio) depuis Notion via un intermédiaire **n8n** (webhook). Problème : les URLs média Notion
**expirent en ~1 h**, d'où un cache fragile.

On migre vers une vraie base Firebase :
- **Firestore** = métadonnées des chiourim (collection `chiourim`).
- **Cloud Storage** = les fichiers **audio** (URLs permanentes).
- **Audio uniquement** : plus de YouTube. **Notion et n8n sont abandonnés.**

Le projet est **déjà sur le plan Blaze** (les Cloud Functions sont déployées, donc Blaze est actif).

## 2. Déjà fait par l'équipe dev — NE PAS refaire

Tout le **code** est prêt sur la branche `feat/chiourim-firestore-migration` :
règles Storage/Firestore, repository Firestore, script de migration, sélecteur de source.
Le code est **inerte** tant qu'on ne bascule pas le flag — **la bascule et le nettoyage UI seront faits
par l'équipe dev, PAS par toi.**

Périmètre de cette passation = uniquement l'**infra** et l'**exécution de la migration des données**.

## 3. Ce qu'on attend de toi (résumé)

1. Activer **Cloud Storage**.
2. T'authentifier sur le projet avec le **bon compte**.
3. Déployer les **règles de sécurité**.
4. Lancer le **script de migration** (dry-run puis commit).
5. **Vérifier** et nous remonter le résultat.

## 4. Accès requis

- Accès **Owner/Editor** au projet Firebase `petite-jerusalem-dev`.
- Compte Google **`admin@phenixel.fr`** (⚠️ voir vigilance §10 : le compte gcloud par défaut n'a PAS les droits).
- `gcloud` CLI et `firebase-tools` installés (`npm i -g firebase-tools` si absent).
- Node ≥ 20.

---

## Prérequis 0 — Récupérer le code

```bash
git fetch
git checkout feat/chiourim-firestore-migration
cd functions && npm install
```
> Si la branche n'est pas visible, demander à l'équipe dev de la **pousser** (`git push -u origin feat/chiourim-firestore-migration`).

---

## Tâche 1 — Activer Cloud Storage

**Objectif :** le bucket `petite-jerusalem-dev.firebasestorage.app` doit être actif.

**Étapes (console) :** Firebase Console → projet `petite-jerusalem-dev` → **Build → Storage → Commencer**
→ accepter les règles par défaut → **choisir la région `us-central` (= `nam5`, pour coller à Firestore)**.

**Critère d'acceptation :** l'onglet Storage affiche un bucket vide sans erreur.

---

## Tâche 2 — Authentification (⚠️ le bon compte)

**Objectif :** `gcloud` et le SDK pointent sur `petite-jerusalem-dev` avec `admin@phenixel.fr`.

```bash
gcloud auth login admin@phenixel.fr
gcloud config set account admin@phenixel.fr
gcloud config set project petite-jerusalem-dev
gcloud auth application-default login        # choisir admin@phenixel.fr dans le navigateur

# Vérification — doit afficher admin@phenixel.fr :
gcloud config get-value account
```

**Critère d'acceptation :** `gcloud config get-value account` = `admin@phenixel.fr`.

---

## Tâche 3 — Déployer les règles de sécurité

**Objectif :** verrouiller l'écriture (`chiourim` Firestore + audios Storage) en admin uniquement,
lecture publique.

```bash
# depuis la racine du repo
firebase login            # si pas déjà connecté (auth séparée de gcloud)
firebase deploy --only firestore:rules,storage --project petite-jerusalem-dev
```

**Critère d'acceptation :** déploiement « ✔ Deploy complete » sans erreur sur `firestore` et `storage`.
> Le script de migration (Tâche 4) écrit via l'Admin SDK et **contourne** les règles : cette tâche
> n'est donc pas bloquante pour la migration, mais doit être faite avant la mise en ligne de l'admin.

---

## Tâche 4 — Lancer la migration des données

**Objectif :** uploader les 40 audios dans Storage et créer 43 documents dans `chiourim`.
⚠️ **Les URLs Notion expirent en ~1 h → faire le `--commit` en UN SEUL passage, sans interruption.**

```bash
cd functions

# 4a. Rapport (aucune écriture) — doit afficher "Audio prêts à migrer : 40"
node scripts/migrate-chiourim.mjs --report

# 4b. Migration réelle (upload + écriture Firestore)
node scripts/migrate-chiourim.mjs --commit
```

**Résultat attendu du `--commit` :**
- `Audio prêts à migrer : 40`
- `À re-sourcer (sans audio) : 3` (les 3 vidéos PESSAH — créées en brouillon, normal)
- `Migration terminée.`

**Critère d'acceptation :**
- Console Storage → dossier `chiourim/` contenant ~40 sous-dossiers avec un `audio.mp3`.
- Console Firestore → collection `chiourim` avec ~43 documents.

---

## Tâche 5 — Vérifications finales

1. **Firestore** : ouvrir un document `chiourim`, vérifier qu'il a `mediaUrl`, `audioPath`, `published: true`.
2. **Audio jouable** : copier le `mediaUrl` d'un document dans un navigateur → le fichier audio doit se lire/télécharger.
3. **Brouillons** : les 3 docs PESSAH ont `published: false` et `mediaUrl` vide (attendu).

---

## 10. Points de vigilance

- ⚠️ **Compte gcloud** : le compte par défaut n'a **aucun droit** sur `petite-jerusalem-dev`. Toujours
  utiliser **`admin@phenixel.fr`** (Tâche 2). C'est la cause d'erreur n°1.
- ⚠️ **Fenêtre de 1 h** : lancer le `--commit` d'une traite (les URLs sources expirent).
- 🚫 **Ne PAS** modifier le code, ni basculer le flag `VITE_CHIOURIM_SOURCE`, ni merger la branche,
  ni déployer le hosting. La bascule applicative est faite par l'équipe dev **après** ta migration.
- ℹ️ Le script est **idempotent** (doc id = slug) : on peut le relancer sans créer de doublons.

## 11. À nous remonter

- La **sortie complète** de `node scripts/migrate-chiourim.mjs --commit`.
- Captures : Storage (`chiourim/`) et Firestore (collection `chiourim`).
- Toute erreur rencontrée (surtout permissions / compte).
- Confirmation que les **règles** sont déployées (Tâche 3).

Une fois ces 5 tâches OK, l'équipe dev prend le relais : déploiement de la bascule (flag → Firestore),
retrait de l'UI YouTube, mise à jour de la fonction `socialPreview`, et livraison de l'interface d'admin.
