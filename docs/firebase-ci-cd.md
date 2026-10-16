# Firebase CI/CD: service account permissions

The workflow [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
publishes **on each `vX.Y.Z` tag** (full release, with the mobile apps)
**or `web-vX.Y.Z` tag** (the site alone: front-end fix, content, SEO,
without a mobile release; the `v*` pattern does not match `web-v*`, so the
mobile workflows do not run), in this order:

1. the site (hosting), then a check that the new version is indeed the one
   served in production;
2. an IndexNow ping (`scripts/indexnow.mjs`), non-blocking
   (`continue-on-error`): a refusal from IndexNow must not fail a
   deployment whose site is already live;
3. the Firestore rules **and** indexes;
4. the Storage rules;
5. the Cloud Functions.

Everything goes through a single service account, whose JSON key is in the
GitHub secret `FIREBASE_SERVICE_ACCOUNT`:

```
github-action-769913390@petite-jerusalem-dev.iam.gserviceaccount.com
```

For a long time this account could deploy hosting **and nothing else**: the
rules and functions failed with a 403, and had to be pushed by hand after
each change. The roles below fix that; they are recorded here so they can
be replayed as is if the account is ever recreated.

## Service account roles

| Role | Why |
|---|---|
| `roles/firebaserules.admin` | Compile, test and publish the Firestore **and** Storage rules. The account had no `firebaserules` permission: the CI failed as soon as the test call was made (`firebaserules.googleapis.com/…:test`). |
| `roles/datastore.indexAdmin` | Create the indexes declared in `firestore.indexes.json`. The account only had `roles/datastore.viewer`, read-only. |
| `roles/firebase.developViewer` | Read the default bucket (`firebasestorage.defaultBucket.get`), which firebase-tools checks before deploying the Storage rules. Deliberately chosen instead of `roles/firebase.developAdmin` or `roles/firebase.admin`: writing the rules already goes through `firebaserules.admin`, so a read permission is enough here. |
| `roles/datastore.user` | Write to Firestore: the information item for each version, published by `.github/workflows/release-info.yml` (`scripts/admin.mjs info:depuis-release`, see `docs/backoffice-cli.md`). Read and write of documents only, neither rules nor indexes. |

## Service agent roles

Deploying the Cloud Functions failed with "*We failed to modify the IAM
policy*": firebase-tools was trying to grant roles to the project's service
agents itself, at deploy time. Giving it that power would have meant
assigning `roles/resourcemanager.projectIamAdmin` to the CI account, that
is, allowing it to grant itself **any role** on the project, for a key that
lives in a GitHub secret.

The three bindings firebase-tools asked for were therefore set once and for
all, by hand:

| Principal | Role |
|---|---|
| `152837353533-compute@developer.gserviceaccount.com` | `roles/run.invoker` |
| `152837353533-compute@developer.gserviceaccount.com` | `roles/eventarc.eventReceiver` |
| `service-152837353533@gcp-sa-pubsub.iam.gserviceaccount.com` | `roles/iam.serviceAccountTokenCreator` |

The Eventarc agent (`service-152837353533@gcp-sa-eventarc…`) receives
`roles/eventarc.serviceAgent` automatically when it is created: nothing to
do.

## Replaying everything

```bash
PROJECT=petite-jerusalem-dev
CI_SA=github-action-769913390@petite-jerusalem-dev.iam.gserviceaccount.com
COMPUTE_SA=152837353533-compute@developer.gserviceaccount.com
PUBSUB_SA=service-152837353533@gcp-sa-pubsub.iam.gserviceaccount.com

# CI service account
for role in roles/firebaserules.admin roles/datastore.indexAdmin roles/firebase.developViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$CI_SA" --role="$role"
done

# Service agents (deploying functions without IAM permission on the project)
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$COMPUTE_SA" --role="roles/run.invoker"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$COMPUTE_SA" --role="roles/eventarc.eventReceiver"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$PUBSUB_SA" --role="roles/iam.serviceAccountTokenCreator"
```

To check a permission without waiting for a tag, authenticate **with the
service account key**, not with an owner account, otherwise the test proves
nothing:

```bash
gcloud auth activate-service-account --key-file=<clé.json>
export GOOGLE_APPLICATION_CREDENTIALS=<clé.json>
firebase deploy --only firestore:rules,firestore:indexes --project petite-jerusalem-dev
firebase deploy --only storage --project petite-jerusalem-dev
firebase deploy --only functions --project petite-jerusalem-dev
```

## If a run fails

The rules and functions steps are **blocking**: a red run signals a real
problem, not a tolerated lack of permissions. They all run after the site
goes live, which is therefore never held back by their failure.

A 403 that reappears means one of the bindings above was dropped (account
recreated, role removed): replay the matching `gcloud` block. The
firebase-tools error message names the exact missing permission; that is
what tells you which role to restore, not the other way around.
