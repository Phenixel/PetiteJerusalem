# Traductions des textes : sources libres et couverture

Ce document dit où trouver une traduction **humaine et publiée** de chaque
corpus de la bibliothèque, sous quelle licence, et quelle part du texte elle
couvre. Il sert de registre : une traduction ne s'ajoute à l'app que si elle
figure ici, avec sa licence et la manière de la citer.

Pas de traduction automatique, ni par IA : c'est la règle de départ.

Les versions retenues ci-dessous sont **dans l'app** depuis octobre 2026 :
voir « Dans l'app » pour où elles vivent, comment elles se reconstruisent et
comment le lecteur les montre.

État des lieux d'octobre 2026, mesuré sur l'export public de Sefaria
(`Sefaria-Export/books.json`, généré le 2 octobre 2026).

## La licence de l'app nous ouvre le « non commercial »

L'app et le site sont gratuits, sans publicité ni achat intégré, et publiés
eux-mêmes sous CC BY-NC 4.0. Ils répondent à la définition de
« NonCommercial » de Creative Commons : un usage qui ne vise pas d'abord un
avantage commercial ou une rémunération. Les traductions en **CC BY-NC**
nous sont donc ouvertes, au même titre que le domaine public, CC0, CC BY et
CC BY-SA.

Ce choix nous engage : si l'app devenait payante, portait de la publicité ou
des achats, les traductions NC (Talmud anglais, Tanakh anglais de JPS ou de
Koren) devraient être retirées.

## Couverture, en part des mots hébreux de chaque corpus

Mesure : pour chaque version, la part des mots hébreux (segment par segment,
sur le découpage de Sefaria, celui de nos fichiers) dont le segment a une
traduction non vide.

| Corpus              |  Mots hébreux |    Anglais libre | Français libre |
| ------------------- | ------------: | ---------------: | -------------: |
| Torah               |        70 130 |            100 % |          100 % |
| Neviim              |       125 409 |            100 % |          100 % |
| Ketouvim (Tehilim)  |        76 656 |            100 % |          100 % |
| Mishna (63 traités) |       192 537 |            100 % |           58 % |
| Talmud Bavli (37)   |     1 928 381 |           99,9 % |            0 % |
| Rachi sur la Torah  |       166 480 |           99,7 % |            0 % |
| Hovot Halévavot     |        89 075 |             96 % |            0 % |
| Pélé Yoets          |       233 554 | 7 % (non fiable) |            0 % |
| **Ensemble**        | **2 882 222** |         **92 %** |       **13 %** |

Pour la Torah, la Mishna et le Talmud réunis (2,19 millions de mots) :
**99,9 % en anglais, 8 % en français**. Le Talmud pèse les deux tiers de
toute la bibliothèque : c'est lui qui fait l'écart.

## Les versions retenues

### Anglais

| Corpus               | Version (titre exact dans Sefaria)                                                | Licence                        | Remarques                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Tanakh entier        | The Koren Jerusalem Bible                                                         | CC BY-NC                       | Une seule version pour tout le Tanakh, traduction orthodoxe.                                                |
| Tanakh entier, repli | The Holy Scriptures A New Translation JPS 1917                                    | Domaine public                 | Anglais daté, mais sans aucune condition.                                                                   |
| Torah, autre choix   | Metsudah Chumash, Metsudah Publications, 2009                                     | CC BY                          | Littérale ; la variante « with Onkelos » est en CC BY-NC.                                                   |
| Mishna               | Mishnah Yomit by Dr. Joshua Kulp                                                  | CC BY 3.0                      | Les 63 traités, Avot compris, entièrement remplis.                                                          |
| Talmud Bavli         | William Davidson Edition - English                                                | CC BY-NC 4.0                   | Koren Steinsaltz. Voir plus bas : traduction et explication sont mêlées.                                    |
| Rachi                | Rashi Chumash, Metsudah Publications, 2009                                        | CC BY                          | 99,5 %.                                                                                                     |
| Rachi, autre choix   | Pentateuch with Rashi's commentary by M. Rosenbaum and A.M. Silbermann, 1929-1934 | Domaine public (selon Sefaria) | Œuvre anglaise : aux États-Unis, chaque volume n'y entre que 95 ans après sa parution (le dernier en 2030). |
| Hovot Halévavot      | Duties of the Heart, trans. Rabbi Yosef Sebag                                     | CC BY                          | 75 % ; complété par Hyamson (1925, domaine public) on atteint 96 %.                                         |
| Pélé Yoets           | Sefaria Community Translation                                                     | CC0                            | 7 %, traducteurs anonymes et non relus : pas exploitable.                                                   |

### Français

| Corpus        | Version (titre exact dans Sefaria)                               | Licence        | Remarques                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tanakh entier | Bible du Rabbinat 1899 [fr]                                      | Domaine public | Zadoc Kahn et le Rabbinat, 1899 et 1906 ; transcrite de Wikisource, verset par verset. Seuls Josué 21,36 et 21,37 manquent.                                |
| Tanakh, repli | La Bible, Traduction Nouvelle, Samuel Cahen, 1831 [fr]           | Domaine public | Cahen est mort en 1862 (Sefaria affiche « unknown »).                                                                                                      |
| Mishna        | Le Talmud de Jérusalem, traduit par Moise Schwab, 1878-1890 [fr] | Domaine public | 39 traités : ceux du Talmud de Jérusalem (Zeraïm, Moèd, Nachim, une partie de Nezikin, le début de Nida). Notes de bas de page retirées à la construction. |
| Pirké Avot    | Maximes des Pères, trans. by Rabbi Rivon Krygier, 2023 [fr]      | CC BY-NC       | Traité complet.                                                                                                                                            |

Ce qui manque en français, et pourquoi :

- **Mishna** : tout Kodachim, tout Taharot sauf Nida (chapitres 1 à 4),
  Édouyot. Le Talmud de Jérusalem ne les commente pas, Schwab ne les a donc
  pas traduits. Maasser Chéni n'a que 7 mishnayot sur 57 chez Sefaria (trou
  de numérisation : Schwab l'a traduit en entier).
- **Talmud Bavli** : aucune traduction française libre et structurée. Les
  traductions du XIXe siècle (Chiarini 1831 pour Berakhot ; Rabbinowicz,
  de 1873 à 1880, pour les trois Bava, Sanhédrin et Makot) n'existent qu'en
  scans, souvent abrégées ou réorganisées, et n'ont jamais été alignées sur
  le daf. La traduction intégrale Steinsaltz en français (achevée en juin 2026) est protégée.
- **Rachi** : aucune traduction française avant 1957 ; toutes les éditions
  (Fondation Samuel et Odette Lévy, Colbo, Cerf) sont protégées.
- **Hovot Halévavot** et **Pélé Yoets** : seulement des traductions récentes
  (Chouraqui 1950, Frajerman 2018), protégées.

## Pièges à éviter

- **Jamais les fichiers `merged`** pour une traduction. Ils assemblent,
  segment par segment, des versions aux licences différentes (celui de la
  Genèse commence par du JPS). `scripts/download-texts.mjs` lit aujourd'hui
  `English/merged.json` : pour une traduction, il faut lire le fichier de
  la version choisie, nommé par son titre exact.
- **Sefaria publie aussi des traductions automatiques.** Elles portent
  parfois un « ✧ » dans leur titre (« Sefaria Kli Yakar, 2026 Claude 3.7 »),
  parfois la mention « DeepL » ou « établie à partir de la traduction
  anglaise ». On ne prend que les versions listées ici.
- **« Sefaria Community Translation »** est en CC0 mais anonyme et non
  relue : on ne s'y fie pas, même là où elle est fournie (78 % de la
  Mishna).
- **Talmud anglais de Steinsaltz** : la traduction littérale est en gras
  (`<b>`) et l'explication de Steinsaltz s'y glisse en romain, dans la même
  phrase. Il faut afficher les deux et garder le gras, pas retirer
  l'explication : le gras seul donne un texte haché.
- **Les licences de Sefaria sont déclaratives.** Pour quelques versions,
  seule Sefaria les affiche et l'éditeur ne les confirme nulle part :
  JPS 1985, Metsudah, Sebag. Elles restent utilisables (Sefaria les
  diffuse ainsi depuis des années), mais une version contestée devrait
  sortir de l'app sans délai.

## Citer une traduction

Au pied du texte, une seule ligne : « Traduction : » et le nom de celui qui a
traduit (« Traduction : Moïse Schwab »), rien d'autre. Ni le titre de
l'édition, ni la licence, ni Sefaria, ni ce qu'on a retouché : la page de
lecture reste sobre (décision du propriétaire, octobre 2026).

Le nom est un lien vers la traduction chez Sefaria, dont la page donne
l'édition, l'éditeur et la licence. C'est ce qui nous garde en règle : les
licences CC demandent de citer l'auteur, la licence et les modifications,
mais admettent qu'on le fasse par un lien vers une page qui les porte. Le
fichier de chaque traduction garde, lui, toutes ses sources (`sources` :
nom, auteur, année, éditeur, licence et son lien).

## Pour aller plus loin en français : demander

Le domaine public ne couvrira jamais le Talmud, Rachi ni le moussar en
français. La seule voie est l'autorisation des ayants droit, comme Koren l'a
accordée à Sefaria pour l'anglais :

- **Talmud** : le Steinsaltz Center et Biblieurope, pour la traduction
  française achevée en 2026 ;
- **Mishna** : le Rabbinat (Presses du Temps Présent), ou l'éditeur de la
  Mishna Kehati en français, pour Kodachim et Taharot ;
- **Rachi** : la Fondation Samuel et Odette Lévy, ou Colbo.

Une app gratuite, sans publicité, qui cite et renvoie vers l'éditeur, est la
demande la plus facile à accepter.

## Dans l'app

### Ce qui est intégré

Les versions des deux tableaux ci-dessus, sauf les « repli » et « autre
choix », plus deux compléments pour les fichiers du rayon Talmud qui n'ont
pas de guemara de Babylone :

- **Chekalim** (`talmud/shekalim.json`), qui est du Talmud de Jérusalem :
  Guggenheimer en anglais (« The Jerusalem Talmud », De Gruyter, CC BY) et
  Schwab en français ;
- **Kinim** et **Midot**, qui n'ont que leur michna : Kulp.

Mesuré en lignes du lecteur (un verset, une michna, une phrase de guemara) à
la construction :

| Corpus              | Anglais |                      Français |
| ------------------- | ------: | ----------------------------: |
| Tanakh et Tehilim   |   100 % |                         100 % |
| Michna              |   100 % |  100 % (60 % humain, 40 % IA) |
| Talmud              |  99,6 % | 99,6 % (IA ; Chekalim humain) |
| Rachi (chnei mikra) |  99,5 % |                   99,5 % (IA) |
| 'Hovot Halévavot    |    98 % |                     98 % (IA) |

### La traduction française assistée par IA

Ce qui n'existe qu'en anglais est traduit en français par des agents (Claude
Sonnet), à partir de la traduction anglaise humaine et de l'hébreu, en
suivant `docs/traduction-ia.md` : c'est une première version, à relire. Les
lignes traduites vivent dans `data/traductions-ia/fr/<fichier>`, à la clé de
leur ligne, et `download-translations.mjs` les prend en dernier, après toute
traduction humaine. Le pied du texte le dit : « Traduction : Joshua Kulp
(traduit de l'anglais par IA) ». La licence est celle de la traduction
anglaise d'où elle vient (une adaptation la garde).

`scripts/translate-ia.mjs` découpe le travail en lots et rassemble les
résultats (vérifiés ligne à ligne : complets, en français, gras et italique
gardés, typographie du dépôt) ; un lot refusé repasse au tour suivant. Un
gras ouvert dans un gras redevient l'italique de la source : c'est
l'erreur que les agents font le plus souvent sur un terme translittéré du
Talmud.

Les quelques lignes sans traduction sont celles que l'alignement ne retrouve
pas chez Sefaria (une phrase de guemara découpée autrement) : elles restent
vides plutôt que de recevoir la traduction d'une autre.

### Où elles vivent

`public/texts/traductions/<langue>/`, au chemin du fichier hébreu qu'elles
traduisent (`texts/mishna/berakhot.json` → `texts/traductions/fr/mishna/berakhot.json`),
et un index (`texts/traductions/index.json`) qui donne, pour chaque fichier
hébreu, ses langues. Un fichier de traduction a la forme de son hébreu, chaque
chaîne remplacée par sa traduction, et porte ses sources (nom, auteur,
licence, lien) : c'est lui qui dit comment le citer.

À part de l'hébreu, et non dans le même fichier : qui lit en hébreu ne
télécharge rien de plus, et le Talmud anglais (58 Mo pour l'anglais en tout)
pèse à lui seul plus que tous les textes hébreux. Pour la même raison, l'app
native ne les embarque pas (`scripts/prune-native-bundle.mjs`) : elles se
lisent en ligne.

### Les reconstruire

```bash
node scripts/download-translations.mjs              # tout
node scripts/download-translations.mjs --only=mishna --lang=fr
node scripts/texts-manifest.mjs                     # puis le manifeste
```

Le script lit chaque version par son titre exact (jamais un `merged`), refuse
une licence hors de la liste et un titre qui trahit une traduction
automatique, et aligne chaque ligne hébraïque de nos fichiers sur l'hébreu de
Sefaria par ses seules lettres : nos fichiers redécoupent Sefaria (montées
d'une paracha, Trei Asar, paragraphes du moussar), l'alignement par la
position se tromperait. Ajouter une version, c'est l'ajouter à `VERSIONS` et
`CREDITS` dans le script, et à ce registre.

`src/__tests__/translations.test.ts` tient le reste : chaque fichier a la
forme de son hébreu, chaque section du lecteur a autant de lignes traduites
que de lignes hébraïques, chaque source a une licence de la liste et un lien,
et chaque corpus garde au moins la couverture annoncée plus haut.

### Dans le lecteur

Une commande « Traduction » dans la barre d'outils du texte, et le même
réglage dans les réglages de lecture, avec le choix de la langue quand le
texte en a deux (`composables/useTranslation.ts`). Éteinte au départ, elle
tient ensuite d'un texte à l'autre. La langue suit le choix fait, puis celle
de l'interface, puis ce qui existe : un francophone lit le Talmud en anglais,
et une phrase le lui dit. La traduction se pose sous chaque verset ; dans le
Talmud, la guemara passe alors de son bloc par daf à une suite de phrases,
chacune suivie de la sienne. La lecture du jour et le chnei mikra suivent le
même réglage, Rachi compris. Au pied du texte, le nom du traducteur
(`TranslationCredit.vue`, voir « Citer une traduction »). Pas de traduction sur une tefila.

Une traduction faite par IA est annoncée en tête du texte, dans le lecteur
comme dans la lecture du jour (Rachi compris) : « Traduction en français
faite par IA à partir du texte anglais : elle peut contenir des erreurs »
(`TranslationAiNotice.vue`). Le lecteur la reconnaît au drapeau `ai: true`
que `download-translations.mjs` pose sur sa source ; une version
ancienne de l'app l'ignore. `translations.test.ts` vérifie que toute source
IA, et elle seule, le porte.

### Ce qui reste à faire

- **Le français assisté par IA** est à relire, et à remplacer par une
  traduction humaine dès qu'on en obtient une (voir « Pour aller plus loin
  en français : demander »).
- **Le Pélé Yoets** n'a de traduction libre dans aucune langue.
- **Hors ligne** : télécharger un livre ne télécharge pas sa traduction.
  Hors connexion, la commande ne se propose pas (son index ne se lit pas) ;
  allumée avant la coupure, une phrase dit que la traduction se lit en
  ligne.
- **Le prérendu** des pages de la bibliothèque (référencement) ne porte que
  l'hébreu.

## Comment refaire la mesure

1. Télécharger `https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json`.
2. Pour chaque livre, prendre l'hébreu `merged` et chaque version anglaise ou
   française (une version française porte `"actualLanguage": "fr"` et un
   titre en `[fr]`). Le champ `license` de chaque fichier de version donne
   sa licence.
3. Compter, segment par segment, les mots hébreux dont le segment traduit
   n'est pas vide, et rapporter au total du corpus.
