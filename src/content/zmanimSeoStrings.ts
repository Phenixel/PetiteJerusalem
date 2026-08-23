/**
 * Tout le texte des pages d'horaires, du calendrier et des pages de fête,
 * dans les trois langues.
 *
 * Ces pages sont engendrées : leurs phrases sont donc des gabarits, qui
 * reçoivent une ville, une heure, un nom de fête. Les sortir du module de
 * construction (zmanimSeoPages.ts) permet d'en avoir trois jeux sans tripler
 * le code qui les assemble.
 *
 * Chaque langue est écrite, pas transposée : on cherche « shabbat times in
 * Manchester » et « זמני שבת בירושלים », pas la traduction littérale de
 * « horaires de Chabbat à ».
 */

import type { SeoLocale } from "./seoLocales";

/** Les chemins vers lesquels les pages renvoient, dans leur propre langue. */
export type ZmanimLinks = {
  horaires: string;
  calendrier: string;
  zmanim: string;
  paracha: string;
};

/** Une question et sa réponse, telles qu'elles partent en FAQPage. */
export type Faq = { q: string; a: string };

export type ZmanimStrings = {
  /** L'étiquette Intl, pour le format des dates et des heures. */
  intl: string;
  /** Le premier maillon du fil d'Ariane. */
  breadcrumbHome: string;

  // ---- vocabulaire commun ----
  /** « Chabbat Ki Tétsé », « Shabbat Ki Tetze », « שבת כי תצא ». */
  shabbatOf: (name: string) => string;
  /** Le mot « Chabbat » seul. */
  shabbat: string;
  /** « ven. 28 août à 20:23 » : la date et l'heure, reliées. */
  at: (date: string, time: string) => string;
  /** « du 2 au 9 avril 2026 ». */
  range: (from: string, to: string) => string;
  /** Le libellé d'un lien vers la page d'une ville. */
  cityLink: (city: string) => string;
  /** « (à 12 km) » sous un lien de ville proche. */
  distance: (km: number) => string;

  // ---- /horaires ----
  hubTitle: string;
  hubDescription: string;
  hubH1: string;
  hubLead: (city: string) => string;
  restHead: [string, string, string];
  hubRestTitle: (city: string) => string;
  hubRestNote: (city: string) => string;
  zmanimHead: [string, string, string];
  zmanimTitle: (city: string, day: string) => string;
  zmanimIntro: (city: string, day: string) => string;
  zmanimGuideNote: (link: string) => string;
  parashaTitle: string;
  parashaIntro: (link: string) => string;
  parashaHead: [string, string, string];
  featuredTitle: string;
  featuredIntro: string;
  directoryTitle: string;
  directoryIntro: string;
  countryHeading: (where: string) => string;
  festivalsTitle: string;
  festivalsHtml: (links: ZmanimLinks, festivalPath: (slug: string) => string) => string;
  hubFaqHeading: string;

  // ---- /horaires/<ville> ----
  cityTitle: (city: string) => string;
  cityDescription: (city: string) => string;
  cityH1: (city: string) => string;
  cityLead: (city: string, minutes: number) => string;
  cityRestTitle: (city: string) => string;
  cityRestNote: (city: string, minutes: number, links: ZmanimLinks) => string;
  cityJerusalemNote: (city: string) => string;
  cityZmanimIntro: (city: string, day: string) => string;
  neighboursTitle: (city: string) => string;
  neighboursIntro: (city: string, where: string) => string;
  cityFaqHeading: (city: string) => string;

  // ---- questions communes aux horaires ----
  faqShabbatStart: (city: string, day: string, time: string, minutes: number) => Faq;
  faqShabbatEnd: (city: string, day: string, time: string) => Faq;
  faqHowComputed: (city: string, minutes: number) => Faq;
  faqJerusalem: Faq;
  faqOffline: Faq;
  faqParasha: (parasha: string, date: string) => Faq;
  faqSunrise: (where: string, day: string, time: string) => Faq;
  faqShema: (where: string, day: string, time: string) => Faq;
  faqShkiaTzeit: (where: string, day: string, shkia: string, tzeit: string) => Faq;
  /** « à Paris », « in Paris », « בפריז » : le lieu, tel qu'il s'insère. */
  inCity: (city: string) => string;

  // ---- /calendrier ----
  calendarTitle: string;
  calendarDescription: (from: number, to: number) => string;
  calendarH1: (fromYear: number, toYear: number, from: number, to: number) => string;
  calendarLead: string;
  calendarHead: [string, string, string, string];
  calendarOpeningTitle: (year: number) => string;
  calendarNextTitle: (year: number) => string;
  multiYearTitle: (years: number) => string;
  multiYearIntro: string;
  multiYearHead: string;
  festivalListTitle: string;
  festivalListItem: (label: string) => string;
  calendarShabbatTitle: string;
  calendarShabbatHtml: (links: ZmanimLinks) => string;
  calendarFaqHeading: string;

  // ---- /calendrier/<fete> ----
  festivalTitle: (label: string) => string;
  festivalDescription: (label: string, years: number, from: number, hasTimes: boolean) => string;
  festivalH1: (label: string) => string;
  festivalWhenTitle: (label: string) => string;
  festivalHead: [string, string, string];
  festivalSplitNote: (label: string) => string;
  festivalTimesNote: (links: ZmanimLinks) => string;
  festivalNoTimesNote: (links: ZmanimLinks) => string;
  festivalAroundTitle: (label: string) => string;
  festivalAroundHtml: (links: ZmanimLinks) => string;
  festivalFaqHeading: (label: string) => string;
  faqWhenFestival: (
    label: string,
    year: number,
    start: string,
    startTime: string,
    end: string,
    endTime: string,
    city: string,
  ) => Faq;
  faqWhenHanukkah: (label: string, year: number, eve: string, range: string) => Faq;
  faqWhenFast: (label: string, year: number, when: string, kind: "dawn" | "eve") => Faq;
  faqWhenPlain: (label: string, year: number, when: string) => Faq;
  faqFestivalWork: (label: string, hasTimes: boolean, isFast: boolean) => Faq;
  faqFestivalCity: (label: string) => Faq;
  /** Les intros des pages de fête, par slug français (la clé stable). */
  festivalIntro: Record<string, string>;
};

/** Le jeu de chaînes d'une langue. */
export type ZmanimStringsByLocale = Record<SeoLocale, ZmanimStrings>;

const FR: ZmanimStrings = {
  intl: "fr-FR",
  breadcrumbHome: "Accueil",

  shabbatOf: (name) => `Chabbat ${name}`,
  shabbat: "Chabbat",
  at: (date, time) => `${date} à ${time}`,
  range: (from, to) => `du ${from} au ${to}`,
  cityLink: (city) => `Horaires de Chabbat à ${city}`,
  distance: (km) => `(à ${km} km)`,

  hubTitle: "Horaires de Chabbat : allumage, sortie et zmanim du jour | Petite Jérusalem",
  hubDescription:
    "L'heure d'allumage des bougies et de sortie de Chabbat semaine par semaine, et tous les zmanim du jour (alot, netz, fin du Chéma, chkia, tsét haKokhavim), calculés pour votre ville. Gratuit, hors ligne.",
  hubH1: "Horaires de Chabbat : allumage des bougies et sortie",
  hubLead: (
    city,
  ) => `L'heure d'<strong>entrée de Chabbat</strong> (allumage des bougies, 18 minutes avant le
      coucher du soleil) et l'heure de <strong>sortie de Chabbat</strong> (sortie des étoiles,
      havdala), semaine par semaine. Les horaires ci-dessous sont calculés pour ${city} ; ouvrez la
      page dans l'application pour votre ville ou votre position exacte, même hors ligne.`,
  restHead: ["Chabbat ou fête", "Entrée (allumage)", "Sortie"],
  hubRestTitle: (city) => `Prochains horaires de Chabbat et des fêtes à ${city}`,
  hubRestNote: (
    city,
  ) => `Ces horaires valent pour ${city} (entrée 18 minutes avant la chkia, sortie aux
      étoiles). Pour une autre ville, voir l'annuaire ci-dessous, ou ouvrez la page dans
      l'application : elle calcule les mêmes horaires sur votre appareil, à partir de votre
      position ou d'une ville choisie.`,
  zmanimHead: ["Horaire", "Heure", "Ce qu'il marque"],
  zmanimTitle: (city, day) => `Les zmanim du jour à ${city} (${day})`,
  zmanimIntro: (
    city,
    day,
  ) => `Les horaires halakhiques de la journée : l'aube, le lever du soleil, les
      limites du matin, l'après-midi, la nuit. Le tableau est celui du ${day} à ${city} ;
      l'application recalcule celui d'aujourd'hui, pour le lieu de votre choix.`,
  zmanimGuideNote: (link) => `Ce que veut dire chaque horaire, opinion par opinion : voir
      <a href="${link}">les zmanim expliqués</a>.`,
  parashaTitle: "Paracha de la semaine, Chabbat par Chabbat",
  parashaIntro: (
    link,
  ) => `La paracha lue à chacun des prochains Chabbats, avec l'heure d'allumage. Chaque
      nom mène au texte complet dans la bibliothèque, et le calendrier complet des 54 parachiot
      est sur la page <a href="${link}">paracha de la semaine</a>.`,
  parashaHead: ["Paracha", "Chabbat", "Allumage"],
  featuredTitle: "Horaires de Chabbat des grandes communautés",
  featuredIntro: "L'heure d'allumage et de sortie de Chabbat pour les villes les plus consultées :",
  directoryTitle: "Toutes les villes, pays par pays",
  directoryIntro: `Chaque ville a sa page, avec ses horaires d'entrée et de sortie de Chabbat calculés à
      ses coordonnées et ses zmanim du jour.`,
  countryHeading: (where) => `Horaires de Chabbat ${where}`,
  festivalsTitle: "Fêtes juives",
  festivalsHtml: (
    links,
    festivalPath,
  ) => `<p>Voir le <a href="${links.calendrier}">calendrier des fêtes juives</a> : les dates de toutes
      les fêtes de l'année, avec leurs heures d'entrée et de sortie, et une page par fête
      (<a href="${festivalPath("roch-hachana")}">Roch Hachana</a>,
      <a href="${festivalPath("yom-kippour")}">Yom Kippour</a>,
      <a href="${festivalPath("pessah")}">Pessah</a>,
      <a href="${festivalPath("hanouka")}">Hanouka</a>).</p>`,
  hubFaqHeading: "Questions fréquentes sur les horaires de Chabbat",

  cityTitle: (city) =>
    `Horaires de Chabbat à ${city} : allumage, sortie et zmanim | Petite Jérusalem`,
  cityDescription: (city) =>
    `L'heure d'allumage des bougies (entrée de Chabbat) et l'heure de sortie de Chabbat à ${city}, semaine par semaine, et tous les zmanim du jour : netz, fin du Chéma, chkia, tsét haKokhavim. Gratuit, hors ligne.`,
  cityH1: (city) => `Horaires de Chabbat à ${city}`,
  cityLead: (
    city,
    minutes,
  ) => `L'heure d'<strong>entrée de Chabbat à ${city}</strong> (allumage des bougies,
      ${minutes} minutes avant le coucher du soleil) et l'heure de <strong>sortie de
      Chabbat</strong> (sortie des étoiles, havdala), semaine par semaine, ainsi que les fêtes à
      venir et tous les zmanim du jour à ${city}, même hors ligne.`,
  cityRestTitle: (city) => `Entrée et sortie de Chabbat à ${city}`,
  cityRestNote: (
    city,
    minutes,
    links,
  ) => `Entrée calculée ${minutes} minutes avant la chkia de ${city}, sortie à
      la sortie des étoiles. Voir aussi l'annuaire des
      <a href="${links.horaires}">horaires de Chabbat ville par ville</a> et le
      <a href="${links.calendrier}">calendrier des fêtes juives</a>.`,
  cityJerusalemNote: (
    city,
  ) => `A ${city}, l'usage est d'allumer 40 minutes avant le coucher du soleil, et non
      18 comme dans la plupart des communautés : les heures ci-dessus suivent cet usage.`,
  cityZmanimIntro: (
    city,
    day,
  ) => `Les horaires halakhiques de la journée à ${city} : alot haCha'har, le netz,
      la fin du Chéma et de la Amida, 'hatsot, min'ha, la chkia et le tsét haKokhavim. Le tableau
      est celui du ${day} ; l'application recalcule celui d'aujourd'hui sur votre appareil.`,
  neighboursTitle: (city) => `Villes proches de ${city}`,
  neighboursIntro: (
    city,
    where,
  ) => `Les horaires changent de quelques minutes d'une ville à l'autre. Les plus
      proches de ${city}, ${where} et alentour :`,
  cityFaqHeading: (city) => `Questions fréquentes sur les horaires de Chabbat à ${city}`,

  inCity: (city) => `à ${city}`,
  faqShabbatStart: (city, day, time, minutes) => ({
    q: `A quelle heure commence Chabbat à ${city} cette semaine ?`,
    a: `Le prochain Chabbat à ${city} commence le ${day} avec l'allumage des bougies à ${time}, soit ${minutes} minutes avant le coucher du soleil.`,
  }),
  faqShabbatEnd: (city, day, time) => ({
    q: `A quelle heure se termine Chabbat à ${city} ?`,
    a: `Chabbat se termine à la sortie des étoiles (tsét haKokhavim), le moment de la havdala. Le prochain Chabbat à ${city} se termine le ${day} à ${time}.`,
  }),
  faqHowComputed: (city, minutes) => ({
    q: `Comment les horaires de Chabbat de ${city} sont-ils calculés ?`,
    a: `L'entrée est fixée ${minutes} minutes avant la chkia (le coucher du soleil) aux coordonnées de ${city}, la sortie à la tombée de la nuit (sortie des étoiles). Le calcul astronomique se fait sur votre appareil, gratuitement et même hors ligne, et la page affiche aussi tous les zmanim du jour.`,
  }),
  faqJerusalem: {
    q: "Pourquoi l'heure d'allumage est-elle différente à Jérusalem ?",
    a: "A Jérusalem, l'usage est d'allumer 40 minutes avant le coucher du soleil, et non 18 : la page des horaires de Jérusalem applique cet usage. Partout ailleurs, le calcul reste de 18 minutes avant la chkia.",
  },
  faqOffline: {
    q: "Peut-on consulter les horaires de Chabbat hors ligne ?",
    a: "Oui. Tous les horaires sont calculés sur l'appareil, sans connexion : la page fonctionne hors ligne, et l'application propose aussi un widget d'écran d'accueil avec les horaires du jour. C'est entièrement gratuit.",
  },
  faqParasha: (parasha, date) => ({
    q: "Quelle est la paracha de cette semaine ?",
    a: `Le Chabbat du ${date}, on lit Parachat ${parasha}. Le tableau des semaines à venir donne la paracha de chaque Chabbat, avec un lien vers son texte.`,
  }),
  faqSunrise: (where, day, time) => ({
    q: `A quelle heure est le netz haHama (lever du soleil) ${where} ?`,
    a: `Le ${day}, le netz haHama ${where} est à ${time}. C'est l'heure à partir de laquelle se dit la prière de Cha'harit selon le meilleur usage (vatikin). La page des horaires recalcule le netz du jour sur votre appareil.`,
  }),
  faqShema: (where, day, time) => ({
    q: `A quelle heure se termine le Chéma du matin ${where} ?`,
    a: `Le ${day}, la fin du Chéma ${where} est à ${time} selon le Gaon de Vilna, et un peu plus tôt selon le Maguen Avraham. Les deux opinions sont affichées côte à côte sur la page des horaires.`,
  }),
  faqShkiaTzeit: (where, day, shkia, tzeit) => ({
    q: `Quelle différence entre la chkia et le tsét haKokhavim ${where} ?`,
    a: `La chkia est le coucher du soleil (${shkia} le ${day} ${where}), le tsét haKokhavim la sortie des étoiles, quand la nuit est faite (${tzeit}). Entre les deux se place le bein hachmachot, dont le statut est douteux : c'est pourquoi Chabbat commence avant la chkia et se termine au tsét.`,
  }),

  calendarTitle:
    "Calendrier des fêtes juives : dates, entrée et sortie de chaque fête | Petite Jérusalem",
  calendarDescription: (from, to) =>
    `Les dates des fêtes juives ${from}-${to} : Roch Hachana, Yom Kippour, Souccot, Hanouka, Pourim, Pessah, Chavouot et les jeûnes, avec l'heure d'entrée et de sortie de chaque fête.`,
  calendarH1: (fromYear, toYear, from, to) =>
    `Calendrier des fêtes juives ${fromYear}-${toYear} (${from}-${to})`,
  calendarLead: `Les dates de toutes les fêtes et de tous les jeûnes de l'année hébraïque, avec, pour chaque
      fête où le travail est interdit, l'heure d'entrée (allumage) et l'heure de sortie. Les
      heures ci-dessous sont calculées pour Paris ; l'application les calcule pour votre ville,
      même hors ligne.`,
  calendarHead: ["Fête", "Dates", "Entrée", "Sortie"],
  calendarOpeningTitle: (year) => `Prochaines fêtes de l'année ${year}`,
  calendarNextTitle: (year) => `Fêtes de l'année ${year}`,
  multiYearTitle: (years) => `Dates des grandes fêtes juives sur ${years} ans`,
  multiYearIntro: `Le premier jour de chaque fête, année hébraïque par année hébraïque : une même année
      hébraïque court sur deux années civiles, les cellules portent donc la leur. Chaque fête a
      sa page, avec ses dates et ses heures d'entrée et de sortie.`,
  multiYearHead: "Fête",
  festivalListTitle: "Une page par fête",
  festivalListItem: (label) => `Dates de ${label}`,
  calendarShabbatTitle: "Chabbat, semaine par semaine",
  calendarShabbatHtml: (
    links,
  ) => `<p>Pour l'heure d'allumage des bougies et la sortie de Chabbat chaque semaine,
      ainsi que tous les zmanim du jour, voir les <a href="${links.horaires}">horaires de
      Chabbat</a>, ville par ville, et <a href="${links.zmanim}">les zmanim expliqués</a>.</p>`,
  calendarFaqHeading: "Dates des prochaines fêtes juives",

  festivalTitle: (label) => `${label} : dates, heure d'entrée et de sortie | Petite Jérusalem`,
  festivalDescription: (label, years, from, hasTimes) =>
    hasTimes
      ? `Quand tombe ${label} ? Les dates de ${label} sur ${years} ans à partir de ${from}, avec l'heure d'entrée et de sortie de la fête, et ce qu'on y fait.`
      : `Quand tombe ${label} ? Les dates de ${label} sur ${years} ans à partir de ${from}, en dates civiles et hébraïques, et ce qu'on y fait.`,
  festivalH1: (label) => `${label} : dates, entrée et sortie`,
  festivalWhenTitle: (label) => `Quand tombe ${label} ?`,
  festivalHead: ["Année", "Dates", "Date hébraïque"],
  festivalSplitNote: (
    label,
  ) => `${label} compte deux blocs de fête, séparés par le 'Hol haMoed (les jours
      intermédiaires, où le travail est permis) : l'heure d'entrée est celle du premier jour, la
      sortie celle du dernier.`,
  festivalTimesNote: (
    links,
  ) => `Les heures d'entrée et de sortie sont calculées pour Paris. Pour votre ville,
      voir les <a href="${links.horaires}">horaires ville par ville</a> : l'application les
      recalcule à vos coordonnées, même hors ligne.`,
  festivalNoTimesNote: (
    links,
  ) => `Le travail n'est pas interdit ce jour-là : il n'a donc pas d'heure d'entrée
      ni de sortie comme Chabbat. Pour les horaires de la journée (l'aube, le netz, la sortie des
      étoiles) à votre ville, voir les <a href="${links.horaires}">horaires</a>.`,
  festivalAroundTitle: (label) => `Autour de ${label}`,
  festivalAroundHtml: (
    links,
  ) => `<p>Voir le <a href="${links.calendrier}">calendrier complet des fêtes juives</a>,
      les <a href="${links.horaires}">horaires de Chabbat et des fêtes</a> et
      <a href="${links.zmanim}">les zmanim expliqués</a> (l'aube, le netz, la chkia, la sortie
      des étoiles), qui donnent le sens des heures de ce tableau.</p>`,
  festivalFaqHeading: (label) => `Questions fréquentes sur ${label}`,
  faqWhenFestival: (label, year, start, startTime, end, endTime, city) => ({
    q: `Quand tombe ${label} ${year} ?`,
    a: `${label} ${year} commence le ${start} au soir (entrée à ${startTime} à ${city}) et se termine le ${end} à la tombée de la nuit (${endTime} à ${city}).`,
  }),
  faqWhenHanukkah: (label, year, eve, range) => ({
    q: `Quand tombe ${label} ${year} ?`,
    a: `La première bougie de ${label} ${year} s'allume le ${eve} au soir ; la fête dure huit jours, ${range}.`,
  }),
  faqWhenFast: (label, year, when, kind) => ({
    q: `Quand tombe ${label} ${year} ?`,
    a:
      kind === "dawn"
        ? `${label} ${year} tombe ${when} : on jeûne de l'aube (alot haCha'har) à la sortie des étoiles.`
        : `${label} ${year} tombe ${when} : le jeûne commence la veille au coucher du soleil et se termine à la sortie des étoiles, vingt-cinq heures plus tard.`,
  }),
  faqWhenPlain: (label, year, when) => ({
    q: `Quand tombe ${label} ${year} ?`,
    a: `${label} ${year} a lieu ${when} (la journée commence la veille au soir).`,
  }),
  faqFestivalWork: (label, hasTimes, isFast) => ({
    q: `${label} est-il un jour où le travail est interdit ?`,
    a: hasTimes
      ? `Oui : ${label} est un Yom Tov, le travail y est interdit comme à Chabbat, avec une entrée (allumage des bougies) et une sortie données dans le tableau ci-dessus. En diaspora, les jours de fête sont doublés.`
      : isFast
        ? `Non : ${label} est un jour de jeûne, pas un Yom Tov ; le travail y reste permis.`
        : `Non : ${label} n'est pas un jour de Yom Tov, le travail y reste permis. La journée a ses usages propres, mais pas d'entrée ni de sortie comme Chabbat.`,
  }),
  faqFestivalCity: (label) => ({
    q: `Comment connaître l'heure exacte de ${label} dans ma ville ?`,
    a: `Les heures ci-dessus sont calculées pour Paris. Ouvrez les horaires dans l'application, ou la page d'horaires de votre ville, pour l'heure d'entrée et de sortie à vos coordonnées, calculée sur votre appareil et même hors ligne.`,
  }),
  festivalIntro: {
    "roch-hachana":
      "Roch Hachana est le nouvel an juif et le jour du jugement : deux jours de fête, le 1er et le 2 Tichri, où l'on sonne le chofar, où l'on mange des simanim (la pomme dans le miel, la tête de poisson) et où la prière est plus longue que de coutume.",
    "jeune-guedalia":
      "Le jeûne de Guedalia, le 3 Tichri, suit Roch Hachana : il rappelle l'assassinat de Guedalia ben Ahikam, dernier gouverneur juif après la destruction du premier Temple. On jeûne de l'aube à la sortie des étoiles.",
    "yom-kippour":
      "Yom Kippour, le 10 Tichri, est le jour du Grand Pardon : un jeûne de vingt-cinq heures, de l'entrée de la fête au soir jusqu'à la sortie des étoiles du lendemain, ouvert par Kol Nidré et refermé par la Néïla et le chofar.",
    souccot:
      "Souccot, la fête des cabanes, commence le 15 Tichri : on mange (et on dort) dans la soucca sept jours durant, et l'on prend chaque matin les quatre espèces, le loulav et l'étrog. Les deux premiers jours sont Yom Tov en diaspora, les suivants 'Hol haMoed.",
    "simhat-torah":
      "Chemini Atséret et Simhat Torah closent le cycle de Tichri : on demande la pluie, puis on achève la lecture annuelle de la Torah et on la recommence aussitôt, en dansant avec les rouleaux (les hakafot).",
    hanouka:
      "Hanouka dure huit jours à partir du 25 Kislev : on allume chaque soir une bougie de plus sur la 'hanoukia, en souvenir de la fiole d'huile du Temple. Le travail y est permis, et la première bougie s'allume la veille du premier jour, au soir.",
    "10-tevet":
      "Assara beTevet, le 10 Tevet, rappelle le début du siège de Jérusalem par Nabuchodonosor. C'est un jeûne de l'aube à la sortie des étoiles.",
    "tou-bichvat":
      "Tou Bichvat, le 15 Chvat, est le nouvel an des arbres. On y mange les fruits d'Israël, et beaucoup tiennent un séder de Tou Bichvat. Le travail y est permis.",
    "jeune-esther":
      "Le jeûne d'Esther précède Pourim, le 13 Adar. On jeûne de l'aube à la sortie des étoiles, en souvenir du jeûne des Juifs de Suse avant la délivrance.",
    pourim:
      "Pourim, le 14 Adar, célèbre la délivrance racontée dans la Meguila d'Esther : on lit la Meguila le soir et le matin, on envoie des michloa'h manot, on donne aux pauvres et on fait un repas de fête. A Jérusalem, Pourim se célèbre le 15 Adar (Chouchan Pourim).",
    pessah:
      "Pessah commence le 15 Nissan et dure huit jours en diaspora (sept en Israël) : le séder et la Haggada les deux premiers soirs, le pain levé banni de la maison, puis 'Hol haMoed et deux derniers jours de fête.",
    "lag-baomer":
      "Lag Baomer, le 33e jour du compte du Omer, est le jour de la hiloula de Rabbi Chimon bar Yohaï. Le deuil du Omer s'y interrompt : on allume des feux, on coupe les cheveux, on célèbre des mariages.",
    chavouot:
      "Chavouot, le 6 Sivan, célèbre le don de la Torah au Sinaï, sept semaines après Pessah. On veille la première nuit pour étudier (le tikoun lel Chavouot), on lit les Dix Commandements et le livre de Ruth, et l'usage est de manger laitage.",
    "17-tamouz":
      "Le 17 Tamouz rappelle la brèche ouverte dans les murailles de Jérusalem. Il ouvre les trois semaines de deuil qui mènent au 9 Av. On jeûne de l'aube à la sortie des étoiles.",
    "ticha-beav":
      "Tich'a beAv, le 9 Av, est le jour de la destruction des deux Temples : un jeûne de vingt-cinq heures, du coucher du soleil à la sortie des étoiles du lendemain, où l'on lit les Lamentations assis à terre.",
  },
};

const EN: ZmanimStrings = {
  intl: "en-GB",
  breadcrumbHome: "Home",

  shabbatOf: (name) => `Shabbat ${name}`,
  shabbat: "Shabbat",
  at: (date, time) => `${date} at ${time}`,
  range: (from, to) => `${from} to ${to}`,
  cityLink: (city) => `Shabbat times in ${city}`,
  distance: (km) => `(${km} km away)`,

  hubTitle: "Shabbat times: candle lighting, havdalah and the day's zmanim | Petite Jérusalem",
  hubDescription:
    "Candle lighting and Shabbat end times week by week, plus all the zmanim of the day (alot, sunrise, latest Shema, shkia, tzeit hakochavim), computed for your city. Free, works offline.",
  hubH1: "Shabbat times: candle lighting and havdalah",
  hubLead: (city) => `<strong>Candle lighting</strong> (18 minutes before sunset) and the end of
      <strong>Shabbat</strong> (nightfall, the time for havdalah), week by week. The times below
      are computed for ${city}; open the page in the app for your own city or exact location, even
      offline.`,
  restHead: ["Shabbat or festival", "Candle lighting", "Ends"],
  hubRestTitle: (city) => `Upcoming Shabbat and festival times in ${city}`,
  hubRestNote: (
    city,
  ) => `These times are for ${city} (candle lighting 18 minutes before shkia, ending at
      nightfall). For another city, see the directory below, or open the page in the app: it
      computes the same times on your device, from your location or a city you pick.`,
  zmanimHead: ["Time", "Clock", "What it marks"],
  zmanimTitle: (city, day) => `Today's zmanim in ${city} (${day})`,
  zmanimIntro: (
    city,
    day,
  ) => `The halachic times of the day: dawn, sunrise, the morning deadlines, the
      afternoon, nightfall. The table is for ${day} in ${city}; the app recomputes today's, for
      the place of your choice.`,
  zmanimGuideNote: (link) => `What each of these times means, opinion by opinion: see
      <a href="${link}">zmanim explained</a>.`,
  parashaTitle: "The weekly parasha, Shabbat by Shabbat",
  parashaIntro: (
    link,
  ) => `The parasha read on each of the coming Shabbatot, with the candle lighting time.
      Every name leads to the full text in the library, and the complete calendar of all 54
      parashiot is on the <a href="${link}">parashat hashavua page</a>.`,
  parashaHead: ["Parasha", "Shabbat", "Candle lighting"],
  featuredTitle: "Shabbat times for the main communities",
  featuredIntro: "Candle lighting and havdalah times for the most searched cities:",
  directoryTitle: "Every city, country by country",
  directoryIntro: `Every city has its page, with Shabbat start and end times computed at its coordinates
      and the zmanim of the day.`,
  countryHeading: (where) => `Shabbat times ${where}`,
  festivalsTitle: "Jewish festivals",
  festivalsHtml: (
    links,
    festivalPath,
  ) => `<p>See the <a href="${links.calendrier}">Jewish holiday calendar</a>: the dates of every
      festival of the year, with start and end times, and a page for each one
      (<a href="${festivalPath("roch-hachana")}">Rosh Hashanah</a>,
      <a href="${festivalPath("yom-kippour")}">Yom Kippur</a>,
      <a href="${festivalPath("pessah")}">Passover</a>,
      <a href="${festivalPath("hanouka")}">Hanukkah</a>).</p>`,
  hubFaqHeading: "Frequently asked questions about Shabbat times",

  cityTitle: (city) =>
    `Shabbat times in ${city}: candle lighting, havdalah and zmanim | Petite Jérusalem`,
  cityDescription: (city) =>
    `Candle lighting (the start of Shabbat) and havdalah times in ${city}, week by week, plus all the zmanim of the day: sunrise, latest Shema, shkia, tzeit hakochavim. Free, works offline.`,
  cityH1: (city) => `Shabbat times in ${city}`,
  cityLead: (
    city,
    minutes,
  ) => `<strong>Candle lighting in ${city}</strong> (${minutes} minutes before sunset)
      and the end of <strong>Shabbat</strong> (nightfall, the time for havdalah), week by week,
      along with the coming festivals and all the zmanim of the day in ${city}, even offline.`,
  cityRestTitle: (city) => `Shabbat start and end times in ${city}`,
  cityRestNote: (
    city,
    minutes,
    links,
  ) => `Candle lighting is computed ${minutes} minutes before shkia in ${city},
      and Shabbat ends at nightfall. See also the directory of
      <a href="${links.horaires}">Shabbat times city by city</a> and the
      <a href="${links.calendrier}">Jewish holiday calendar</a>.`,
  cityJerusalemNote: (
    city,
  ) => `In ${city} the custom is to light 40 minutes before sunset, not 18 as in most
      communities: the times above follow that custom.`,
  cityZmanimIntro: (
    city,
    day,
  ) => `The halachic times of the day in ${city}: alot hashachar, sunrise, sof zman
      Shema and Tefillah, chatzot, mincha, shkia and tzeit hakochavim. The table is for ${day};
      the app recomputes today's on your device.`,
  neighboursTitle: (city) => `Cities near ${city}`,
  neighboursIntro: (
    city,
    where,
  ) => `Times shift by a few minutes from one city to the next. The closest to
      ${city}, ${where} and around:`,
  cityFaqHeading: (city) => `Frequently asked questions about Shabbat times in ${city}`,

  inCity: (city) => `in ${city}`,
  faqShabbatStart: (city, day, time, minutes) => ({
    q: `What time does Shabbat start in ${city} this week?`,
    a: `The coming Shabbat in ${city} starts on ${day}, with candle lighting at ${time}, that is ${minutes} minutes before sunset.`,
  }),
  faqShabbatEnd: (city, day, time) => ({
    q: `What time does Shabbat end in ${city}?`,
    a: `Shabbat ends at nightfall (tzeit hakochavim), the time for havdalah. The coming Shabbat in ${city} ends on ${day} at ${time}.`,
  }),
  faqHowComputed: (city, minutes) => ({
    q: `How are the Shabbat times for ${city} calculated?`,
    a: `Candle lighting is set ${minutes} minutes before shkia (sunset) at the coordinates of ${city}, and Shabbat ends at nightfall. The astronomical computation runs on your device, free and even offline, and the page also shows all the zmanim of the day.`,
  }),
  faqJerusalem: {
    q: "Why is candle lighting different in Jerusalem?",
    a: "In Jerusalem the custom is to light 40 minutes before sunset rather than 18, and the Jerusalem page follows it. Everywhere else the calculation stays 18 minutes before shkia.",
  },
  faqOffline: {
    q: "Can I check Shabbat times offline?",
    a: "Yes. Every time is computed on the device, with no connection: the page works offline, and the app also offers a home-screen widget with the day's times. It is entirely free.",
  },
  faqParasha: (parasha, date) => ({
    q: "What is this week's parasha?",
    a: `On the Shabbat of ${date} we read Parashat ${parasha}. The table of coming weeks gives the parasha of each Shabbat, with a link to its text.`,
  }),
  faqSunrise: (where, day, time) => ({
    q: `What time is sunrise (netz hachama) ${where}?`,
    a: `On ${day}, sunrise ${where} is at ${time}. From that moment the Amidah of Shacharit may be said according to the preferred practice (vatikin). The Shabbat times page recomputes the day's sunrise on your device.`,
  }),
  faqShema: (where, day, time) => ({
    q: `What is the latest time for the morning Shema ${where}?`,
    a: `On ${day}, sof zman Shema ${where} is ${time} according to the Vilna Gaon, and a little earlier according to the Magen Avraham. Both opinions are shown side by side on the Shabbat times page.`,
  }),
  faqShkiaTzeit: (where, day, shkia, tzeit) => ({
    q: `What is the difference between shkia and tzeit hakochavim ${where}?`,
    a: `Shkia is sunset (${shkia} on ${day} ${where}), tzeit hakochavim is nightfall, when it is properly dark (${tzeit}). Between the two lies bein hashmashot, of doubtful status: that is why Shabbat starts before shkia and only ends at tzeit.`,
  }),

  calendarTitle: "Jewish holiday calendar: dates, start and end times | Petite Jérusalem",
  calendarDescription: (from, to) =>
    `The dates of the Jewish festivals ${from}-${to}: Rosh Hashanah, Yom Kippur, Sukkot, Hanukkah, Purim, Passover, Shavuot and the fasts, with the start and end time of each one.`,
  calendarH1: (fromYear, toYear, from, to) =>
    `Jewish holiday calendar ${fromYear}-${toYear} (${from}-${to})`,
  calendarLead: `The dates of every festival and fast of the Hebrew year, with, for each day on which work is
      forbidden, the start time (candle lighting) and the end time. The times below are computed
      for Paris; the app computes them for your own city, even offline.`,
  calendarHead: ["Festival", "Dates", "Starts", "Ends"],
  calendarOpeningTitle: (year) => `Upcoming festivals of the year ${year}`,
  calendarNextTitle: (year) => `Festivals of the year ${year}`,
  multiYearTitle: (years) => `Dates of the major Jewish festivals over ${years} years`,
  multiYearIntro: `The first day of each festival, Hebrew year by Hebrew year: one Hebrew year runs across two
      civil years, so each cell carries its own. Every festival has its page, with its dates and
      its start and end times.`,
  multiYearHead: "Festival",
  festivalListTitle: "A page for each festival",
  festivalListItem: (label) => `${label} dates`,
  calendarShabbatTitle: "Shabbat, week by week",
  calendarShabbatHtml: (
    links,
  ) => `<p>For candle lighting and havdalah times each week, and all the zmanim of the
      day, see <a href="${links.horaires}">Shabbat times</a>, city by city, and
      <a href="${links.zmanim}">zmanim explained</a>.</p>`,
  calendarFaqHeading: "Dates of the coming Jewish festivals",

  festivalTitle: (label) => `${label}: dates, start and end times | Petite Jérusalem`,
  festivalDescription: (label, years, from, hasTimes) =>
    hasTimes
      ? `When is ${label}? The dates of ${label} over ${years} years from ${from}, with the start and end time of the festival, and what is done on it.`
      : `When is ${label}? The dates of ${label} over ${years} years from ${from}, in civil and Hebrew dates, and what is done on it.`,
  festivalH1: (label) => `${label}: dates, start and end`,
  festivalWhenTitle: (label) => `When is ${label}?`,
  festivalHead: ["Year", "Dates", "Hebrew date"],
  festivalSplitNote: (
    label,
  ) => `${label} has two blocks of festival days, separated by Chol HaMoed (the
      intermediate days, on which work is allowed): the start time is that of the first day, the
      end time that of the last.`,
  festivalTimesNote: (
    links,
  ) => `The start and end times are computed for Paris. For your own city, see
      <a href="${links.horaires}">Shabbat times city by city</a>: the app recomputes them at your
      coordinates, even offline.`,
  festivalNoTimesNote: (
    links,
  ) => `Work is not forbidden on that day, so it has no start or end time the way
      Shabbat does. For the times of the day (dawn, sunrise, nightfall) in your city, see
      <a href="${links.horaires}">Shabbat times</a>.`,
  festivalAroundTitle: (label) => `Around ${label}`,
  festivalAroundHtml: (
    links,
  ) => `<p>See the full <a href="${links.calendrier}">Jewish holiday calendar</a>, the
      <a href="${links.horaires}">Shabbat and festival times</a> and
      <a href="${links.zmanim}">zmanim explained</a> (dawn, sunrise, shkia, nightfall), which give
      the meaning of the times in this table.</p>`,
  festivalFaqHeading: (label) => `Frequently asked questions about ${label}`,
  faqWhenFestival: (label, year, start, startTime, end, endTime, city) => ({
    q: `When is ${label} ${year}?`,
    a: `${label} ${year} begins on the evening of ${start} (candle lighting at ${startTime} in ${city}) and ends on ${end} at nightfall (${endTime} in ${city}).`,
  }),
  faqWhenHanukkah: (label, year, eve, range) => ({
    q: `When is ${label} ${year}?`,
    a: `The first candle of ${label} ${year} is lit on the evening of ${eve}; the festival runs eight days, ${range}.`,
  }),
  faqWhenFast: (label, year, when, kind) => ({
    q: `When is ${label} ${year}?`,
    a:
      kind === "dawn"
        ? `${label} ${year} falls on ${when}: the fast runs from dawn (alot hashachar) to nightfall.`
        : `${label} ${year} falls on ${when}: the fast begins the evening before at sunset and ends at nightfall, twenty-five hours later.`,
  }),
  faqWhenPlain: (label, year, when) => ({
    q: `When is ${label} ${year}?`,
    a: `${label} ${year} falls on ${when} (the day begins the evening before).`,
  }),
  faqFestivalWork: (label, hasTimes, isFast) => ({
    q: `Is work forbidden on ${label}?`,
    a: hasTimes
      ? `Yes: ${label} is a Yom Tov, work is forbidden as on Shabbat, with a start (candle lighting) and an end given in the table above. In the diaspora the festival days are doubled.`
      : isFast
        ? `No: ${label} is a fast day, not a Yom Tov; work is allowed.`
        : `No: ${label} is not a Yom Tov, work is allowed. The day has its own customs, but no start and end the way Shabbat does.`,
  }),
  faqFestivalCity: (label) => ({
    q: `How do I find the exact time of ${label} in my city?`,
    a: `The times above are computed for Paris. Open the Shabbat times in the app, or your city's page, for the start and end times at your own coordinates, computed on your device and even offline.`,
  }),
  festivalIntro: {
    "roch-hachana":
      "Rosh Hashanah is the Jewish new year and the day of judgment: two days of Yom Tov, the 1st and 2nd of Tishrei, on which the shofar is blown, simanim are eaten (apple in honey, the head of a fish), and the prayers run longer than usual.",
    "jeune-guedalia":
      "The Fast of Gedaliah, on 3 Tishrei, follows Rosh Hashanah: it recalls the murder of Gedaliah ben Achikam, the last Jewish governor after the destruction of the First Temple. The fast runs from dawn to nightfall.",
    "yom-kippour":
      "Yom Kippur, on 10 Tishrei, is the Day of Atonement: a fast of twenty-five hours, from the start of the day in the evening until nightfall the following day, opened by Kol Nidrei and closed by Neilah and the shofar.",
    souccot:
      "Sukkot, the festival of booths, begins on 15 Tishrei: one eats (and sleeps) in the sukkah for seven days, and takes the four species, lulav and etrog, each morning. The first two days are Yom Tov in the diaspora, the rest are Chol HaMoed.",
    "simhat-torah":
      "Shemini Atzeret and Simchat Torah close the cycle of Tishrei: rain is asked for, then the annual reading of the Torah is finished and begun again straight away, dancing with the scrolls (the hakafot).",
    hanouka:
      "Hanukkah runs eight days from 25 Kislev: one candle more is lit each evening on the chanukiah, in memory of the flask of oil in the Temple. Work is allowed, and the first candle is lit on the evening before the first day.",
    "10-tevet":
      "Asara BeTevet, on 10 Tevet, recalls the beginning of the siege of Jerusalem by Nebuchadnezzar. It is a fast from dawn to nightfall.",
    "tou-bichvat":
      "Tu Bishvat, on 15 Shevat, is the new year of the trees. The fruits of the Land of Israel are eaten, and many hold a Tu Bishvat seder. Work is allowed.",
    "jeune-esther":
      "The Fast of Esther comes before Purim, on 13 Adar. The fast runs from dawn to nightfall, in memory of the fast of the Jews of Shushan before the deliverance.",
    pourim:
      "Purim, on 14 Adar, celebrates the deliverance told in the Megillah of Esther: the Megillah is read evening and morning, mishloach manot are sent, gifts are given to the poor, and a festive meal is eaten. In Jerusalem, Purim falls on 15 Adar (Shushan Purim).",
    pessah:
      "Passover begins on 15 Nisan and runs eight days in the diaspora (seven in Israel): the seder and the Haggadah on the first two nights, chametz banished from the house, then Chol HaMoed and two final days of Yom Tov.",
    "lag-baomer":
      "Lag BaOmer, the 33rd day of the Omer count, is the yahrzeit of Rabbi Shimon bar Yochai. The mourning of the Omer stops for the day: bonfires are lit, hair is cut, weddings are held.",
    chavouot:
      "Shavuot, on 6 Sivan, celebrates the giving of the Torah at Sinai, seven weeks after Passover. The first night is spent learning (the tikkun leil Shavuot), the Ten Commandments and the book of Ruth are read, and the custom is to eat dairy.",
    "17-tamouz":
      "The Seventeenth of Tammuz recalls the breach made in the walls of Jerusalem. It opens the three weeks of mourning that lead to Tisha B'Av. The fast runs from dawn to nightfall.",
    "ticha-beav":
      "Tisha B'Av, the 9th of Av, is the day of the destruction of both Temples: a fast of twenty-five hours, from sunset to nightfall the following day, on which Lamentations is read sitting on the ground.",
  },
};

const HE: ZmanimStrings = {
  intl: "he-IL",
  breadcrumbHome: "דף הבית",

  shabbatOf: (name) => `שבת ${name}`,
  shabbat: "שבת",
  at: (date, time) => `${date} בשעה ${time}`,
  range: (from, to) => `מ־${from} עד ${to}`,
  cityLink: (city) => `זמני שבת ב${city}`,
  distance: (km) => `(${km} ק״מ)`,

  hubTitle: "זמני שבת: הדלקת נרות, צאת שבת וזמני היום | פטיט ירושלים",
  hubDescription:
    "זמני הדלקת נרות וצאת שבת שבוע אחר שבוע, וכל זמני היום ההלכתיים (עלות, נץ, סוף זמן קריאת שמע, שקיעה, צאת הכוכבים), מחושבים לעיר שלך. חינם וגם ללא חיבור לאינטרנט.",
  hubH1: "זמני שבת: הדלקת נרות וצאת השבת",
  hubLead: (city) => `זמן <strong>כניסת השבת</strong> (הדלקת נרות, 18 דקות לפני השקיעה) וזמן
      <strong>צאת השבת</strong> (צאת הכוכבים, זמן ההבדלה), שבוע אחר שבוע. הזמנים שלהלן מחושבים
      ל${city}; פתחו את העמוד באפליקציה כדי לקבל את הזמנים של העיר או המיקום המדויק שלכם, גם ללא
      חיבור לאינטרנט.`,
  restHead: ["שבת או חג", "כניסה (הדלקת נרות)", "יציאה"],
  hubRestTitle: (city) => `זמני השבתות והחגים הקרובים ב${city}`,
  hubRestNote: (
    city,
  ) => `הזמנים הללו הם של ${city} (הדלקה 18 דקות לפני השקיעה, יציאה בצאת הכוכבים). לעיר
      אחרת, ראו את המפתח שלהלן, או פתחו את העמוד באפליקציה: היא מחשבת את אותם זמנים במכשיר שלכם,
      לפי המיקום שלכם או לפי עיר שתבחרו.`,
  zmanimHead: ["זמן", "שעה", "מה הוא מציין"],
  zmanimTitle: (city, day) => `זמני היום ב${city} (${day})`,
  zmanimIntro: (
    city,
    day,
  ) => `זמני היום ההלכתיים: עלות השחר, הנץ, זמני הבוקר, אחר הצהריים והלילה. הטבלה היא
      של ${day} ב${city}; האפליקציה מחשבת מחדש את זמני היום הנוכחי, למקום שתבחרו.`,
  zmanimGuideNote: (link) => `מה מציין כל זמן, שיטה אחר שיטה: ראו
      <a href="${link}">זמני היום ההלכתיים</a>.`,
  parashaTitle: "פרשת השבוע, שבת אחר שבת",
  parashaIntro: (
    link,
  ) => `הפרשה הנקראת בכל אחת מהשבתות הקרובות, לצד זמן הדלקת הנרות. כל שם מוביל לטקסט
      המלא בספרייה, ולוח כל 54 הפרשות נמצא בעמוד <a href="${link}">פרשת השבוע</a>.`,
  parashaHead: ["פרשה", "שבת", "הדלקת נרות"],
  featuredTitle: "זמני שבת בקהילות הגדולות",
  featuredIntro: "זמני הדלקת הנרות וצאת השבת בערים המבוקשות ביותר:",
  directoryTitle: "כל הערים, מדינה אחר מדינה",
  directoryIntro: `לכל עיר יש עמוד משלה, עם זמני כניסת השבת ויציאתה המחושבים לנקודות הציון שלה, ועם זמני
      היום.`,
  countryHeading: (where) => `זמני שבת ${where}`,
  festivalsTitle: "חגי ישראל",
  festivalsHtml: (
    links,
    festivalPath,
  ) => `<p>ראו את <a href="${links.calendrier}">לוח החגים</a>: תאריכי כל החגים של השנה, עם זמני
      הכניסה והיציאה, ועמוד לכל חג
      (<a href="${festivalPath("roch-hachana")}">ראש השנה</a>,
      <a href="${festivalPath("yom-kippour")}">יום כיפור</a>,
      <a href="${festivalPath("pessah")}">פסח</a>,
      <a href="${festivalPath("hanouka")}">חנוכה</a>).</p>`,
  hubFaqHeading: "שאלות נפוצות על זמני שבת",

  cityTitle: (city) => `זמני שבת ב${city}: הדלקת נרות, צאת שבת וזמני היום | פטיט ירושלים`,
  cityDescription: (city) =>
    `זמן הדלקת הנרות (כניסת השבת) וזמן צאת השבת ב${city}, שבוע אחר שבוע, וכל זמני היום: נץ, סוף זמן קריאת שמע, שקיעה וצאת הכוכבים. חינם וגם ללא חיבור לאינטרנט.`,
  cityH1: (city) => `זמני שבת ב${city}`,
  cityLead: (
    city,
    minutes,
  ) => `זמן <strong>כניסת השבת ב${city}</strong> (הדלקת נרות, ${minutes} דקות לפני
      השקיעה) וזמן <strong>צאת השבת</strong> (צאת הכוכבים, זמן ההבדלה), שבוע אחר שבוע, לצד החגים
      הקרובים וכל זמני היום ב${city}, גם ללא חיבור לאינטרנט.`,
  cityRestTitle: (city) => `כניסת השבת ויציאתה ב${city}`,
  cityRestNote: (
    city,
    minutes,
    links,
  ) => `הכניסה מחושבת ${minutes} דקות לפני השקיעה של ${city}, והיציאה בצאת
      הכוכבים. ראו גם את מפתח <a href="${links.horaires}">זמני השבת עיר אחר עיר</a> ואת
      <a href="${links.calendrier}">לוח החגים</a>.`,
  cityJerusalemNote: (
    city,
  ) => `ב${city} המנהג להדליק 40 דקות לפני השקיעה, ולא 18 כמו ברוב הקהילות: הזמנים
      שלמעלה הולכים אחרי מנהג זה.`,
  cityZmanimIntro: (
    city,
    day,
  ) => `זמני היום ההלכתיים ב${city}: עלות השחר, הנץ, סוף זמן קריאת שמע ותפילה,
      חצות, מנחה, שקיעה וצאת הכוכבים. הטבלה היא של ${day}; האפליקציה מחשבת מחדש את זמני היום
      הנוכחי במכשיר שלכם.`,
  neighboursTitle: (city) => `ערים קרובות ל${city}`,
  neighboursIntro: (
    city,
    where,
  ) => `הזמנים משתנים בכמה דקות מעיר לעיר. הקרובות ביותר ל${city}, ${where}
      ובסביבתה:`,
  cityFaqHeading: (city) => `שאלות נפוצות על זמני שבת ב${city}`,

  inCity: (city) => `ב${city}`,
  faqShabbatStart: (city, day, time, minutes) => ({
    q: `באיזו שעה נכנסת השבת ב${city} השבוע?`,
    a: `השבת הקרובה ב${city} נכנסת ב${day}, עם הדלקת נרות בשעה ${time}, כלומר ${minutes} דקות לפני השקיעה.`,
  }),
  faqShabbatEnd: (city, day, time) => ({
    q: `באיזו שעה יוצאת השבת ב${city}?`,
    a: `השבת יוצאת בצאת הכוכבים, זמן ההבדלה. השבת הקרובה ב${city} יוצאת ב${day} בשעה ${time}.`,
  }),
  faqHowComputed: (city, minutes) => ({
    q: `כיצד מחושבים זמני השבת של ${city}?`,
    a: `הכניסה נקבעת ${minutes} דקות לפני השקיעה בנקודות הציון של ${city}, והיציאה בצאת הכוכבים. החישוב האסטרונומי נעשה במכשיר שלכם, בחינם וגם ללא חיבור לאינטרנט, והעמוד מציג גם את כל זמני היום.`,
  }),
  faqJerusalem: {
    q: "מדוע זמן הדלקת הנרות בירושלים שונה?",
    a: "בירושלים המנהג להדליק 40 דקות לפני השקיעה ולא 18, ועמוד הזמנים של ירושלים הולך אחרי מנהג זה. בכל מקום אחר החישוב נשאר 18 דקות לפני השקיעה.",
  },
  faqOffline: {
    q: "אפשר לראות את זמני השבת ללא חיבור לאינטרנט?",
    a: "כן. כל הזמנים מחושבים במכשיר עצמו, ללא חיבור: העמוד פועל גם במצב לא מקוון, והאפליקציה מציעה גם ווידג׳ט למסך הבית עם זמני היום. הכול בחינם.",
  },
  faqParasha: (parasha, date) => ({
    q: "מהי פרשת השבוע?",
    a: `בשבת ${date} קוראים את פרשת ${parasha}. הטבלה של השבועות הקרובים נותנת את הפרשה של כל שבת, עם קישור לטקסט שלה.`,
  }),
  faqSunrise: (where, day, time) => ({
    q: `באיזו שעה הנץ ${where}?`,
    a: `ב${day}, נץ החמה ${where} בשעה ${time}. מאותו רגע אפשר להתפלל שחרית כמנהג המהודר, תפילת ותיקין. עמוד הזמנים מחשב מחדש את הנץ של אותו יום במכשיר שלכם.`,
  }),
  faqShema: (where, day, time) => ({
    q: `עד איזו שעה אפשר לקרוא קריאת שמע של שחרית ${where}?`,
    a: `ב${day}, סוף זמן קריאת שמע ${where} הוא ${time} לפי הגר״א, ומעט מוקדם יותר לפי המגן אברהם. שתי השיטות מוצגות זו לצד זו בעמוד הזמנים.`,
  }),
  faqShkiaTzeit: (where, day, shkia, tzeit) => ({
    q: `מה ההבדל בין שקיעה לצאת הכוכבים ${where}?`,
    a: `השקיעה היא שקיעת השמש (${shkia} ב${day} ${where}), וצאת הכוכבים היא חשכת הלילה (${tzeit}). ביניהן נמצא בין השמשות, שספק יום ספק לילה: משום כך השבת נכנסת לפני השקיעה ויוצאת רק בצאת הכוכבים.`,
  }),

  calendarTitle: "לוח החגים: תאריכים, זמני כניסה ויציאה של כל חג | פטיט ירושלים",
  calendarDescription: (from, to) =>
    `תאריכי חגי ישראל ${from}-${to}: ראש השנה, יום כיפור, סוכות, חנוכה, פורים, פסח, שבועות והצומות, עם זמני הכניסה והיציאה של כל חג.`,
  calendarH1: (fromYear, toYear, from, to) => `לוח החגים ${fromYear}-${toYear} (${from}-${to})`,
  calendarLead: `תאריכי כל החגים והצומות של השנה העברית, ולכל יום שבו המלאכה אסורה גם זמן הכניסה (הדלקת
      נרות) וזמן היציאה. הזמנים שלהלן מחושבים לפריז; האפליקציה מחשבת אותם לעיר שלכם, גם ללא
      חיבור לאינטרנט.`,
  calendarHead: ["חג", "תאריכים", "כניסה", "יציאה"],
  calendarOpeningTitle: (year) => `החגים הקרובים של שנת ${year}`,
  calendarNextTitle: (year) => `חגי שנת ${year}`,
  multiYearTitle: (years) => `תאריכי החגים הגדולים ל־${years} שנים`,
  multiYearIntro: `היום הראשון של כל חג, שנה עברית אחר שנה עברית: שנה עברית אחת משתרעת על שתי שנים לועזיות,
      ולכן כל תא נושא את השנה שלו. לכל חג יש עמוד משלו, עם התאריכים וזמני הכניסה והיציאה.`,
  multiYearHead: "חג",
  festivalListTitle: "עמוד לכל חג",
  festivalListItem: (label) => `תאריכי ${label}`,
  calendarShabbatTitle: "שבת, שבוע אחר שבוע",
  calendarShabbatHtml: (links) => `<p>לזמני הדלקת הנרות וצאת השבת בכל שבוע, ולכל זמני היום, ראו
      <a href="${links.horaires}">זמני שבת</a>, עיר אחר עיר, ו<a href="${links.zmanim}">זמני היום
      ההלכתיים</a>.</p>`,
  calendarFaqHeading: "תאריכי החגים הקרובים",

  festivalTitle: (label) => `${label}: תאריכים, זמני כניסה ויציאה | פטיט ירושלים`,
  festivalDescription: (label, years, from, hasTimes) =>
    hasTimes
      ? `מתי חל ${label}? התאריכים של ${label} ל־${years} שנים החל מ־${from}, עם זמני הכניסה והיציאה של החג, ומה נוהגים בו.`
      : `מתי חל ${label}? התאריכים של ${label} ל־${years} שנים החל מ־${from}, בתאריכים לועזיים ועבריים, ומה נוהגים בו.`,
  festivalH1: (label) => `${label}: תאריכים, כניסה ויציאה`,
  festivalWhenTitle: (label) => `מתי חל ${label}?`,
  festivalHead: ["שנה", "תאריכים", "תאריך עברי"],
  festivalSplitNote: (label) => `${label} כולל שני חלקים של ימים טובים, ובאמצע חול המועד (הימים שבהם
      המלאכה מותרת): זמן הכניסה הוא של היום הראשון, וזמן היציאה של האחרון.`,
  festivalTimesNote: (links) => `זמני הכניסה והיציאה מחושבים לפריז. לעיר שלכם, ראו את
      <a href="${links.horaires}">זמני השבת עיר אחר עיר</a>: האפליקציה מחשבת אותם מחדש לנקודות
      הציון שלכם, גם ללא חיבור לאינטרנט.`,
  festivalNoTimesNote: (
    links,
  ) => `המלאכה אינה אסורה ביום זה, ולכן אין לו זמן כניסה ויציאה כמו לשבת. לזמני
      היום (עלות השחר, הנץ, צאת הכוכבים) בעיר שלכם, ראו <a href="${links.horaires}">זמני
      שבת</a>.`,
  festivalAroundTitle: (label) => `סביב ${label}`,
  festivalAroundHtml: (links) => `<p>ראו את <a href="${links.calendrier}">לוח החגים המלא</a>, את
      <a href="${links.horaires}">זמני השבת והחגים</a> ואת <a href="${links.zmanim}">זמני היום
      ההלכתיים</a> (עלות השחר, הנץ, השקיעה וצאת הכוכבים), שנותנים את משמעות הזמנים שבטבלה.</p>`,
  festivalFaqHeading: (label) => `שאלות נפוצות על ${label}`,
  faqWhenFestival: (label, year, start, startTime, end, endTime, city) => ({
    q: `מתי חל ${label} ${year}?`,
    a: `${label} ${year} מתחיל בערב ${start} (כניסה בשעה ${startTime} ב${city}) ומסתיים ב${end} בצאת הכוכבים (${endTime} ב${city}).`,
  }),
  faqWhenHanukkah: (label, year, eve, range) => ({
    q: `מתי חל ${label} ${year}?`,
    a: `הנר הראשון של ${label} ${year} מודלק בערב ${eve}; החג נמשך שמונה ימים, ${range}.`,
  }),
  faqWhenFast: (label, year, when, kind) => ({
    q: `מתי חל ${label} ${year}?`,
    a:
      kind === "dawn"
        ? `${label} ${year} חל ${when}: הצום מעלות השחר ועד צאת הכוכבים.`
        : `${label} ${year} חל ${when}: הצום מתחיל בערב שלפניו עם השקיעה ומסתיים בצאת הכוכבים, עשרים וחמש שעות אחר כך.`,
  }),
  faqWhenPlain: (label, year, when) => ({
    q: `מתי חל ${label} ${year}?`,
    a: `${label} ${year} חל ${when} (היום מתחיל בערב שלפניו).`,
  }),
  faqFestivalWork: (label, hasTimes, isFast) => ({
    q: `האם המלאכה אסורה ב${label}?`,
    a: hasTimes
      ? `כן: ${label} הוא יום טוב, והמלאכה אסורה בו כמו בשבת, עם זמן כניסה (הדלקת נרות) וזמן יציאה המופיעים בטבלה שלמעלה. בחוץ לארץ ימי החג כפולים.`
      : isFast
        ? `לא: ${label} הוא יום צום ולא יום טוב; המלאכה מותרת בו.`
        : `לא: ${label} אינו יום טוב, והמלאכה מותרת בו. ליום יש מנהגים משלו, אך אין לו כניסה ויציאה כמו לשבת.`,
  }),
  faqFestivalCity: (label) => ({
    q: `כיצד אפשר לדעת את הזמן המדויק של ${label} בעיר שלי?`,
    a: `הזמנים שלמעלה מחושבים לפריז. פתחו את עמוד הזמנים באפליקציה, או את עמוד העיר שלכם, כדי לקבל את זמני הכניסה והיציאה בנקודות הציון שלכם, המחושבים במכשיר שלכם וגם ללא חיבור לאינטרנט.`,
  }),
  festivalIntro: {
    "roch-hachana":
      "ראש השנה הוא ראש השנה העברית ויום הדין: שני ימי חג, א׳ וב׳ בתשרי, שבהם תוקעים בשופר, אוכלים סימנים (תפוח בדבש, ראש דג) והתפילה ארוכה מן הרגיל.",
    "jeune-guedalia":
      "צום גדליה, בג׳ בתשרי, בא אחרי ראש השנה: הוא מזכיר את רציחתו של גדליה בן אחיקם, אחרון המושלים היהודים לאחר חורבן בית ראשון. הצום מעלות השחר ועד צאת הכוכבים.",
    "yom-kippour":
      "יום כיפור, בי׳ בתשרי, הוא יום הסליחה והכפרה: צום של עשרים וחמש שעות, מכניסת החג בערב ועד צאת הכוכבים למחרת, הנפתח בכל נדרי ונחתם בנעילה ובתקיעת שופר.",
    souccot:
      "סוכות, חג האסיף, מתחיל בט״ו בתשרי: יושבים (וישנים) בסוכה שבעה ימים, ונוטלים בכל בוקר את ארבעת המינים, לולב ואתרוג. בחוץ לארץ שני הימים הראשונים הם יום טוב, והשאר חול המועד.",
    "simhat-torah":
      "שמיני עצרת ושמחת תורה חותמים את חגי תשרי: מבקשים על הגשם, ואז מסיימים את קריאת התורה השנתית ומתחילים אותה מיד מחדש, ברוקדים עם ספרי התורה בהקפות.",
    hanouka:
      "חנוכה נמשך שמונה ימים מכ״ה בכסלו: מדליקים בכל ערב נר נוסף בחנוכייה, זכר לפך השמן שבמקדש. המלאכה מותרת, והנר הראשון מודלק בערב שלפני היום הראשון.",
    "10-tevet":
      "עשרה בטבת מזכיר את תחילת המצור על ירושלים בידי נבוכדנאצר. זהו צום מעלות השחר ועד צאת הכוכבים.",
    "tou-bichvat":
      "ט״ו בשבט הוא ראש השנה לאילנות. אוכלים בו מפירות ארץ ישראל, ורבים עורכים סדר ט״ו בשבט. המלאכה מותרת.",
    "jeune-esther":
      "תענית אסתר קודמת לפורים, בי״ג באדר. הצום מעלות השחר ועד צאת הכוכבים, זכר לצום יהודי שושן לפני ההצלה.",
    pourim:
      "פורים, בי״ד באדר, מציין את ההצלה המסופרת במגילת אסתר: קוראים את המגילה בערב ובבוקר, שולחים משלוח מנות, נותנים מתנות לאביונים ועורכים סעודת חג. בירושלים פורים חל בט״ו באדר, שושן פורים.",
    pessah:
      "פסח מתחיל בט״ו בניסן ונמשך שמונה ימים בחוץ לארץ (שבעה בארץ ישראל): הסדר וההגדה בשני הלילות הראשונים, החמץ מבוער מן הבית, ואחר כך חול המועד ושני ימי חג אחרונים.",
    "lag-baomer":
      "ל״ג בעומר, היום השלושים ושלושה לספירת העומר, הוא יום ההילולא של רבי שמעון בר יוחאי. אבלות הספירה נפסקת בו: מדליקים מדורות, מסתפרים ועורכים חתונות.",
    chavouot:
      "שבועות, בו׳ בסיוון, הוא חג מתן תורה, שבעה שבועות אחרי פסח. נוהגים ללמוד בליל החג (תיקון ליל שבועות), קוראים את עשרת הדיברות ואת מגילת רות, והמנהג לאכול מאכלי חלב.",
    "17-tamouz":
      "שבעה עשר בתמוז מזכיר את הבקעת חומות ירושלים. הוא פותח את שלושת השבועות של אבלות המובילים לתשעה באב. הצום מעלות השחר ועד צאת הכוכבים.",
    "ticha-beav":
      "תשעה באב הוא יום חורבן שני בתי המקדש: צום של עשרים וחמש שעות, מן השקיעה ועד צאת הכוכבים למחרת, שבו קוראים מגילת איכה בישיבה על הארץ.",
  },
};

/** Les trois jeux, par langue. */
export const ZMANIM_STRINGS: ZmanimStringsByLocale = { fr: FR, en: EN, he: HE };
