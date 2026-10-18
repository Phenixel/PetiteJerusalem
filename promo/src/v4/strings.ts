/**
 * The words of the version 4.0 videos, in the three languages of the app.
 *
 * The social video (`v4`) speaks French only, like the earlier series; the
 * "what's new" video that plays in the app (`nouveautes-*`) speaks the
 * reader's language. A word written *like this* takes the accent fill.
 *
 * French follows the house typography (CLAUDE.md): a narrow no-break space
 * (U+202F) before « ! », « ? » and « ; », a no-break space (U+00A0) before
 * « : ». Interface names are the app's own (src/locales).
 */

export type Locale = "fr" | "en" | "he";

const NNBSP = " ";
const NBSP = " ";

export type V4Strings = {
  dir?: "rtl";
  /** The in-app video's opening, and the social one's. */
  welcome: string[];
  promoHook: string[];
  before: string;
  after: string;
  newTag: string;
  /** « Mais aussi… », in two words. */
  also: [string, string];
  alsoCount: string;
  chapters: {
    bars: string;
    etude: string;
    sidour: string;
    deck: string;
    edit: string;
    parcours: string;
    goal: string;
    daf: string;
    translation: string;
    commentaries: string;
    table: string;
    audio: string;
    contact: string;
  };
  montage: {
    halakha: string;
    moussar: string;
    tikoun: string;
    chnei: string;
    signet: string;
    tehilim: string;
    sidour: string;
    contact: string;
  };
  end: { title: string; replay: string };
};

export const STRINGS: Record<Locale, V4Strings> = {
  fr: {
    welcome: ["Bienvenue", "dans la"],
    promoHook: ["La plus grosse", "mise à jour", "de l'app"],
    before: "Avant",
    after: "Maintenant",
    newTag: "Nouveau",
    also: ["Et", "aussi"],
    alsoCount: "Et aussi",
    chapters: {
      bars: "Deux onglets *changent*",
      etude: "*Étude* réunit Bibliothèque, Chiourim et Partage",
      sidour: "Le *Sidour* a son onglet",
      deck: "L'accueil, *votre journée*",
      edit: "Maintenez un bloc *pour le déplacer*",
      parcours: "*Mon parcours* tient vos lectures",
      goal: "Fixez-vous *un objectif*",
      daf: "Le Talmud *dans sa page*",
      translation: "La *traduction* sous l'hébreu",
      commentaries: "Rachi et Tossafot, *d'un geste*",
      table: "Mettez un texte *de côté*",
      audio: "Les cours *en plein écran*",
      contact: `Écrivez-nous${NBSP}: *on vous répond ici*`,
    },
    montage: {
      halakha: "Un rayon Halakha",
      moussar: "Un rayon Moussar",
      tikoun: "Le Tikoun du lecteur",
      chnei: "Le chnei mikra à cocher",
      signet: "Un signet par livre",
      tehilim: "Vos Tehilim d'une traite",
      sidour: "Le Sidour du moment",
      contact: "Vos messages, nos réponses",
    },
    end: {
      title: `Bonne découverte${NNBSP}!`,
      replay: `À revoir dans Profil, «${NBSP}Aide${NBSP}»`,
    },
  },
  en: {
    welcome: ["Welcome", "to version"],
    promoHook: ["The biggest", "update", "yet"],
    before: "Before",
    after: "Now",
    newTag: "New",
    also: ["And", "more"],
    alsoCount: "And more",
    chapters: {
      bars: "Two tabs *change*",
      etude: "*Study* brings together Library, Shiurim and Sharing",
      sidour: "The *Siddur* has its own tab",
      deck: "Home, *your day*",
      edit: "Hold a block *to move it*",
      parcours: "*My journey* keeps your readings",
      goal: "Set yourself *a goal*",
      daf: "The Talmud *as printed*",
      translation: "The *translation* under the Hebrew",
      commentaries: "Rashi and Tosafot, *in one touch*",
      table: "*Set a text aside*",
      audio: "Shiurim *in full screen*",
      contact: "Write to us: *we answer here*",
    },
    montage: {
      halakha: "A Halakha shelf",
      moussar: "A Mussar shelf",
      tikoun: "The reader's Tikkun",
      chnei: "Shnayim mikra, aliyah by aliyah",
      signet: "One bookmark per book",
      tehilim: "Your Tehilim in one go",
      sidour: "The Siddur of the moment",
      contact: "Your messages, our answers",
    },
    end: {
      title: "Enjoy!",
      replay: "Watch it again in Profile, “Help”",
    },
  },
  he: {
    dir: "rtl",
    welcome: ["ברוכים הבאים", "לגרסה"],
    promoHook: ["העדכון", "הגדול", "ביותר"],
    before: "לפני",
    after: "עכשיו",
    newTag: "חדש",
    also: ["ועוד", "הרבה"],
    alsoCount: "ועוד",
    chapters: {
      bars: "שתי לשוניות *השתנו*",
      etude: "*לימוד* מאחד ספרייה, שיעורים ושיתוף",
      sidour: "*הסידור* קיבל לשונית משלו",
      deck: "דף הבית, *היום שלכם*",
      edit: "לחיצה ארוכה על בלוק *כדי להזיז אותו*",
      parcours: "*המסלול שלי* שומר על הקריאות שלכם",
      goal: "הציבו לעצמכם *מטרה*",
      daf: "התלמוד *בצורת הדף*",
      translation: "*התרגום* מתחת לעברית",
      commentaries: "רש״י ותוספות *בנגיעה אחת*",
      table: "*הניחו טקסט בצד*",
      audio: "השיעורים *במסך מלא*",
      contact: "כתבו לנו: *נענה לכם כאן*",
    },
    montage: {
      halakha: "מדף הלכה",
      moussar: "מדף מוסר",
      tikoun: "תיקון קוראים",
      chnei: "שניים מקרא, עלייה אחר עלייה",
      signet: "סימנייה לכל ספר",
      tehilim: "כל התהילים שלכם ברצף",
      sidour: "הסידור של הרגע",
      contact: "ההודעות שלכם, התשובות שלנו",
    },
    end: {
      title: "תיהנו מהחידושים!",
      replay: "לצפייה חוזרת: פרופיל, ״עזרה״",
    },
  },
};
