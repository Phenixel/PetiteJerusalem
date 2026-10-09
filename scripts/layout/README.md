# Les lignes du livre

Ce dossier relève l'endroit où chaque ligne du livre se coupe, et l'écrit
dans `public/texts/torah-layout/` (les colonnes du Sefer Torah, pour toute la
Torah) et `public/texts/talmud-layout/` (la page de Vilna). Le
format de ces fichiers est décrit dans `docs/compatibilite-textes.md`.

Rien n'est transcrit. Le texte, on l'a déjà (`public/texts/`) ; les sources
ne servent qu'à savoir où les lignes se coupent. Sur une image, aucune lettre
n'est lue : on y relève les lignes et la largeur de leurs mots, et l'on cale
cette suite de largeurs sur les mots du texte, dont on sait prévoir la
largeur dans le caractère du livre.

## Le Sefer Torah

Le rouleau relevé est celui de **245 colonnes de 42 lignes**, où chaque
colonne commence par un vav (« vavé ha'amoudim »), sauf les six de
« בי"ה שמ"ו ». C'est la disposition des tikounim de lecture d'aujourd'hui.

```bash
# Les sources (une fois).
python3 scripts/layout/fetch.py tikkun-io
python3 scripts/layout/fetch.py scrollscraper
python3 scripts/layout/fetch.py sefaria-torah

# Le contrôle, sans rien écrire : ce qui est recalé, et pourquoi.
python3 scripts/layout/scroll.py --check

# Les 54 fichiers, puis le manifeste et les tests.
python3 scripts/layout/scroll.py --write
node scripts/texts-manifest.mjs
npx vitest run src/__tests__/textLayout.test.ts src/__tests__/scrollLayout.test.ts
```

Trois sources, de la plus commode à la plus sûre (`scroll.py`) :

1. **tikkun.io** (licence MIT) donne les 245 colonnes ligne par ligne, en
   texte. Son texte est celui de Sefaria, comme le nôtre : les 79 977 mots se
   suivent à l'identique, une ligne se note donc par la place d'un mot de
   notre fichier, sans rien caler.
2. **Les images du tikoun d'ORT** montrent les mêmes lignes. tikkun.io en a
   vraisemblablement été tiré, par un partage des versets qui range parfois un mot
   une ligne trop haut ou trop bas. Chaque ligne est donc recalée sur son
   image, et l'image a raison : onze coupures corrigées (colonnes 16, 82, 83
   et 88), et deux lignes que tikkun.io arrête avant le bord alors qu'elles
   sont pleines.
3. **La tradition écrite** fixe les lignes des deux chirot et de leurs
   abords. Là où les deux sources s'en écartent, elle a raison : les cinq
   lignes d'après Az yachir commencent par « ותקח, אחריה, סוס, ויצאו,
   ויבאו » (Rema, Yoré Déa 275, 6) ; dans Haazinou, « ואילים » finit sa ligne
   (Rambam, Hilkhot Sefer Torah 8, 4) ; la dernière ligne d'Az yachir est en
   trois morceaux. Les lignes blanches suivent la règle : quatre entre deux
   livres, une avant et une après chaque chira.

Ce que vaut le contrôle. `scroll.py --probe 9` déplace d'un mot une coupure
sur neuf (1 075), puis demande au contrôle de les retrouver : il
les retrouve toutes, sans fausse alerte. Les colonnes des deux chirot (78,
242, 243) en sont exclues, leurs lettres étant étirées sur l'image : la
tradition les fixe, et elles ont été relues à l'œil.

Ce que le relevé ne garantit pas :

- **Un rouleau n'est pas l'autre.** Ces lignes sont celles du tikoun de 245
  colonnes. Un rouleau écrit sur un autre tikoun (celui, plus espacé, de Rav
  Davidovitch, un rouleau yéménite, un rouleau ancien) coupe ses lignes
  ailleurs.
- **Deux témoins, pas trois.** tikkun.io dérive des images d'ORT : hors des
  chirot, rien d'autre ne les contrôle. Une ligne que le tikoun d'ORT
  couperait autrement qu'un tikoun imprimé passerait inaperçue.
- **Les six lignes d'après Haazinou** ne sont pas celles du Rema (cinq
  lignes, qui demandent une colonne très large) : le rouleau de 245 colonnes
  en écrit six, pour que la colonne suivante commence par un vav.
- **Le texte** est celui de Sefaria (la Massora d'Alep). Les rouleaux
  achkénazes et séfarades en diffèrent par quelques lettres (Berechit 9, 29 ;
  Devarim 23, 2) : cela ne change aucune ligne, mais ce n'est pas la lettre
  de tous les rouleaux.
- Les nounim inversés de Bamidbar 10, 35 ne sont pas écrits.

## La page de Vilna

```bash
python3 scripts/layout/vilna.py beitzah --fetch          # les pages (une par seconde)
python3 scripts/layout/vilna.py beitzah --check          # ce que vaut le calage
python3 scripts/layout/vilna.py beitzah --amud 3a --dump # une page, ligne par ligne
python3 scripts/layout/vilna.py beitzah --write          # public/texts/talmud-layout
python3 scripts/layout/vilna.py all --write              # tout le Shas
```

La source est une page par amoud, recomposée ligne pour ligne d'après Vilna,
en PDF (lecteur de shas.org, voir `sources.json`). Le texte y est du texte :
`vilna.py` en lit les mots, leur police et leur place, sans rien deviner.

- **La zone** vient de la police : celle de la guemara, celle de Rachi (que
  Tossafot partage), celle des dibbourim de Rachi, celle des dibbourim de
  Tossafot. Les marges ont les leurs, qu'on laisse.
- **La ligne** vient de la place. Deux colonnes voisines se séparent à leur
  gouttière, qui se retrouve au même endroit d'une rangée à l'autre ; un
  blanc de justification, non.
- **À qui est une ligne de commentaire** : à Rachi ou à Tossafot selon la
  police du dibbour qu'elle ouvre, sinon selon ses mots. Le côté ne le dit
  pas : sur certaines pages Rachi tient les deux colonnes.
- **Nos mots** : le texte de la page et le nôtre sont le même Talmud. On les
  aligne mot à mot ; ce qui diffère entre deux mots retrouvés est une
  abréviation (« ר' » pour « רבי », « א"ל » pour « אמר ליה »), et nos mots
  prennent la ligne du mot imprimé qui leur répond. La page n'imprime pas
  les commentaires dans l'ordre de notre fichier : les suites de mots restées
  seules sont cherchées partout sur la page.

`--check` dit, par zone : les lignes dont les deux bords sont retrouvés mot
pour mot, les mots imprimés retrouvés dans notre texte, et nos mots posés sur
une ligne. Ce que le relevé ne garantit pas : une ligne dont un bord n'est pas
retrouvé (une variante de texte) peut commencer un mot trop tôt ou trop
tard ; les réclames et les notes des marges ne sont pas relevées ; Chekalim
et Middot, que nos fichiers ne rangent pas par amoud, n'ont pas de lignes.

## Le pilote sur scan

## Ce qu'il faut

- Python 3 avec `numpy`, `opencv-python` et `Pillow` ;
- `pdftoppm` et `curl` (Poppler : `brew install poppler`) ;
- pour les captures de notre rendu : l'app en marche (`npm run dev`) et le
  Chromium de Playwright (`npx playwright install chromium`).

Les scans et tout ce qu'on en tire d'image restent hors du dépôt, dans un
cache : `~/.cache/petite-jerusalem/layout` (ou `PJ_LAYOUT_CACHE`). **On ne
commite ni image ni PDF** : seulement les fichiers de coupures, qui sont du
texte.

## Les sources

`sources.json` dit d'où vient chaque source et sous quelle licence. Les
scans viennent d'archive.org, marqués « Public Domain Mark 1.0 » :

- le Shas de Vilna de la veuve et des frères Romm (1882 à 1887), numérisé par
  la bibliothèque de l'université Duke ;
- le tikoun soferim de Judah Pisa, _'Ezrat ha-Sofer_ (Amsterdam, 1769),
  numérisé par la Bibliothèque nationale d'Israël.

La Bibliothèque nationale d'Israël et hebrewbooks.org ferment leurs pages aux
programmes (contrôle anti-robot) : on ne les interroge pas.

## La marche

```bash
# 1. Le scan (une fois).
python3 scripts/layout/fetch.py vilna v01
python3 scripts/layout/fetch.py ezrat-hasofer

# 2. La guemara : un passage d'un traité.
python3 scripts/layout/talmud.py berakhot --from 2a --to 2b --review /tmp/relecture

# 3. Le pilote de la Torah sur scan : une paracha du tikoun de Pisa (264
#    colonnes). Rien n'en va dans le dépôt, qui porte le rouleau de 245
#    colonnes (plus haut).
python3 scripts/layout/torah.py 279 --review /tmp/relecture

# 4. Le manifeste des textes, puis les tests.
node scripts/texts-manifest.mjs
npx vitest run src/__tests__/textLayout.test.ts
```

Un traité se déclare dans `sources.json` : son volume, et la page du PDF qui
porte son premier amoud (`firstPage`). Une paracha s'y déclare par les pages
du tikoun qui la portent.

Sans `--write`, rien n'est écrit dans le dépôt : le programme dit seulement,
page par page, ce que vaut le calage (son coût par mot, les lignes douteuses,
les commentaires que l'imprimé ne donne pas dans l'ordre du fichier).

## Relire

Le calage se trompe : il faut le regarder.

```bash
# Chaque ligne du scan à côté des mots que le calage lui donne.
python3 scripts/layout/talmud.py berakhot --from 2a --to 2b --review /tmp/relecture

# Un échantillon tiré au hasard sur tout le passage, pour mesurer.
python3 scripts/layout/talmud.py berakhot --from 2a --to 10b --review /tmp/relecture --sample 44

# Le scan à gauche, notre rendu à droite.
node scripts/layout/capture.mjs http://localhost:5173 /bibliotheque/talmud/berakhot/1 /tmp/rendu
python3 scripts/layout/compare.py talmud berakhot 2a 7a /tmp/rendu --out /tmp/comparaison
```

Sur une planche de relecture, les traits bleus sous l'image sont les mots que
l'analyse a vus ; les traits orange, ceux qu'elle tient pour des renvois de
marge. Une ligne en rouge est une ligne que le calage lui-même trouve
douteuse.

## Les fichiers

| Fichier        | Ce qu'il fait                                                       |
| -------------- | ------------------------------------------------------------------- |
| `fetch.py`     | télécharge une source dans le cache                                 |
| `imaging.py`   | rend une page (`pdftoppm`), en tire l'encre, la redresse            |
| `segment.py`   | les lettres, les gouttières, les lignes, les mots                   |
| `daf.py`       | la page de Vilna : la guemara et les colonnes de commentaire        |
| `align.py`     | le calage des mots vus sur les mots du texte                        |
| `texts.py`     | les mots du texte, comptés comme le lecteur les compte              |
| `talmud.py`    | le pilote : la guemara, Rachi et Tossafot lus sur un scan           |
| `torah.py`     | le pilote : les colonnes d'une paracha lues sur le tikoun de Pisa   |
| `scroll.py`    | les 245 colonnes du Sefer Torah, pour toute la Torah                |
| `vilna.py`     | la page de Vilna ligne pour ligne, lue dans des pages composées     |
| `review.py`    | les planches de relecture                                           |
| `capture.mjs`  | la capture de notre rendu (Playwright)                              |
| `compare.py`   | les images côte à côte                                              |
| `fonts.json`   | la largeur des lettres de chaque caractère, mesurée (`--calibrate`) |
| `sources.json` | les sources, leurs adresses, leurs licences, leurs pages            |

## Ce que le calage ne sait pas faire

- **Les abréviations de la guemara.** Notre texte écrit « הקדוש ברוך הוא » là
  où Vilna imprime « הקב"ה ». Quand l'abréviation finit une ligne, le calage
  laisse parfois un ou deux de ses mots à la ligne suivante.
- **L'ordre des commentaires.** Sefaria range chaque commentaire sous le
  passage qu'il explique ; la page les imprime dans son ordre à elle. Le
  programme replace ceux qu'il reconnaît ; un commentaire court (trois ou
  quatre mots) ne se reconnaît pas toujours.
- **Ce que le fichier porte et que l'imprimé n'a pas** (un doublon, un ajout
  entre crochets) : rangé sous `absent`, il n'appartient à aucune ligne.
- **Les chirot.** Une ligne d'Az yachir tient parfois en un mot au bord de la
  colonne : le calage y est moins sûr que dans la prose.
