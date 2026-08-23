/**
 * Le contenu du hub « Paracha de la semaine » (/paracha), dans les trois
 * langues. Données pures, sans dépendance : le module des pages l'importe.
 *
 * Les noms de parachiot viennent du catalogue en translittération latine
 * (« Ki Tetze »), qui sert au français comme à l'anglais ; l'hébreu affiche le
 * nom hébreu, rendu par hebcal.
 */

export type ParashaLinks = {
  horaires: string;
  calendrier: string;
  /** La bibliothèque n'est pas traduite : ses adresses sont les mêmes partout. */
  chneiMikra: string;
  tanakh: string;
  shareReading: string;
};

export type ParashaStrings = {
  lang: string;
  title: (parasha: string) => string;
  description: (parasha: string, date: string) => string;
  h1: string;
  /**
   * Le chapeau, quand la paracha de la semaine est connue. Daté, jamais
   * « cette semaine » : le prérendu ne se refait qu'au déploiement, et une
   * promesse de fraîcheur se périme en sept jours ; une date reste vraie.
   */
  lead: (parasha: string, date: string) => string;
  leadFallback: string;
  cycleTitle: string;
  /**
   * La 54e paracha : Vezot Haberakha ne se lit jamais un Chabbat ordinaire,
   * le tableau des Chabbats ne la voit donc pas passer. Sans cette note, le
   * hub annoncerait 54 parachiot et n'en montrerait que 53, et sa page de
   * texte serait la seule que le hub ne relie pas.
   */
  vezotNote: (date: string, href: string) => string;
  tableHead: { parasha: string; shabbat: string; book: string };
  readTitle: string;
  readHtml: string;
  shabbatTitle: string;
  shabbatHtml: string;
  faqHeading: string;
  faq: (parasha: string, date: string) => { q: string; a: string }[];
  breadcrumbHome: string;
  breadcrumbName: string;
};

export const PARASHA_FR = (links: ParashaLinks): ParashaStrings => ({
  lang: "fr",
  title: () =>
    "Paracha de la semaine : le calendrier des parachiot et leurs textes | Petite Jérusalem",
  description: (parasha, date) =>
    `Le Chabbat ${date}, on lit Parachat ${parasha} : le calendrier daté des 54 parachiot, chacune liée à son texte en hébreu et en phonétique.`,
  h1: "Paracha de la semaine",
  lead: (parasha, date) => `Le Chabbat ${date}, on lit <strong>Parachat ${parasha}</strong>.`,
  leadFallback: "La paracha lue à chaque Chabbat de l'année.",
  cycleTitle: "Le calendrier des parachiot",
  vezotNote: (date, href) =>
    `<a href="${href}">Vezot Haberakha</a> ne se lit pas un Chabbat ordinaire : elle achève la Torah à Simhat Torah, le ${date}.`,
  tableHead: { parasha: "Paracha", shabbat: "Chabbat", book: "Livre" },
  readTitle: "Lire la paracha",
  readHtml: `<p>Chaque paracha a sa page dans la bibliothèque, en hébreu et en phonétique. Pour le
      <a href="${links.chneiMikra}">chnei mikra</a>, chaque verset est suivi de son Targoum
      Onkelos, et Rachi s'ajoute en option. Le <a href="${links.tanakh}">Tanakh</a> complet est là
      aussi.</p>
      <p>Pour étudier à plusieurs, une <a href="${links.shareReading}">session de partage</a>
      répartit un texte entre les participants et suit la progression jusqu'au siyoum.</p>`,
  shabbatTitle: "Le Chabbat où on la lit",
  shabbatHtml: `<p>L'heure d'entrée et de sortie du Chabbat de chaque paracha, pour votre ville, est sur
      la page des <a href="${links.horaires}">horaires de Chabbat</a> ; les dates des fêtes sont
      sur le <a href="${links.calendrier}">calendrier des fêtes juives</a>.</p>`,
  faqHeading: "Questions fréquentes sur la paracha de la semaine",
  faq: (parasha, date) => [
    {
      q: "Quelle est la paracha de cette semaine ?",
      a: `Le Chabbat ${date}, on lit Parachat ${parasha}. Le tableau ci-dessus donne la paracha de chaque Chabbat de l'année, avec un lien vers son texte en hébreu et en phonétique.`,
    },
    {
      q: "Qu'est-ce qu'une paracha ?",
      a: "Une paracha (parachat hachavoua, la « section de la semaine ») est la portion de la Torah lue à la synagogue le Chabbat. Les cinq livres sont découpés en 54 sections, lues d'un Chabbat à l'autre : le cycle se referme à Simhat Torah, où l'on achève le Deutéronome et où l'on recommence aussitôt la Genèse.",
    },
    {
      q: "Pourquoi lit-on parfois deux parachiot le même Chabbat ?",
      a: "Parce que l'année hébraïque compte tantôt 50 Chabbats, tantôt moins, et que les jours de fête en occupent quelques-uns. Pour que le cycle se referme à Simhat Torah, certaines paires (Vayakhel et Pekoudé, Nitzavim et Vayelekh, et d'autres) sont lues ensemble les années courtes.",
    },
    {
      q: "Où lire la paracha de la semaine en ligne ?",
      a: `Chaque paracha a sa page dans la bibliothèque, en hébreu et en phonétique, gratuitement et sans compte. Pour le chnei mikra (chaque verset deux fois, puis le Targoum Onkelos), la <a href="${links.chneiMikra}">page du chnei mikra</a> déroule la paracha de la semaine verset par verset.`,
    },
    {
      q: "A quelle heure commence le Chabbat où on la lit ?",
      a: `L'heure d'allumage des bougies et de sortie de Chabbat de votre ville est sur la page des <a href="${links.horaires}">horaires de Chabbat</a>, semaine par semaine, avec le nom de la paracha en regard.`,
    },
  ],
  breadcrumbHome: "Accueil",
  breadcrumbName: "Paracha de la semaine",
});

export const PARASHA_EN = (links: ParashaLinks): ParashaStrings => ({
  lang: "en",
  title: () => "Parashat hashavua: the calendar of parashiot and their texts | Petite Jérusalem",
  description: (parasha, date) =>
    `On Shabbat ${date} we read Parashat ${parasha}: the dated calendar of all 54 parashiot, each linked to its text in Hebrew and transliteration.`,
  h1: "Parashat hashavua: this week's Torah portion",
  lead: (parasha, date) => `On Shabbat ${date} we read <strong>Parashat ${parasha}</strong>.`,
  leadFallback: "The Torah portion read on each Shabbat of the year.",
  cycleTitle: "The calendar of parashiot",
  vezotNote: (date, href) =>
    `<a href="${href}">Vezot Haberakhah</a> is not read on an ordinary Shabbat: it closes the Torah on Simchat Torah, on ${date}.`,
  tableHead: { parasha: "Parasha", shabbat: "Shabbat", book: "Book" },
  readTitle: "Reading the parasha",
  readHtml: `<p>Every parasha has its page in the library, in Hebrew with transliteration. For
      <a href="${links.chneiMikra}">shnayim mikra</a>, each verse is followed by its Targum
      Onkelos, with Rashi as an option. The full <a href="${links.tanakh}">Tanakh</a> is there
      too.</p>
      <p>To learn together, a <a href="${links.shareReading}">shared reading session</a> splits a
      text between participants and tracks the progress through to the siyum.</p>`,
  shabbatTitle: "The Shabbat it is read on",
  shabbatHtml: `<p>Candle lighting and havdalah times for each parasha's Shabbat, in your city, are on
      the <a href="${links.horaires}">Shabbat times page</a>; the festival dates are on the
      <a href="${links.calendrier}">Jewish holiday calendar</a>.</p>`,
  faqHeading: "Frequently asked questions about the weekly parasha",
  faq: (parasha, date) => [
    {
      q: "What is this week's parasha?",
      a: `On Shabbat ${date} we read Parashat ${parasha}. The table above gives the parasha of every Shabbat of the year, each linked to its text in Hebrew and transliteration.`,
    },
    {
      q: "What is a parasha?",
      a: "A parasha (parashat hashavua, the “portion of the week”) is the section of the Torah read in shul on Shabbat. The five books are divided into 54 sections, read one Shabbat after another: the cycle closes on Simchat Torah, when Deuteronomy is finished and Genesis begins again straight away.",
    },
    {
      q: "Why are two parashiot sometimes read on the same Shabbat?",
      a: "Because the Hebrew year holds about fifty Shabbatot, sometimes fewer, and festivals take up several of them. So that the cycle still closes on Simchat Torah, certain pairs (Vayakhel and Pekudei, Nitzavim and Vayelech, and others) are read together in short years.",
    },
    {
      q: "Where can I read the weekly parasha online?",
      a: `Every parasha has its page in the library, in Hebrew with transliteration, free and with no account. For shnayim mikra (each verse twice, then the Targum Onkelos), the <a href="${links.chneiMikra}">shnayim mikra page</a> runs through the week's parasha verse by verse.`,
    },
    {
      q: "What time does that Shabbat start?",
      a: `Candle lighting and havdalah times for your city are on the <a href="${links.horaires}">Shabbat times page</a>, week by week, with the name of the parasha alongside.`,
    },
  ],
  breadcrumbHome: "Home",
  breadcrumbName: "Parashat hashavua",
});

export const PARASHA_HE = (links: ParashaLinks): ParashaStrings => ({
  lang: "he",
  title: () => "פרשת השבוע: לוח הפרשות והטקסטים שלהן | פטיט ירושלים",
  description: (parasha, date) =>
    `בשבת ${date} קוראים את פרשת ${parasha}: לוח מתוארך של 54 הפרשות, כל אחת מקושרת לטקסט שלה בעברית ובתעתיק.`,
  h1: "פרשת השבוע",
  lead: (parasha, date) => `בשבת ${date} קוראים <strong>פרשת ${parasha}</strong>.`,
  leadFallback: "הפרשה הנקראת בכל שבת בשנה.",
  cycleTitle: "לוח הפרשות",
  vezotNote: (date, href) =>
    `<a href="${href}">וזאת הברכה</a> אינה נקראת בשבת רגילה: היא חותמת את התורה בשמחת תורה, ב־${date}.`,
  tableHead: { parasha: "פרשה", shabbat: "שבת", book: "ספר" },
  readTitle: "קריאת הפרשה",
  readHtml: `<p>לכל פרשה יש עמוד בספרייה, בעברית ובתעתיק. ל<a href="${links.chneiMikra}">שניים מקרא</a>
      כל פסוק מלווה בתרגום אונקלוס, ורש״י נוסף לפי בחירה. גם
      <a href="${links.tanakh}">התנ״ך</a> המלא נמצא שם.</p>
      <p>ללימוד משותף, <a href="${links.shareReading}">מפגש קריאה משותפת</a> מחלק טקסט בין
      המשתתפים ועוקב אחר ההתקדמות עד הסיום.</p>`,
  shabbatTitle: "השבת שבה קוראים אותה",
  shabbatHtml: `<p>זמני הכניסה והיציאה של השבת של כל פרשה, בעיר שלך, נמצאים בעמוד
      <a href="${links.horaires}">זמני שבת</a>; תאריכי החגים נמצאים
      ב<a href="${links.calendrier}">לוח החגים</a>.</p>`,
  faqHeading: "שאלות נפוצות על פרשת השבוע",
  faq: (parasha, date) => [
    {
      q: "מהי פרשת השבוע?",
      a: `בשבת ${date} קוראים את פרשת ${parasha}. הטבלה שלמעלה נותנת את הפרשה של כל שבת בשנה, כל אחת מקושרת לטקסט שלה בעברית ובתעתיק.`,
    },
    {
      q: "מהי פרשה?",
      a: "פרשה (פרשת השבוע) היא החלק מן התורה הנקרא בבית הכנסת בשבת. חמישה חומשי תורה מחולקים ל־54 פרשות, הנקראות שבת אחר שבת: המחזור נחתם בשמחת תורה, שבה מסיימים את ספר דברים ומתחילים מיד מבראשית.",
    },
    {
      q: "מדוע לפעמים קוראים שתי פרשות באותה שבת?",
      a: "משום שבשנה העברית יש כחמישים שבתות, ולעיתים פחות, וימי החג תופסים כמה מהן. כדי שהמחזור ייחתם בשמחת תורה, זוגות מסוימים (ויקהל ופקודי, ניצבים וילך ואחרים) נקראים יחד בשנים הקצרות.",
    },
    {
      q: "היכן אפשר לקרוא את פרשת השבוע באינטרנט?",
      a: `לכל פרשה יש עמוד בספרייה, בעברית ובתעתיק, בחינם וללא חשבון. לשניים מקרא (כל פסוק פעמיים ואחריו תרגום אונקלוס), <a href="${links.chneiMikra}">עמוד השניים מקרא</a> פורש את פרשת השבוע פסוק אחר פסוק.`,
    },
    {
      q: "באיזו שעה נכנסת אותה שבת?",
      a: `זמני הדלקת הנרות וצאת השבת בעיר שלך נמצאים בעמוד <a href="${links.horaires}">זמני שבת</a>, שבוע אחר שבוע, עם שם הפרשה לצידם.`,
    },
  ],
  breadcrumbHome: "דף הבית",
  breadcrumbName: "פרשת השבוע",
});

export const PARASHA_STRINGS: Record<string, (links: ParashaLinks) => ParashaStrings> = {
  fr: PARASHA_FR,
  en: PARASHA_EN,
  he: PARASHA_HE,
};
