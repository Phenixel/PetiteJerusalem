# Les textes voyagent plus vite que le code

Ce document dit une seule chose, et la règle qui en découle : **les fichiers
de `public/texts/` sont lus par des applications plus anciennes qu'eux.** Qui
écrit un texte de tefila, ou la recette qui le produit
(`scripts/build-sidour.mjs`), écrit pour ces versions-là autant que pour la
nôtre.

## Pourquoi ils n'arrivent pas ensemble

Le site et les apps sortent du même tag `vX.Y.Z`. Le site est en ligne dans
la minute ; l'app, elle, attend la revue d'Apple et de Google, puis que
l'appareil veuille bien se mettre à jour. Une version installée peut rester
des mois en arrière (c'est la raison d'être de `appUpdateService`).

Pendant ce temps, l'app native ne lit pas les textes de son bundle : elle ne
les embarque pas (`scripts/prune-native-bundle.mjs` retire
`texts/tefila/`) et les télécharge depuis le site
(`offlineTextStore.fetchTextResponse`), avec une empreinte qui garantit qu'ils
sont bien les derniers publiés. Résultat, et c'est voulu pour les corrections
de contenu :

> le fichier vient d'aujourd'hui, le code qui le lit vient de la version
> installée.

## Ce qu'une version ancienne fait d'une condition

Le lecteur n'affiche un passage conditionnel que si sa condition tient parmi
les occasions du jour (`textService.saidOn`, `dailyCycles.activeOccasions`).
Or cette liste d'occasions et cette lecture des conditions vivent dans le
code, donc dans la version installée :

| Ce que le fichier écrit                                   | Ce qu'en fait une version qui ne la connaît pas                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `when` sur une clé d'occasion qu'elle ne pose pas         | elle tient la condition pour fausse : **le passage disparaît**                |
| `when` sur une syntaxe qu'elle ne découpe pas (`!`, `\|`) | elle cherche la chaîne entière parmi les occasions : **le passage disparaît** |
| un champ qu'elle ne connaît pas (`unless`)                | elle l'ignore : **le passage s'affiche**                                      |

Le premier cas est celui qu'on ne voit pas venir : il ne fait pas d'erreur, il
ne laisse pas de trace, il retire le tahanoun un matin, ou la conclusion d'une
bénédiction au milieu de la 'Amida, chez des lecteurs qu'on n'a pas sous les
yeux. C'est arrivé en Tichri 5787 : la conclusion « Barouh ata Adonaï, boné
Yerouchalayim » et le tahanoun tout entier ont disparu de toutes les versions
publiées, parce que le site s'était mis à écrire `!tisha-beav` et
`tahanoun-ordinaire`, deux formes que leur code ne savait pas lire.

## La règle

1. **`when` ne porte qu'une clé simple**, sans `!` ni `|`. La lecture reste
   tolérante (`saidOn` sait toujours les lire), mais les fichiers ne les
   écrivent plus.
2. **Ce qui retire un passage passe par `unless`**, l'exception : la
   conclusion ordinaire de la troisième bénédiction n'a pas de condition, ce
   sont les dix jours de techouva qui la retirent. Une version ancienne
   ignore `unless` et affiche le texte ordinaire : elle perd la finesse, pas
   le texte.
3. **Une alternative s'écrit en deux passages**, un par clé, quand les deux
   jours s'excluent (la lecture de la Torah du lundi et du jeudi, celle des
   jours de jeûne) : chaque version affiche celle qu'elle comprend, et jamais
   les deux.
4. **Une clé d'occasion nouvelle ne conditionne que du contenu nouveau.**
   Ajouter une clé au calendrier ne coûte rien ; déplacer un passage qui
   existait déjà sur cette clé nouvelle le fait disparaître partout ailleurs.
   Pour affiner un passage déjà servi, on garde sa clé et on ajoute un
   `unless`.
5. **Tout paragraphe garde un fragment d'hébreu sans condition**, pour qu'un
   paragraphe ne puisse jamais être rendu mutilé, quelle que soit la version.

Les points 1, 2 et 5 sont tenus par un test
(`src/__tests__/sidourCompatibilite.test.ts`) ; les clés employées sont
vérifiées contre celles que pose le calendrier
(`src/__tests__/sidourContent.test.ts`).

## Quand la flotte a rattrapé

Ces contraintes ne sont pas éternelles : elles valent tant que des versions
antérieures lisent nos fichiers. Le jour où toutes les versions installées
savent lire `!` et `|` (v3.10.1 et suivantes), le point 1 pourra se relâcher,
en connaissance de cause, en modifiant le test qui le tient. Le point 4, lui,
vaudra toujours : le calendrier avancera toujours plus vite que les
téléphones.
