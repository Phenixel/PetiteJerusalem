# Les coupures de ligne du livre imprimé

Ce dossier tire d'un scan l'endroit où chaque ligne du livre se coupe, et
l'écrit dans `public/texts/talmud-layout/` (la page de Vilna) et
`public/texts/torah-layout/` (les colonnes du Sefer Torah). Le format de ces
fichiers est décrit dans `docs/compatibilite-textes.md`.

Rien n'est transcrit. Le texte, on l'a déjà (`public/texts/`) ; l'image ne
sert qu'à savoir où les lignes se coupent. Aucune lettre n'est lue : on
relève sur l'image les lignes et la largeur de leurs mots, et l'on cale cette
suite de largeurs sur les mots du texte, dont on sait prévoir la largeur dans
le caractère du livre.

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

`sources.json` dit d'où vient chaque scan et sous quelle licence. Toutes
viennent d'archive.org, marquées « Public Domain Mark 1.0 » :

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
python3 scripts/layout/talmud.py berakhot --from 2a --to 10b --write

# 3. La Torah : une paracha, par son numéro.
python3 scripts/layout/torah.py 279 --write

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
| `fetch.py`     | télécharge un scan dans le cache                                    |
| `imaging.py`   | rend une page (`pdftoppm`), en tire l'encre, la redresse            |
| `segment.py`   | les lettres, les gouttières, les lignes, les mots                   |
| `daf.py`       | la page de Vilna : la guemara et les colonnes de commentaire        |
| `align.py`     | le calage des mots vus sur les mots du texte                        |
| `texts.py`     | les mots du texte, comptés comme le lecteur les compte              |
| `talmud.py`    | la guemara, Rachi et Tossafot d'un passage                          |
| `torah.py`     | les colonnes d'une paracha                                          |
| `review.py`    | les planches de relecture                                           |
| `capture.mjs`  | la capture de notre rendu (Playwright)                              |
| `compare.py`   | les images côte à côte                                              |
| `fonts.json`   | la largeur des lettres de chaque caractère, mesurée (`--calibrate`) |
| `sources.json` | les scans, leurs adresses, leurs licences, leurs pages              |

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
