import type { KlafKind } from "../services/textService";

/**
 * Les parchemins du sidour : leurs photos, et leur retranscription.
 *
 * Les photos (public/klaf) sont celles d'un klaf écrit par un sofer, telles
 * quelles : c'est la graphie du sofer, avec ses taguim, qu'on vient regarder.
 * La retranscription reprend le parchemin lettre à lettre, sans voyelles
 * comme lui, un paragraphe à chaque blanc que le sofer a laissé. Le texte
 * vocalisé, lui, est déjà dans le fil de l'office.
 */

/** Les photos de chaque parchemin, dans l'ordre des pages. */
export const KLAF_PHOTOS: Record<KlafKind, string[]> = {
  ketoret: ["/klaf/ketoret-1.webp", "/klaf/ketoret-2.webp"],
  menora: ["/klaf/menora.webp"],
};

/** Le pitoum haketoret, tel que le parchemin l'écrit. */
export const KETORET_KLAF: readonly string[] = [
  "אתה הוא יהוה אלהינו שהקטירו אבותינו לפניך את קטרת הסמים בזמן שבית המקדש קים כאשר צוית אותם על יד משה נביאך ככתוב בתורתך",
  "ויאמר יהוה אל משה קח לך סמים נטף ושחלת וחלבנה סמים ולבנה זכה בד בבד יהיה ועשית אתה קטרת רקח מעשה רוקח ממלח טהור קדש ושחקת ממנה הדק ונתתה ממנה לפני העדת באהל מועד אשר אועד לך שמה קדש קדשים תהיה לכם",
  "ונאמר והקטיר עליו אהרן קטרת סמים בבקר בבקר בהיטיבו את הנרת יקטירנה ובהעלת אהרן את הנרת בין הערבים יקטירנה קטרת תמיד לפני יהוה לדרתיכם",
  "תנו רבנן פטום הקטרת כיצד שלש מאות וששים ושמונה מנים היו בה שלש מאות וששים וחמשה כמנין ימות החמה מנה בכל יום מחציתו בבקר ומחציתו בערב ושלשה מנים יתרים שמהם מכניס כהן גדול ונוטל מהם מלא חפניו ביום הכפורים ומחזירן למכתשת בערב יום הכפורים כדי לקים מצות דקה מן הדקה ואחד עשר סמנים היו בה ואלו הן הצרי והצפורן והחלבנה והלבונה משקל שבעים שבעים מנה מור וקציעה ושבולת נרד וכרכום משקל ששה עשר ששה עשר מנה הקושט שנים עשר קלופה שלשה קנמון תשעה בורית כרשינה תשעה קבין יין קפריסין סאין תלת וקבין תלתא ואם לא מצא יין קפריסין מביא חמר חיור עתיק מלח סדומית רובע מעלה עשן כל שהוא רבי נתן הבבלי אומר אף כפת הירדן כל שהיא אם נתן בה דבש פסלה ואם חסר אחת מכל סממניה חייב מיתה",
  "רבן שמעון בן גמליאל אומר הצרי אינו אלא שרף הנוטף מעצי הקטף בורית כרשינה למה היא באה כדי לשפות בה את הצפורן כדי שתהא נאה יין קפריסין למה הוא בא כדי לשרות בו את הצפורן כדי שתהא עזה והלא מי רגלים יפין לה אלא שאין מכניסין מי רגלים במקדש מפני הכבוד",
  "תניא רבי נתן אומר כשהוא שוחק אומר הדק היטב היטב הדק מפני שהקול יפה לבשמים פטמה לחצאין כשרה לשליש ולרביע לא שמענו אמר רבי יהודה זה הכלל אם כמדתה כשרה לחצאין ואם חסר אחת מכל סממניה חייב מיתה",
  "תני בר קפרא אחת לששים או לשבעים שנה היתה באה של שירים לחצאין ועוד תני בר קפרא אלו היה נותן בה קרטוב של דבש אין אדם יכול לעמוד מפני ריחה ולמה אין מערבין בה דבש מפני שהתורה אמרה כי כל שאר וכל דבש לא תקטירו ממנו אשה ליהוה",
  "יהוה צבאות עמנו משגב לנו אלהי יעקב סלה יהוה צבאות אשרי אדם בטח בך יהוה הושיעה המלך יעננו ביום קראנו וערבה ליהוה מנחת יהודה וירושלם כימי עולם וכשנים קדמנית",
];

/**
 * Le psaume 67 en forme de menora, comme le parchemin l'écrit : le titre du
 * psaume (verset 1) en tête, les sept versets suivants sur les sept branches,
 * de droite à gauche, chacun lu de haut en bas. Le verset du milieu (le 5e)
 * est sur la tige : il est le plus long, et sa fin descend jusqu'au pied.
 */
export const MENORA_KLAF = {
  title: "למנצח בנגינת מזמור שיר",
  branches: [
    "אלהים יחננו ויברכנו יאר פניו אתנו סלה",
    "לדעת בארץ דרכך בכל גוים ישועתך",
    "יודוך עמים אלהים יודוך עמים כלם",
    "ישמחו וירננו לאמים כי תשפט עמים מישור",
    "יודוך עמים אלהים יודוך עמים כלם",
    "ארץ נתנה יבולה יברכנו אלהים אלהינו",
    "יברכנו אלהים וייראו אותו כל אפסי ארץ",
  ],
  base: "ולאמים בארץ תנחם סלה",
} as const;

/** La branche du milieu : la tige de la menora. */
export const MENORA_STEM = 3;
