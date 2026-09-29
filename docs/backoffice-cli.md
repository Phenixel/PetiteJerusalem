# Le backoffice en ligne de commande

`scripts/admin.mjs` fait ce que font les pages `/admin`, sans l'interface :
publier une information, clore un incident, ajouter ou publier un chiour,
créer un auteur et son lien studio, modérer une session. Il écrit exactement
ce qu'écrirait l'interface (mêmes champs, mêmes refus), et sert à trois
usages :

- **Claude**, quand on lui demande « ajoute une information pour la mise en
  ligne », « publie les chiourim de Rav X », « clos l'incident » ;
- **la CI**, qui fait de chaque note de version une information
  (`.github/workflows/release-info.yml`) ;
- **à la main**, depuis un terminal.

```bash
node scripts/admin.mjs aide
```

(ou `npm run admin -- aide`)

## Les garde-fous

- **Rien n'est écrit sans `--confirmer`.** Sans lui, une commande qui écrit
  décrit ce qu'elle ferait (« [essai, production] Créer l'information… ») et
  s'arrête. On lit l'essai, puis on relance avec `--confirmer`.
- **Une notification ne part qu'avec `--notifier`.** Jamais par défaut, ni
  depuis la CI. L'essai le dit en toutes lettres : « UNE NOTIFICATION
  PARTIRA vers tous les appareils abonnés ». Elle part une seule fois, au
  moment où l'information devient publiée avec la case cochée (la Cloud
  Function `onAnnouncementWritten`).
- **La cible est la production** (`petite-jerusalem-dev`, qui porte le site
  public malgré son nom). `--emulateur` vise les émulateurs de
  `npm run dev:local` ; attention, même là, `--notifier` ferait partir une
  vraie notification (FCM n'est pas émulé).
- Chaque document écrit garde qui l'a écrit : `updatedVia`
  (`cli (utilisateur@machine)` ou `ci (…)`).

## Accès

Le script passe par le SDK admin de Firebase (celui des functions : lancer
`npm ci --prefix functions` s'il manque), avec les identifiants par défaut de
Google (ADC). Il n'est donc pas soumis aux règles Firestore : c'est le
compte qui fait foi.

- **En local**, une fois (le jeton finit par expirer, le script le dit) :

  ```bash
  gcloud auth application-default login
  ```

  et choisir **admin@phenixel.fr** dans le navigateur. Le gcloud de la
  machine a un autre compte par défaut, sans accès au projet : c'est bien
  l'ADC qu'il faut renouveler, pas `gcloud auth login`.

- **En CI**, le compte de service `FIREBASE_SERVICE_ACCOUNT` posé par
  `google-github-actions/auth`. Il lui faut `roles/datastore.user` pour
  écrire dans Firestore (voir `docs/firebase-ci-cd.md`).

## Les commandes

Toutes acceptent `--confirmer`, `--emulateur` et `--json` (sortie lisible par
un script, par exemple pour retrouver un identifiant).

### État

| Commande | Ce qu'elle fait                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `etat`   | Ce que « À traiter » montre dans le backoffice : chiourim à relire, sans auteur, sessions signalées, incident en cours, brouillons, auteurs sans lien studio. |

### Informations (collection `announcements`, voir `docs/informations.md`)

| Commande              | Ce qu'elle fait                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `info:liste`          | Toutes les informations, brouillons compris, la plus récente d'abord, avec leur identifiant.                                        |
| `info:voir <id>`      | Une information en entier.                                                                                                          |
| `info:creer`          | Nouvelle information (options ci-dessous). Brouillon sauf `--publier`.                                                              |
| `info:modifier <id>`  | Change ce qui est passé en option, garde le reste. `--publier` / `--depublier`, `--resolu` / `--en-cours`.                          |
| `info:resoudre <id>`  | Clôt un incident : il quitte l'accueil.                                                                                             |
| `info:supprimer <id>` | Supprime définitivement.                                                                                                            |
| `info:depuis-release` | La note de version d'un tag en information « Mise à jour » (`--tag vX.Y.Z`, ou `--version X.Y.Z --fichier note.md`). Voir plus bas. |

Options d'une information :

- `--type` : `nouveaute`, `mise-a-jour`, `incident` ou `question` ;
- `--titre`, `--texte` (ou `--texte-fichier note.md`, `-` pour l'entrée
  standard) : le français, obligatoire ;
- `--titre-en`, `--texte-en`, `--titre-he`, `--texte-he` : les traductions,
  facultatives (sans elles, ces lecteurs voient le français) ;
- `--lien /page` ou `--lien https://…`, `--lien-texte` : le bouton ;
- `--version X.Y.Z` : pour une mise à jour (l'app ne l'annonce qu'une fois
  cette version installée) ;
- `--publier`, `--notifier`.

Le texte suit la typographie du dépôt : pas de tiret long, et les espaces
insécables du français (U+202F avant ! ? ;, U+00A0 avant : et dans « »).

### Chiourim

| Commande                   | Ce qu'elle fait                                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chiour:liste`             | `--filtre brouillons\|publies\|sans-auteur\|sans-serie`, `--auteur <id>`, `--recherche …`. Le premier mot de chaque ligne est le slug.                                                                                                                                                    |
| `chiour:voir <slug>`       | Un chiour en entier (série, catégories, audio).                                                                                                                                                                                                                                           |
| `chiour:publier <slug>…`   | Publie un ou plusieurs chiourim (les envois des auteurs arrivent en brouillon).                                                                                                                                                                                                           |
| `chiour:depublier <slug>…` | Les retire de l'app.                                                                                                                                                                                                                                                                      |
| `chiour:modifier <slug>`   | `--titre`, `--description`, `--auteur <id>`, `--serie <id>` ou `--sans-serie`, `--episode N`, `--categories a,b`, `--niveau`, `--publier` / `--depublier`.                                                                                                                                |
| `chiour:ajouter <fichier>` | Ajoute un chiour avec son audio (mp3, m4a, wav, ogg, aac), comme le studio d'un auteur : `--titre`, `--auteur <id>` requis ; `--description`, `--categories`, `--serie`, `--episode`, `--niveau`, `--publier`. Durée mesurée par `ffprobe` s'il est installé, sinon `--duree <secondes>`. |

### Auteurs et séries

| Commande                       | Ce qu'elle fait                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `auteur:liste`                 | Les auteurs, leurs chiourim publiés et en brouillon, s'ils ont un lien studio actif.  |
| `auteur:voir <id>`             | Un auteur et ses séries (identifiants à passer à `--serie`).                          |
| `auteur:creer "Nom"`           | Crée l'auteur et son lien studio, affiché une seule fois : le transmettre à l'auteur. |
| `auteur:lien <id>`             | Nouveau lien studio ; l'ancien cesse de fonctionner.                                  |
| `serie:creer <auteurId> "Nom"` | Crée une série de cet auteur.                                                         |

### Sessions (modération)

| Commande                 | Ce qu'elle fait                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `session:signalements`   | Les sessions signalées et le motif de chaque signalement ouvert.                   |
| `session:masquer <id>`   | Retire une session du public.                                                      |
| `session:demasquer <id>` | La rend au public et résout ses signalements ouverts (le compteur repart de zéro). |

## Les notes de version, automatiquement

Quand une release `vX.Y.Z` est publiée sur GitHub (ou son texte corrigé),
`.github/workflows/release-info.yml` lance :

```bash
node scripts/admin.mjs info:depuis-release --tag vX.Y.Z --confirmer
```

Le texte de la release (le même que celui des stores, trois sections, voir
`docs/notes-de-version.md`) devient l'information `release-vX.Y.Z`, publiée,
**sans notification**, titrée « Version X.Y.Z : les nouveautés » dans chaque
langue présente. Une release corrigée met l'information à jour sans changer
sa date. Une release sans texte n'en crée pas. Pour la rattraper à la main :
onglet Actions, « Information de version », avec le tag ; ou la même commande
depuis un terminal.

Pour notifier une version en plus (rarement : l'app annonce déjà la note une
fois la version installée) :

```bash
node scripts/admin.mjs info:modifier release-vX.Y.Z --notifier --confirmer
```

## Exemples

```bash
# Annoncer une nouveauté, avec un bouton vers la page
node scripts/admin.mjs info:creer --type nouveaute \
  --titre "Les Hochanot sont dans le sidour" \
  --texte "Tout Souccot, les Hochanot du jour s'affichent dans l'office du matin." \
  --lien /bibliotheque/sidour --lien-texte "Ouvrir le sidour" --publier
# … lire l'essai, puis relancer avec --confirmer

# Prévenir d'un incident, puis le clore
node scripts/admin.mjs info:creer --type incident --titre "…" --texte "…" --publier --confirmer
node scripts/admin.mjs info:liste
node scripts/admin.mjs info:resoudre <id> --confirmer

# Relire puis publier les envois des auteurs
node scripts/admin.mjs chiour:liste --filtre brouillons
node scripts/admin.mjs chiour:publier <slug> <slug> --confirmer

# Ajouter un cours enregistré
node scripts/admin.mjs auteur:voir <auteurId>
node scripts/admin.mjs chiour:ajouter ~/cours.mp3 --titre "…" --auteur <auteurId> \
  --serie <serieId> --episode 4 --categories "Michna" --confirmer
```

## Pour faire évoluer le script

La partie pure (validation, mise en forme, notes de version) vit dans
`scripts/lib/backoffice.mjs`, tenue par `src/__tests__/backofficeCli.test.ts`.
Une règle changée dans le backoffice (un champ d'information, le dépôt du
studio dans `functions/src/studio.ts`) se reporte ici, sinon les deux chemins
écriraient des documents différents.
