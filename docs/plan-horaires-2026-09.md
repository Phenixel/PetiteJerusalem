# Plan d'implémentation : fiabilité des horaires (septembre 2026)

Ce plan met en œuvre les constats de `docs/audit-horaires-2026-09.md`. Il
s'adresse à qui exécute le travail dans une session à part : chaque lot dit
ce qu'il change, dans quels fichiers, quels textes et quels tests, et à quoi
on reconnaît qu'il est fini. Les lots sont indépendants sauf mention ; ils
se livrent dans l'ordre donné, un commit (ou une PR) par lot.

## Principe directeur

Le lieu décide, et chaque avis donne l'heure que son luah imprime là où
l'on est. Un avis n'est pas un jeu de paramètres fixes, c'est une source
(un luah, un calendrier) qui elle-même s'adapte au pays : le calendrier
Rabbi Ovadiah Yosef suit l'Or Ha'Haïm en Israël et l'Amudei Horaah ailleurs,
l'usage de l'allumage change de ville en ville, le calendrier des fêtes et
le tahanoun changent entre Israël et la diaspora. L'application doit donc
tenir, pour chaque avis, une règle PAR RÉGION, choisie d'après la position
(ville du catalogue ou position de l'appareil, `isIsraelPlace` tranche par
le fuseau), sans rien demander à l'utilisateur. Toute décision « garder les
paramètres d'un pays partout » est exclue : ce plan applique ce principe
lot par lot, et un avis ajouté plus tard doit l'appliquer aussi.

## 0. Règles du chantier

- Lire `CLAUDE.md` avant d'écrire une ligne : jamais de tiret long ni
  demi-cadratin, espaces insécables du français (U+202F avant `;`, `!`,
  `?` ; U+00A0 avant `:` et dans les guillemets), commentaires et messages
  de commit en français, identifiants du domaine liturgique en français.
- Partir de `main` une fois la PR 228 fusionnée (elle touche
  `zmanimService.ts`, `zmanimOpinions.ts`, `tachanun.ts`, les trois locales
  et les tests). Si elle ne l'est pas encore, partir de sa branche
  `claude/rav-pozen-schedule-check-nfqf7n`.
- Toute heure attendue dans un test se calcule et se justifie dans le
  commentaire du test (lieu, date, définition), comme les tests existants.
  Aucune valeur « ajustée pour que ça passe ».
- Les trois locales (`src/locales/fr.ts`, `en.ts`, `he.ts`) reçoivent
  chaque nouvelle clé ; `src/__tests__/i18nUsage.test.ts` échoue sinon.
- Avant chaque commit : `npm run verify` (type-check, lint, tests). Les
  tests `typography.test.ts` et `frenchTypography.test.ts` balayent aussi
  la documentation.
- Ne pas toucher au calcul de l'avis du Rav Posen (aube 16,1°, michéyakir
  11,5°, tsét 8,5°, fin des jeûnes 7,083°, Rabbénou Tam 72 minutes fixes)
  hors le lot 2 (arrondi), qui touche tous les avis.

## 1. Une heure d'écart le jour où l'appareil change d'heure (audit 3.1)

**Cause.** Dans `node_modules/@hebcal/core/dist/esm/zmanim.js`, `zdtToDate`
fait `res.setMilliseconds(0)` et `sunriseOffset`/`sunsetOffset` font
`sunset.setSeconds(0, 0)`. Les setters de `Date` reconstruisent l'instant
depuis les champs locaux de l'appareil : dans l'heure ambiguë du retour à
l'heure d'hiver, l'instant saute d'une heure. Reproduction : appareil réglé
sur `America/New_York`, Paris, 1er novembre 2026, `sunrise()` rend 05:37 UTC
au lieu de 06:37.

**Changement.** Poser un correctif local avec `patch-package` (dépendance de
développement, script `postinstall: patch-package`, dossier `patches/`) sur
`@hebcal/core` :

- `zdtToDate` : `return new Date(Math.floor(zdt.epochMilliseconds / 1000) * 1000);`
- `sunriseOffset` et `sunsetOffset`, branche `roundMinute` : calculer
  `const secs = Math.floor((t.getTime() % 60000) / 1000)`, puis
  `t = new Date(Math.floor(t.getTime() / 60000) * 60000)` et, pour un décalage
  positif, `offset++` quand `secs >= 30` (même règle qu'avant, sans setter).
- Le fichier `dist/bundle.js` porte le même code : le patch le couvre aussi,
  ou l'on vérifie qu'aucun import ne passe par lui.

Ouvrir une issue chez `hebcal/hebcal-es6` avec la reproduction (trois lignes)
et le correctif, pour retirer le patch quand une version le porte.

**Test.** `src/__tests__/zmanimDeviceTimezone.test.ts` : Node relit
`process.env.TZ` à l'affectation. Pour chaque fuseau d'appareil de
`["UTC", "America/New_York", "America/Los_Angeles", "Europe/Paris"]`,
poser `process.env.TZ`, vider le cache (`setZmanimOpinion` d'une autre
opinion puis retour, ou exposer `clearZmanimCache`), calculer Paris le
1er novembre 2026 et le 29 mars 2026, et exiger les mêmes instants qu'en UTC
(netz `2026-11-01T06:37:17Z`, fin du Chéma GRA `09:05:32Z`, fin du Chéma MGA
16,1° telle que calculée en UTC). Restaurer `TZ` dans `afterEach`. Le test
doit échouer sans le patch et passer avec.

**Fini quand** : le test ci-dessus passe, `npm ci` applique le patch
(vérifier dans le journal), et `docs/tests.md` mentionne le patch et la
raison.

## 2. Arrondi des heures de fin vers la minute supérieure (audit 3.3)

**Règle.** Une LIMITE (dernier moment pour faire quelque chose) s'arrondit
vers le bas, une FIN (moment à partir duquel une chose devient permise)
vers le haut. L'arrondi se fait au calcul, pas à l'affichage : le décompte,
les rappels, les widgets et la montre lisent alors la même minute que la
page.

**Changement, `src/services/zmanimService.ts`.**

- `ZMAN_DEFS` : ajouter un champ `round: "down" | "up"` par horaire. Vers le
  haut : `tzeit`, `chatzotNight`, `chatzotNightDawn`. Vers le bas : tout le
  reste (`sunrise`, `sunset`, les fins du Chéma et de la Amida, `chatzot`,
  min'ha, plag, aube, michéyakir). Une fonction `roundMinute(date, round)`
  (plancher ou plafond de `getTime()` au multiple de 60 000, jamais un
  setter de `Date`, voir lot 1) s'applique dans `computeZmanimFor` avant de
  pousser dans `times`.
- `restPeriodAt` : `end` et `endRabbenouTam` arrondis vers le haut (le
  Rabbénou Tam de hebcal l'est déjà à la minute ; le plafond est alors sans
  effet). `start` reste l'arrondi vers le bas que hebcal fait déjà.
- `fastAt` : `end` vers le haut, `start` vers le bas.
- `nightfallOf` (bénédiction de la lune, sidour) : vers le haut.
- `chametzAt` (PR 228) : les quatre limites vers le bas.
- `slihotWindow` : `start` vers le haut, `end` vers le bas.
- `formatZmanTime` ne change pas.

**Tests.** Mettre à jour les attendus que l'arrondi déplace, avec la seconde
d'origine en commentaire : à Paris, Tzom Guedalia 5787 finit à 20:44:19,
donc affiché 20:45 ; la sortie du Chabbat du 19 septembre 2026 est 20:42:09,
donc 20:43. Ajouter dans `zmanim.test.ts` un test qui, pour un jour et un
lieu, vérifie que chaque horaire `up` a `getSeconds() === 0` et n'est pas
antérieur à la valeur brute de hebcal, et l'inverse pour `down`. Les tests
de la PR 228 (`zmanimInvariants.test.ts`) doivent continuer de passer : un
plafond ne casse pas l'ordre des horaires, sauf égalité de minute, à
tolérer.

**Fini quand** : aucune heure de fin affichée n'est antérieure à son instant
calculé.

## 3. L'avis du Rav Ovadia Yossef conforme à sa source (audit 3.2, 3.6, 3.7, 3.9)

La source citée dans `zmanimOpinions.ts` est le calendrier Rabbi Ovadiah
Yosef (`ROZmanimCalendar.java`, `ZmanimFactory.java`). Il fait deux choses :
en Israël, le luah Or Ha'Haïm ; hors Israël, par défaut, le luah Amudei
Horaah (Rav Léor Dahan). L'application n'applique qu'Israël, partout, avec
deux paramètres faux. Ce lot rend l'avis fidèle, en deux modes, choisis
d'après la position : c'est décidé, il n'y a pas d'option « Israël
partout » à garder.

### 3a. Le lieu entre dans le calcul de l'opinion

`OpinionZmanim` : chaque fonction reçoit un second paramètre
`ctx: { il: boolean }` (`il` = `isIsraelPlace(place)`), et
`opinionZmanim(opinion)` ne change pas de signature. `zmanimService.ts`
passe `{ il }` partout où il appelle une fonction d'opinion (`computeZmanimFor`,
`restPeriodAt`, `nightfallOf`, `fastAt`, `chametzAt`). Les fonctions de
`POSEN` ignorent `ctx`.

Les champs de description deviennent des règles typées, pour que la note
sous le cadre dise exactement ce que le calcul fait :

```ts
type EndRule =
  | { kind: "degrees"; degrees: number } // sortie des étoiles à n degrés
  | { kind: "fixed"; minutes: number } // n minutes fixes après la chkia
  | { kind: "zmaniyot"; minutes: number } // n minutes zmaniyot après la chkia
  | { kind: "amudeiHoraah" }; // 7,165° sous l'horizon, au moins 20 minutes
```

`restEndRule(ctx)` et `fastEndRule(ctx)` remplacent `restEndMinutes` et
`fastEndMinutes` ; `FastPeriod.endMinutes` devient `endRule: EndRule` ;
`RestTimes.vue` et `FastTimes.vue` traduisent la règle par une clé de locale
par `kind` (`zmanim.rest.exit.degrees`, `.fixed`, `.zmaniyot`,
`.amudeiHoraah`, et de même sous `zmanim.fast.end.*`). Les anciennes clés
`exitAtNightfall`, `exitAfterSunset`, `endStars`, `endAfterSunset` sont
retirées des trois locales.

### 3b. Israël (Or Ha'Haïm), `ctx.il === true`

- **Fin des jeûnes** : `fromSunset(z, 20)` (20 minutes ZMANIYOT), règle
  `{ kind: "zmaniyot", minutes: 20 }`. Source : `getTzeitLChumra()`,
  `20 * (getShaahZmanisGra() / 60)`.
- **Sortie du Chabbat et des fêtes** : chkia + 30 minutes fixes
  (`{ kind: "fixed", minutes: 30 }`). Source : « 30 minutes after sunset in
  Israel », en-tête de `ROZmanimCalendar.java`.
- **Michéyakir** : `fromSunrise(z, -60)`. Source :
  `getMisheyakir60ZmaniyotMinutes`, l'heure du talith ; les 66 sont l'heure
  « de grand besoin ».
- Aube 72 zmaniyot, tsét 13,5 zmaniyot, Rabbénou Tam 72 zmaniyot, Maguen
  Avraham de 72 à 72 zmaniyot, min'ha guedola « la plus tardive », plag
  Yalkout Yossef : inchangés.

### 3c. Hors Israël (Amudei Horaah), `ctx.il === false`

Principe (`getPercentOfShaahZmanisFromDegrees`) : on mesure, au lieu même,
le 17 mars de l'année civile du jour calculé, combien d'heures zmaniyot
(du Gaon) séparent le lever du soleil à n degrés sous l'horizon ; on
applique ce pourcentage à l'heure zmanit du jour demandé.

```ts
// Part d'une heure zmanit qu'occupe la descente du soleil à `degrees`
// sous l'horizon, mesurée à l'équinoxe (17 mars) au même lieu.
function equinoxShare(
  z: Zmanim,
  degrees: number,
  evening: boolean,
): number | null;
```

Se calcule avec un `new Zmanim(gloc, new Date(année, 2, 17, 12), false)` ;
il faut donc la `GeoLocation` : ajouter `gloc` au `ctx`
(`ctx: { il: boolean; gloc: GeoLocation }`), ou exposer une fabrique
`equinoxZmanim(z)` dans `zmanimService`. Mémoïser par lieu et année. Quand
l'angle n'est pas atteint à l'équinoxe (au-delà de 60° de latitude environ)
la fonction rend `null` et l'horaire est absent, comme pour l'avis par
degrés (`zmanimGap` de la PR 228 le signale déjà).

- **Aube** : `sunrise - share(16.04°, matin) × shaahZmanit`.
- **Michéyakir** : la même part × 10/12 (60 minutes sur 72).
- **Tsét ordinaire** : `sunset + share(3.7°, soir) × shaahZmanit`.
- **Fin des jeûnes** : `sunset + share(5.075°, soir) × shaahZmanit`
  (`getTzeitLChumra`, mode Amudei Horaah).
- **Sortie du Chabbat et des fêtes** (`getTzeitShabbatAmudeiHoraah`) : le
  soleil à 7,165° sous l'horizon (`z.tzeit(7.165)`) ; si chkia + 20 minutes
  est plus tard, prendre chkia + 20 ; si le milieu de la nuit solaire est
  plus tôt que 7,165°, prendre le milieu de la nuit. Règle
  `{ kind: "amudeiHoraah" }`.
- **Rabbénou Tam** : le plus tôt de chkia + 72 fixes et chkia + 72 zmaniyot
  (`getTzais72ZmanisAmudeiHoraahLkulah`). `rabbenouTamZmaniyot` devient une
  règle typée elle aussi (`"fixed" | "zmaniyot" | "earliest"`), avec sa clé
  de locale.
- **Maguen Avraham** : inchangé (la source garde
  `getSofZmanShmaMGA72MinutesZmanis` dans ce mode).
- **Plag** : inchangé dans sa formule, mais sur le tsét de ce mode.
- **Min'ha guedola, min'ha ketana** : inchangés.

### 3d. Textes

- `zmanim.opinions.ovadia.hint` (trois locales) décrit les deux modes en une
  phrase chacun. Nom : « Rav Ovadia Yossef (Or Ha'Haïm en Israël, Amudei
  Horaah ailleurs) ».
- La note du cadre du jeûne et du repos suit la règle typée (3a).
- `docs/` : l'en-tête de `zmanimOpinions.ts` est la documentation de
  l'avis ; le réécrire avec les deux modes et les fonctions Java sources.

### 3e. Tests (`zmanimOpinions.test.ts`, `zmanimFasts.test.ts`)

Valeurs à obtenir, tirées de l'audit (avis Ovadia) :

- Paris, Tzom Guedalia lundi 14 septembre 2026 : fin 20:26:57 avant arrondi
  (chkia 20:05:50, heure zmanit 63,3 minutes), donc 20:27 avec le lot 2 ;
  l'ancienne valeur 20:25 (20 fixes) doit échouer.
- Paris, 17 Tamouz jeudi 2 juillet 2026 : la fin doit être 6 à 7 minutes
  plus tard qu'avec 20 minutes fixes.
- Jérusalem, Chabbat 12 septembre 2026 : sortie 19:19 (chkia 18:49 + 30),
  non 19:29.
- Paris, Chabbat 27 juin 2026 : sortie 22:51 (7,165°), non 22:38 ; Londres
  22:21 ; Paris 26 décembre 2026 : 17:44.
- Paris, 21 juin 2026 : michéyakir 60 zmaniyot, plus tard que les 66
  d'avant.
- Aube Amudei Horaah, Paris, 21 juin 2026 : environ 123 minutes avant le
  lever (72 zmaniyot en donnaient 96). Vérifier l'ordre de grandeur, et
  qu'à Jérusalem le 17 mars l'aube Amudei Horaah et l'aube 72 zmaniyot
  coïncident à la minute (la méthode est calibrée pour cela).
- Helsinki, 21 juin 2026 : aube et tsét Amudei Horaah existent (l'équinoxe
  y atteint 16,04°), là où l'avis par degrés n'a rien.
- Tromsø : `equinoxShare` rend `null` pour 16,04° si l'angle n'est pas
  atteint le 17 mars ; sinon les horaires existent.

`zmanimInvariants.test.ts` (PR 228) balaye les deux avis : il doit passer
avec les nouvelles règles (ordre des horaires, sortie après le tsét, fin de
jeûne avant la sortie du Chabbat).

**Fini quand** : sur les lieux ci-dessus, l'application donne les mêmes
heures que les formules du calendrier source, à la minute.

## 4. Tahanoun : deux jours faux (audit 3.4)

`src/services/tachanun.ts`, dans `saidTachanun`, avant l'appel à hebcal :

- **Lendemain de 'Hanouka.** hebcal retire le tahanoun du 25 au « 33 »
  Kislev, ce qui déborde sur le 3 Tévet (Kislev de 30 jours) ou le 4 Tévet
  (Kislev de 29 jours). Règle : si `hd` est en Tévet, jour 3 ou 4, et que
  `getHolidaysOnDate(hd)` n'a aucun événement portant `flags.CHANUKAH_CANDLES`,
  ne pas lire hebcal pour ce jour : `shacharit = true`, et `mincha` suit la
  règle ordinaire (vrai sauf vendredi, et sauf si le lendemain est un jour
  sans tahanoun : réutiliser `saidTachanun(hd.next())` avec l'exception
  `keepsPreviousMincha`).
- **Chouchan Pourim Katan.** Année embolismique, 15 Adar I :
  `{ shacharit: false, mincha: false }` (Choul'han Aroukh, Ora'h 'Haïm
  697, 1 : ni le 14 ni le 15 Adar I). La veille, 14 Adar I, est déjà sans
  tahanoun.

Tests, `src/__tests__/tachanun.test.ts` (créer s'il n'existe pas, sinon
compléter) : 3 Tévet 5787 (13 décembre 2026) `full` ; 4 Tévet 5787 `full` ;
2 Tévet 5787 `none` ('Hanouka) ; dans une année où Kislev a 29 jours (5790 : 'Hanouka
court du 25 Kislev au 3 Tévet), 3 Tévet `none` et 4 Tévet (10 décembre 2029) `full` ; 15 Adar I 5787 (22 février 2027) `none` ; 15 Adar d'une
année ordinaire inchangé.

Le sidour (`dailyCycles.activeOccasions`) et le widget lisent la même
fonction : rien d'autre à changer, mais vérifier `sidourOccasions.test.ts`.

## 5. Allumage des bougies en Israël (audit 3.5, manque 4.3)

`src/services/zmanimService.ts` :

```ts
const CANDLE_LIGHTING_BY_CITY: Record<string, number> = {
  Jérusalem: 40,
  Haïfa: 30,
};
const CANDLE_LIGHTING_ISRAEL_MINUTES = 20;
const CANDLE_LIGHTING_MINUTES = 18;

export function candleLightingMinutes(place: ZmanimPlace): number {
  const local = place.city ? CANDLE_LIGHTING_BY_CITY[place.city] : undefined;
  if (local !== undefined) return local;
  return isIsraelPlace(place)
    ? CANDLE_LIGHTING_ISRAEL_MINUTES
    : CANDLE_LIGHTING_MINUTES;
}
```

Une position d'appareil en Israël (fuseau `Asia/Jerusalem`) suit donc 20.
Le commentaire au-dessus de la table cite les sources (luhot israéliens,
`setCandleLightingOffset(20)` du calendrier Rabbi Ovadiah Yosef pour l'Or
Ha'Haïm, Haïfa 30 chez hebcal et Chabad.org). Petah Tikva, Safed et
Tibériade restent à 20 : usage partagé, c'est le réglage ci-dessous qui
tranche.

**Réglage utilisateur.** Une préférence d'appareil `pj_candle_minutes`
(`devicePreference`, `null` = défaut du lieu), choix parmi 18, 20, 30, 40 :
dans `ZmanimSettings.vue` (app) et dans `ZmanimOpinionModal.vue` (site), sous
l'avis suivi, libellé « Allumage : n minutes avant la chkia (usage du lieu :
n) ». `candleLightingMinutes(place)` lit la préférence d'abord. Le rappel
d'entrée de Chabbat (`zmanReminderService.planRestReminders`) et les
widgets passent par `restPeriodAt`, donc suivent.

Pages SEO (`src/content/zmanimSeoPages.ts`, `jerusalemNote`) : généraliser en
une note quand `minutes !== 18` (« À Haïfa, l'usage est d'allumer 30 minutes
avant la chkia »), clés `cityCandleNote` dans `zmanimGuideStrings.ts` pour
les trois langues ; `zmanimSeoPages.test.ts` à compléter pour Haïfa et Tel
Aviv.

Tests : `candleLightingMinutes` pour Jérusalem (40), Haïfa (30), Tel Aviv
(20), position d'appareil en `Asia/Jerusalem` (20), Paris (18), et la
préférence qui prime.

## 6. Allumages intermédiaires d'un bloc de repos (manque 4.1) et érouv tavchilin (4.2)

`RestPeriod` gagne :

```ts
/** Un allumage à l'intérieur du bloc : chaque soir sauf le premier. */
export interface RestLighting {
  /** Le jour hébraïque qui commence à cet allumage. */
  day: HDate;
  at: Date;
  rule: "beforeSunset" | "afterShabbat" | "afterNightfall";
}
lightings: RestLighting[];
/** Le jour civil où faire l'érouv tavchilin, ou null. */
eruvTavshilin: Date | null;
```

Dans `restPeriodAt`, pour chaque jour `d` de `first` à `last.prev()`, le
soir de `d` ouvre `d.next()` :

- `d.next()` est un Chabbat (`getDay() === 6`) : `beforeSunset`, chkia de `d`
  moins `candleLightingMinutes` (comme `start`), depuis une flamme existante
  si `d` est Yom Tov.
- `d` est un Chabbat et `d.next()` un Yom Tov : `afterShabbat`, à
  `opinion.restEnd` de `d`.
- `d` et `d.next()` sont deux Yom Tov : `afterNightfall`, à `opinion.tzeit`
  de `d` pour le Rav Posen (8,5°), et à la fin de jeûne (tsét le'houmra, 20
  zmaniyot ou 5,075° selon le mode) pour le Rav Ovadia : c'est ce que fait
  `ZmanimFactory` (« Yom Tov going into Yom Tov : getTzeitLChumra »). Ajouter
  pour cela `yomTovLighting(z, ctx)` à `OpinionZmanim`.

Érouv tavchilin : si un jour Yom Tov du bloc a `getDay() === 5` (vendredi)
et que le bloc continue sur le Chabbat, `eruvTavshilin` = le jour civil qui
précède le premier Yom Tov du bloc (mercredi pour jeudi-vendredi, jeudi pour
vendredi seul). Kippour ne tombe jamais un vendredi ; Roch Hachana un
jeudi-vendredi en est le cas le plus fréquent.

`RestTimes.vue` : une ligne par allumage entre l'entrée et la sortie,
libellé « Allumage du 2e soir (après la sortie des étoiles) », « Allumage de
Chabbat (avant la chkia, depuis une flamme) », « Allumage après la sortie du
Chabbat » ; sous la note, « Érouv tavchilin : mercredi 21 avril » quand il y
en a un. Clés `zmanim.rest.lighting.beforeSunset`, `.afterShabbat`,
`.afterNightfall`, `zmanim.rest.eruvTavshilin`, trois locales.
`CalendarPage.vue` affiche les mêmes lignes sous l'entrée du bloc.
`zmanReminderService` : un rappel d'entrée une heure avant chaque allumage
`beforeSunset` du bloc, pas seulement le premier (le rappel existant se
programme par bloc ; le programmer par allumage).

Tests, `zmanimRestLightings.test.ts` (Paris, Rav Posen, avant arrondi) :

- Roch Hachana 5787 (samedi 12 et dimanche 13 septembre 2026) : un allumage
  `afterShabbat` le samedi à la sortie des étoiles, 20:58 (hebcal :
  « Candle lighting: 8:58pm » le 12 septembre).
- Pessah 5787 (jeudi 22 au samedi 24 avril 2027) : `afterNightfall` jeudi
  21:44, `beforeSunset` vendredi 20:35 ; `eruvTavshilin` mercredi 21 avril.
- Chavou'ot 5789 (dimanche 20 et lundi 21 mai 2029, bloc depuis le vendredi
  18) : `afterShabbat` samedi, `afterNightfall` dimanche.
- Un Chabbat ordinaire : `lightings` vide, `eruvTavshilin` null.
- Test de recoupement : pour l'année 5787 à Paris, chaque événement
  `LIGHT_CANDLES_TZEIS` ou `LIGHT_CANDLES` de
  `HebrewCalendar.calendar({ candlelighting: true, candleLightingMins: 18, havdalahDeg: 8.5 })`
  a un allumage dans un bloc de `yearCalendar`, à la même minute.

## 7. Altitude (audit 3.8)

Après le lot 3, parce qu'il ne concerne que l'avis du Rav Ovadia.

- `City` et `ZmanimPlace` gagnent `elevation?: number` (mètres).
  `scripts/generate-cities.mjs` : la source actuelle n'a pas d'altitude ;
  ajouter une table manuelle pour les villes d'Israël (les 35 du catalogue,
  altitude geonames, colonne `dem`), et laisser les autres sans valeur pour
  l'instant. Jérusalem 754, Safed 900, Tibériade -200 (hebcal refuse une
  altitude négative : passer 0).
- `geoLocationOf(place, useElevation)` : `new GeoLocation(name, lat, lon, place.elevation ?? 0, tzid)` ;
  `new Zmanim(gloc, day, useElevation)` avec `useElevation = opinion === "ovadia" && place.elevation !== undefined`.
  Attention : `chatzot()` reste au niveau de la mer chez hebcal, et les
  angles (aube, tsét par degrés) ne dépendent pas de l'altitude ; seuls
  lever, coucher et tout ce qui s'en déduit bougent. `getTemporalHourByDeg`
  n'est pas concerné.
- Position d'appareil : ne pas utiliser l'altitude du GPS (imprécise, souvent
  nulle sur le web) ; la ville la plus proche (`nearestCity`) peut prêter la
  sienne si elle est à moins de `IN_CITY_KM`.
- `zmanim.disclaimer` : « niveau de la mer » devient « niveau de la mer, sauf
  pour l'avis du Rav Ovadia dans les villes d'Israël, qui suit l'altitude du
  lieu ».

Test : Jérusalem, 18 septembre 2026, avis Ovadia : chkia entre 4 et 5
minutes plus tard qu'au niveau de la mer (18:41 devient environ 18:45), et
le tsét, l'allumage et la fin de jeûne décalés d'autant ; avis Posen
inchangé.

## 8. Birkat Halevana sur le molad (audit 3.10)

`src/services/zmanimService.ts` :

```ts
/** La fenêtre de la bénédiction de la lune pour le mois de `hd`. */
export function birkatHalevanaWindow(hd: HDate): { start: Date; end: Date };
```

`start` = `new Molad(année, mois).getInstant()` + 7 jours ;
`end` = molad + 14 jours 18 heures 22 minutes (la moitié de 29 j 12 h 793
'halakim, Choul'han Aroukh Ora'h 'Haïm 426, 3, l'avis retenu par le Rav
Ovadia Yossef). Vérifier d'abord la sémantique de `getInstant()` sur un molad
publié (le molad de Tichri 5787 tel qu'annoncé au Chabbat Mevarekhim ; hebcal
rend `2026-09-11T18:38:06Z`, à confronter à « vendredi 20 h 59 et 1 'helek »
compté depuis 18 h la veille, temps de Jérusalem).

`saysBirkatHalevana(place, hd)` (signature élargie) : vrai si la nuit qui
ouvre `hd`, c'est-à-dire `nightfallOf(place, hd.prev())`, est dans la
fenêtre, avec les deux reports d'usage conservés (Av : pas avant la sortie
de Tich'a beAv ; Tichri : pas avant la sortie de Kippour) et le tsét de
l'avis suivi. `birkatHalevanaLastDay(place, hd)` : le dernier jour
hébraïque dont la nuit d'ouverture précède `end`. Appelants :
`BirkatHalevanaBanner.vue`, `hebrewOccasions.ts` (le commentaire de tête),
le sidour s'il lit la bénédiction (`grep saysBirkatHalevana`).

Tests : Nissan 5787 à Paris, la nuit qui ouvre le 7 Nissan est permise
(molad mardi 28 Adar II 14 h 07, plus 7 jours), la nuit qui ouvre le 14
Nissan ne l'est plus (limite le 13 Nissan vers 8 h 30) ; Tichri 5787 : rien
avant la nuit qui ouvre le 11, permis le 14.

## 9. Calendrier : retirer ce qui n'est pas une fête (audit 3.11)

`yearCalendar`, filtre sur `ev.basename()` avec les constantes
`holidayDesc.LEIL_SELICHOT`, `holidayDesc.ROSH_HASHANA_LABEHEMOT`,
`holidayDesc.CHAG_HABANOT` de `@hebcal/core` (exportées). Test : l'année
5787 à Paris ne porte aucune des trois entrées ; 'Hanouka, Pourim, Tou
biChvat, Lag ba'Omer y restent.

## 10. Kippour et Ta'anit Bekhorot (manques 4.4, 4.5)

- `RestTimes.vue` : quand `period.festivals` contient Kippour (reconnaître
  l'événement par `flags.MAJOR_FAST` et `flags.CHAG` réunis dans
  `restPeriodAt`, exposer `period.fastStarts: boolean`), la ligne d'entrée
  s'intitule « Allumage et début du jeûne ». Clé
  `zmanim.shabbat.candleLightingAndFast`.
- `fastAt` : `FastPeriod.firstbornOnly: boolean` vrai pour Ta'anit Bekhorot
  (`ev.basename() === "Ta'anit Bechorot"`, vérifier l'orthographe dans
  `staticHolidays`). `ZmanimPage.vue` : ce jeûne ne passe jamais devant
  (`fastFirst` faux) et son cadre porte la note « Jeûne des premiers-nés ;
  un siyoum en dispense » (`zmanim.fast.noteFirstborn`). Le cadre du 'hamets
  (PR 228) garde la première place ce jour-là.

## 11. Livraison

Chaque lot : commit en français, sans identifiant de modèle, message qui dit
ce que l'utilisateur voit changer. Une PR par lot ou une PR pour les lots 1
et 2 (touchent tous les avis), une pour le lot 3 (l'avis du Rav Ovadia), une
pour 4, 5, 9, 10 (petits), une pour 6, une pour 7 et 8. Dans chaque
description de PR : les heures avant et après sur Paris et Jérusalem pour un
Chabbat, un jeûne et une fête, pour qu'un relecteur les pose à côté d'un
luah.

Après le dernier lot, relancer la matrice de l'audit (59 lieux, 30 dates,
trois fuseaux d'appareil : la méthode est décrite dans
`docs/audit-horaires-2026-09.md`, section 1) et ajouter ses points fixes
dans `zmanimInvariants.test.ts` : lever et coucher à moins de dix secondes
des valeurs de référence pour cinq villes aux solstices et aux équinoxes.
