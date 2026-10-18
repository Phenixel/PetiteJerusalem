/**
 * The words of the version 4.0 video, in the three languages of the app.
 *
 * One video, a presentation rather than an ad: it plays in the app after
 * the update in the reader's language (`nouveautes-*`), and the French one
 * also goes to the networks (`v4`, which only ends differently). Captions
 * are the first series': two lines, the second carrying the point; a word
 * written *like this* takes the accent (italic, in the orange ink).
 *
 * French follows the house typography (CLAUDE.md): a narrow no-break space
 * (U+202F) before « ! », « ? » and « ; », a no-break space (U+00A0) before
 * « : » and inside « ». Interface names are the app's own (src/locales).
 */

export type Locale = "fr" | "en" | "he";

const NNBSP = " ";
const NBSP = " ";

/** A caption: two lines, as in the first series. */
export type CaptionLines = [string, string];

export type V4Strings = {
  dir?: "rtl";
  /** The opening: struck line by line on the orange, the last one is « 4.0 ». */
  hook: string[];
  hookSub: string;
  before: string;
  after: string;
  newTag: string;
  /** « Et aussi… », in two words. */
  also: [string, string];
  captions: {
    bars: [CaptionLines, CaptionLines];
    etude: [CaptionLines, CaptionLines];
    sidour: [CaptionLines, CaptionLines];
    accueil: [CaptionLines, CaptionLines, CaptionLines];
    parcours: [CaptionLines, CaptionLines, CaptionLines];
    daf: [CaptionLines, CaptionLines];
    translation: [CaptionLines];
    commentaries: [CaptionLines];
    table: [CaptionLines, CaptionLines];
    audio: [CaptionLines];
    contact: [CaptionLines, CaptionLines];
  };
  montage: {
    halakha: string;
    moussar: string;
    tikoun: string;
    chnei: string;
    signet: string;
    tehilim: string;
  };
  /** The in-app ending. */
  end: { title: string; replay: string };
};

export const STRINGS: Record<Locale, V4Strings> = {
  fr: {
    hook: ["Bienvenue", "dans la", "4.0"],
    hookSub: "Voici ce qui change",
    before: "Avant",
    after: "Maintenant",
    newTag: "Nouveau",
    also: ["Et", "aussi"],
    captions: {
      bars: [
        ["Deux onglets", "*changent*"],
        ["Bibliothèque et Chiourim", "*passent dans Étude*"],
      ],
      etude: [
        ["*Étude*", "réunit tout"],
        ["Bibliothèque, Chiourim", "*et Partage*"],
      ],
      sidour: [
        ["Le *Sidour*", "a son onglet"],
        ["Il s'ouvre", "*sur le moment*"],
      ],
      accueil: [
        ["Un nouvel", "*accueil*"],
        ["Votre journée,", "*carte après carte*"],
        ["Maintenez un bloc", "*pour le déplacer*"],
      ],
      parcours: [
        ["*Mon parcours*", "remplace la lecture du jour"],
        ["Une pierre", "*par jour tenu*"],
        ["Fixez-vous", "*un objectif*"],
      ],
      daf: [
        ["Le Talmud", "*dans sa page*"],
        ["Rachi et Tossafot", "*autour du texte*"],
      ],
      translation: [["La traduction", "*sous l'hébreu*"]],
      commentaries: [[`Touchez un passage${NBSP}:`, "*ses commentaires*"]],
      table: [
        ["Mettez un texte", "*de côté*"],
        ["Reprenez-le", "*là où vous étiez*"],
      ],
      audio: [["Les cours", "*en plein écran*"]],
      contact: [
        ["Écrivez-nous", "*depuis le profil*"],
        ["L'équipe", "*vous répond ici*"],
      ],
    },
    montage: {
      halakha: "Un rayon Halakha",
      moussar: "Un rayon Moussar",
      tikoun: "Le Tikoun du lecteur",
      chnei: "Le chnei mikra à cocher",
      signet: "Un signet par livre",
      tehilim: "Vos Tehilim d'une traite",
    },
    end: {
      title: `Bonne découverte${NNBSP}!`,
      replay: `À revoir dans Profil, «${NBSP}Aide${NBSP}»`,
    },
  },
  en: {
    hook: ["Welcome", "to version", "4.0"],
    hookSub: "Here is what changed",
    before: "Before",
    after: "Now",
    newTag: "New",
    also: ["And", "more"],
    captions: {
      bars: [
        ["Two tabs", "*change*"],
        ["Library and Shiurim", "*move into Study*"],
      ],
      etude: [
        ["*Study*", "brings it together"],
        ["Library, Shiurim", "*and Sharing*"],
      ],
      sidour: [
        ["The *Siddur*", "has its own tab"],
        ["It opens", "*on the moment*"],
      ],
      accueil: [
        ["A new", "*home*"],
        ["Your day,", "*card by card*"],
        ["Hold a block", "*to move it*"],
      ],
      parcours: [
        ["*My journey*", "replaces the daily reading"],
        ["One stone", "*per day kept*"],
        ["Set yourself", "*a goal*"],
      ],
      daf: [
        ["The Talmud", "*as printed*"],
        ["Rashi and Tosafot", "*around the text*"],
      ],
      translation: [["The translation", "*under the Hebrew*"]],
      commentaries: [["Touch a passage:", "*its commentaries*"]],
      table: [
        ["Set a text", "*aside*"],
        ["Pick it up", "*where you left it*"],
      ],
      audio: [["Shiurim", "*in full screen*"]],
      contact: [
        ["Write to us", "*from your profile*"],
        ["The team", "*answers you here*"],
      ],
    },
    montage: {
      halakha: "A Halakha shelf",
      moussar: "A Mussar shelf",
      tikoun: "The reader's Tikkun",
      chnei: "Shnayim mikra, aliyah by aliyah",
      signet: "One bookmark per book",
      tehilim: "Your Tehilim in one go",
    },
    end: {
      title: "Enjoy!",
      replay: "Watch it again in Profile, “Help”",
    },
  },
  he: {
    dir: "rtl",
    hook: ["ברוכים הבאים", "לגרסה", "4.0"],
    hookSub: "הנה מה שהשתנה",
    before: "לפני",
    after: "עכשיו",
    newTag: "חדש",
    also: ["ועוד", "הרבה"],
    captions: {
      bars: [
        ["שתי לשוניות", "*השתנו*"],
        ["ספרייה ושיעורים", "*עברו ללימוד*"],
      ],
      etude: [
        ["*לימוד*", "מאחד הכול"],
        ["ספרייה, שיעורים", "*ושיתוף*"],
      ],
      sidour: [
        ["*לסידור*", "לשונית משלו"],
        ["הוא נפתח", "*ברגע הנכון*"],
      ],
      accueil: [
        ["דף בית", "*חדש*"],
        ["היום שלכם,", "*כרטיס אחר כרטיס*"],
        ["לחיצה ארוכה על בלוק", "*כדי להזיז אותו*"],
      ],
      parcours: [
        ["*המסלול שלי*", "במקום הקריאה היומית"],
        ["אבן אחת", "*לכל יום*"],
        ["הציבו לעצמכם", "*מטרה*"],
      ],
      daf: [
        ["התלמוד", "*בצורת הדף*"],
        ["רש״י ותוספות", "*סביב הטקסט*"],
      ],
      translation: [["התרגום", "*מתחת לעברית*"]],
      commentaries: [["נגיעה בקטע:", "*המפרשים שלו*"]],
      table: [
        ["הניחו טקסט", "*בצד*"],
        ["וחזרו אליו", "*בדיוק איפה שהייתם*"],
      ],
      audio: [["השיעורים", "*במסך מלא*"]],
      contact: [
        ["כתבו לנו", "*מהפרופיל*"],
        ["הצוות", "*עונה לכם כאן*"],
      ],
    },
    montage: {
      halakha: "מדף הלכה",
      moussar: "מדף מוסר",
      tikoun: "תיקון קוראים",
      chnei: "שניים מקרא, עלייה אחר עלייה",
      signet: "סימנייה לכל ספר",
      tehilim: "כל התהילים שלכם ברצף",
    },
    end: {
      title: "תיהנו מהחידושים!",
      replay: "לצפייה חוזרת: פרופיל, ״עזרה״",
    },
  },
};
