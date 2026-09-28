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
Pour une page ou un composant nouveau, la section 8 de ce document nomme les
styles à ne pas employer : c'est elle qui fait la différence, bien plus
qu'une consigne générale du genre « éviter un rendu générique ».

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
`scripts/check-release-notes.mjs`) est dans `docs/notes-de-version.md`.
Le format y est fixe parce que la CI découpe la note par langue et que les
stores en coupent ou en refusent une partie.
