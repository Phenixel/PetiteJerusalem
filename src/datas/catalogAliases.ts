/**
 * Les autres noms des textes du catalogue, pour la recherche (voir
 * services/catalogSearch) : ceux que la clé phonétique ne peut pas deviner.
 *
 * « Chabbat » et « Shabbat », « Kidouchin » et « Kiddushin » se retrouvent
 * seuls, par la phonétique (services/fuzzySearch). « Genèse » et
 * « Berechit », « Maariv » et « Arvit », « Psaume » et « Tehilim » sont
 * d'autres mots : il faut les écrire. On y met aussi les noms hébreux que le
 * catalogue ne porte pas (les parachiot, les livres du Tanakh), pour qui
 * cherche en hébreu.
 *
 * Un alias ne s'affiche jamais : il ne sert qu'à trouver. Un test
 * (catalogSearch.test.ts, « autres noms du catalogue ») vérifie que chaque
 * clé désigne un texte ou un livre du catalogue, pour qu'un renommage ne
 * rende pas un alias muet.
 */

/** Les noms communs aux cinq livres de la Torah. */
const TORAH = ["Torah", "Houmach", "Chumash", "Pentateuque", "תורה", "חומש"];

/**
 * Par livre (ou seder, ou section), sous sa partie latine telle que
 * l'affiche la bibliothèque (`bookName`) : « Nevi'im (Prophets) » se range
 * sous « Prophets ». Tous les textes du livre en héritent.
 */
export const BOOK_ALIASES: Record<string, string[]> = {
  Berechit: ["Genèse", "Genesis", "בראשית", ...TORAH],
  Chemot: ["Exode", "Exodus", "שמות", ...TORAH],
  Vayikra: ["Lévitique", "Leviticus", "ויקרא", ...TORAH],
  Bamidbar: ["Nombres", "Numbers", "במדבר", ...TORAH],
  Devarim: ["Deutéronome", "Deuteronomy", "דברים", ...TORAH],
  Prophets: ["Prophètes", "נביאים"],
  Writings: ["Hagiographes", "Écrits", "כתובים"],
  Toharot: ["Taharot"],
  "Yamim Noraim": ["Fêtes de Tichri", "Kippour", "Yom Kippour", "Yom Kippur", "High Holidays"],
  Brahot: ["Bénédictions", "Blessings"],
  "Maagal Hahayim": ["Cycle de la vie", "Life cycle"],
  Sidour: ["Siddur", "Prières", "Prayers", "Tefila", "Tefilot", "תפילה"],
};

/**
 * Par texte, sous sa partie latine (`latinPart`). Quand deux textes portent
 * le même nom, la clé précise le livre après une barre verticale :
 * « Shoftim » est une paracha du Deutéronome et le livre des Juges.
 */
export const TEXT_ALIASES: Record<string, string[]> = {
  // Torah : les parachiot, sous leur nom hébreu.
  Noah: ["נח", "Noé"],
  "Lech Lecha": ["לך לך"],
  Vayera: ["וירא"],
  "Chayei Sarah": ["חיי שרה"],
  Toldot: ["תולדות"],
  Vayetze: ["ויצא"],
  Vayishlach: ["וישלח"],
  Vayeshev: ["וישב"],
  Miketz: ["מקץ"],
  Vayigash: ["ויגש"],
  Vayechi: ["ויחי"],
  Shemot: ["שמות"],
  "Va'era": ["וארא"],
  Bo: ["בא"],
  Beshalach: ["בשלח"],
  Yitro: ["יתרו", "Jethro"],
  Mishpatim: ["משפטים"],
  Terumah: ["תרומה"],
  Tetzaveh: ["תצוה"],
  "Ki Tisa": ["כי תשא"],
  Vayakhel: ["ויקהל"],
  Pekudei: ["פקודי"],
  Tzav: ["צו"],
  Shemini: ["שמיני"],
  Tazria: ["תזריע"],
  Metzora: ["מצורע"],
  "Acharei Mot": ["אחרי מות"],
  Kedoshim: ["קדושים"],
  Emor: ["אמור"],
  Behar: ["בהר"],
  Bechukotai: ["בחוקותי"],
  Nasso: ["נשא"],
  "Beha'alotcha": ["בהעלותך"],
  Shelach: ["שלח לך", "Shelach Lecha"],
  Korach: ["קרח"],
  Chukat: ["חוקת"],
  Balak: ["בלק"],
  Pinchas: ["פינחס"],
  Matot: ["מטות"],
  Masei: ["מסעי"],
  "Va'etchanan": ["ואתחנן"],
  Ekev: ["עקב"],
  "Re'eh": ["ראה"],
  Shoftim: ["שופטים"],
  "Ki Tetze": ["כי תצא"],
  "Ki Tavo": ["כי תבוא"],
  Nitzavim: ["נצבים"],
  Vayelech: ["וילך"],
  Haazinu: ["האזינו"],
  "V'Zot HaBerachah": ["וזאת הברכה"],

  // Nevi'im et Ketuvim : les livres, sous leurs noms français et anglais.
  Yehoshua: ["Josué", "Joshua", "יהושע"],
  "Shoftim|Nevi'im (Prophets)": ["Juges", "Judges"],
  "Shmuel Aleph": ["Samuel 1", "1 Samuel", "Samuel I", "שמואל א"],
  "Shmuel Bet": ["Samuel 2", "2 Samuel", "Samuel II", "שמואל ב"],
  "Melachim Aleph": ["Rois 1", "1 Rois", "Kings 1", "1 Kings", "מלכים א"],
  "Melachim Bet": ["Rois 2", "2 Rois", "Kings 2", "2 Kings", "מלכים ב"],
  Yeshayahu: ["Isaïe", "Isaiah", "ישעיהו"],
  Yirmiyahu: ["Jérémie", "Jeremiah", "ירמיהו"],
  Yechezkel: ["Ézéchiel", "Ezekiel", "יחזקאל"],
  // Les douze petits prophètes tiennent en un seul livre : chacun y mène.
  "Trei Asar": [
    "Douze prophètes",
    "Twelve Prophets",
    "תרי עשר",
    "Hochéa",
    "Osée",
    "Hosea",
    "Yoël",
    "Joël",
    "Amos",
    "Ovadia",
    "Abdias",
    "Obadiah",
    "Yona",
    "Jonas",
    "Jonah",
    "Mikha",
    "Michée",
    "Micah",
    "Nahoum",
    "Havakouk",
    "Habacuc",
    "Habakkuk",
    "Tsefania",
    "Sophonie",
    "Zephaniah",
    "Hagaï",
    "Aggée",
    "Zekharia",
    "Zacharie",
    "Zechariah",
    "Malakhi",
    "Malachie",
    "הושע",
    "יואל",
    "עמוס",
    "עובדיה",
    "יונה",
    "מיכה",
    "נחום",
    "חבקוק",
    "צפניה",
    "חגי",
    "זכריה",
    "מלאכי",
  ],
  Tehillim: ["Psaumes", "Psalms", "תהילים"],
  Mishlei: ["Proverbes", "Proverbs", "משלי"],
  Iyov: ["Job", "איוב"],
  "Shir Hashirim": ["Cantique des cantiques", "Song of Songs", "שיר השירים"],
  Ruth: ["רות"],
  Eicha: ["Lamentations", "איכה"],
  Kohelet: ["Ecclésiaste", "Ecclesiastes", "קהלת"],
  Esther: ["Meguilat Esther", "אסתר"],
  Daniel: ["דניאל"],
  "Ezra-Nehemiah": ["Esdras", "Néhémie", "עזרא", "נחמיה"],
  "Divrei Hayamim Aleph": [
    "Chroniques 1",
    "1 Chroniques",
    "Chronicles 1",
    "1 Chronicles",
    "דברי הימים א",
  ],
  "Divrei Hayamim Bet": [
    "Chroniques 2",
    "2 Chroniques",
    "Chronicles 2",
    "2 Chronicles",
    "דברי הימים ב",
  ],

  // Michna et Talmud : les traités à deux noms.
  Avot: [
    "Pirké Avot",
    "Pirkei Avot",
    "Maximes des Pères",
    "Éthique des Pères",
    "Ethics of the Fathers",
    "פרקי אבות",
  ],
  Beitzah: ["Yom Tov"],
  Oktzin: ["Uktzin", "Oukatsin"],

  // Moadim.
  "Atarat Nedarim": ["Hatarat Nedarim", "Annulation des vœux", "Annulment of Vows"],
  "Netilat Loulav": ["Arba Minim", "Quatre espèces", "Four Species", "ארבעת המינים"],
  "Seder Leil Souccot": ["Ouchpizin", "אושפיזין"],
  Hochanot: ["Hochana Rabba"],
  "Nerot Hanouka": ["Maoz Tsour", "Allumage des bougies", "Menorah"],

  // Brahot : le nom de la bénédiction, ou ce qu'elle accompagne.
  "Birkat Hamazon": ["Bénédiction après le repas", "Grace after meals", "Bentcher"],
  "Brakha A'harona": ["Mé'ein Chaloch", "Al Hami'hya", "Boré Nefachot", "Bénédiction finale"],
  "Cheva Brahot": ["Mariage", "Wedding"],
  "Birkat Halevana": ["Kiddouch Levana", "Bénédiction de la lune", "Blessing of the Moon"],
  "Birkot Hanehenin": ["Chéhé'héyanou", "Bénédictions de jouissance", "Blessings on Enjoyments"],
  "Brahot Chonot": ["Bénédictions diverses", "Assorted Blessings"],
  "Birkat Hailanot": ["Bénédiction des arbres", "Blessing of the Trees"],
  "Tefilat Haderekh": ["Prière du voyageur", "Prière de la route", "Traveler's Prayer"],
  "Hafrashat Halla": ["Prélèvement de la halla", "Separating Hallah"],
  "Teroumot ouMaasrot": ["Prélèvement des dîmes", "Separating Tithes"],
  "Brit Mila": ["Circoncision", "Circumcision"],
  Hachkava: ["Deuil", "Défunts", "Mourning"],

  // Sidour.
  Chaharit: ["Prière du matin", "Morning prayer"],
  "Min'ha": ["Prière de l'après-midi", "Afternoon prayer"],
  Arvit: ["Maariv", "מעריב", "Prière du soir", "Evening prayer"],
  "Chema al Hamita": ["Kriat Chema", "Chéma du coucher", "Bedtime Shema"],
  "Tikoun Hatsot": ["Prière de minuit", "Midnight prayer"],
};
