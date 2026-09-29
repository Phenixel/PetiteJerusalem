# Petite Jérusalem

Conventions du dépôt, à respecter dans tout ce qui s'écrit ici : code,
commentaires, textes de l'interface, contenus, documentation, messages de
commit et de pull request.

## Typographie

**Jamais de tiret long.** Ni le cadratin (U+2014), ni le demi-cadratin
(U+2013). Nulle part : ni dans les commentaires, ni dans les chaînes traduites,
ni dans les contenus, ni dans la documentation, ni dans les messages de commit.
Un test le vérifie (`src/__tests__/typography.test.ts`), la vérification échoue
s'il en reste un.

Ce que l'on écrit à la place, selon ce que le tiret faisait :

| Le tiret servait à         | On écrit                         |
| -------------------------- | -------------------------------- |
| introduire une explication | deux-points (`:`)                |
| encadrer une incise        | des virgules, ou des parenthèses |
| lier deux propositions     | un point-virgule (`;`)           |
| donner une plage           | « du 12 au 14 »                  |
| ouvrir une énumération     | une vraie liste                  |

Le trait d'union (`-`) reste bien sûr en usage dans les mots composés, et les
corpus importés (`public/texts/`, textes de Sefaria) gardent la ponctuation de
leur source : ce n'est pas de la rédaction.

Le français de l'interface veut ses espaces insécables : U+202F avant `!`, `?`
et `;`, U+00A0 avant `:` et à l'intérieur des guillemets. Un test le vérifie
aussi (`src/__tests__/frenchTypography.test.ts`).

## Apparence

L'apparence du site et de l'app suit `docs/design.md` : couleurs des trois
thèmes, rayons (surfaces franches, commandes rondes), polices (Playfair
Display pour les titres, Manrope pour le reste), et ce qui ne s'emploie pas,
à commencer par les dégradés. Toute décision de design nouvelle s'y ajoute.

## Langue

Les commentaires et la documentation sont en français. Les identifiants de code
suivent le fichier où ils vivent : l'anglais pour les noms techniques, le
français pour le domaine liturgique.

## Commits

Un commit appartient au propriétaire du dépôt, pas à Claude : l'auteur et le
committeur sont `Phenixel <yonathancardoso@outlook.fr>`. Avant de commiter,
on règle l'identité du dépôt (`git config user.name "Phenixel"` et
`git config user.email "yonathancardoso@outlook.fr"`) ou l'on passe
`--author`. Claude n'y figure qu'en co-auteur, par la ligne `Co-Authored-By`.

## Notes de version

« Rédige la note de patch » suffit : la marche à suivre (ce qui change
depuis le dernier tag, format en trois langues, 500 caractères par langue,
nouveautés puis corrections, vérification par
`scripts/check-release-notes.mjs`) est dans `docs/notes-de-version.md`,
à suivre à la lettre.

## Backoffice sans l'interface

Publier une information (nouveauté, incident, question), clore un incident,
publier ou ajouter un chiour, créer un auteur et son lien studio (et son
lien vers le bot Telegram, `auteur:telegram`), modérer une session : tout se
fait par `node scripts/admin.mjs`, sans passer par les pages `/admin`. Mode
d'emploi complet dans `docs/backoffice-cli.md` ; le bot Telegram des auteurs
dans `docs/telegram.md`.

- Toujours lancer d'abord **sans** `--confirmer` (essai), montrer ce qui
  sera écrit, puis relancer avec `--confirmer`.
- La cible par défaut est la **production** ; `--emulateur` pour les
  émulateurs locaux.
- **Jamais `--notifier` sans l'accord explicite du propriétaire** : une
  notification part vers tous les téléphones et ne se rattrape pas.
- Un texte d'information suit la typographie ci-dessus (pas de tiret long,
  espaces insécables en français) ; l'anglais et l'hébreu sont facultatifs.
- Identifiants : en local, l'ADC du poste (s'il a expiré, le script le dit ;
  c'est au propriétaire de lancer `gcloud auth application-default login`,
  compte admin@phenixel.fr). En session cloud, la clé
  `PJ_ADMIN_SERVICE_ACCOUNT` de l'environnement ; si le script dit que
  firebase-admin manque, lancer `npm ci --prefix functions`.
- Les notes de version deviennent seules une information à la publication
  de la release GitHub (`.github/workflows/release-info.yml`).
