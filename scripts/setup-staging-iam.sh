#!/usr/bin/env bash
# Droits IAM du projet de staging, à lancer une fois par le propriétaire
# (admin@phenixel.fr), et à rejouer tel quel si le projet est recréé. Chaque
# commande est idempotente. Voir docs/staging.md.
#
#   bash scripts/setup-staging-iam.sh
#
# Ce que fait le script :
#   1. le compte de service de la CI de staging et ses rôles, les mêmes que
#      ceux du compte de production (docs/firebase-ci-cd.md), plus ce que
#      demandent les functions planifiées et les secrets ;
#   2. les rôles des agents de service : sans eux, le build des functions
#      échoue (« missing permission on the build service account ») et les
#      triggers Firestore aussi (Eventarc), la politique de l'organisation
#      n'accordant rien d'office ;
#   3. la clé du compte de la CI, versée dans le secret GitHub
#      FIREBASE_SERVICE_ACCOUNT_STAGING puis effacée du disque ;
#   4. la politique de nettoyage des images des functions.
set -euo pipefail

ACCOUNT=admin@phenixel.fr
PROJECT=petite-jerusalem-staging
NUMBER=388713166885
CI_NAME=github-staging
CI_SA="$CI_NAME@$PROJECT.iam.gserviceaccount.com"
COMPUTE_SA="$NUMBER-compute@developer.gserviceaccount.com"
PUBSUB_SA="service-$NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com"
EVENTARC_SA="service-$NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com"
REPO=Phenixel/PetiteJerusalem

gc() { gcloud --account="$ACCOUNT" --project="$PROJECT" --quiet "$@"; }
bind() {
  gc projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$1" --role="$2" --condition=None >/dev/null
  echo "  $2 → $1"
}

echo "1. Compte de service de la CI"
gc iam service-accounts describe "$CI_SA" >/dev/null 2>&1 \
  || gc iam service-accounts create "$CI_NAME" --display-name="GitHub Actions staging"
for role in \
  roles/firebasehosting.admin \
  roles/cloudfunctions.admin \
  roles/run.admin \
  roles/cloudbuild.builds.editor \
  roles/artifactregistry.admin \
  roles/iam.serviceAccountUser \
  roles/serviceusage.serviceUsageConsumer \
  roles/firebaserules.admin \
  roles/datastore.indexAdmin \
  roles/firebase.developViewer \
  roles/datastore.user \
  roles/cloudscheduler.admin \
  roles/secretmanager.viewer \
  roles/firebaseextensions.viewer; do
  bind "$CI_SA" "$role"
done

echo "2. Agents de service"
# L'agent Eventarc n'existe qu'une fois demandé : le créer avant de le lier.
gc beta services identity create --service=eventarc.googleapis.com >/dev/null
gc beta services identity create --service=pubsub.googleapis.com >/dev/null
bind "$COMPUTE_SA" roles/cloudbuild.builds.builder
bind "$COMPUTE_SA" roles/datastore.user
bind "$COMPUTE_SA" roles/run.invoker
bind "$COMPUTE_SA" roles/eventarc.eventReceiver
bind "$COMPUTE_SA" roles/firebasecloudmessaging.admin
bind "$PUBSUB_SA" roles/iam.serviceAccountTokenCreator
bind "$EVENTARC_SA" roles/eventarc.serviceAgent

echo "3. Clé de la CI → secret GitHub FIREBASE_SERVICE_ACCOUNT_STAGING"
if gh secret list --repo "$REPO" | grep -q '^FIREBASE_SERVICE_ACCOUNT_STAGING\b'; then
  echo "  secret déjà présent, aucune nouvelle clé créée"
else
  key="$(mktemp)"
  trap 'rm -f "$key"' EXIT
  gc iam service-accounts keys create "$key" --iam-account="$CI_SA" >/dev/null
  gh secret set FIREBASE_SERVICE_ACCOUNT_STAGING --repo "$REPO" < "$key"
  echo "  clé créée et versée dans le secret, copie locale effacée"
fi

echo "4. Nettoyage des images des functions (au-delà d'un jour)"
firebase functions:artifacts:setpolicy --project "$PROJECT" --days 1 --force --non-interactive >/dev/null
echo "  politique posée"

echo "Terminé. Relancer le déploiement des functions :"
echo "  firebase deploy --only functions --project $PROJECT"
