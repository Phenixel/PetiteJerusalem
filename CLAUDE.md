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

## Langue

Les commentaires et la documentation sont en français. Les identifiants de code
suivent le fichier où ils vivent : l'anglais pour les noms techniques, le
français pour le domaine liturgique.
