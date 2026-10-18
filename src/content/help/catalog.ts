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

export type HelpTopicId = "start" | "home" | "reading" | "parcours" | "zmanim" | "sharing";

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
