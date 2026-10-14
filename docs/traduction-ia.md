# Guide de la traduction française assistée par IA

Ce guide est celui que suit chaque agent qui traduit un lot (voir
`scripts/translate-ia.mjs`). Il traduit en français une **traduction anglaise
humaine et publiée** (Steinsaltz, Kulp, Metsudah, Sebag…), ligne par ligne,
en s'aidant de l'hébreu quand le lot le donne. C'est une première version,
relue ensuite : elle doit être fidèle avant d'être élégante.

## Ce qu'on rend

Un lot est un fichier JSON : `{ id, rel, corpus, items: [{ k, en, he? }] }`.
On écrit un seul objet JSON, `{ "<k>": "<traduction française>", … }`, avec
**toutes** les clés `k` du lot, et rien d'autre (ni commentaire, ni clé en
plus). Le JSON doit être valide : un guillemet droit `"` dans le texte
s'échappe (`\"`) ; mieux, une citation prend les guillemets français « ».

## La fidélité

- Traduire le sens de la phrase anglaise, tout le sens, rien que le sens. Ne
  rien ajouter, ne rien résumer, ne rien expliquer de plus que la source.
- L'hébreu (`he`), quand il est là, sert à lever une ambiguïté de l'anglais
  (un nom, un terme, le sujet d'un verbe) ; on traduit quand même l'anglais.
- Les crochets `[ ]` de la source (ce que le traducteur ajoute pour la
  compréhension) restent des crochets, autour des mêmes mots.
- Une ligne qui n'est qu'une référence ou un titre se traduit telle quelle.

## Le gras et l'italique

Seules les balises `<b>…</b>` et `<i>…</i>` existent ; on n'en ajoute
aucune autre, on n'en retire aucune.

- **Talmud (Steinsaltz)** : le gras est la traduction littérale du texte du
  Talmud, le romain l'explication de Steinsaltz. Ce partage fait partie du
  texte : chaque passage en gras de l'anglais devient un passage en gras du
  français, qui traduit les mêmes mots ; le reste reste en romain. Les
  en-têtes `<b>MISHNA:</b>`, `<b>GEMARA:</b>` deviennent `<b>MICHNA :</b>`,
  `<b>GUEMARA :</b>`.
- **Rachi (Metsudah)** : le gras de tête est le passage du verset commenté
  (le dibbour hamat'hil) ; il se traduit et reste en gras.
- L'italique marque un terme hébreu translittéré (`<i>Shema</i>`) : il reste
  en italique, dans sa graphie française (`<i>Chéma</i>`).

## Les noms et les termes

La graphie est celle du site : `ch` pour ש, `ts` pour צ, `ou` pour le son
u, `h` pour ח et כ, `é` pour le e prononcé.

| Anglais                                           | Français                                            |
| ------------------------------------------------- | --------------------------------------------------- |
| Shema                                             | Chéma                                               |
| Shabbat                                           | Chabbat                                             |
| mitzva, mitzvot                                   | mitsva, mitsvot                                     |
| Mishna, Gemara, baraita                           | Michna, Guemara, baraïta                            |
| halakha, aggada                                   | halakha, aggada                                     |
| Torah, Written / Oral Torah                       | Torah, Torah écrite / orale                         |
| the Sages, the Rabbis                             | les Sages                                           |
| Rabbi Eliezer, Rabbi Yehuda, Rav Yosef, Rav Ḥisda | Rabbi Eliézer, Rabbi Yehouda, Rav Yossef, Rav Hisda |
| Rabban Gamliel, Reish Lakish                      | Rabban Gamliel, Rech Lakich                         |
| Beit Shammai, Beit Hillel                         | Beit Chammaï, Beit Hillel                           |
| Pesaḥ, Sukkot, Shavuot                            | Pessah, Souccot, Chavouot                           |
| Rosh HaShana, Yom Kippur                          | Roch Hachana, Yom Kippour                           |
| Hanukkah, Purim                                   | Hanouka, Pourim                                     |
| teruma, ma'aser, ḥalla                            | terouma, maasser (dîme), hala                       |
| priest, kohen                                     | prêtre (cohen quand l'anglais l'écrit)              |
| Levite, Temple, Sanctuary                         | Lévite, Temple, Sanctuaire                          |
| Sanhedrin, court                                  | Sanhédrin, tribunal                                 |
| the Lord (le Tétragramme), God                    | l'Éternel, Dieu                                     |
| the Holy One, Blessed be He                       | le Saint, béni soit-Il                              |
| sela, dinar, zuz, perutah                         | séla, dinar, zouz, prouta                           |
| cubit, handbreadth                                | coudée, palme                                       |

Les personnages bibliques prennent leur nom français : Moïse, Aaron,
Josué, Samuel, David, Salomon, Élie, Élisée, Isaïe, Jérémie, Ézéchiel,
Abraham, Isaac, Jacob, Joseph, Rébecca, Rachel, Léa. Les Sages du Talmud
gardent le leur, translittéré comme ci-dessus.

Les livres de la Bible, dans une référence : Genèse, Exode, Lévitique,
Nombres, Deutéronome, Josué, Juges, I Samuel, II Samuel, I Rois, II Rois,
Isaïe, Jérémie, Ézéchiel, Osée, Joël, Amos, Abdias, Jonas, Michée, Nahoum,
Habacuc, Sophonie, Aggée, Zacharie, Malachie, Psaumes, Proverbes, Job,
Cantique des cantiques, Ruth, Lamentations, Ecclésiaste, Esther, Daniel,
Ezra, Néhémie, I Chroniques, II Chroniques. La référence garde sa forme :
« (Deutéronome 6:7) ».

Une citation de la Torah se traduit dans la langue de la Bible du Rabbinat,
qui est celle du site : on tutoie (« Tu aimeras l'Éternel, ton Dieu »).

## La typographie

- Pas de tiret long, ni cadratin ni demi-cadratin : deux-points pour une
  explication, virgules ou parenthèses pour une incise, point-virgule entre
  deux propositions.
- Guillemets français « » pour une citation, apostrophe droite `'`.
- Des espaces ordinaires partout : les espaces insécables (avant `:` `;`
  `!` `?`, dans « ») sont posées ensuite par le script.
