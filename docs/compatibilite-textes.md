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

Pendant ce temps, l'app native ne se contente pas des textes de son bundle.
Elle n'embarque que le Sidour (`src/datas/bundledTexts.json`), pour qu'on
puisse prier sans réseau dès l'installation ; tout le reste de
`texts/tefila/` est retiré par `scripts/prune-native-bundle.mjs` et se
télécharge. Et même le Sidour embarqué, elle le compare au site
(`offlineTextStore.fetchTextResponse`) : dès qu'il en sert une autre version,
avec une empreinte qui garantit qu'elle est bien la dernière publiée, l'app
la télécharge et la lit ensuite à la place de la sienne. Résultat, et c'est
voulu pour les corrections de contenu :

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
6. **Ce qu'une version publiée ne peut pas cacher, elle doit pouvoir le
   lire.** `unless` retire un passage chez qui le comprend, et le laisse chez
   les autres : une conclusion remplacée (« Hamélekh hakadoch » aux dix jours)
   s'affiche donc deux fois sur ces versions, et aucune clé n'y changera rien,
   leur calendrier ne sait pas nommer « hors des dix jours ». On leur rend
   alors la présentation du sidour imprimé, qui écrit les deux et met la règle
   entre : une didascalie `{ when: clé, unless: clé }`, que seul un lecteur
   ignorant `unless` affiche (voir `didascalieDeRemplacement` dans
   build-sidour.mjs). Elle s'enlèvera quand la flotte aura rattrapé.
7. **Une couverture nouvelle se nomme par une clé nouvelle, jamais par une
   clé déjà posée.** Ata 'honantanou se dit sous `jour-0`, que tout le monde
   connaît ; la sortie de Yom Tov, qui s'y ajoute, a reçu `motsae-yom-tov`
   plutôt que `motsae` : ce dernier, posé depuis la v3.10.1, aurait fait dire
   le passage deux fois le samedi soir aux versions qui le connaissent sans
   connaître `unless`.

8. **Un texte qui quitte le catalogue garde son fichier.** Le catalogue
   (`src/datas/textStudies.json`) vit dans le code, le fichier sur le site :
   une version publiée continue d'ouvrir le texte sous son ancien nom. Les
   Hochanot, passées d'une page par jour à un seul livre qui s'ouvre sur le
   jour (`hochanot.json`), écrivent donc encore leurs huit pages d'avant
   (`build-moadim.mjs`, `PAGES_DU_JOUR`), que le catalogue ne porte plus ;
   les adresses web de ces pages, elles, redirigent vers le livre.
9. **Un champ nouveau ne porte que du nouveau.** Le renvoi d'un bloc vers un
   autre texte (`link`) et le repère qui le reçoit (`anchor`) sont ignorés
   par les versions publiées : le bloc des Hochanot de Cha'harit y garde son
   premier verset et la halakha qui dit où lire la suite. De même pour la fin
   d'une 'Amida répétée (`hazara`) : une version publiée n'affiche pas le
   bouton de la 'hazara, et rien du texte ne manque.
10. **Un remplacement que le calendrier décide se fait dans le calendrier.**
    À 'Hol haMoed, le psaume de la fête prend à Min'ha la place du
    Lamnatséa'h. Le psaume reçoit une clé nouvelle (`chir-moed-minha`), et
    c'est le code récent qui cesse de poser `lamnatseah-minha` ces jours-là,
    au lieu d'un `unless` dans le fichier. Une version publiée pose encore
    `lamnatseah-minha` et ne connaît pas la clé nouvelle : elle garde le
    Lamnatséa'h, comme avant ; une version récente ne dit que le psaume de la
    fête. Aucune ne perd de texte, aucune ne dit les deux (tenu par
    `sidourOccasions.test.ts`).

    Même principe pour les Kaddich des jours de Moussaf (clé `moussaf`) : le
    Kaddich Titkabal après Ouva letsion et le Kaddich yehé chelama avant
    Moussaf portent `unless: "moussaf"`, le demi-Kaddich qui les remplace
    `when: "moussaf"`. Une version publiée garde l'ordre de semaine, et voit
    en plus, à Roch 'Hodech, le Kaddich Titkabal et le Kaddich yehé chelama
    qui suivent désormais Moussaf, comme elle les voyait déjà à 'Hol haMoed :
    deux encadrés repliés du 'hazan, pas un mot de la prière en double.

11. **Un passage qui tombe certains soirs se retire par `unless` et une clé
    nouvelle.** Le vidouy du Chema du coucher ne se dit pas les nuits sans
    tahanoun : il porte `unless: "sans-tahanoun-nuit"`, clé que le lecteur
    pose (`nightWithoutTachanun`, tenu par `tachanun.test.ts`) puisqu'elle
    dépend de hatsot à la sortie de Chabbat. Une version publiée ignore
    `unless` et affiche le vidouy tous les soirs, comme avant. De même, le
    cadran des six côtés que portent les didascalies des na'anou'im du Hallel
    (`naanouim` sur un fragment `r`) est un champ ignoré : une version
    publiée garde la didascalie, sans le bouton.

Les points 1, 2, 5 et 6 sont tenus par un test
(`src/__tests__/sidourCompatibilite.test.ts`) ; les clés employées sont
vérifiées contre celles que pose le calendrier
(`src/__tests__/sidourContent.test.ts`).

### Les commentaires de la page du daf

Rachi et Tossafot de la guemara vivent à part, par tranches de vingt amoudim
(`texts/talmud-meforshim/<traité>/<n>.json`, `{ title, from, rashi, tosafot,
rashbam? }`, écrits par `scripts/download-texts.mjs --only=meforshim`).
`rashi[a][p]` est la liste des commentaires du passage `p` de l'amoud `a`,
dans la numérotation des passages de Sefaria, vides compris : c'est elle que
le lecteur retrouve à partir de `DafBlock.passages`, et **elle ne se
renumérote pas** sans régénérer aussi la guemara. `rashbam` liste les amoudim
de la tranche où le Rachbam tient la place de Rachi (Bava Batra). Une
version installée calcule elle-même le nom de la tranche d'un amoud
(`MEFORSHIM_CHUNK` dans `textService.ts`) : **la taille des tranches ne change
pas sans changer de dossier**, sans quoi une version publiée demanderait
`3.json` pour un amoud qui n'y est plus, et montrerait la guemara sans ses
commentaires. Les index d'amoud et de passage sont ceux du fichier de
guemara du traité ;
une guemara régénérée qui gagnerait ou perdrait un amoud se régénère donc avec
ses commentaires (tenu par `src/__tests__/pageForm.test.ts`, qui vérifie
l'alignement sur chaque traité).

### Les commentaires de la Michna et des Neviim / Ketouvim

Deux corpus s'ajoutent, écrits par `scripts/download-texts.mjs
--only=commentaires`, et lus seulement par le panneau d'étude :

- `texts/mishna-meforshim/<traité>.json`, `{ title, bartenura,
tosafotYomTov }` : un fichier par traité, nommé comme celui de sa Michna ;
- `texts/rashi/<id>.json` pour les entrées des Neviim et des Ketouvim (318
  à 339), au format de Rachi sur une paracha (`{ title, he }`, sans
  `fromBook` ni `grouping`). Le fichier du livre de Tehilim (328) sert aussi
  aux psaumes lus un par un : son groupe `n - 1` est le psaume `n`.

Leur grille est celle du fichier de texte livré : un groupe par groupe du
fichier (chapitre, livre des Douze), une case par ligne **affichée** (une
ligne vide de la source n'en a pas), une liste de commentaires par case, le
dibbour hamat'hil en `<b>…</b>`. Un texte lu chapitre par chapitre (un
traité de Michna, Chir HaChirim) prend le groupe de son chapitre
(`section.index - 1`) ; un texte lu d'un seul tenant, tous les groupes bout à
bout. Une version publiée ne lit ces fichiers que pour les parachiot (option
Rachi du chnei mikra) : les fichiers des Neviim et des Ketouvim ne lui
changent rien. Un texte régénéré qui gagnerait ou perdrait une ligne se
régénère avec ses commentaires (tenu par `src/__tests__/commentaryFiles.test.ts`).

### Les lignes du livre : la page de Vilna, les colonnes du Sefer Torah

La forme de la page compose ses lignes à l'écran : ce ne sont pas celles du
livre. Deux dossiers disent où le livre coupe les siennes. Ils sont écrits
par `scripts/layout/` (mode d'emploi dans son `README.md`) ; ils ne portent
**aucun mot**, seulement des places dans les textes qu'on a déjà. Une version
publiée ne les demande pas, et les fichiers existants ne changent pas.

- Les colonnes du Sefer Torah sont relevées pour toute la Torah, et lues :
  la forme du Sefer Torah écrit ligne pour ligne comme le rouleau
  (`TorahScroll.vue`, `scrollLayout.ts`).
- La page de Vilna n'est relevée que pour un pilote (Berakhot 2a à 10b), à
  partir de scans du domaine public, et rien ne la lit encore : son format
  reste une proposition.

**La page de Vilna** : `texts/talmud-layout/<traité>/<n>.json`, par tranches
de vingt amoudim comme `talmud-meforshim` (même règle : la taille des
tranches ne change pas sans changer de dossier).

```text
{
  "title": "Berakhot",
  "from": 0,
  "edition": "vilna-romm-1880",
  "through": 17,
  "main": [[[0, 0], [0, 7], [0, 13]]],
  "rashi": [[[[0, 0, 8]], [[0, 8, 6]], [[0, 14, 4], [1, 0, 7]]]],
  "tosafot": [[[[0, 0, 10]]]],
  "absent": [{ "rashi": [[14, 37, 8]] }]
}
```

- `main[a]` : les lignes de la guemara de l'amoud `from + a`, chacune par la
  place de son premier mot, `[passage, mot]`. Le passage est celui du fichier
  de guemara (`he[amoud][passage]`) ; le mot se compte dans
  `gemaraPageText([passage]).split(" ")`, c'est-à-dire dans le passage tel
  que la page du daf l'affiche. Les lignes se suivent dans l'ordre du texte :
  une ligne va de son premier mot à celui de la suivante.
- `rashi[a]`, `tosafot[a]` : les lignes du commentaire, chacune par les
  morceaux de texte qu'elle porte, `[passage, mot, nombre]`. Le mot se compte
  dans les commentaires du passage bout à bout, chacun lu par
  `parseRashiComment` (son dibbour, puis son texte), coupés aux espaces. Un
  quatrième nombre donne l'amoud quand le texte est celui d'un autre amoud :
  un commentaire qui finit à la page suivante reste rangé, chez Sefaria, sous
  l'amoud où il commence.
- `absent[a]` : ce que le fichier de commentaires porte et que la page
  n'imprime pas (un doublon, un ajout entre crochets), ou que le relevé n'a
  pas su placer. Ces mots ne sont sur aucune ligne.
- `through` : le dernier amoud relevé de la tranche. Le dernier amoud relevé
  d'un traité peut avoir des commentaires qui finissent à la page suivante :
  ils seront placés quand elle le sera.

Pourquoi les commentaires ne se notent pas comme la guemara, par un seul
début de ligne : la page n'imprime pas les commentaires dans l'ordre des
passages. Rachi sur le passage 14 peut venir avant Rachi sur le passage 9, et
une ligne porter la fin d'un commentaire et le début d'un autre, d'un autre
passage. Une ligne dit donc tout ce qu'elle porte.

**Les colonnes du Sefer Torah** : `texts/torah-layout/<id>.json`, un fichier
par paracha (264 à 317), sous le numéro de son fichier de texte. Le rouleau
est celui de 245 colonnes de 42 lignes, où chaque colonne commence par un
vav, celui des tikounim de lecture d'aujourd'hui (`edition: "tikkun-245"`).

```text
{
  "title": "Beshalach",
  "edition": "tikkun-245",
  "columns": [
    {
      "column": 76,
      "from": 17,
      "lines": [[null, [0, 0]], [[0, 1]], [[5, 6], null], [], [[57, 8], [58, 0]]]
    }
  ],
  "big": [],
  "small": []
}
```

- `columns` : les colonnes du rouleau que la paracha occupe, par leur numéro
  dans le rouleau (1 à 245). `from` : la ligne de la colonne (de 0 à 41) où
  la paracha commence ; les colonnes suivantes commencent à 0, et toutes
  sauf la dernière vont jusqu'à la quarante-deuxième ligne.
- `lines` : les lignes, dans l'ordre. Une ligne est la suite de ses
  **morceaux**, chacun noté par la place de son premier mot, `[verset, mot]` ;
  le verset est celui du fichier de la paracha mis à plat (comme `data-line`
  dans le lecteur), le mot se compte dans `scrollVerseWords(verset)`. Un
  morceau va de son premier mot à celui du morceau suivant. Entre deux
  morceaux d'une ligne, un blanc : une setouma, une brique d'Az yachir.
- `null` tient la place d'un blanc au bord de la ligne. À la fin
  (`[[5, 6], null]`), la ligne s'arrête avant le bord : c'est une petou'ha, ou
  bien la paracha suivante continue dans la même ligne. Au début
  (`[null, [0, 0]]`), ce qui précède dans la ligne est de la paracha d'avant :
  quatorze parachiot commencent ainsi au milieu d'une ligne.
- `[]` : une ligne blanche (avant et après Az yachir, après Haazinou). Les
  quatre lignes blanches qui séparent deux livres, et celle d'avant Haazinou,
  ne sont dans aucun fichier : elles se lisent dans `from`.
- `halves`, sur une colonne : de quelle ligne à quelle ligne (rangs dans
  `lines`) on écrit Haazinou, chaque ligne en deux moitiés de même largeur.
- `big`, `small` : les grandes et les petites lettres, chacune par son
  verset, son mot et son rang dans le mot. Elles viennent du balisage du
  texte de Sefaria.

Ces fichiers pèsent 216 Ko en tout et restent dans le binaire de l'app (ils
ne sont pas dans `PRUNED_DIRS` de `scripts/prune-native-bundle.mjs`) : une
paracha téléchargée a ses lignes sans réseau.

D'où viennent ces lignes, par ordre d'autorité croissante
(`scripts/layout/scroll.py`) : les colonnes de tikkun.io (licence MIT), dont
le texte est le nôtre mot pour mot ; les images du tikoun d'ORT, sur
lesquelles chaque ligne est recalée (onze coupures corrigées sur 10 270
lignes) ; la tradition écrite pour les deux chirot et leurs abords (Rambam,
Hilkhot Sefer Torah 8, 4 ; Rema, Yoré Déa 275, 6 : cinq corrections). Le
détail, et ce que ce relevé ne garantit pas, est dans
`scripts/layout/README.md`.

Ce que les tests tiennent (`src/__tests__/textLayout.test.ts`) : chaque place
écrite existe et les lignes se partagent le texte mot pour mot ; les 54
fichiers se suivent sans trou d'un bout à l'autre des 245 colonnes de 42
lignes ; chaque colonne commence par un vav, sauf les six que la tradition
nomme ; les deux chirot ont leurs lignes. Pour la page de Vilna, le test ne
tient que le partage du texte : la justesse des coupures s'y mesure à l'œil,
sur des planches de relecture. Ces index sont ceux des fichiers de texte :
une guemara, des commentaires ou une paracha régénérés demandent de refaire
le relevé. Un fichier de lignes qui ne colle plus à son texte n'est pas lu :
la colonne s'écrit alors à notre façon, justifiée (`scrollColumns` rend
`null`).

## Quand la flotte a rattrapé

Ces contraintes ne sont pas éternelles : elles valent tant que des versions
antérieures lisent nos fichiers. Le jour où toutes les versions installées
savent lire `!` et `|` (v3.10.1 et suivantes), le point 1 pourra se relâcher,
en connaissance de cause, en modifiant le test qui le tient. Le point 4, lui,
vaudra toujours : le calendrier avancera toujours plus vite que les
téléphones.
