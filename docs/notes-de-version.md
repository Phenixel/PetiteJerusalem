# Notes de version

La marche à suivre quand on demande « rédige la note de patch » (ou les
notes de version, le changelog, les « Nouveautés » d'une version).
CLAUDE.md y renvoie.

La note part de la description de la release GitHub du tag `vX.Y.Z` : la CI
en envoie chaque section à la langue du même nom, sur le Play Store (fr-FR,
en-US, iw-IL) et sur l'App Store (fr-FR, en-US, he). Voir
`docs/android-ci-cd.md`, section « Notes de version en trois langues ».
Le même texte devient une information « Mise à jour » dans l'app et sur le
site, à la publication de la release (`.github/workflows/release-info.yml`,
voir `docs/backoffice-cli.md`).

Le résultat attendu est UN bloc de texte prêt à coller, rien d'autre à
faire pour le propriétaire du dépôt que le copier.

## 1. Trouver ce qui a changé

1. `git fetch --tags origin main`, puis le dernier tag de version de l'app :
   `git tag -l 'v*' --sort=-v:refname | head -1` (les tags `web-v*` ne
   comptent pas, ils ne publient que le site).
2. Les PR fusionnées depuis : `git log --first-parent --format='%h %s' <tag>..origin/main`,
   puis, pour chacune, le corps des commits de la branche fusionnée
   (`git log --no-merges --format='%s%n%b' <merge>^1..<merge>^2`). Le
   message de commit dit ce que la personne voit ; c'est là qu'on lit.
3. Ne garder que ce qu'un utilisateur de l'app ou du site remarque. Laisser
   de côté : CI, workflows, captures des fiches, tests, documentation,
   nettoyage de code, suivi d'audience, remontées d'erreurs, refactorisations
   sans effet visible.
4. Relire au besoin les deux ou trois dernières releases GitHub pour le ton.

## 2. Écrire

Trois sections, dans cet ordre, sous ces titres exacts. Dans chacune, deux
blocs : les nouveautés, puis les corrections. Un bloc sans rien s'omet.

```markdown
## Français
Nouveautés
- …

Corrections
- …

## English
What's new
- …

Fixes
- …

## עברית
חדש
- …

תיקונים
- …
```

- **Court.** Le Play Store coupe à 500 caractères par langue (puces et
  intitulés compris) : viser 3 ou 4 nouveautés et autant de corrections au
  plus, une phrase courte chacune, la plus importante d'abord. Si tout ne
  tient pas, regrouper (« Sidour : quatre lectures corrigées ») ou retirer
  le moins visible, jamais tronquer une phrase.
- **Du point de vue de l'utilisateur**, au présent : ce qu'il voit ou peut
  faire désormais, pas comment c'est fait. Ni numéro de PR, ni nom de
  fichier, ni jargon technique.
- **Les trois langues disent la même chose**, dans le même ordre. L'anglais
  et l'hébreu sont de vraies traductions, pas un résumé.
- **Les libellés de l'interface** sont ceux de l'app dans chaque langue :
  les reprendre de `src/locales/fr.ts`, `en.ts` et `he.ts` (noms des
  onglets, des groupes du profil, des boutons).
- **Termes liturgiques** : en français, la graphie du dépôt (Cha'harit,
  Min'ha, Arvit, 'Hol haMoed, Tehilim, Sidour, Hochanot, Chabbat) ; en
  anglais, la translittération courante (Shacharit, Mincha, Arvit, Chol
  HaMoed, Tehilim, Siddur, Hoshanot, Shabbat) ; en hébreu, le mot hébreu
  (שחרית, חול המועד, תהילים, סידור, הושענות, שבת). Une citation en hébreu
  reste en hébreu dans les trois langues.
- **Typographie** : jamais de tiret long (règle du dépôt, voir CLAUDE.md),
  guillemets « » en français et " " en anglais et en hébreu, apostrophe
  droite. Aucun émoji : App Store Connect les refuse.

## 3. Vérifier

Écrire la note dans un fichier de travail (le scratchpad de la session),
puis :

```sh
node scripts/check-release-notes.mjs <fichier>
```

Il affiche la longueur de chaque langue et échoue sur une langue absente,
un texte de plus de 500 caractères, un tiret long ou un émoji. Reprendre
jusqu'à « note prête ».

## 4. Rendre

- Le bloc complet, dans un seul bloc de code markdown, prêt à coller.
- Sous le bloc, en une ligne : la longueur de chaque langue (sortie du
  vérificateur), et le numéro de version suivant proposé (dernier tag,
  patch + 1, sauf si les changements appellent plus).
- Le rappel : créer la release GitHub avec ce texte AVANT de pousser le
  tag, puisque c'est au tag que la CI lit la description.
- Ne rien publier soi-même (ni release, ni tag) sans qu'on le demande.

## 5. Publier la version (sur demande)

Quand le propriétaire demande de publier (« publie la 3.11.0 », « mets en
prod »), la mise en production passe par une PR, ce qui marche aussi depuis
une session cloud (qui ne peut ni pousser un tag, ni écrire sur main) :

1. La note, vérifiée comme au 3, dans `releases/vX.Y.Z.md`, sur une
   branche, puis une PR vers main. Rien d'autre dans cette PR.
2. Montrer la version, la note et le commit de main qui partira, et
   attendre un oui explicite pour CETTE version : la fusion est la mise en
   production (site, stores, information de version).
3. Fusionner la PR. `.github/workflows/release.yml` vérifie la note
   (check-release-notes), refuse un tag déjà pris ou une version qui ne
   suit pas la dernière, crée la release `vX.Y.Z` avec ce texte, puis lance
   deploy.yml, deploy-android.yml, deploy-ios.yml et release-info.yml sur
   le tag.
4. Donner le lien du run « Publier une version » (onglet Actions).

Pour tout vérifier sans rien publier : onglet Actions, « Publier une
version », « Run workflow » avec la version et « Essai » coché (le
défaut). La release créée depuis l'interface GitHub reste possible et
déclenche tout comme avant ; les deux chemins ne se mélangent pas pour une
même version (le workflow refuse un tag qui existe déjà).
