# Audit des horaires (septembre 2026)

Vérification approfondie de la page des horaires et du calendrier des fêtes :
horaires de la semaine, jeûnes, Chabbat et fêtes, sur les deux avis (Rav Posen
et Rav Ovadia Yossef). Chaque horaire calculé par l'application a été comparé
à des outils indépendants, sur 59 lieux du globe (les villes du catalogue plus
des positions d'appareil : La Paz, Quito, Tromsø, Reykjavik, Anchorage,
Katmandou, Lord Howe...), à 30 dates (solstices, équinoxes, jours de changement
d'heure de six pays, tous les jeûnes et fêtes de 5786 à 5788), et sous trois
fuseaux d'appareil (UTC, Auckland, Los Angeles).

Ce document relève ce qui est faux, ce qui manque, et ce qui a été vérifié
sans écart. Il ne corrige rien : chaque point dit où commencer dans le code.
La PR 228 (limites du 'hamets, horaires manquants aux latitudes extrêmes)
est prise en compte : ce qu'elle règle déjà est signalé comme tel.

## 1. Méthode

Outils de comparaison, tous indépendants de hebcal :

- **PyEphem** (éphémérides VSOP87) : lever, coucher, transit, et les angles
  16,1°, 11,5°, 8,5° et 7,083°, avec et sans dépression d'horizon due à
  l'altitude.
- **kosher-zmanim** (port de KosherJava, la référence des luhot anglophones) :
  tous les zmanim nommés, niveau de la mer et altitude.
- **suncalc** : lever, coucher, midi et minuit solaires.
- **pyluach** : les dates du calendrier hébraïque, fêtes et jeûnes observés.
- **Le code source du calendrier « Rabbi Ovadiah Yosef »** (Elyahu Jacobi,
  `ROZmanimCalendar.java` et `ZmanimFactory.java`) : c'est la source que
  `zmanimOpinions.ts` cite pour l'avis du Rav Ovadia, relue ligne à ligne.
- **hebcal lui-même** par un autre chemin : les événements d'allumage et de
  sortie que `HebrewCalendar.calendar` publie, comparés aux blocs de repos de
  `restPeriodAt`.

Ce qui n'a pas pu être fait : hebcal.com, Chabad.org, MyZmanim, le
Consistoire et Torah-Box sont inaccessibles depuis l'environnement (proxy).
L'avis du Rav Posen n'a donc pas été confronté à un luah français imprimé. La
section 5 donne les heures à vérifier à la main dans le calendrier du
Consistoire.

## 2. Ce qui est juste

- **Le moteur solaire.** Lever, coucher, 'hatsot et tous les angles (aube,
  michéyakir, tsét, fin des jeûnes) tombent à moins de 6 secondes de PyEphem
  et de suncalc sur les 1 770 couples lieu/date, pôles compris. Les heures
  zmaniyot (Chéma, Amida, min'ha, plag) sont à moins de 2 secondes de
  kosher-zmanim (hors Auckland, où c'est kosher-zmanim qui lit le mauvais jour
  civil).
- **Les dates.** Fêtes et jeûnes de 5786 à 5788 sont identiques à pyluach,
  reports compris : Ta'anit Esther le jeudi 9 mars 2028 (5788), Tich'a beAv
  jamais un Chabbat, Roch Hachana 5787 samedi 12 septembre.
- **Les fuseaux.** Casablanca repasse à UTC+0 pendant le ramadan (1er mars
  2026 : 18:30, 27 mars : 19:30), Israël change d'heure le vendredi 27 mars
  2026 à 2 h, Katmandou (+5:45) et Lord Howe (+10:30/+11) s'affichent juste.
- **L'indépendance du fuseau de l'appareil.** Les 3 540 lignes calculées
  sous UTC et sous Auckland sont identiques. Une exception, le point 3.1.
- **Les blocs de repos.** Chabbat et Yom Tov accolés se réunissent bien (Roch
  Hachana 5787 : allumage vendredi 11 septembre 19:54 à Paris, sortie
  dimanche 13 à 20:55, comme hebcal), Pessah donne deux blocs, Kippour garde
  sa sortie des étoiles ordinaire.
- **Les jeûnes.** Les six jeûnes ont leurs heures, Tich'a beAv commence la
  veille au coucher du soleil, Kippour reste à son cadre de repos.
- **Le rappel d'avant-chkia côté serveur** (`functions/src/sunsetReminder.ts`)
  reproduit le même NOAA : rien à signaler.

## 3. Erreurs

Par gravité décroissante.

### 3.1 Une heure de décalage le jour où l'APPAREIL change d'heure

Sur l'appareil, le jour du passage à l'heure d'hiver, certains horaires
sortent avec une heure d'écart, pour n'importe quel lieu affiché. Reproduit
avec hebcal seul (6.9.1 et 6.9.2, sa dernière version) :

| Appareil réglé sur  | Lieu affiché | Jour          | Horaire faux                         |
| ------------------- | ------------ | ------------- | ------------------------------------ |
| America/New_York    | Paris        | 1er nov. 2026 | netz 06:37 affiché 05:37 (UTC)       |
| America/New_York    | Paris        | 1er nov. 2026 | fin du Chéma MGA 08:29 affiché 07:44 |
| America/Los_Angeles | Paris        | 1er nov. 2026 | fin du Chéma GRA 09:05 affiché 08:05 |

Cause : `zdtToDate` dans `@hebcal/core/dist/esm/zmanim.js` fait
`res.setMilliseconds(0)` sur la `Date` obtenue de l'instant exact. Or les
setters de `Date` recalculent l'instant depuis les CHAMPS LOCAUX de
l'appareil ; à l'heure ambiguë du retour à l'heure d'hiver (01:00 à 02:00
à New York, qui existe deux fois), JavaScript choisit l'autre occurrence, et
l'instant recule ou avance d'une heure. `sunsetOffset` (l'allumage) et
`sunriseOffset` ont le même défaut avec `setSeconds(0, 0)`. Tout horaire dont
l'instant tombe dans l'heure ambiguë de l'appareil est touché, quel que soit
le lieu affiché.

Impact : un appareil français le 25 octobre 2026 (heure ambiguë 2 h à 3 h,
soit 0 h à 1 h UTC) n'est touché que pour les horaires tombant là (aucun à
Paris ce jour-là, mais 'hatsot de la nuit d'une ville plus à l'ouest) ; un
appareil réglé sur un fuseau américain qui regarde Paris ou Jérusalem l'est
sur le netz, la fin du Chéma et de la Amida. Rare, mais c'est le genre de
« bizarrerie » signalée sans qu'on la retrouve le lendemain.

Correctif : en amont (`hebcal/hebcal-es6`), remplacer `setMilliseconds(0)`
par `new Date(Math.floor(zdt.epochMilliseconds / 1000) * 1000)` et
`setSeconds(0, 0)` par une troncature sur l'epoch ; en attendant, le même
correctif se pose ici par `patch-package` sur les deux fonctions.

### 3.2 Fin des jeûnes selon le Rav Ovadia : 20 minutes FIXES au lieu de zmaniyot

`zmanimOpinions.ts` (`OVADIA_FAST_END_MINUTES`) donne 20 minutes fixes après
la chkia, en citant le calendrier Rabbi Ovadiah Yosef. Ce calendrier fait
autre chose : `getTzeitLChumra()` compte `20 * (shaahZmanisGra / 60)`, soit
20 minutes ZMANIYOT, et `ZmanimFactory` prend cette heure pour la fin de
tous les jeûnes (`FAST_ENDS_ZMAN`). L'écart, application moins luah :

| Lieu         | Jeûne                      | Écart    |
| ------------ | -------------------------- | -------- |
| Paris        | 17 Tamouz 2026 (2 juillet) | -6,8 min |
| Paris        | Tich'a beAv 2026           | -5,8 min |
| Paris        | 10 Tévet 2026 (20 déc.)    | +6,2 min |
| Jérusalem    | 17 Tamouz 2026             | -3,6 min |
| Jérusalem    | 10 Tévet 2026              | +3,2 min |
| Montréal     | 17 Tamouz 2026             | -6,0 min |
| Buenos Aires | 17 Tamouz 2026 (hiver)     | +3,5 min |

En été, l'application fait rompre le jeûne jusqu'à sept minutes trop tôt ;
en hiver, elle fait attendre six minutes de trop. À l'équinoxe (Guedalia,
Esther), l'écart est nul, ce qui explique que les tests, écrits sur Tzom
Guedalia, ne l'aient pas vu. Fichier : `zmanimOpinions.ts`, `fastEnd` de
`OVADIA`, et la note `zmanim.fast.endAfterSunset` qui annonce des minutes
fixes.

### 3.3 Les heures de fin sont tronquées à l'affichage : jusqu'à 59 secondes trop tôt

`formatZmanTime` passe par `Intl.DateTimeFormat`, qui tronque les secondes.
C'est juste pour une LIMITE (fin du Chéma à 10:37:48 affichée 10:37, on est
dans le bon sens), c'est faux pour une FIN : la sortie des étoiles à
20:44:21 s'affiche 20:44, la sortie du Chabbat à 20:42:09 s'affiche 20:42,
la fin du jeûne à 20:44:19 s'affiche 20:44. Sur la matrice, 907 tsét sur
1 742 ont 30 secondes ou plus ; 557 sorties de repos sur 565 et 902 fins de
jeûne sur 912 portent des secondes non nulles. Les luhot arrondissent les
fins à la minute SUPÉRIEURE (le calendrier Rabbi Ovadiah Yosef marque chaque
zman `ROUND_EARLIER` ou `ROUND_LATER` ; hebcal arrondit sa havdala au plus
proche). L'allumage, lui, est déjà arrondi vers le bas par hebcal.

Où : `formatZmanTime` (`zmanimService.ts`) n'a pas la notion de sens ;
`ZMAN_DEFS` pourrait porter, par horaire, s'il s'arrondit vers le haut
(tsét, sortie, fin de jeûne, Rabbénou Tam, 'hatsot de la nuit) ou vers le
bas (le reste), et `RestPeriod.end`, `FastPeriod.end` s'arrondir à la
minute supérieure avant affichage et rappel.

### 3.3 bis Le sens de l'arrondi, relu sur la source

Le plan (lot 2) rangeait sous « limites, arrondies vers le bas » tout ce qui
n'est pas une sortie. Le calendrier Rabbi Ovadiah Yosef, relu zman par zman
(`ROUND_EARLIER` et `ROUND_LATER` de son `ZmanimFactory.java`), en range cinq
de l'autre côté : le talith, le netz, min'ha guedola, min'ha ketana et plag.

Ce n'est pas une contradiction de fond, c'est l'énumération du plan qui
manquait sa propre règle : ces cinq horaires sont des DÉBUTS, premiers moments
où une chose est permise, au même titre qu'une sortie. On ne met pas le talith
deux secondes avant l'heure, on ne prie pas min'ha avant min'ha guedola. Le
sens retenu est donc celui de la source :

| Vers le bas (dernier moment) | Vers le haut (premier moment) |
| ---------------------------- | ----------------------------- |
| aube, fin du Chéma et de la Amida (les deux avis), limites du 'hamets, hatsot, chkia, allumage | talith, netz, min'ha guedola, min'ha ketana, plag, sortie des étoiles, sortie du Chabbat, fin de jeûne, hatsot de la nuit |

L'aube reste vers le bas : elle n'ouvre pas une permission, elle ouvre le jour
du Maguen Avraham, dont les limites se comptent. C'est aussi le sens que la
source lui donne.

Une conséquence visible : le netz s'affiche à la minute supérieure dans la
liste du jour (06:27:44 devient 06:28), mais la plage des Sli'hot, qu'il
FERME, garde la minute inférieure. Le même instant, deux rôles.

### 3.4 Tahanoun : deux jours faux, hérités de hebcal

- **Le lendemain de 'Hanouka.** hebcal retire le tahanoun du 25 au 33 Kislev
  (`range(25, 33)`), sans regarder si Kislev a 29 ou 30 jours. Le 33 Kislev
  déborde sur le 3 Tévet quand Kislev est plein (5787 : dimanche 13 décembre
  2026, « Pas de Ta'hanoun » à tort), et sur le 4 Tévet quand il ne l'est
  pas. Le 3 Tévet 5787 est bien après 'Hanouka (25 Kislev au 2 Tévet).
- **Chouchan Pourim Katan** (15 Adar I, lundi 22 février 2027) : l'application
  dit le tahanoun. Le Choul'han Aroukh (Ora'h 'Haïm 697) l'omet les 14 ET 15
  Adar I ; hebcal ne connaît que le 14.

Où : `tachanun.ts`, qui corrige déjà hebcal sur trois points ; ces deux-là
s'ajoutent à la même liste. Le sidour (`dailyCycles`) lit la même fonction.

Une précision, trouvée en écrivant le correctif : le test ne peut pas porter
sur `flags.CHANUKAH_CANDLES`, comme le plan le proposait. Le DERNIER jour de
'Hanouka (« Chanukah: 8th Day ») ne porte pas ce drapeau, puisqu'on n'y allume
plus rien : la règle aurait rendu le tahanoun au 3 Tévet 5790, qui est
justement ce huitième jour. C'est le nom de l'événement (`basename()`) qui
tranche.

### 3.5 Allumage en Israël : 18 minutes partout sauf Jérusalem

`CANDLE_LIGHTING_BY_CITY` ne connaît que Jérusalem (40). Or :

- **Haïfa** allume 30 minutes avant la chkia (usage établi, retenu par hebcal
  et Chabad.org) ; l'application donne 18.
- **Le reste d'Israël** allume 20 minutes, non 18 : c'est ce qu'impriment les
  luhot israéliens, et le calendrier Rabbi Ovadiah Yosef le dit de l'Or
  Ha'Haïm (« change `setCandleLightingOffset` to 20 if you want to replicate
  the exact times of the Ohr Hachaim calendar »). Sur l'avis du Rav Ovadia,
  l'application annonce donc 2 minutes trop tard dans 33 villes d'Israël.
- **Petah Tikva** est partagée entre l'usage de Jérusalem (40) et 20 ; **Safed
  et Tibériade** suivent 20, sauf qui suit Jérusalem.

Où : `CANDLE_LIGHTING_BY_CITY` et `candleLightingMinutes` (`zmanimService.ts`).
Une position d'appareil en Israël suit aussi 18, faute de nom : la règle
pourrait tenir compte du fuseau (`isIsraelPlace`) et non seulement du nom.

### 3.6 Sortie du Chabbat selon le Rav Ovadia : 40 minutes fixes partout

`OVADIA_REST_END_MINUTES = 40` s'applique en Israël comme ailleurs. Le
calendrier cité fait deux choses différentes :

- **En Israël**, 30 minutes après la chkia (« 30 minutes after sunset in
  Israel »). L'application sort le Chabbat 10 minutes trop tard à Jérusalem,
  toute l'année.
- **Hors Israël**, le calendrier bascule par défaut sur le luah **Amudei
  Horaah** (Rav Léor Dahan, validé par le Rav Yits'hak Yossef), dont la sortie
  est le soleil à 7,165° sous l'horizon, avec un plancher de 20 minutes. C'est
  plus tard que 40 minutes dès qu'on monte en latitude l'été :

| Samedi        | Lieu     | App (chkia + 40) | Amudei Horaah (7,165°) | Écart   |
| ------------- | -------- | ---------------- | ---------------------- | ------- |
| 27 juin 2026  | Paris    | 22:38            | 22:51                  | -13 min |
| 27 juin 2026  | Londres  | 22:01            | 22:21                  | -20 min |
| 27 juin 2026  | Montréal | 21:27            | 21:34                  | -7 min  |
| 26 déc. 2026  | Paris    | 17:39            | 17:44                  | -5 min  |
| 12 sept. 2026 | Paris    | 20:50            | 20:49                  | +1 min  |

L'application relâche donc le Chabbat jusqu'à vingt minutes avant le luah
qu'elle cite, en été, au nord. Où : `restEnd` de `OVADIA`.

### 3.7 Michéyakir selon le Rav Ovadia : l'heure « de grand besoin »

`OVADIA_MISHEYAKIR_MINUTES = 66`. Dans le calendrier cité, 66 minutes
zmaniyot est `getMisheyakir66ZmaniyotMinutes`, documenté « THIS TIME SHOULD
ONLY BE USED FOR PEOPLE IN GREAT NEED » et réservé à l'affichage
hebdomadaire ; l'heure ordinaire du talith est
`getMisheyakir60ZmaniyotMinutes`, 60 minutes zmaniyot. Paris, 21 juin 2026 :
04:17 (app) contre 04:26 (luah) ; Jérusalem, 21 décembre : 05:39 contre
05:44. Où : `misheyakir` de `OVADIA`.

### 3.8 L'altitude est ignorée, y compris là où le luah cité en tient compte

`geoLocationOf` fixe l'altitude à 0 et `useElevation` à false. Pour l'avis
du Rav Posen (les calendriers d'Europe), c'est l'usage. Pour l'Or Ha'Haïm,
ce ne l'est pas : « The Ohr Hachaim calendar uses elevation adjusted sunrise
and sunset for all of its zmanim », et ce coucher décalé porte l'allumage,
le tsét (13,5 zmaniyot après lui), la fin du jeûne et la sortie. Mesuré avec
kosher-zmanim et PyEphem (les deux concordent), coucher plus tard et lever
plus tôt de :

| Lieu          | Altitude   | Décalage      |
| ------------- | ---------- | ------------- |
| Jérusalem     | 754 m      | 4,1 à 4,7 min |
| Safed         | 900 m      | 4,6 à 5,3 min |
| Genève, Berne | 375, 540 m | 3,6 à 5,5 min |
| Denver        | 1 609 m    | 6,7 à 8,0 min |
| Mexico        | 2 240 m    | 6,4 à 7,2 min |
| Bogota        | 2 640 m    | 6,6 à 7,2 min |
| La Paz        | 3 640 m    | 8,1 à 8,9 min |

À Jérusalem sur l'avis du Rav Ovadia, tout ce qui se lit sur la chkia
(allumage, tsét, fin de jeûne, sortie) est donc décalé de plus de quatre
minutes par rapport au luah imprimé. Le catalogue n'a pas d'altitude ;
`cities.json` de hebcal en porte une pour ses villes (Beer Sheva 285,
Ashdod 27...) et geonames, déjà utilisé par `scripts/generate-cities.mjs`,
aussi. La note `zmanim.disclaimer` dit bien « niveau de la mer » : elle
reste vraie, mais elle contredit l'intitulé « Or Ha'Haïm ».

### 3.8 bis L'altitude : le lot 7 est suspendu

Le lot 7 proposait d'activer l'altitude pour l'avis du Rav Ovadia dans les
villes d'Israël, à partir d'une table d'altitudes geonames. La relecture du
calendrier source contredit ce point sur deux plans, et le lot est donc laissé
de côté plutôt qu'appliqué de travers.

**Le sens.** Le calendrier Rabbi Ovadiah Yosef ne met pas l'altitude en Israël,
il l'en RETIRE. Son écran de démarrage écrit `useElevation = !inIsrael`
(`InIsraelActivity.saveInfoAndStartActivity`) : répondre « je suis en Israël »
met l'altitude à zéro. Et la seconde porte d'entrée, quand la position est
clairement hors d'Israël, écrit `useElevation = false` elle aussi
(`GetUserLocationWithMapActivity`). La phrase que l'audit citait, « The Ohr
Hachaim calendar uses elevation adjusted sunrise and sunset for all of its
zmanim », commente `getCandleLighting()` : elle explique pourquoi cette méthode
lit le coucher AJUSTÉ plutôt que celui du niveau de la mer quand l'altitude est
active, non qu'elle le soit toujours. En Israël, le calendrier prend d'ailleurs
son lever de ChaiTables (`getHaNetz`), qui tient compte de l'horizon réel des
montagnes, bien mieux qu'une altitude moyenne.

**La donnée.** Le calendrier source ne porte aucune table d'altitudes : il
interroge geonames.org au moment du calcul, trois fois, et moyenne les
résultats (`LocationResolver.resolveElevation`). L'altitude y est une valeur
PAR POSITION, que l'utilisateur peut aussi saisir à la main
(`SetupElevationActivity`). Les trente-cinq altitudes que le lot demandait
n'existent donc nulle part dans la source, et geonames n'est pas joignable
depuis l'environnement de travail : les inventer serait précisément la
« valeur ajustée pour que ça passe » que le plan interdit.

**Ce que cela coûterait.** Activer l'altitude à Jérusalem recule la chkia de
quatre à cinq minutes, et avec elle l'allumage, le tsét, la fin des jeûnes et
la sortie du Chabbat, pour tous les utilisateurs du pays. Un déplacement de
cette taille ne se pose pas sur une prémisse que la source dément.

**Ce qui serait fidèle**, si le sujet est repris : un réglage d'altitude par
lieu, éteint par défaut, alimenté par une saisie ou par un service d'altitude,
comme le fait la source. C'est une décision de produit, pas une correction
d'audit, et elle sort de ce chantier.

### 3.9 L'avis « Rav Ovadia » applique les paramètres d'Israël au monde entier

Le calendrier cité n'utilise l'Or Ha'Haïm (72 minutes zmaniyot, 13,5, 72)
qu'en Israël ; hors Israël, il bascule sur Amudei Horaah : l'aube et le tsét
sont d'abord mesurés en degrés (16,04° et 3,7°) à l'équinoxe au lieu même,
puis rendus zmaniyot. À Paris, 72 minutes zmaniyot d'aube donnent 96 minutes
avant le lever en juin ; le même calendrier, pour Paris, en donne environ 123. Rabbénou Tam y est le plus tôt de 72 fixes et 72 zmaniyot (le Rav
Ovadia lui-même suivait les zmaniyot), l'application prend toujours les
zmaniyot : 23:35 le 27 juin 2026 à Paris, quand le luah écrirait 23:09.

Ce n'est pas une erreur de calcul, c'est une infidélité à la source citée
dans l'écran de réglage. Décision prise : le lieu décide, et l'avis doit
donner l'heure de son luah là où l'on est, Or Ha'Haïm en Israël et Amudei
Horaah ailleurs (voir `docs/plan-horaires-2026-09.md`, principe directeur
et lot 3).

### 3.9 bis Ce que le lot 3 change pour Paris, et ce que le plan en disait

Le plan donnait, pour éprouver le lot 3, deux heures parisiennes tirées du
tableau du point 3.2 : Tzom Guedalia 2026 à 20:26:57 (vingt minutes zmaniyot)
et le 17 Tamouz « six à sept minutes plus tard » que les vingt minutes fixes.
Ces deux valeurs sont celles de l'Or Ha'Haïm, mesurées avant que le point 3.9
ne soit tranché.

Or Paris n'est pas en Israël : le lot 3 y pose l'Amudei Horaah, et la fin des
jeûnes s'y mesure sur 5,075° à l'équinoxe. Les heures vraies sont donc :

| Paris, avis Rav Ovadia     | 20 fixes (avant) | 20 zmaniyot (Or Ha'Haïm) | Amudei Horaah (retenu) |
| -------------------------- | ---------------- | ------------------------ | ---------------------- |
| Tzom Guedalia, 14 sept. 2026 | 20:25:50       | 20:26:57                 | 20:33:09               |
| 17 Tamouz, 2 juillet 2026    | 22:17:16       | 22:24:05                 | 22:31:58               |

C'est le plan qui se contredisait, non la source : son lot 3c dit bien que
Paris suit l'Amudei Horaah, et le calendrier cité le confirme
(`getTzeitLChumra`, branche `amudehHoraah`). Les tests retiennent les heures de
la colonne de droite, et gardent les deux autres en commentaire pour que la
comparaison reste lisible.

### 3.10 Birkat Halevana : une fenêtre à jours fixes, sans regarder le molad

`saysBirkatHalevana` autorise les nuits qui ouvrent le 8 au 14 du mois. La
règle (sept jours pleins depuis le molad, jusqu'à la moitié de la lunaison,
14 j 18 h 22 min) se compte depuis le molad, et Roch Hodech tombe de zéro à
deux jours après lui. Sur 5787 :

- **Nissan 5787** : molad le mardi 28 Adar II à 14 h 07 ; sept jours plus tard
  tombent le 6 Nissan à 14 h 07, l'application n'ouvre que la nuit du 8. La
  demi-lunaison tombe le 13 Nissan vers 8 h 30 ; l'application autorise
  encore la nuit qui ouvre le 14, une dizaine d'heures après la limite.
- **Tichri 5787** : molad le vendredi 29 Eloul à 20 h 59, sept jours au 7
  Tichri au soir ; la demi-lunaison au 14 Tichri à 15 h. Là, le report après
  Kippour (nuit du 11) et la fin au 14 tombent juste.

Où : `saysBirkatHalevana` et `birkatHalevanaLastDay`. hebcal calcule le
molad (`Molad`) : le début pourrait être « molad + 7 jours » et la fin
« molad + 14 j 18 h 22 min », en heures de Jérusalem, avec l'usage de
l'avis suivi pour l'arrondi.

### 3.10 bis Les dates du point 3.10, recalculées

Le point 3.10 donnait, pour Nissan 5787, une demi-lunaison « le 13 Nissan vers
8 h 30 », et concluait que l'application autorisait une nuit de trop à la fin.
Le molad de hebcal donne autre chose : la limite tombe le 21 avril 2027 à
08:08 (heure de Paris), qui est le 14 Nissan. La nuit qui ouvre le 14 est donc
bien permise, et c'est seulement au DÉBUT que la fenêtre était fausse ce
mois-là : sept jours pleins sont écoulés dès la nuit qui ouvre le 7.

Les autres mois éprouvés penchent dans l'autre sens, le molad y suivant Roch
Hodech de plus près :

| Mois          | Fenêtre du compte en jours | Fenêtre du molad |
| ------------- | -------------------------- | ---------------- |
| Av 5786       | nuits du 8 au 14           | nuits du 8 au 15 |
| Eloul 5786    | nuits du 8 au 14           | nuits du 8 au 15 |
| Tichri 5787   | nuits du 8 au 14           | nuits du 8 au 15 |
| Nissan 5787   | nuits du 8 au 14           | nuits du 7 au 14 |

L'erreur de fond que le point 3.10 relevait est donc bien réelle, et d'un jour
dans les deux sens ; ce sont ses deux dates d'exemple qui étaient décalées.

### 3.11 Le calendrier des fêtes porte des jours qui ne sont pas des fêtes

`CALENDAR_FLAGS` inclut `MINOR_HOLIDAY`, ce qui fait entrer « Lel Selihot »
(23 Eloul, usage ACHKÉNAZE : les Séfarades disent les Sli'hot depuis Roch
Hodech Eloul, et l'application les propose ainsi), « Roch Hachanah
LaBehemot » (1er Eloul) et « Hag HaBanot » (30 Kislev). Dans un calendrier
séfarade, le premier est faux, les deux autres du bruit. Où : `yearCalendar`,
filtre sur `ev.basename()`.

### 3.12 Un marqueur de jour rendu dans le fuseau du lieu

Trouvé en rejouant la matrice, après le chantier (lot 11).

Certains champs ne portent pas une heure mais une DATE : le jour du Chabbat
d'un bloc (`RestPeriod.shabbat`), celui de l'érouv tavchilin, celui d'un jeûne
dont l'aube ne se calcule pas. Ils sont posés au midi LOCAL de la machine
(`civilNoon`, `HDate.greg`), et c'est là leur repère.

Les cadres les passaient à `formatZmanDay`, qui les rend dans le fuseau du
LIEU. Tant que la machine et le lieu sont proches, cela ne se voit pas ; dès
qu'ils s'éloignent, le marqueur recule d'un jour : le midi d'Auckland est
encore la veille au soir à New York. C'est le piège du point 3.1 à l'échelle
du jour plutôt que de l'heure.

Corrigé avec le lot 11 : `formatMarkerDay` relit un marqueur dans son propre
repère, et les deux cadres l'emploient. `CalendarPage` le faisait déjà
correctement, sans le nommer.

## 4. Manques

### 4.1 Les allumages intermédiaires d'un bloc de repos

Un bloc n'a qu'une entrée et qu'une sortie. Or, entre les deux, il y a des
allumages que l'utilisateur cherche, et que hebcal calcule :

- **Le deuxième soir d'un Yom Tov de deux jours** : allumage après la sortie
  des étoiles, depuis une flamme existante. Roch Hachana 5787 : samedi
  12 septembre 2026, 20:58 à Paris. Absent.
- **Le vendredi dans un bloc** : allumage avant la chkia. Pessah 5787 (jeudi,
  vendredi, Chabbat) : vendredi 23 avril 2027, 20:35 à Paris. Absent.
- **Un Yom Tov qui commence samedi soir** : allumage après la sortie du
  Chabbat (Chavou'ot 5789, dimanche 20 mai 2029). Absent.

La note du cadre dit « on allume après la sortie, à partir d'une flamme
déjà allumée », sans donner l'heure. `restPeriodAt` a déjà `first` et
`last` : une liste d'allumages (un par soir, avec sa règle) suffirait.
`HebrewCalendar.calendar({ candlelighting: true })` sert de référence
(événements `LIGHT_CANDLES_TZEIS`).

### 4.2 Erouv tavchilin

Quand un Yom Tov tombe jeudi et vendredi (Pessah 5787) ou vendredi seul, il
faut faire l'érouv tavchilin la veille. Ni la page ni le calendrier ne le
disent ; hebcal marque ces jours (`flags.EREV` avec `YOM_TOV_ENDS` le
vendredi, ou son test `hasEruvTavshilin` côté KosherJava).

### 4.3 Le réglage de l'écart d'allumage

18, 20, 30 ou 40 minutes : c'est l'usage d'une communauté, pas d'une ville
(Petah Tikva en a deux). Un réglage, avec le défaut par lieu de 3.5,
éviterait de trancher à la place de l'utilisateur.

### 4.4 Kippour sans « début du jeûne »

Kippour n'a que le cadre de repos, dont l'entrée s'appelle « Allumage des
bougies ». Qui cherche « à quelle heure commence le jeûne » ne trouve pas le
mot. Une ligne « Début du jeûne » (même heure) dans le cadre, quand le bloc
porte Kippour, lèverait le doute.

### 4.5 Ta'anit Bekhorot pour tout le monde

La veille de Pessah, le jeûne des premiers-nés monte en tête de page comme
un jeûne public, avec une fin « à la sortie des étoiles » que personne ne
suit (le siyoum le lève). Il concerne les premiers-nés seuls ; la PR 228 met
les limites du 'hamets, ce que tout le monde cherche ce jour-là. Le cadre du
jeûne pourrait s'effacer ou se ranger dessous.

## 5. À vérifier à la main dans un luah français

Le Consistoire et Torah-Box étant inaccessibles d'ici, voici les heures de
l'application (avis Rav Posen, Paris, coordonnées 48,8534 / 2,3488) pour le
Chabbat du 18 au 19 septembre 2026, à poser à côté du calendrier imprimé :

| Horaire                                                      | Application   |
| ------------------------------------------------------------ | ------------- |
| Alot haCha'har (16,1°)                                       | 05:55         |
| Michéyakir (11,5°)                                           | 06:25         |
| Netz                                                         | 07:31         |
| Fin du Chéma (Maguen Avraham, 72 min fixes, avant la PR 228) | 10:01         |
| Fin du Chéma (Gaon de Vilna)                                 | 10:37         |
| 'Hatsot                                                      | 13:44         |
| Plag hamin'ha                                                | 18:39         |
| Allumage (chkia 19:57, moins 18)                             | 19:39         |
| Sortie du Chabbat (8,5°, samedi)                             | 20:42         |
| Rabbénou Tam (72 min, samedi)                                | 21:07         |
| Tzom Guedalia, lundi 14 : début / fin (7,083°)               | 05:48 / 20:44 |

Si le calendrier du Consistoire donne une autre sortie que 20:42 ou une autre
fin de jeûne que 20:44, c'est la définition (les degrés) qu'il faut revoir,
pas le calcul.

## 6. Ce que la PR 228 règle déjà

- Le Maguen Avraham du Rav Posen passe de 72 minutes fixes à 16,1° (vérifié :
  la nouvelle valeur est celle de `getSofZmanShmaMGA16Point1Degrees` de
  kosher-zmanim, à 2 secondes près ; l'ancienne s'en écartait de 8 minutes
  en moyenne, jusqu'à 76 à Manchester en juillet).
- Les horaires triés, les faux jeûnes (Yom Kippour Katan, BeHaB) écartés, le
  tahanoun des jours de tachloumin, les horaires manquants expliqués aux
  latitudes où 16,1° n'existe pas (Lille et Londres en juin, Helsinki de
  juin à août, relevés ici aussi), la sortie et le début nullables, les
  limites du 'hamets.

Rien dans cette PR ne touche aux points 3.1 à 3.11 ni à la section 4.

## 7. Ordre suggéré

1. 3.1 (une heure d'écart, patch de deux lignes) et 3.3 (arrondi des fins) :
   ce sont les deux seuls points qui touchent aussi l'avis par défaut.
2. 3.2, 3.6, 3.7 (l'avis du Rav Ovadia ne fait pas ce que sa source fait),
   puis la décision de 3.9.
3. 3.4 et 3.5 (tahanoun, allumage en Israël), petits et sans ambiguïté.
4. 4.1 (allumages intermédiaires), le manque le plus visible.
5. 3.8, 3.10, 3.11, 4.2 à 4.5.
