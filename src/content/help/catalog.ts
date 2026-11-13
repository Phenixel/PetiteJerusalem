import type { IconName } from "../../components/icons/registry";

/**
 * The help center's guides (docs/help-center.md): how each part of the app
 * is handled, written out and shown. The app grew rich enough that much of
 * it stays obscure until someone explains it; a tip shows a gesture once, on
 * its page (useFeatureTips), and this is where one comes back to it.
 *
 * A guide is data: its topic, its title, a one-line summary, then blocks
 * (a paragraph, a point with its drawn screenshot, a link into the app).
 * The screenshots are drawn, like the introduction's and a chain's
 * instructions (`src/components/mock`): they follow the theme, dark mode
 * and the language, weigh almost nothing and do not age from one redesign
 * to the next. `illustrations.ts` maps their names to components.
 *
 * A text is written here in the three languages, or borrowed from the app's
 * own words with an i18n key: a tip and a guide that explain the same gesture
 * must say it the same way. French follows the house typography: U+202F
 * before « ! », « ? » and « ; », U+00A0 before « : » and inside « »
 * (held by helpCenter.test.ts).
 *
 * The YouTube videos are not here: they are published by the site
 * (`public/aide/videos.json`, see services/helpVideos.ts), so that a new
 * video reaches the installed apps without a release.
 */

export type HelpLocale = "fr" | "en" | "he";

/** A text in the three languages, or the app's own words (an i18n key). */
export type HelpText = Record<HelpLocale, string> | { key: string };

/** The drawn screenshots a guide can show (see illustrations.ts). */
export const HELP_ILLUSTRATIONS = [
  "tab-bar",
  "card-swipe",
  "home-reorder",
  "reading-scrub",
  "zman-reminder",
  "end-pull",
  "reading-menu",
  "pinch",
  "auto-scroll",
  "session-search",
  "session-reserve",
  "session-cancel",
  "session-mark-read",
  "session-read",
] as const;

export type HelpIllustration = (typeof HELP_ILLUSTRATIONS)[number];

export type HelpBlock =
  /** A paragraph. */
  | { kind: "text"; text: HelpText }
  /** One thing to know: a title, two sentences, and what shows it, if drawn. */
  | { kind: "point"; title: HelpText; text: HelpText; illustration?: HelpIllustration }
  /** A way into the part of the app the guide is about. */
  | { kind: "link"; to: string; label: HelpText };

export type HelpTopicId =
  | "start"
  | "home"
  | "prayer"
  | "reading"
  | "parcours"
  | "zmanim"
  | "sharing";

export type HelpTopic = { id: HelpTopicId; icon: IconName; title: HelpText };

export type HelpGuide = {
  /** Its address: /aide/<slug>. Never changed once published: links point to it. */
  slug: string;
  topic: HelpTopicId;
  title: HelpText;
  summary: HelpText;
  blocks: HelpBlock[];
};

/** The topics, in the order a newcomer meets them. */
export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "start",
    icon: "map-pin",
    title: { fr: "Se repérer", en: "Finding your way", he: "התמצאות" },
  },
  { id: "home", icon: "home", title: { key: "common.home" } },
  {
    id: "prayer",
    icon: "book-open",
    title: { fr: "La tefila", en: "Prayer", he: "התפילה" },
  },
  {
    id: "reading",
    icon: "book-open",
    title: { fr: "La lecture", en: "Reading", he: "קריאה" },
  },
  { id: "parcours", icon: "flag", title: { key: "parcours.title" } },
  {
    id: "zmanim",
    icon: "clock",
    title: { fr: "Les horaires", en: "Prayer times", he: "זמני היום" },
  },
  {
    id: "sharing",
    icon: "users",
    title: { fr: "Lire à plusieurs", en: "Reading together", he: "קריאה משותפת" },
  },
];

export const HELP_GUIDES: HelpGuide[] = [
  {
    slug: "nouveaux-onglets",
    topic: "start",
    title: {
      fr: "Où sont passés la Bibliothèque et les Chiourim ?",
      en: "Where did the Library and the Shiurim go?",
      he: "לאן עברו הספרייה והשיעורים?",
    },
    summary: {
      fr: "Depuis la 4.0, ils vivent sous l'onglet Étude, et le Sidour a le sien.",
      en: "Since 4.0 they live under the Study tab, and the Siddur has its own.",
      he: "מאז גרסה 4.0 הם נמצאים בלשונית לימוד, ולסידור יש לשונית משלו.",
    },
    blocks: [
      {
        kind: "point",
        illustration: "tab-bar",
        title: {
          fr: "Quatre onglets, l'horloge au milieu",
          en: "Four tabs, the clock in the middle",
          he: "ארבע לשוניות, השעון באמצע",
        },
        text: {
          fr: "Accueil, Sidour, Étude et Profil. Le rond du milieu ouvre les horaires du jour.",
          en: "Home, Siddur, Study and Profile. The round button in the middle opens the day's times.",
          he: "בית, סידור, לימוד ופרופיל. הכפתור העגול שבאמצע פותח את זמני היום.",
        },
      },
      {
        kind: "point",
        title: {
          fr: "Étude réunit tout",
          en: "Study brings it all together",
          he: "לימוד מאחד הכול",
        },
        text: {
          fr: "La Bibliothèque, les Chiourim et le Partage : les onglets en tête de page passent de l'un à l'autre.",
          en: "The Library, the Shiurim and Sharing: the tabs at the top of the page go from one to the other.",
          he: "הספרייה, השיעורים והשיתוף: הלשוניות בראש הדף עוברות מאחד לשני.",
        },
      },
      {
        kind: "point",
        title: {
          fr: "Le Sidour a son onglet",
          en: "The Siddur has its own tab",
          he: "לסידור לשונית משלו",
        },
        text: {
          fr: "Il prend la place de l'ancienne Bibliothèque, et s'ouvre sur la prière du moment.",
          en: "It takes the old Library's place, and opens on the prayer of the moment.",
          he: "הוא תופס את מקומה של הספרייה הקודמת, ונפתח על התפילה של הרגע.",
        },
      },
      { kind: "link", to: "/bibliotheque", label: { key: "common.study" } },
    ],
  },
  {
    slug: "votre-journee",
    topic: "home",
    title: { key: "tips.parcours.deck.title" },
    summary: {
      fr: "Ce qui est à faire aujourd'hui, une carte après l'autre.",
      en: "What is on for today, one card after the other.",
      he: "מה שיש לעשות היום, כרטיס אחרי כרטיס.",
    },
    blocks: [
      {
        kind: "point",
        illustration: "card-swipe",
        title: {
          fr: "Glissez quand c'est fait",
          en: "Swipe when it is done",
          he: "החליקו כשזה נעשה",
        },
        text: { key: "tips.parcours.deck.text" },
      },
      {
        kind: "point",
        title: { key: "tips.parcours.dayBar.title" },
        text: { key: "tips.parcours.dayBar.text" },
      },
      {
        kind: "text",
        text: {
          fr: "Le Sidour fait de même avec sa carte du moment : glissée à droite, la prière est notée comme dite.",
          en: "The Siddur does the same with its card of the moment: swiped to the right, the prayer is noted as said.",
          he: "הסידור עושה אותו דבר עם כרטיס הרגע שלו: החלקה ימינה רושמת שהתפילה נאמרה.",
        },
      },
      { kind: "link", to: "/", label: { key: "common.home" } },
    ],
  },
  {
    slug: "accueil-a-votre-gout",
    topic: "home",
    title: {
      fr: "L'accueil à votre goût",
      en: "The home page, your way",
      he: "דף הבית לטעמכם",
    },
    summary: {
      fr: "Les blocs dans l'ordre qui vous sert, vos livres sous la main.",
      en: "The blocks in the order that suits you, your books at hand.",
      he: "הבלוקים בסדר שנוח לכם, והספרים שלכם בהישג יד.",
    },
    blocks: [
      {
        kind: "point",
        illustration: "home-reorder",
        title: {
          fr: "Un appui long soulève un bloc",
          en: "A long press lifts a block",
          he: "לחיצה ארוכה מרימה בלוק",
        },
        text: { key: "home.edit.hint" },
      },
      {
        kind: "point",
        title: { key: "home.edit.blocks.livres.title" },
        text: {
          fr: "Jusqu'à trois livres ou textes sur une étagère de l'accueil : le Sidour, les Tehilim, un office. Ils se choisissent en modifiant l'accueil.",
          en: "Up to three books or texts on a shelf of the home page: the Siddur, the Tehilim, a service. They are chosen while editing the home page.",
          he: "עד שלושה ספרים או טקסטים על מדף בדף הבית: הסידור, התהילים, תפילה. בוחרים אותם בעריכת דף הבית.",
        },
      },
      { kind: "link", to: "/accueil/modifier", label: { key: "home.edit.link" } },
    ],
  },
  {
    slug: "avant-la-tefila",
    topic: "prayer",
    title: {
      fr: "Le téléphone se tait pendant la tefila",
      en: "The phone goes quiet for the tefila",
      he: "הטלפון שותק בזמן התפילה",
    },
    summary: {
      fr: "Sur Android, Ne pas déranger, silencieux ou vibreur, d'une touche quand l'office s'ouvre.",
      en: "On Android, Do not disturb, silent or vibrate, in one touch when the service opens.",
      he: "באנדרואיד: נא לא להפריע, שקט או רטט, בנגיעה אחת כשהתפילה נפתחת.",
    },
    blocks: [
      {
        kind: "point",
        title: { key: "prayerQuiet.title" },
        text: {
          fr: "Quand Cha'harit, Min'ha ou Arvit s'ouvre, un panneau descend du haut de l'écran : Ne pas déranger, Silencieux et Vibreur, chacun avec son état. L'app reste utilisable dessous.",
          en: "When Shacharit, Mincha or Arvit opens, a panel comes down from the top of the screen: Do not disturb, Silent and Vibrate, each with its state. The app stays usable below it.",
          he: "כששחרית, מנחה או ערבית נפתחות, לוח יורד מראש המסך: נא לא להפריע, שקט ורטט, כל אחד עם המצב שלו. האפליקציה שמתחתיו ממשיכה לעבוד.",
        },
      },
      {
        kind: "point",
        title: { key: "prayerQuiet.settings.title" },
        text: { key: "prayerQuiet.settings.hint" },
      },
      {
        kind: "point",
        title: {
          fr: "Où le régler",
          en: "Where to set it",
          he: "איפה מגדירים",
        },
        text: { key: "prayerQuiet.farewell" },
      },
      {
        kind: "text",
        text: {
          fr: "Sur iPhone, le système ne laisse pas une app changer ces modes : le panneau n'y vient pas.",
          en: "On iPhone, the system lets no app change these modes: the panel does not come there.",
          he: "באייפון המערכת לא מאפשרת לאפליקציה לשנות את המצבים האלה, ולכן הלוח לא מופיע שם.",
        },
      },
      { kind: "link", to: "/sidour", label: { key: "common.sidour" } },
    ],
  },
  {
    slug: "heure-de-la-tefila",
    topic: "prayer",
    title: {
      fr: "L'heure de la prière, sous son ciel",
      en: "The time to pray, under its sky",
      he: "זמן התפילה, תחת השמיים שלו",
    },
    summary: {
      fr: "La pastille en tête d'un office, et le cycle du jour quand on la touche.",
      en: "The pill at the head of a service, and the day's cycle when touched.",
      he: "התווית בראש התפילה, ומחזור היום כשנוגעים בה.",
    },
    blocks: [
      {
        kind: "point",
        title: {
          fr: "Ce qui compte maintenant",
          en: "What matters now",
          he: "מה שחשוב עכשיו",
        },
        text: {
          fr: "En tête de Cha'harit, de Min'ha ou d'Arvit, une pastille dit jusqu'à quand prier et combien de temps il reste, avec le ciel de ce moment.",
          en: "At the head of Shacharit, Mincha or Arvit, a pill says until when to pray and how long is left, with the sky of that moment.",
          he: "בראש שחרית, מנחה או ערבית, תווית אומרת עד מתי להתפלל וכמה זמן נשאר, עם השמיים של אותו רגע.",
        },
      },
      {
        kind: "point",
        title: {
          fr: "Le cycle du jour",
          en: "The cycle of the day",
          he: "מחזור היום",
        },
        text: {
          fr: "Touchez-la : le jour et la nuit d'un trait, le bon moment en couleur, « Hors de son temps » en pointillé, et maintenant, le soleil ou la lune.",
          en: "Touch it: day and night in one line, the right moment in color, “Out of its time” dashed, and now, the sun or the moon.",
          he: "נגעו בה: היום והלילה בקו אחד, הזמן הנכון בצבע, ״מחוץ לזמנה״ בקו מקווקו, ועכשיו, השמש או הירח.",
        },
      },
      {
        kind: "point",
        title: {
          fr: "Les repères, un à un",
          en: "Each landmark",
          he: "ציוני הדרך, אחד אחד",
        },
        text: {
          fr: "Sous le dessin, chaque horaire et le temps qui reste avant lui, puis la règle en entier.",
          en: "Under the drawing, each time and how long until it comes, then the rule in full.",
          he: "מתחת לציור, כל זמן וכמה נשאר עד אליו, ואחר כך הכלל במלואו.",
        },
      },
      { kind: "link", to: "/sidour", label: { key: "common.sidour" } },
    ],
  },
  {
    slug: "office-dit",
    topic: "prayer",
    title: {
      fr: "Marquer un office comme dit",
      en: "Marking a service as said",
      he: "לסמן תפילה כנאמרה",
    },
    summary: {
      fr: "Au bout du texte, poussez la page ; ou glissez la carte du moment.",
      en: "At the end of the text, push the page; or swipe the card of the moment.",
      he: "בסוף הטקסט, דחפו את הדף; או החליקו את כרטיס הרגע.",
    },
    blocks: [
      {
        kind: "point",
        illustration: "end-pull",
        title: {
          fr: "Poussez la page au-delà de sa fin",
          en: "Push the page past its end",
          he: "דחפו את הדף מעבר לסופו",
        },
        text: {
          fr: "Au bout de l'office, posez le doigt n'importe où et poussez encore vers le haut : l'anneau se remplit. Relâché plein, l'office est noté.",
          en: "At the end of the service, lay a finger anywhere and push up again: the ring fills. Let go full, the service is marked.",
          he: "בסוף התפילה, הניחו אצבע בכל מקום ודחפו שוב למעלה: הטבעת מתמלאת. כשמשחררים אותה מלאה, התפילה נרשמת.",
        },
      },
      {
        kind: "point",
        illustration: "card-swipe",
        title: {
          fr: "Ou glissez la carte du moment",
          en: "Or swipe the card of the moment",
          he: "או החליקו את כרטיס הרגע",
        },
        text: {
          fr: "Sur le Sidour, la carte de l'office en cours se glisse à droite, comme celles de l'accueil.",
          en: "On the Siddur, the card of the current service swipes to the right, like those of the home page.",
          he: "בסידור, כרטיס התפילה הנוכחית מוחלק ימינה, כמו הכרטיסים של דף הבית.",
        },
      },
      {
        kind: "text",
        text: {
          fr: "Le Sidour passe alors à la suite : après Cha'harit, Min'ha ; après Arvit, le Chéma du coucher.",
          en: "The Siddur then moves on: after Shacharit, Mincha; after Arvit, the bedtime Shema.",
          he: "הסידור עובר אז הלאה: אחרי שחרית, מנחה; אחרי ערבית, קריאת שמע על המיטה.",
        },
      },
    ],
  },
  {
    slug: "boussole-du-kotel",
    topic: "prayer",
    title: {
      fr: "Se tourner vers le Kotel",
      en: "Facing the Kotel",
      he: "לפנות אל הכותל",
    },
    summary: {
      fr: "La boussole se remplit quand vous êtes face à Jérusalem.",
      en: "The compass fills when you face Jerusalem.",
      he: "המצפן מתמלא כשאתם פונים לירושלים.",
    },
    blocks: [
      {
        kind: "point",
        title: {
          fr: "Où la trouver",
          en: "Where to find it",
          he: "איפה למצוא אותו",
        },
        text: {
          fr: "Dans les outils du Sidour, « Direction du Kotel », et au titre de la 'Amida.",
          en: "Among the Siddur's tools, “Direction of the Kotel”, and at the title of the Amida.",
          he: "בכלים של הסידור, ״כיוון הכותל״, ובכותרת של העמידה.",
        },
      },
      {
        kind: "point",
        title: {
          fr: "Elle se remplit",
          en: "It fills",
          he: "הוא מתמלא",
        },
        text: {
          fr: "Tournez-vous : la couleur monte dans le cadran à l'approche, le téléphone vibre tous les dix degrés, et le cadran se remplit quand vous êtes face au Kotel.",
          en: "Turn around: the color rises in the dial as you get close, the phone clicks every ten degrees, and the dial fills when you face the Kotel.",
          he: "הסתובבו: הצבע עולה בחוגה ככל שמתקרבים, הטלפון רוטט כל עשר מעלות, והחוגה מתמלאת כשאתם מול הכותל.",
        },
      },
      {
        kind: "point",
        title: {
          fr: "Calibrer",
          en: "Calibrating",
          he: "כיול",
        },
        text: {
          fr: "Si la précision est faible, « Calibrer » montre le geste : un 8 dans l'air, et la boussole revient d'elle-même.",
          en: "When accuracy is low, “Calibrate” shows the gesture: a figure 8 in the air, and the compass comes back on its own.",
          he: "כשהדיוק נמוך, ״כיול״ מראה את התנועה: שמונה באוויר, והמצפן חוזר מעצמו.",
        },
      },
      { kind: "link", to: "/sidour", label: { key: "common.sidour" } },
    ],
  },
  {
    slug: "gestes-de-lecture",
    topic: "reading",
    title: { key: "onboarding.gestures.title" },
    summary: {
      fr: "Le menu, la taille du texte, le défilement automatique, la lecture hors ligne.",
      en: "The menu, the text size, automatic scrolling, reading offline.",
      he: "התפריט, גודל הטקסט, גלילה אוטומטית, קריאה במצב לא מקוון.",
    },
    blocks: [
      {
        kind: "point",
        illustration: "reading-menu",
        title: { key: "tips.reading.menu.title" },
        text: { key: "tips.reading.menu.text" },
      },
      {
        kind: "point",
        illustration: "pinch",
        title: { key: "tips.reading.pinch.title" },
        text: { key: "tips.reading.pinch.text" },
      },
      {
        kind: "point",
        illustration: "auto-scroll",
        title: { key: "tips.reading.autoScroll.title" },
        text: { key: "tips.reading.autoScroll.text" },
      },
      {
        kind: "point",
        title: { key: "tips.reading.download.title" },
        text: { key: "tips.reading.download.text" },
      },
      {
        kind: "point",
        title: { key: "tips.reading.settings.title" },
        text: { key: "tips.reading.settings.text" },
      },
    ],
  },
  {
    slug: "barre-de-lecture",
    topic: "reading",
    title: {
      fr: "Se déplacer dans un long texte",
      en: "Getting around a long text",
      he: "ניווט בטקסט ארוך",
    },
    summary: {
      fr: "La barre de lecture se fait glisser et mène au bon passage.",
      en: "The reading bar slides, and takes you to the right passage.",
      he: "סרגל הקריאה נגרר באצבע ומביא אתכם לקטע הנכון.",
    },
    blocks: [
      {
        kind: "point",
        illustration: "reading-scrub",
        title: {
          fr: "Faites glisser la barre",
          en: "Slide the bar",
          he: "גררו את הסרגל",
        },
        text: {
          fr: "Posez le doigt sur la fine ligne en bas de la lecture et faites-le glisser : la page suit, jusqu'à la fin du texte.",
          en: "Lay a finger on the thin line at the bottom of the reading and slide it: the page follows, all the way to the end of the text.",
          he: "הניחו אצבע על הקו הדק בתחתית הקריאה וגררו אותה: הדף עוקב, עד סוף הטקסט.",
        },
      },
      {
        kind: "point",
        title: {
          fr: "Les titres défilent avec elle",
          en: "The titles ride along",
          he: "הכותרות נעות איתו",
        },
        text: {
          fr: "Le passage atteint s'écrit en grand au-dessus du doigt, avec sa part du texte : la 'Amida d'un Cha'harit, la fin d'un long daf, en un seul geste.",
          en: "The passage reached is written large above your finger, with its share of the text: the Amida of a Shacharit, the end of a long daf, in one gesture.",
          he: "הקטע שהגעתם אליו נכתב בגדול מעל האצבע, עם החלק שלו בטקסט: העמידה של שחרית, סוף דף ארוך, בתנועה אחת.",
        },
      },
    ],
  },
  {
    slug: "mon-parcours",
    topic: "parcours",
    title: { key: "parcours.title" },
    summary: {
      fr: "La lumière de la série, le mur, vos volumes et vos objectifs.",
      en: "The streak's light, the wall, your volumes and your goals.",
      he: "האור של הרצף, החומה, הכרכים והמטרות שלכם.",
    },
    blocks: [
      {
        kind: "point",
        title: { key: "tips.parcours.lamp.title" },
        text: { key: "tips.parcours.lamp.text" },
      },
      {
        kind: "point",
        title: { key: "tips.parcours.wall.title" },
        text: { key: "tips.parcours.wall.text" },
      },
      {
        kind: "point",
        title: { key: "tips.parcours.volumes.title" },
        text: { key: "tips.parcours.volumes.text" },
      },
      {
        kind: "point",
        title: { key: "tips.parcours.new.title" },
        text: { key: "tips.parcours.new.text" },
      },
      { kind: "link", to: "/parcours", label: { key: "parcours.title" } },
    ],
  },
  {
    slug: "heures-de-ma-journee",
    topic: "parcours",
    title: { key: "parcours.reminders.title" },
    summary: {
      fr: "Un rappel aux moments de votre journée, s'il reste quelque chose à faire.",
      en: "A reminder at the moments of your day, when something is left to do.",
      he: "תזכורת ברגעי היום שלכם, כשנשאר משהו לעשות.",
    },
    blocks: [
      {
        kind: "point",
        title: {
          fr: "Le réveil, en haut de Mon parcours",
          en: "The alarm clock, at the top of My journey",
          he: "השעון המעורר, בראש המסלול שלי",
        },
        text: {
          fr: "Il ouvre les heures de votre journée : Réveil, Cha'harit, Midi, Min'ha, Arvit et Coucher, chacune avec son interrupteur.",
          en: "It opens the hours of your day: Wake-up, Shacharit, Midday, Mincha, Arvit and Bedtime, each with its switch.",
          he: "הוא פותח את שעות היום שלכם: השכמה, שחרית, צהריים, מנחה, ערבית ושינה, כל אחת עם המתג שלה.",
        },
      },
      {
        kind: "point",
        title: {
          fr: "Une heure fixe, ou selon le calendrier",
          en: "A fixed time, or by the calendar",
          he: "שעה קבועה, או לפי הלוח",
        },
        text: {
          fr: "Touchez un moment : une heure fixe, ou un horaire du jour avec un écart (« 20 min avant Chkia »). L'heure suit alors le soleil.",
          en: "Touch a moment: a fixed time, or one of the day's times with an offset (“20 min before sunset”). The time then follows the sun.",
          he: "נגעו ברגע: שעה קבועה, או אחד מזמני היום עם הפרש (״20 דקות לפני השקיעה״). השעה עוקבת אז אחרי השמש.",
        },
      },
      {
        kind: "point",
        title: {
          fr: "Seulement s'il reste à faire",
          en: "Only when something is left",
          he: "רק כשנשאר מה לעשות",
        },
        text: { key: "parcours.reminders.footer" },
      },
      { kind: "link", to: "/parcours", label: { key: "parcours.title" } },
    ],
  },
  {
    slug: "horaires-et-rappels",
    topic: "zmanim",
    title: {
      fr: "Les horaires et leurs rappels",
      en: "Prayer times and their reminders",
      he: "זמני היום והתזכורות שלהם",
    },
    summary: {
      fr: "Un rappel d'un geste, le lieu des horaires, une autre date.",
      en: "A reminder in one swipe, the place of the times, another date.",
      he: "תזכורת בתנועה אחת, המקום של הזמנים, תאריך אחר.",
    },
    blocks: [
      {
        kind: "point",
        illustration: "zman-reminder",
        title: { key: "tips.zmanim.reminder.title" },
        text: { key: "tips.zmanim.reminder.text" },
      },
      {
        kind: "point",
        title: { key: "tips.zmanim.place.title" },
        text: { key: "tips.zmanim.place.text" },
      },
      {
        kind: "point",
        title: { key: "tips.zmanim.date.title" },
        text: { key: "tips.zmanim.date.text" },
      },
      {
        kind: "link",
        to: "/horaires",
        label: {
          fr: "Voir les horaires",
          en: "See the times",
          he: "לזמני היום",
        },
      },
    ],
  },
  {
    slug: "lire-a-plusieurs",
    topic: "sharing",
    title: {
      fr: "Une chaîne de lecture",
      en: "A reading chain",
      he: "שרשרת קריאה",
    },
    summary: {
      fr: "Trouver un texte, réserver sa part, la marquer comme lue.",
      en: "Find a text, reserve your share, mark it as read.",
      he: "למצוא טקסט, לשריין את החלק שלכם, לסמן אותו כנקרא.",
    },
    blocks: [
      {
        kind: "text",
        text: {
          fr: "Une chaîne partage un livre entre plusieurs personnes, les Tehilim pour un malade, un traité pour un défunt : chacun réserve sa part et la coche une fois lue.",
          en: "A chain shares a book among several people, the Tehilim for someone ill, a tractate in memory of the departed: each one reserves a share and checks it once read.",
          he: "שרשרת מחלקת ספר בין כמה אנשים, תהילים לרפואת חולה, מסכת לעילוי נשמה: כל אחד משריין את חלקו ומסמן אותו אחרי הקריאה.",
        },
      },
      {
        kind: "point",
        illustration: "session-search",
        title: { key: "detailSession.instructions.steps.search.title" },
        text: { key: "detailSession.instructions.steps.search.text" },
      },
      {
        kind: "point",
        illustration: "session-reserve",
        title: { key: "detailSession.instructions.steps.reserve.title" },
        text: { key: "detailSession.instructions.steps.reserve.text" },
      },
      {
        kind: "point",
        illustration: "session-cancel",
        title: { key: "detailSession.instructions.steps.cancel.title" },
        text: { key: "detailSession.instructions.steps.cancel.text" },
      },
      {
        kind: "point",
        illustration: "session-mark-read",
        title: { key: "detailSession.instructions.steps.markRead.title" },
        text: { key: "detailSession.instructions.steps.markRead.text" },
      },
      {
        kind: "point",
        illustration: "session-read",
        title: { key: "detailSession.instructions.steps.read.title" },
        text: { key: "detailSession.instructions.steps.read.text" },
      },
      {
        kind: "link",
        to: "/share-reading",
        label: {
          fr: "Voir les chaînes",
          en: "See the chains",
          he: "לשרשראות",
        },
      },
    ],
  },
  {
    slug: "nichmat-40",
    topic: "sharing",
    title: {
      fr: "Nichmat 40",
      en: "Nishmat 40",
      he: "נשמת 40",
    },
    summary: {
      fr: "Quarante personnes disent Nichmat chaque jour, quarante jours durant.",
      en: "Forty people say Nishmat every day, for forty days.",
      he: "ארבעים איש אומרים נשמת כל יום, במשך ארבעים יום.",
    },
    blocks: [
      {
        kind: "point",
        title: {
          fr: "Une place, quarante jours",
          en: "One place, forty days",
          he: "מקום אחד, ארבעים יום",
        },
        text: {
          fr: "Chaque lecteur prend une place et dit Nichmat kol 'hai chaque jour. La chaîne se crée comme les autres, en choisissant « Nichmat 40 ».",
          en: "Each reader takes a place and says Nishmat kol chai every day. The chain is created like the others, by choosing “Nishmat 40”.",
          he: "כל קורא לוקח מקום ואומר נשמת כל חי בכל יום. השרשרת נוצרת כמו האחרות, בבחירת ״נשמת 40״.",
        },
      },
      {
        kind: "point",
        title: { key: "nichmat.readToday" },
        text: {
          fr: "Ce bouton coche le jour. Un jour oublié se rattrape : touchez-le dans la grille de vos quarante jours.",
          en: "This button ticks the day. A forgotten day can be caught up: touch it in the grid of your forty days.",
          he: "הכפתור הזה מסמן את היום. יום שנשכח אפשר להשלים: נגעו בו ברשת ארבעים הימים שלכם.",
        },
      },
      {
        kind: "point",
        title: { key: "nichmat.statusLabel" },
        text: {
          fr: "En tête, le jour de la chaîne et les lectures faites ; en bas, les lecteurs et leurs jours.",
          en: "At the top, the chain's day and the readings done; below, the readers and their days.",
          he: "למעלה, היום של השרשרת והקריאות שנעשו; למטה, הקוראים והימים שלהם.",
        },
      },
      {
        kind: "link",
        to: "/share-reading",
        label: {
          fr: "Voir les chaînes",
          en: "See the chains",
          he: "לשרשראות",
        },
      },
    ],
  },
];

export function guideBySlug(slug: string): HelpGuide | undefined {
  return HELP_GUIDES.find((guide) => guide.slug === slug);
}

/** The topics that hold at least one guide, each with its guides. */
export function guidesByTopic(guides: HelpGuide[] = HELP_GUIDES) {
  return HELP_TOPICS.map((topic) => ({
    topic,
    guides: guides.filter((guide) => guide.topic === topic.id),
  })).filter((group) => group.guides.length > 0);
}

/** Other guides to read after this one: its topic first, then the next ones. */
export function relatedGuides(slug: string, count = 3): HelpGuide[] {
  const guide = guideBySlug(slug);
  if (!guide) return HELP_GUIDES.slice(0, count);
  const sameTopic = HELP_GUIDES.filter((g) => g.topic === guide.topic && g.slug !== slug);
  const index = HELP_GUIDES.indexOf(guide);
  const following = [...HELP_GUIDES.slice(index + 1), ...HELP_GUIDES.slice(0, index)].filter(
    (g) => g.topic !== guide.topic,
  );
  return [...sameTopic, ...following].slice(0, count);
}
