import type { HelpText } from "./catalog";

/**
 * The help center's frequently asked questions (docs/help-center.md): the
 * short answers to what people ask about the app as a whole (is it free,
 * do I need an account, can I read offline, which city are the times
 * for), where a guide shows a part of the app and the page of a version
 * follows its video.
 *
 * A question is written the way someone would ask it; its answer, in two
 * sentences, names the buttons as the app names them. It can lead to the
 * guide that explains more, or into the app. Texts follow catalog.ts: the
 * three languages or the app's own words (an i18n key), the French with
 * its no-break spaces (held by helpCenter.test.ts).
 */

export type HelpFaqEntry = {
  /** Unique, stable: the question's anchor (/aide#gratuite). */
  id: string;
  question: HelpText;
  answer: HelpText;
  /** The guide that explains more (catalog.ts), by slug. */
  guide?: string;
  /** Where it is done in the app: a route of routes.ts. */
  link?: { to: string; label: HelpText };
};

export type HelpFaqGroup = { title: HelpText; entries: HelpFaqEntry[] };

export const HELP_FAQ: HelpFaqGroup[] = [
  {
    title: { fr: "L'app", en: "The app", he: "האפליקציה" },
    entries: [
      {
        id: "gratuite",
        question: {
          fr: "L'app est-elle gratuite ?",
          en: "Is the app free?",
          he: "האם האפליקציה חינמית?",
        },
        answer: {
          fr: "Oui, entièrement : sans publicité, sans achat intégré, sans abonnement. Le site aussi.",
          en: "Yes, entirely: no ads, no in-app purchases, no subscription. The website too.",
          he: "כן, לגמרי: בלי פרסומות, בלי רכישות בתוך האפליקציה ובלי מנוי. גם האתר.",
        },
      },
      {
        id: "compte",
        question: {
          fr: "Faut-il un compte ?",
          en: "Do I need an account?",
          he: "צריך חשבון?",
        },
        answer: {
          fr: "Non : tout se lit et s'écoute sans compte. Un compte garde vos réglages, vos marque-pages, Mon parcours et vos lectures partagées d'un appareil à l'autre.",
          en: "No: everything can be read and listened to without one. An account keeps your settings, your bookmarks, My journey and your shared readings from one device to another.",
          he: "לא: אפשר לקרוא ולהאזין להכול בלי חשבון. חשבון שומר את ההגדרות, הסימניות, המסלול שלי והקריאות המשותפות שלכם ממכשיר למכשיר.",
        },
      },
      {
        id: "site-et-app",
        question: {
          fr: "Le site et l'app, c'est la même chose ?",
          en: "Are the website and the app the same?",
          he: "האתר והאפליקציה הם אותו דבר?",
        },
        answer: {
          fr: "Le même contenu, à la même adresse : petite-jerusalem.fr. L'app ajoute ce qu'un téléphone permet : les rappels, les textes gardés sur l'appareil pour lire sans réseau, et sur Android le téléphone qui se tait pendant la tefila.",
          en: "The same content, at the same address: petite-jerusalem.fr. The app adds what a phone allows: reminders, texts kept on the device to read without a network, and on Android the phone going quiet during the tefila.",
          he: "אותו תוכן, באותה כתובת: petite-jerusalem.fr. האפליקציה מוסיפה את מה שטלפון מאפשר: תזכורות, טקסטים שנשמרים במכשיר לקריאה בלי רשת, ובאנדרואיד הטלפון שמשתתק בזמן התפילה.",
        },
      },
      {
        id: "donnees",
        question: {
          fr: "Que faites-vous de mes données ?",
          en: "What do you do with my data?",
          he: "מה אתם עושים עם הנתונים שלי?",
        },
        answer: {
          fr: "Rien ne part sans votre accord : la mesure d'audience, qui sert à améliorer l'app, attend votre consentement et se règle dans « Gérer les cookies ». Aucune publicité, aucune revente.",
          en: "Nothing leaves without your consent: the audience measurement, which helps improve the app, waits for your agreement and is set in “Manage cookies”. No ads, nothing sold.",
          he: "שום דבר לא יוצא בלי הסכמתכם: מדידת השימוש, שעוזרת לשפר את האפליקציה, מחכה לאישור שלכם ונקבעת ב״ניהול עוגיות״. בלי פרסומות, בלי מכירת נתונים.",
        },
      },
    ],
  },
  {
    title: { fr: "Lire et prier", en: "Reading and praying", he: "קריאה ותפילה" },
    entries: [
      {
        id: "hors-ligne",
        question: {
          fr: "Puis-je lire sans connexion ?",
          en: "Can I read without a connection?",
          he: "אפשר לקרוא בלי חיבור?",
        },
        answer: {
          fr: "Les Tehilim, tout le Sidour et les brahot sont déjà dans l'app. Un autre texte se télécharge depuis le menu de lecture : il s'ouvre ensuite sans réseau, et une coche le dit.",
          en: "The Tehilim, the whole Siddur and the blessings are already in the app. Another text downloads from the reading menu: it then opens without a network, and a tick says so.",
          he: "התהילים, כל הסידור והברכות כבר נמצאים באפליקציה. טקסט אחר יורד מתפריט הקריאה: אחר כך הוא נפתח גם בלי רשת, וסימן וי מראה זאת.",
        },
        guide: "gestes-de-lecture",
      },
      {
        id: "taille-du-texte",
        question: {
          fr: "Comment agrandir le texte ?",
          en: "How do I make the text bigger?",
          he: "איך מגדילים את הטקסט?",
        },
        answer: { key: "tips.reading.pinch.text" },
        guide: "gestes-de-lecture",
      },
      {
        id: "phonetique",
        question: {
          fr: "Peut-on lire en phonétique ?",
          en: "Can I read in transliteration?",
          he: "אפשר לקרוא בתעתיק?",
        },
        answer: {
          fr: "Oui, sur les textes qui l'ont : le menu de lecture bascule entre l'hébreu et la phonétique.",
          en: "Yes, on the texts that have it: the reading menu switches between Hebrew and the phonetic text.",
          he: "כן, בטקסטים שיש להם תעתיק: תפריט הקריאה עובר בין העברית לתעתיק.",
        },
        guide: "gestes-de-lecture",
      },
      {
        id: "erreur-dans-un-texte",
        question: {
          fr: "Comment signaler une erreur dans un texte ?",
          en: "How do I report an error in a text?",
          he: "איך מדווחים על טעות בטקסט?",
        },
        answer: {
          fr: "Depuis la lecture : le second rond du menu porte le formulaire pour nous écrire, sans perdre votre ligne.",
          en: "From the reading itself: the menu's second button holds the form to write to us, without losing your line.",
          he: "מתוך הקריאה: הכפתור השני בתפריט מכיל את הטופס לכתוב לנו, בלי לאבד את השורה.",
        },
      },
    ],
  },
  {
    title: { fr: "Les horaires", en: "Prayer times", he: "זמני היום" },
    entries: [
      {
        id: "ville",
        question: {
          fr: "Comment changer la ville des horaires ?",
          en: "How do I change the city of the times?",
          he: "איך משנים את העיר של הזמנים?",
        },
        answer: { key: "tips.zmanim.place.text" },
        guide: "horaires-et-rappels",
        link: {
          to: "/horaires",
          label: { fr: "Voir les horaires", en: "See the times", he: "לזמני היום" },
        },
      },
      {
        id: "avis",
        question: {
          fr: "Selon quel avis les horaires sont-ils calculés ?",
          en: "Which opinion are the times calculated by?",
          he: "לפי איזו שיטה מחושבים הזמנים?",
        },
        answer: {
          fr: "Celui que vous choisissez, du Rav Meïr Posen ou du Rav Ovadia Yossef : dans l'app, Profil, Préférences ; sur le site, depuis la page des horaires, avec un compte. Pour la pratique, l'avis de votre rav prime.",
          en: "The one you choose, Rav Meir Posen's or Rav Ovadia Yosef's: in the app, Profile, Preferences; on the website, from the times page, with an account. In practice, your rav's opinion comes first.",
          he: "זו שתבחרו, של הרב מאיר פוזן או של הרב עובדיה יוסף: באפליקציה, פרופיל, העדפות; באתר, מדף הזמנים, עם חשבון. למעשה, דעת הרב שלכם קובעת.",
        },
      },
      {
        id: "rappels",
        question: {
          fr: "Je ne reçois pas mes rappels : que faire ?",
          en: "My reminders do not arrive: what can I do?",
          he: "התזכורות שלי לא מגיעות: מה עושים?",
        },
        answer: {
          fr: "Autorisez les notifications de l'app dans les réglages du téléphone : Profil, Notifications le signale quand elles sont bloquées. Les rappels viennent de l'app, pas du site.",
          en: "Allow the app's notifications in the phone's settings: Profile, Notifications says when they are blocked. Reminders come from the app, not the website.",
          he: "אשרו את ההתראות של האפליקציה בהגדרות הטלפון: פרופיל, התראות מציין מתי הן חסומות. התזכורות מגיעות מהאפליקציה, לא מהאתר.",
        },
        guide: "horaires-et-rappels",
      },
    ],
  },
  {
    title: { fr: "Lire à plusieurs", en: "Reading together", he: "קריאה משותפת" },
    entries: [
      {
        id: "creer-une-chaine",
        question: {
          fr: "Comment créer une chaîne de lecture ?",
          en: "How do I create a reading chain?",
          he: "איך יוצרים שרשרת קריאה?",
        },
        answer: {
          fr: "Dans Étude, onglet Partage : « Créer une session », puis le texte et la date. Il faut un compte pour en créer une.",
          en: "In Study, Sharing tab: “Create session”, then the text and the date. Creating one needs an account.",
          he: "בלימוד, לשונית שיתוף: ״צור סשן״, ואז הטקסט והתאריך. כדי ליצור שרשרת צריך חשבון.",
        },
        guide: "lire-a-plusieurs",
      },
      {
        id: "part-sans-compte",
        question: {
          fr: "Peut-on prendre une part sans compte ?",
          en: "Can I take a share without an account?",
          he: "אפשר לקחת חלק בלי חשבון?",
        },
        answer: {
          fr: "Oui : l'appareil vous reconnaît d'une visite à l'autre. Avec un compte, vos parts vous suivent sur tous vos appareils.",
          en: "Yes: the device recognizes you from one visit to the next. With an account, your shares follow you on all your devices.",
          he: "כן: המכשיר מזהה אתכם מביקור לביקור. עם חשבון, החלקים שלכם עוברים איתכם לכל המכשירים.",
        },
        guide: "lire-a-plusieurs",
      },
      {
        id: "inviter",
        question: {
          fr: "Comment inviter d'autres lecteurs ?",
          en: "How do I invite other readers?",
          he: "איך מזמינים קוראים נוספים?",
        },
        answer: {
          fr: "Une chaîne se partage dès sa création : son lien s'envoie par WhatsApp ou ailleurs, et s'ouvre dans l'app comme sur le site.",
          en: "A chain is shared as soon as it is created: its link goes out by WhatsApp or anywhere else, and opens in the app as on the website.",
          he: "שרשרת משותפת מרגע יצירתה: הקישור שלה נשלח בוואטסאפ או בכל דרך אחרת, ונפתח באפליקציה כמו באתר.",
        },
        link: {
          to: "/share-reading",
          label: { fr: "Voir les chaînes", en: "See the chains", he: "לשרשראות" },
        },
      },
    ],
  },
  {
    title: { fr: "Vos réglages", en: "Your settings", he: "ההגדרות שלכם" },
    entries: [
      {
        id: "langue",
        question: {
          fr: "Comment changer de langue ?",
          en: "How do I change the language?",
          he: "איך מחליפים שפה?",
        },
        answer: {
          fr: "Dans l'app, Profil, Langue : français, anglais ou hébreu. Sur le site, dans Apparence.",
          en: "In the app, Profile, Language: French, English or Hebrew. On the website, in Appearance.",
          he: "באפליקציה, פרופיל, שפה: צרפתית, אנגלית או עברית. באתר, במראה.",
        },
      },
      {
        id: "mode-sombre",
        question: {
          fr: "Peut-on passer en mode sombre ?",
          en: "Is there a dark mode?",
          he: "יש מצב כהה?",
        },
        answer: {
          fr: "Oui : Profil, Apparence, avec trois thèmes de couleurs et le contraste renforcé. Tant que vous n'y touchez pas, l'app suit le réglage du téléphone.",
          en: "Yes: Profile, Appearance, with three color themes and higher contrast. Until you change it, the app follows the phone's setting.",
          he: "כן: פרופיל, מראה, עם שלוש ערכות צבע וניגודיות מוגברת. כל עוד לא שיניתם, האפליקציה עוקבת אחרי הגדרת הטלפון.",
        },
      },
      {
        id: "revoir-l-introduction",
        question: {
          fr: "Comment revoir l'introduction ou les astuces ?",
          en: "How do I see the introduction or the tips again?",
          he: "איך רואים שוב את ההיכרות או את הטיפים?",
        },
        answer: {
          fr: "Dans l'app, en bas de ce centre d'aide : « Revoir l'introduction » et « Revoir les astuces ».",
          en: "In the app, at the bottom of this help center: “Replay the introduction” and “Replay the tips”.",
          he: "באפליקציה, בתחתית מרכז העזרה הזה: ״לצפות שוב בהיכרות״ ו״להציג שוב את הטיפים״.",
        },
      },
    ],
  },
];
