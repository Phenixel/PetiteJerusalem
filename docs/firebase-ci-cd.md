# CI/CD Firebase — droits du service account

Le workflow [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
publie **à chaque tag `vX.Y.Z`**, dans cet ordre :

1. le site (hosting), puis une vérification que la nouvelle version est bien
   celle servie en production ;
2. les règles **et** les index Firestore ;
3. les règles Storage ;
4. les Cloud Functions.

Tout passe par un seul compte de service, dont la clé JSON est dans le secret
GitHub `FIREBASE_SERVICE_ACCOUNT` :

```
github-action-769913390@petite-jerusalem-dev.iam.gserviceaccount.com
```

Ce compte a longtemps pu déployer le hosting **et rien d'autre** : les règles
et les functions échouaient en 403, et devaient être poussées à la main après
chaque modification. Les rôles ci-dessous corrigent ça — ils sont consignés
ici pour être rejoués tels quels si le compte est un jour recréé.

## Rôles du compte de service

| Rôle | Pourquoi |
|---|---|
| `roles/firebaserules.admin` | Compiler, tester et publier les règles Firestore **et** Storage. Le compte n'avait aucune permission `firebaserules` : la CI échouait dès l'appel de test (`firebaserules.googleapis.com/…:test`). |
| `roles/datastore.indexAdmin` | Créer les index déclarés dans `firestore.indexes.json`. Le compte n'avait que `roles/datastore.viewer`, en lecture seule. |
| `roles/firebase.developViewer` | Lire le bucket par défaut (`firebasestorage.defaultBucket.get`), que firebase-tools consulte avant de déployer les règles Storage. Choisi délibérément à la place de `roles/firebase.developAdmin` ou `roles/firebase.admin` : l'écriture des règles passe déjà par `firebaserules.admin`, un droit de lecture suffit donc ici. |

## Rôles des agents de service

Le déploiement des Cloud Functions échouait sur « *We failed to modify the IAM
policy* » : firebase-tools essayait d'accorder lui-même, au moment du déploiement,
des rôles aux agents de service du projet. Lui en donner le pouvoir aurait
voulu dire attribuer `roles/resourcemanager.projectIamAdmin` au compte de la
CI — c'est-à-dire l'autoriser à s'octroyer **n'importe quel rôle** sur le
projet, pour une clé qui vit dans un secret GitHub.

Les trois liaisons que firebase-tools réclamait ont donc été posées une fois
pour toutes, à la main :

| Principal | Rôle |
|---|---|
| `152837353533-compute@developer.gserviceaccount.com` | `roles/run.invoker` |
| `152837353533-compute@developer.gserviceaccount.com` | `roles/eventarc.eventReceiver` |
| `service-152837353533@gcp-sa-pubsub.iam.gserviceaccount.com` | `roles/iam.serviceAccountTokenCreator` |

L'agent Eventarc (`service-152837353533@gcp-sa-eventarc…`) reçoit
`roles/eventarc.serviceAgent` automatiquement à sa création : rien à faire.

## Tout rejouer

```bash
PROJECT=petite-jerusalem-dev
CI_SA=github-action-769913390@petite-jerusalem-dev.iam.gserviceaccount.com
COMPUTE_SA=152837353533-compute@developer.gserviceaccount.com
PUBSUB_SA=service-152837353533@gcp-sa-pubsub.iam.gserviceaccount.com

# Compte de service de la CI
for role in roles/firebaserules.admin roles/datastore.indexAdmin roles/firebase.developViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$CI_SA" --role="$role"
done

# Agents de service (déploiement des functions sans droit IAM sur le projet)
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$COMPUTE_SA" --role="roles/run.invoker"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$COMPUTE_SA" --role="roles/eventarc.eventReceiver"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$PUBSUB_SA" --role="roles/iam.serviceAccountTokenCreator"
```

Pour vérifier un droit sans attendre un tag, s'authentifier **avec la clé du
compte de service** — pas avec un compte propriétaire, sinon le test ne prouve
rien :

```bash
gcloud auth activate-service-account --key-file=<clé.json>
export GOOGLE_APPLICATION_CREDENTIALS=<clé.json>
firebase deploy --only firestore:rules,firestore:indexes --project petite-jerusalem-dev
firebase deploy --only storage --project petite-jerusalem-dev
firebase deploy --only functions --project petite-jerusalem-dev
```

## En cas d'échec dans un run

Les étapes de règles et de functions sont **bloquantes** : un run rouge signale
un vrai problème, pas un manque de droits toléré. Elles s'exécutent toutes
après la mise en ligne du site, qui n'est donc jamais retenue par leur échec.

Un 403 qui réapparaîtrait signifie qu'une liaison ci-dessus a sauté (compte
recréé, rôle retiré) : rejouer le bloc `gcloud` correspondant. Le message
d'erreur de firebase-tools nomme la permission exacte qui manque — c'est elle
qui indique le rôle à remettre, pas l'inverse.
