import type { HelpText } from "./catalog";
import WHATS_NEW_CHAPTERS from "./whatsNewChapters.json";

/**
 * What a version changed, passage by passage (docs/help-center.md): the
 * help center's page of a version (/aide/nouveautes/4.0) follows its
 * "what's new" video, passage after passage, and under each one answers
 * the questions it raises. A passage plays again from its start: where it
 * starts in each language's video is written by the promo project
 * (whatsNewChapters.json, promo/scripts/chapters.mjs), from the cut the
 * videos are rendered from.
 *
 * Every chapter of the video has its passage here, and every passage a
 * chapter (held by helpCenter.test.ts): a video that gains a chapter fails
 * the checks until its questions are written.
 *
 * Texts follow catalog.ts: the three languages, or the app's own words (an
 * i18n key); the French with its no-break spaces.
 */

/** A question someone asks about a passage, and its answer. */
export type HelpQuestion = { question: HelpText; answer: HelpText };

export type HelpPassage = {
  /** The chapter of the video it goes with: its id in whatsNewChapters.json. */
  chapter: string;
  title: HelpText;
  questions: HelpQuestion[];
  /** The guides that explain it further (catalog.ts), by slug. */
  guides?: string[];
  /** Where it lives in the app: a route of routes.ts. */
  link?: { to: string; label: HelpText };
};

export type HelpVersion = {
  /** As the video names it, and its address: /aide/nouveautes/<version>. */
  version: string;
  /** What the version changes, in two sentences. */
  intro: HelpText;
  passages: HelpPassage[];
};

/** A passage of a video, in seconds. */
export type VideoChapter = { id: string; start: number; end: number };

const CHAPTERS = WHATS_NEW_CHAPTERS as Record<string, Record<string, VideoChapter[]>>;

const study = { to: "/bibliotheque", label: { key: "common.study" } };
const sidour = { to: "/sidour", label: { key: "common.sidour" } };

export const HELP_VERSIONS: HelpVersion[] = [
  {
    version: "4.0",
    intro: {
      fr: "La 4.0 range l'app autrement : la Bibliothèque et les Chiourim passent dans Étude, le Sidour prend son onglet, Mon parcours remplace la lecture du jour. Elle ajoute de quoi prier, étudier et lire à plusieurs.",
      en: "4.0 arranges the app differently: the Library and the Shiurim move into Study, the Siddur gets its own tab, My journey replaces the daily reading. It adds ways to pray, to study and to read together.",
      he: "גרסה 4.0 מסדרת את האפליקציה אחרת: הספרייה והשיעורים עוברים ללימוד, לסידור יש לשונית משלו, והמסלול שלי מחליף את הקריאה היומית. היא מוסיפה כלים לתפילה, ללימוד ולקריאה משותפת.",
    },
    passages: [
      {
        chapter: "bars",
        title: {
          fr: "Les onglets changent",
          en: "The tabs change",
          he: "הלשוניות משתנות",
        },
        questions: [
          {
            question: {
              fr: "Où sont passés la Bibliothèque et les Chiourim ?",
              en: "Where did the Library and the Shiurim go?",
              he: "לאן עברו הספרייה והשיעורים?",
            },
            answer: {
              fr: "Dans l'onglet Étude, avec le Partage : les onglets en tête de page passent de l'un à l'autre. Le Sidour a pris la place de l'ancienne Bibliothèque.",
              en: "Into the Study tab, with Sharing: the tabs at the top of the page go from one to the other. The Siddur took the old Library's place.",
              he: "ללשונית לימוד, יחד עם השיתוף: הלשוניות בראש הדף עוברות מאחד לשני. הסידור תפס את מקומה של הספרייה הקודמת.",
            },
          },
          {
            question: {
              fr: "À quoi sert le rond au milieu de la barre ?",
              en: "What is the round button in the middle of the bar for?",
              he: "למה משמש הכפתור העגול שבאמצע הסרגל?",
            },
            answer: {
              fr: "Il ouvre les horaires du jour, où que vous soyez dans l'app.",
              en: "It opens the day's times, wherever you are in the app.",
              he: "הוא פותח את זמני היום, מכל מקום באפליקציה.",
            },
          },
        ],
        guides: ["nouveaux-onglets"],
        link: study,
      },
      {
        chapter: "etude",
        title: {
          fr: "Étude réunit tout",
          en: "Study brings it all together",
          he: "לימוד מאחד הכול",
        },
        questions: [
          {
            question: {
              fr: "Que trouve-t-on dans Étude ?",
              en: "What is in Study?",
              he: "מה יש בלשונית לימוד?",
            },
            answer: {
              fr: "Trois onglets en tête de page : la Bibliothèque (Tehilim, Michna, Talmud, Tanakh, Moussar, Halakha), les Chiourim, et le Partage, où vivent les chaînes de lecture.",
              en: "Three tabs at the top of the page: the Library (Tehilim, Mishna, Talmud, Tanakh, Mussar, Halakha), the Shiurim, and Sharing, where the reading chains live.",
              he: "שלוש לשוניות בראש הדף: הספרייה (תהילים, משנה, תלמוד, תנ״ך, מוסר, הלכה), השיעורים, והשיתוף, שבו נמצאות שרשראות הקריאה.",
            },
          },
          {
            question: {
              fr: "Le Sidour n'est plus dans la Bibliothèque ?",
              en: "Is the Siddur no longer in the Library?",
              he: "הסידור כבר לא נמצא בספרייה?",
            },
            answer: {
              fr: "Non : il a sa page, l'onglet Sidour. Ses textes gardent leur adresse : un lien partagé ou le widget s'ouvrent toujours.",
              en: "No: it has its own page, the Siddur tab. Its texts keep their address: a shared link or the widget still opens.",
              he: "לא: יש לו דף משלו, לשונית הסידור. הטקסטים שלו שומרים על הכתובת: קישור ששותף או הווידג׳ט ממשיכים להיפתח.",
            },
          },
        ],
        guides: ["nouveaux-onglets"],
        link: study,
      },
      {
        chapter: "sidour",
        title: {
          fr: "Le Sidour a son onglet",
          en: "The Siddur has its own tab",
          he: "לסידור לשונית משלו",
        },
        questions: [
          {
            question: {
              fr: "Sur quoi s'ouvre le Sidour ?",
              en: "What does the Siddur open on?",
              he: "על מה הסידור נפתח?",
            },
            answer: {
              fr: "Sur la prière du moment, à l'heure de votre lieu : Cha'harit, Min'ha ou Arvit, et les soirs où elle se dit, la bénédiction de la lune. Rien qui ne se dise pas maintenant n'est mis en avant.",
              en: "On the prayer of the moment, by the time where you are: Shacharit, Mincha or Arvit, and on the nights it is said, the blessing of the moon. Nothing that cannot be said now is put forward.",
              he: "על התפילה של הרגע, לפי השעה במקום שלכם: שחרית, מנחה או ערבית, ובלילות שבהם אומרים אותה, ברכת הלבנה. שום דבר שאי אפשר לומר עכשיו לא מוצג בראש.",
            },
          },
          {
            question: {
              fr: "Comment trouver une prière ?",
              en: "How do I find a prayer?",
              he: "איך מוצאים תפילה?",
            },
            answer: {
              fr: "Le champ de recherche, sous la carte du moment, cherche dans tous les textes du Sidour, par leur nom en hébreu ou en français, même avec une faute de frappe.",
              en: "The search field, under the card of the moment, searches all the Siddur's texts, by their Hebrew or English name, even with a typo.",
              he: "שדה החיפוש, מתחת לכרטיס הרגע, מחפש בכל הטקסטים של הסידור, לפי השם בעברית או בלועזית, גם עם שגיאת הקלדה.",
            },
          },
          {
            question: {
              fr: "Le Sidour marche-t-il sans réseau ?",
              en: "Does the Siddur work offline?",
              he: "האם הסידור עובד בלי חיבור?",
            },
            answer: {
              fr: "Oui : ses textes voyagent avec l'app, et ceux de la période de fête en cours se téléchargent d'eux-mêmes. À la synagogue, il s'ouvre comme ailleurs.",
              en: "Yes: its texts travel with the app, and those of the current holiday season download on their own. At the synagogue, it opens like anywhere else.",
              he: "כן: הטקסטים שלו נמצאים באפליקציה עצמה, ואלה של תקופת החג הנוכחית יורדים מעצמם. בבית הכנסת הוא נפתח כמו בכל מקום.",
            },
          },
        ],
        link: sidour,
      },
      {
        chapter: "calme",
        title: {
          fr: "Le téléphone se tait",
          en: "The phone goes quiet",
          he: "הטלפון משתתק",
        },
        questions: [
          {
            question: {
              fr: "Quel est ce panneau qui descend quand j'ouvre un office ?",
              en: "What is the panel that comes down when I open a service?",
              he: "מה הלוח שיורד כשאני פותח תפילה?",
            },
            answer: {
              fr: "Les modes calmes du téléphone : Ne pas déranger, Silencieux et Vibreur, chacun avec son état. Une touche les active ; l'app reste utilisable dessous.",
              en: "The phone's quiet modes: Do not disturb, Silent and Vibrate, each with its state. One touch turns them on; the app stays usable below.",
              he: "מצבי השקט של הטלפון: נא לא להפריע, שקט ורטט, כל אחד עם המצב שלו. נגיעה אחת מפעילה אותם; האפליקציה שמתחת ממשיכה לעבוד.",
            },
          },
          {
            question: {
              fr: "Le téléphone revient-il comme avant ?",
              en: "Does the phone go back to how it was?",
              he: "האם הטלפון חוזר למצבו הקודם?",
            },
            answer: {
              fr: "Oui, à la fin de la tefila : seul ce que l'app a changé est défait. Ce qui était déjà activé avant le reste.",
              en: "Yes, at the end of the tefila: only what the app changed is undone. What was already on before stays on.",
              he: "כן, בסוף התפילה: רק מה שהאפליקציה שינתה מתבטל. מה שהיה מופעל קודם נשאר מופעל.",
            },
          },
          {
            question: {
              fr: "Comment garder les mêmes modes, ou ne plus voir le panneau ?",
              en: "How do I keep the same modes, or stop seeing the panel?",
              he: "איך שומרים את אותם מצבים, או מפסיקים לראות את הלוח?",
            },
            answer: {
              fr: "« À chaque tefila » garde les modes activés pour toutes les prières ; « Fermer » propose « Ne plus afficher la prochaine fois ». Tout se retrouve dans Profil, Préférences, « Avant une tefila ».",
              en: "“Every tefila” keeps the modes that are on for every prayer; “Close” offers “Don't show it next time”. It is all found again in Profile, Preferences, “Before a tefila”.",
              he: "״לכל תפילה״ שומר את המצבים המופעלים לכל התפילות; ״סגירה״ מציע ״לא להציג בפעם הבאה״. הכול נמצא שוב בפרופיל, העדפות, ״לפני תפילה״.",
            },
          },
          {
            question: {
              fr: "Pourquoi n'apparaît-il pas sur iPhone ?",
              en: "Why doesn't it show on iPhone?",
              he: "למה הוא לא מופיע באייפון?",
            },
            answer: {
              fr: "Le système de l'iPhone ne laisse aucune app lire ni changer ces modes : le panneau n'existe que sur Android.",
              en: "The iPhone's system lets no app read or change these modes: the panel only exists on Android.",
              he: "המערכת של האייפון לא מאפשרת לשום אפליקציה לקרוא או לשנות את המצבים האלה: הלוח קיים רק באנדרואיד.",
            },
          },
        ],
        guides: ["avant-la-tefila"],
        link: sidour,
      },
      {
        chapter: "moment",
        title: {
          fr: "L'heure de la tefila, sous son ciel",
          en: "The time to pray, under its sky",
          he: "זמן התפילה, תחת השמיים שלו",
        },
        questions: [
          {
            question: {
              fr: "Que dit la pastille en tête d'un office ?",
              en: "What does the pill at the top of a service say?",
              he: "מה אומרת התווית שבראש התפילה?",
            },
            answer: {
              fr: "Jusqu'à quand prier et combien de temps il reste, avec le ciel de ce moment.",
              en: "Until when to pray and how long is left, with the sky of that moment.",
              he: "עד מתי להתפלל וכמה זמן נשאר, עם השמיים של אותו רגע.",
            },
          },
          {
            question: {
              fr: "Que montre-t-elle quand on la touche ?",
              en: "What does it show when touched?",
              he: "מה היא מראה כשנוגעים בה?",
            },
            answer: {
              fr: "Le cycle du jour d'un trait : le bon moment en couleur, « Hors de son temps » en pointillé, maintenant marqué du soleil ou de la lune. Dessous, chaque horaire et le temps qui reste avant lui.",
              en: "The day's cycle in one line: the right moment in color, “Out of its time” dashed, now marked by the sun or the moon. Below, each time and how long until it comes.",
              he: "מחזור היום בקו אחד: הזמן הנכון בצבע, ״מחוץ לזמנה״ בקו מקווקו, ועכשיו מסומן בשמש או בירח. מתחת, כל זמן וכמה נשאר עד אליו.",
            },
          },
          {
            question: {
              fr: "Ce sont les horaires de quelle ville ?",
              en: "Which city are the times for?",
              he: "של איזו עיר הזמנים?",
            },
            answer: {
              fr: "Celle des horaires du jour : sur leur page, le nom de la ville est le bouton qui la change, et « Ma position » relève celle de l'appareil.",
              en: "The one of the day's times: on their page, the city's name is the button that changes it, and “My location” reads the device's.",
              he: "העיר של זמני היום: בדף שלהם, שם העיר הוא הכפתור שמחליף אותה, ו״המיקום שלי״ קורא את מיקום המכשיר.",
            },
          },
        ],
        guides: ["heure-de-la-tefila", "horaires-et-rappels"],
        link: sidour,
      },
      {
        chapter: "fin",
        title: {
          fr: "Un office noté comme dit",
          en: "A service marked as said",
          he: "תפילה שמסומנת כנאמרה",
        },
        questions: [
          {
            question: {
              fr: "Comment noter un office comme dit ?",
              en: "How do I mark a service as said?",
              he: "איך מסמנים תפילה כנאמרה?",
            },
            answer: {
              fr: "Au bout du texte, poussez encore la page vers le haut : l'anneau se remplit, et relâché plein, l'office est noté. Sur le Sidour, glisser à droite la carte du moment fait de même.",
              en: "At the end of the text, push the page up again: the ring fills, and let go full, the service is marked. On the Siddur, swiping the card of the moment to the right does the same.",
              he: "בסוף הטקסט, דחפו שוב את הדף למעלה: הטבעת מתמלאת, וכשמשחררים אותה מלאה, התפילה נרשמת. בסידור, החלקת כרטיס הרגע ימינה עושה את אותו הדבר.",
            },
          },
          {
            question: {
              fr: "À quoi ça sert ?",
              en: "What is it for?",
              he: "בשביל מה זה?",
            },
            answer: {
              fr: "Le Sidour passe à la suite : après Cha'harit, Min'ha ; après Arvit, le Chéma du coucher. Avec l'habitude « Les trois tefilot » de Mon parcours, votre journée la compte aussi.",
              en: "The Siddur moves on: after Shacharit, Mincha; after Arvit, the bedtime Shema. With the “The three tefilot” habit of My journey, your day counts it too.",
              he: "הסידור עובר הלאה: אחרי שחרית, מנחה; אחרי ערבית, קריאת שמע על המיטה. עם ההרגל ״שלוש התפילות״ במסלול שלי, גם היום שלכם סופר אותה.",
            },
          },
          {
            question: {
              fr: "Je l'ai glissée par erreur : comment revenir en arrière ?",
              en: "I swiped it by mistake: how do I undo it?",
              he: "החלקתי בטעות: איך מבטלים?",
            },
            answer: {
              fr: "Juste après, « Annuler » reste quelques secondes sous la carte.",
              en: "Right after, “Undo” stays under the card for a few seconds.",
              he: "מיד אחר כך, ״ביטול״ נשאר מתחת לכרטיס לכמה שניות.",
            },
          },
        ],
        guides: ["office-dit"],
        link: sidour,
      },
      {
        chapter: "accueil",
        title: {
          fr: "Un nouvel accueil",
          en: "A new home page",
          he: "דף בית חדש",
        },
        questions: [
          {
            question: {
              fr: "Que sont les cartes en haut de l'accueil ?",
              en: "What are the cards at the top of the home page?",
              he: "מה הכרטיסים שבראש דף הבית?",
            },
            answer: { key: "tips.parcours.deck.text" },
          },
          {
            question: {
              fr: "Comment déplacer ou masquer un bloc ?",
              en: "How do I move or hide a block?",
              he: "איך מזיזים או מסתירים בלוק?",
            },
            answer: {
              fr: "Un appui long sur un bloc, ou « Modifier l'accueil » en bas de la page : les blocs se prennent et se déplacent, chacun avec « Masquer ». « Terminé » quand c'est fini.",
              en: "A long press on a block, or “Edit the home page” at the bottom of the page: the blocks are picked up and moved, each with “Hide”. “Done” when it is finished.",
              he: "לחיצה ארוכה על בלוק, או ״עריכת דף הבית״ בתחתית הדף: מרימים את הבלוקים ומזיזים אותם, ולכל אחד ״להסתיר״. ״סיום״ כשגומרים.",
            },
          },
          {
            question: {
              fr: "Comment avoir mes livres sous la main ?",
              en: "How do I keep my books at hand?",
              he: "איך שומרים את הספרים שלי בהישג יד?",
            },
            answer: {
              fr: "Le bloc « Livres épinglés » : jusqu'à trois livres ou textes sur une étagère de l'accueil, choisis en modifiant l'accueil.",
              en: "The “Pinned books” block: up to three books or texts on a shelf of the home page, chosen while editing the home page.",
              he: "הבלוק ״ספרים מוצמדים״: עד שלושה ספרים או טקסטים על מדף בדף הבית, שבוחרים בעריכת דף הבית.",
            },
          },
        ],
        guides: ["votre-journee", "accueil-a-votre-gout"],
        link: { to: "/", label: { key: "common.home" } },
      },
      {
        chapter: "parcours",
        title: { key: "parcours.title" },
        questions: [
          {
            question: {
              fr: "Où est passée la lecture du jour ?",
              en: "Where did the daily reading go?",
              he: "לאן עברה הקריאה היומית?",
            },
            answer: {
              fr: "Dans Mon parcours, qui s'ouvre depuis la lumière de l'accueil ou depuis le profil : chaque lecture y est un volume de votre étagère, ouvert là où vous en êtes.",
              en: "Into My journey, which opens from the light on the home page or from the profile: each reading is a volume on your shelf there, open where you are.",
              he: "למסלול שלי, שנפתח מהאור שבדף הבית או מהפרופיל: כל קריאה היא שם כרך על המדף שלכם, פתוח במקום שבו אתם נמצאים.",
            },
          },
          {
            question: {
              fr: "Que sont les pierres du mur ?",
              en: "What are the stones of the wall?",
              he: "מה האבנים שבחומה?",
            },
            answer: { key: "tips.parcours.wall.text" },
          },
          {
            question: {
              fr: "Comment me fixer un objectif ?",
              en: "How do I set myself a goal?",
              he: "איך מציבים לעצמי יעד?",
            },
            answer: {
              fr: "« Un objectif de plus », sur l'étagère de Mon parcours : un texte à finir, un cycle ou une habitude, et d'ici quand.",
              en: "“One more goal”, on the shelf of My journey: a text to finish, a cycle or a habit, and by when.",
              he: "״עוד יעד״, על המדף של המסלול שלי: טקסט לסיים, מחזור או הרגל, ועד מתי.",
            },
          },
          {
            question: {
              fr: "Ma série s'arrête-t-elle le Chabbat ?",
              en: "Does my streak stop on Shabbat?",
              he: "האם הרצף שלי נעצר בשבת?",
            },
            answer: {
              fr: "Non : Chabbat et les fêtes ne la coupent pas. Chaque jour tenu fait grandir sa lumière.",
              en: "No: Shabbat and the holidays do not break it. Each day kept makes its light grow.",
              he: "לא: שבת וחגים לא קוטעים אותו. כל יום שנשמר מגדיל את האור שלו.",
            },
          },
        ],
        guides: ["mon-parcours", "heures-de-ma-journee"],
        link: { to: "/parcours", label: { key: "parcours.title" } },
      },
      {
        chapter: "daf",
        title: {
          fr: "Le Talmud dans sa page",
          en: "The Talmud as printed",
          he: "התלמוד בצורת הדף",
        },
        questions: [
          {
            question: {
              fr: "Comment lire une guemara dans la forme de sa page ?",
              en: "How do I read a gemara in the form of its page?",
              he: "איך קוראים גמרא בצורת הדף?",
            },
            answer: {
              fr: "Le bouton « Page » de la barre d'outils : la guemara au centre, Rachi et Tossafot autour, comme dans la page de Vilna, un amoud par page.",
              en: "The “Page” button of the toolbar: the gemara in the center, Rashi and Tosafot around it, as on the Vilna page, one amud per page.",
              he: "הכפתור ״צורת הדף״ בסרגל הכלים: הגמרא באמצע, רש״י ותוספות סביבה, כמו בדף של וילנה, עמוד אחד בכל דף.",
            },
          },
          {
            question: {
              fr: "Et pour la Torah ?",
              en: "And for the Torah?",
              he: "ובתורה?",
            },
            answer: {
              fr: "Sur une paracha, le même bouton s'appelle « Tikoun » : la colonne du Sefer Torah, sans voyelles, avec ses petou'hot et ses setoumot, pour préparer la lecture.",
              en: "On a parasha, the same button is called “Tikkun”: the column of the Sefer Torah, without vowels, with its petuchot and setumot, to prepare the reading.",
              he: "בפרשה, אותו כפתור נקרא ״תיקון״: העמודה של ספר התורה, בלי ניקוד, עם הפתוחות והסתומות, כדי להתכונן לקריאה.",
            },
          },
          {
            question: {
              fr: "L'app s'en souvient-elle ?",
              en: "Does the app remember it?",
              he: "האם האפליקציה זוכרת את הבחירה?",
            },
            answer: {
              fr: "Oui, sur cet appareil : le prochain texte qui a une forme s'ouvre dans celle-ci.",
              en: "Yes, on this device: the next text that has a form opens in it.",
              he: "כן, במכשיר הזה: הטקסט הבא שיש לו צורה נפתח בה.",
            },
          },
        ],
        link: study,
      },
      {
        chapter: "progress",
        title: {
          fr: "La barre de lecture",
          en: "The reading bar",
          he: "סרגל הקריאה",
        },
        questions: [
          {
            question: {
              fr: "Comment aller vite à un passage d'un long texte ?",
              en: "How do I get quickly to a passage of a long text?",
              he: "איך מגיעים מהר לקטע בטקסט ארוך?",
            },
            answer: {
              fr: "Posez le doigt sur la fine ligne en bas de la lecture et faites-le glisser : la page suit, et le passage atteint s'écrit en grand au-dessus du doigt.",
              en: "Lay a finger on the thin line at the bottom of the reading and slide it: the page follows, and the passage reached is written large above your finger.",
              he: "הניחו אצבע על הקו הדק בתחתית הקריאה וגררו אותה: הדף עוקב, והקטע שהגעתם אליו נכתב בגדול מעל האצבע.",
            },
          },
          {
            question: {
              fr: "Où est cette ligne dans l'app ?",
              en: "Where is that line in the app?",
              he: "איפה הקו הזה באפליקציה?",
            },
            answer: {
              fr: "Sur le bord haut de la barre d'onglets, qui se soulève sous le doigt.",
              en: "Along the top edge of the tab bar, which rises under your finger.",
              he: "לאורך הקצה העליון של סרגל הלשוניות, שמתרומם מתחת לאצבע.",
            },
          },
        ],
        guides: ["barre-de-lecture"],
      },
      {
        chapter: "translation",
        title: {
          fr: "La traduction sous l'hébreu",
          en: "The translation under the Hebrew",
          he: "התרגום מתחת לעברית",
        },
        questions: [
          {
            question: {
              fr: "Comment afficher la traduction ?",
              en: "How do I show the translation?",
              he: "איך מציגים את התרגום?",
            },
            answer: {
              fr: "Le bouton « Traduction » de la barre d'outils, sur un texte traduit : chaque verset est suivi de sa traduction. Le même réglage est dans les réglages de lecture du menu.",
              en: "The “Translation” button of the toolbar, on a translated text: each verse is followed by its translation. The same setting is in the menu's reading settings.",
              he: "הכפתור ״תרגום״ בסרגל הכלים, בטקסט מתורגם: אחרי כל פסוק בא התרגום שלו. אותה הגדרה נמצאת בהגדרות הקריאה שבתפריט.",
            },
          },
          {
            question: {
              fr: "Quels textes sont traduits ?",
              en: "Which texts are translated?",
              he: "אילו טקסטים מתורגמים?",
            },
            answer: {
              fr: "Le Tanakh et les Tehilim, la Michna, le Talmud, Rachi du chnei mikra et 'Hovot Halévavot, en français et en anglais. Pas les textes du Sidour.",
              en: "The Tanakh and the Tehilim, the Mishna, the Talmud, Rashi on shnayim mikra and Chovot Halevavot, in French and English. Not the Siddur's texts.",
              he: "התנ״ך והתהילים, המשנה, התלמוד, רש״י של שניים מקרא וחובות הלבבות, בצרפתית ובאנגלית. לא הטקסטים של הסידור.",
            },
          },
          {
            question: {
              fr: "D'où vient la traduction française ?",
              en: "Where does the French translation come from?",
              he: "מאיפה מגיע התרגום לצרפתית?",
            },
            answer: {
              fr: "D'une traduction publiée, quand il en existe une libre ; sinon, d'une traduction faite par IA depuis l'anglais, ce que le texte signale. Le nom du traducteur se lit à la fin du texte.",
              en: "From a published translation, when a free one exists; otherwise, from a translation made by AI from the English, which the text says. The translator's name reads at the end of the text.",
              he: "מתרגום שפורסם, כשיש כזה בשימוש חופשי; אחרת, מתרגום שנעשה בבינה מלאכותית מהאנגלית, והטקסט מציין זאת. שם המתרגם מופיע בסוף הטקסט.",
            },
          },
        ],
        link: study,
      },
      {
        chapter: "commentaries",
        title: {
          fr: "Les commentaires d'un passage",
          en: "The commentaries of a passage",
          he: "המפרשים של קטע",
        },
        questions: [
          {
            question: {
              fr: "Comment ouvrir Rachi ou Tossafot sur un passage ?",
              en: "How do I open Rashi or Tosafot on a passage?",
              he: "איך פותחים רש״י או תוספות על קטע?",
            },
            answer: {
              fr: "Touchez le passage : sa fiche porte une ligne « Commentaires », qui dit ce qu'il y a à lire (« Rachi 2 · Tossafot 1 »). Elle ouvre le panneau d'étude.",
              en: "Touch the passage: its sheet carries a “Commentaries” row, which says what there is to read (“Rashi 2 · Tosafot 1”). It opens the study panel.",
              he: "געו בקטע: בכרטיס שלו יש שורה ״מפרשים״, שאומרת מה יש לקרוא (״רש״י 2 · תוספות 1״). היא פותחת את לוח הלימוד.",
            },
          },
          {
            question: {
              fr: "Quels textes ont des commentaires ?",
              en: "Which texts have commentaries?",
              he: "לאילו טקסטים יש מפרשים?",
            },
            answer: {
              fr: "La guemara (Rachi et Tossafot), la Michna (Bartenoura et Tossefot Yom Tov), le Tanakh (Rachi) et le Choul'han Aroukh, séif par séif.",
              en: "The gemara (Rashi and Tosafot), the Mishna (Bartenura and Tosafot Yom Tov), the Tanakh (Rashi) and the Shulchan Aruch, seif by seif.",
              he: "הגמרא (רש״י ותוספות), המשנה (ברטנורא ותוספות יום טוב), התנ״ך (רש״י) והשולחן ערוך, סעיף אחר סעיף.",
            },
          },
          {
            question: {
              fr: "Faut-il le rouvrir à chaque passage ?",
              en: "Do I have to open it again for each passage?",
              he: "צריך לפתוח אותו מחדש בכל קטע?",
            },
            answer: {
              fr: "Non : tant que le panneau est ouvert, touchez un autre passage, ses commentaires s'y affichent. Un daf s'étudie d'un geste par passage.",
              en: "No: while the panel is open, touch another passage and its commentaries show there. A daf is studied with one gesture per passage.",
              he: "לא: כל עוד הלוח פתוח, געו בקטע אחר והמפרשים שלו יופיעו בו. לומדים דף בתנועה אחת לכל קטע.",
            },
          },
        ],
        link: study,
      },
      {
        chapter: "table",
        title: {
          fr: "Mettre un texte de côté",
          en: "Setting a text aside",
          he: "להניח טקסט בצד",
        },
        questions: [
          {
            question: {
              fr: "À quoi sert « Mettre de côté » ?",
              en: "What is “Set aside” for?",
              he: "בשביל מה ״הנחה בצד״?",
            },
            answer: {
              fr: "À garder plusieurs textes ouverts, comme des livres sur une table : le texte rejoint la barre « Sur la table », en bas de l'écran, et s'y rouvre là où vous l'aviez laissé.",
              en: "To keep several texts open, like books on a table: the text joins the “On the table” bar at the bottom of the screen, and reopens from there where you left it.",
              he: "כדי להשאיר כמה טקסטים פתוחים, כמו ספרים על שולחן: הטקסט מצטרף לסרגל ״על השולחן״ בתחתית המסך, ונפתח ממנו בדיוק איפה שעצרתם.",
            },
          },
          {
            question: {
              fr: "Où est le bouton ?",
              en: "Where is the button?",
              he: "איפה הכפתור?",
            },
            answer: {
              fr: "En tête de chaque texte de la bibliothèque, et dans le menu de lecture.",
              en: "At the top of each library text, and in the reading menu.",
              he: "בראש כל טקסט בספרייה, ובתפריט הקריאה.",
            },
          },
          {
            question: {
              fr: "Pourquoi pas sur le Sidour ?",
              en: "Why not in the Siddur?",
              he: "למה לא בסידור?",
            },
            answer: {
              fr: "On y prie d'un bout à l'autre : la table est faite pour l'étude, d'un livre à l'autre. Pas non plus dans une chaîne, où l'on lit sa part.",
              en: "There one prays from start to finish: the table is made for study, from one book to another. Nor in a chain, where you read your share.",
              he: "בסידור מתפללים מההתחלה ועד הסוף: השולחן נועד ללימוד, מספר לספר. גם לא בשרשרת, שבה קוראים את החלק שלכם.",
            },
          },
          {
            question: {
              fr: "Comment ranger les textes ?",
              en: "How do I put the texts away?",
              he: "איך מפנים את הטקסטים?",
            },
            answer: {
              fr: "Ouvrez la table : chaque texte se range d'une touche, et « Tout ranger » les retire tous. Vos marque-pages et votre reprise de lecture restent.",
              en: "Open the table: each text is put away in one touch, and “Put all away” removes them all. Your bookmarks and where you stopped reading stay.",
              he: "פתחו את השולחן: כל טקסט מפונה בנגיעה אחת, ו״פינוי הכול״ מסיר את כולם. הסימניות והמקום שבו עצרתם נשארים.",
            },
          },
        ],
        link: study,
      },
      {
        chapter: "audio",
        title: {
          fr: "Les cours en plein écran",
          en: "Shiurim in full screen",
          he: "השיעורים במסך מלא",
        },
        questions: [
          {
            question: {
              fr: "Comment ouvrir le lecteur en grand ?",
              en: "How do I open the player in full?",
              he: "איך פותחים את הנגן במסך מלא?",
            },
            answer: {
              fr: "Touchez la barre du lecteur, ou glissez-la vers le haut : elle s'agrandit jusqu'à couvrir l'écran. Tirez-la vers le bas pour la refermer.",
              en: "Touch the player bar, or swipe it up: it grows until it covers the screen. Pull it down to close it.",
              he: "געו בסרגל הנגן, או החליקו אותו למעלה: הוא גדל עד שהוא מכסה את המסך. משכו אותו למטה כדי לסגור.",
            },
          },
          {
            question: {
              fr: "Peut-on écouter plus vite ?",
              en: "Can I listen faster?",
              he: "אפשר להאזין מהר יותר?",
            },
            answer: {
              fr: "Oui : la pastille de vitesse, à côté du titre, va de 0,75× à 2×.",
              en: "Yes: the speed pill, next to the title, goes from 0.75× to 2×.",
              he: "כן: תווית המהירות, ליד הכותרת, מציעה מ־0.75× עד 2×.",
            },
          },
          {
            question: {
              fr: "Les cours s'enchaînent-ils ?",
              en: "Do the shiurim play one after another?",
              he: "האם השיעורים מתנגנים ברצף?",
            },
            answer: {
              fr: "Oui : la liste d'où vous lancez un cours devient la file d'écoute, et la fin d'un cours lance le suivant. Un cours commencé reprend là où vous l'aviez laissé.",
              en: "Yes: the list you start a shiur from becomes the queue, and the end of one starts the next. A shiur begun resumes where you left it.",
              he: "כן: הרשימה שממנה הפעלתם שיעור הופכת לתור ההשמעה, וסוף שיעור מפעיל את הבא. שיעור שהתחלתם ממשיך מאיפה שעצרתם.",
            },
          },
        ],
        link: { to: "/chiourim", label: { key: "common.chiourim" } },
      },
      {
        chapter: "contact",
        title: {
          fr: "Écrire à l'équipe",
          en: "Writing to the team",
          he: "לכתוב לצוות",
        },
        questions: [
          {
            question: {
              fr: "Comment écrire à l'équipe ?",
              en: "How do I write to the team?",
              he: "איך כותבים לצוות?",
            },
            answer: {
              fr: "Dans Profil, groupe Aide, « Nous écrire » : une idée, un bug, une erreur dans un texte. Le menu de lecture le propose aussi, pour signaler une erreur sans perdre sa ligne.",
              en: "In Profile, Help group, “Contact us”: an idea, a bug, an error in a text. The reading menu offers it too, to report an error without losing your line.",
              he: "בפרופיל, בקבוצת עזרה, ״כתבו לנו״: רעיון, באג, טעות בטקסט. גם תפריט הקריאה מציע זאת, כדי לדווח על טעות בלי לאבד את השורה.",
            },
          },
          {
            question: {
              fr: "Où lire la réponse ?",
              en: "Where do I read the answer?",
              he: "איפה קוראים את התשובה?",
            },
            answer: {
              fr: "Au même endroit, dans « Vos messages ». Une pastille sur l'onglet Profil la signale, et une notification si elles sont activées sur ce téléphone.",
              en: "In the same place, in “Your messages”. A badge on the Profile tab tells you, and a notification if they are on for this phone.",
              he: "באותו מקום, ב״ההודעות שלכם״. סימון על לשונית הפרופיל מודיע עליה, וגם התראה אם ההתראות מופעלות בטלפון הזה.",
            },
          },
        ],
        link: { to: "/contact", label: { key: "footer.reportIssue" } },
      },
      {
        chapter: "montage",
        title: {
          fr: "Et aussi",
          en: "And more",
          he: "ועוד",
        },
        questions: [
          {
            question: {
              fr: "Où sont la Halakha et le Moussar ?",
              en: "Where are Halakha and Mussar?",
              he: "איפה ההלכה והמוסר?",
            },
            answer: {
              fr: "Sur l'étagère de la Bibliothèque : le Choul'han Aroukh et le Kitsour, 'Hovot Halévavot et le Pélé Yoets. Les commentaires du Choul'han Aroukh s'ouvrent séif par séif.",
              en: "On the Library's shelf: the Shulchan Aruch and the Kitzur, Chovot Halevavot and the Pele Yoetz. The Shulchan Aruch's commentaries open seif by seif.",
              he: "על מדף הספרייה: השולחן ערוך והקיצור, חובות הלבבות ופלא יועץ. מפרשי השולחן ערוך נפתחים סעיף אחר סעיף.",
            },
          },
          {
            question: {
              fr: "Comment suivre le chnei mikra de la semaine ?",
              en: "How do I keep track of the week's shnayim mikra?",
              he: "איך עוקבים אחרי שניים מקרא של השבוע?",
            },
            answer: {
              fr: "Chaque montée se termine par « Marquer comme lue », et la barre en tête dit où en est la semaine. La semaine suivante repart de zéro.",
              en: "Each aliyah ends with “Mark as read”, and the bar at the top says where the week stands. The next week starts from zero.",
              he: "כל עלייה מסתיימת ב״לסמן כנקראה״, והסרגל בראש הדף אומר איפה עומד השבוע. השבוע הבא מתחיל מאפס.",
            },
          },
          {
            question: {
              fr: "Comment poser un marque-page ?",
              en: "How do I place a bookmark?",
              he: "איך מניחים סימנייה?",
            },
            answer: {
              fr: "Touchez un verset, puis « Marque-page » : un ruban rouge se pose avant lui. Un livre n'en a qu'un, le nouveau remplace l'ancien.",
              en: "Touch a verse, then “Bookmark”: a red ribbon lies before it. A book has only one, the new one replaces the old.",
              he: "געו בפסוק, ואז ״סימנייה״: סרט אדום מונח לפניו. לכל ספר יש רק אחת, והחדשה מחליפה את הקודמת.",
            },
          },
          {
            question: {
              fr: "Comment lire d'un coup les psaumes pris dans une chaîne ?",
              en: "How do I read all the psalms I took in a chain at once?",
              he: "איך קוראים בבת אחת את המזמורים שלקחתי בשרשרת?",
            },
            answer: {
              fr: "« Tout lire maintenant », à côté de « Mes réservations » : vos psaumes l'un après l'autre, chacun coché là où il est lu.",
              en: "“Read them all now”, next to “My reservations”: your psalms one after the other, each checked where it is read.",
              he: "״לקרוא את כולם עכשיו״, ליד ״ההזמנות שלי״: המזמורים שלכם אחד אחרי השני, כל אחד מסומן במקום שבו הוא נקרא.",
            },
          },
          {
            question: {
              fr: "Qu'est-ce que Nichmat 40 ?",
              en: "What is Nishmat 40?",
              he: "מה זה נשמת 40?",
            },
            answer: {
              fr: "Une chaîne où quarante personnes disent Nichmat kol 'hai chaque jour, quarante jours durant. « J'ai dit Nichmat aujourd'hui » coche le jour, et un jour oublié se rattrape.",
              en: "A chain where forty people say Nishmat kol chai every day, for forty days. “I said Nishmat today” ticks the day, and a forgotten day can be caught up.",
              he: "שרשרת שבה ארבעים איש אומרים נשמת כל חי בכל יום, במשך ארבעים יום. ״אמרתי נשמת היום״ מסמן את היום, ויום שנשכח אפשר להשלים.",
            },
          },
          {
            question: {
              fr: "Où est Nichmat kol 'hai dans le Sidour ?",
              en: "Where is Nishmat kol chai in the Siddur?",
              he: "איפה נשמת כל חי בסידור?",
            },
            answer: {
              fr: "Parmi les offices de la liste du Sidour, comme un texte à part entière. Le Tikoun haklali est avec les « Occasions ».",
              en: "Among the services in the Siddur's list, as a text of its own. The Tikkun haklali is with the “Occasions”.",
              he: "בין התפילות ברשימת הסידור, כטקסט בפני עצמו. התיקון הכללי נמצא ב״הזדמנויות״.",
            },
          },
          {
            question: {
              fr: "Comment trouver la direction du Kotel ?",
              en: "How do I find the direction of the Kotel?",
              he: "איך מוצאים את כיוון הכותל?",
            },
            answer: {
              fr: "Dans les outils du Sidour, « Direction du Kotel » : tournez-vous, le cadran se remplit quand vous êtes face au Kotel.",
              en: "Among the Siddur's tools, “Direction of the Kotel”: turn around, and the dial fills when you face the Kotel.",
              he: "בכלים של הסידור, ״כיוון הכותל״: הסתובבו, והחוגה מתמלאת כשאתם מול הכותל.",
            },
          },
          {
            question: {
              fr: "Comment recevoir un rappel ?",
              en: "How do I get a reminder?",
              he: "איך מקבלים תזכורת?",
            },
            answer: {
              fr: "En haut de Mon parcours, le réveil ouvre les heures de votre journée, chacune avec son rappel s'il reste à faire. Sur la page des horaires, tirez une ligne de côté : la cloche pose un rappel avant cet horaire.",
              en: "At the top of My journey, the alarm clock opens the hours of your day, each with its reminder when something is left. On the times page, swipe a row aside: the bell sets a reminder before that time.",
              he: "בראש המסלול שלי, השעון המעורר פותח את שעות היום שלכם, כל אחת עם תזכורת כשנשאר מה לעשות. בדף הזמנים, גררו שורה הצידה: הפעמון קובע תזכורת לפני הזמן הזה.",
            },
          },
          {
            question: {
              fr: "Comment rendre l'app plus lisible ?",
              en: "How do I make the app easier to read?",
              he: "איך הופכים את האפליקציה לקריאה יותר?",
            },
            answer: {
              fr: "Profil, Apparence, « Contraste renforcé » : des couleurs plus franches et un texte plus foncé. Il suit le réglage de l'appareil tant que vous n'y touchez pas.",
              en: "Profile, Appearance, “Higher contrast”: bolder colors and darker text. It follows the device's setting until you change it.",
              he: "פרופיל, מראה, ״ניגודיות מוגברת״: צבעים חדים יותר וטקסט כהה יותר. ההגדרה עוקבת אחרי המכשיר כל עוד לא שיניתם אותה.",
            },
          },
        ],
        guides: ["nichmat-40", "boussole-du-kotel", "horaires-et-rappels"],
      },
    ],
  },
];

/** The version whose page this is, by its name (« 4.0 »). */
export function versionByName(version: string): HelpVersion | undefined {
  return HELP_VERSIONS.find((entry) => entry.version === version);
}

/**
 * Where a passage is in the video of a language (French when that
 * language has no video), or null when that video does not show it: the
 * Hebrew one has no passage on the translations, which go into French and
 * English.
 */
export function passageChapter(
  version: string,
  locale: string,
  chapter: string,
): VideoChapter | null {
  const videos = CHAPTERS[version];
  if (!videos) return null;
  const chapters = videos[locale] ?? videos.fr ?? [];
  return chapters.find((entry) => entry.id === chapter) ?? null;
}

/** The chapters of a version's videos, by language (for the checks). */
export function videoChapters(version: string): Record<string, VideoChapter[]> {
  return CHAPTERS[version] ?? {};
}
