/**
 * Les brahot du loulav, et les deux consignes qui les encadrent. Le même
 * texte se lit à deux endroits : dans le livre Moadim, où il a sa page
 * (build-moadim.mjs), et dans la Cha'harit de Souccot, juste avant le Hallel
 * (build-sidour.mjs), puisque c'est là qu'on prend les quatre espèces. Il vit
 * ici pour n'être écrit qu'une fois.
 *
 * Licence des textes : l'export Sefaria du Siddur Edot HaMizrach ne porte pas
 * ce séder. Les deux formules sont celles des sidourim séfarades imprimés ;
 * l'ouverture de la bénédiction et le Chéhé'héyanou viennent mot pour mot de
 * l'allumage de Hanouka (public/texts/tefila/nerot-hanouka.json), pour que la
 * vocalisation soit la même d'un texte à l'autre.
 */

/**
 * « Al netilat loulav », dite le loulav en main. L'étrog reste écarté tant
 * qu'elle n'est pas dite : la bénédiction précède l'accomplissement, et l'on
 * ne tient les quatre espèces réunies qu'après elle.
 */
export const BRAKHA_LOULAV =
  "בָּרוּךְ אַתָּה יְהֹוָה, אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֹתָיו, וְצִוָּנוּ עַל נְטִילַת לוּלָב:";

/**
 * Le Chéhé'héyanou, la première fois de l'année seulement. Cette première
 * fois n'est pas toujours le 15 Tichri : le loulav ne se prend pas le
 * Chabbat, et quand la fête s'ouvre un Chabbat, c'est le lendemain qu'on le
 * dit.
 */
export const BRAKHA_CHEHEHIYANOU =
  "בָּרוּךְ אַתָּה יְהֹוָה, אֱלֹהֵֽינוּ מֶלֶךְ הָעוֹלָם, שֶׁהֶחֱיָֽינוּ וְקִיְּמָנוּ וְהִגִּיעָנוּ לַזְּמַן הַזֶּה:";

/**
 * Les six côtés du na'anou'a, dans l'ordre de l'usage : sud, nord, est, haut,
 * bas, ouest.
 */
export const NAANOUIM = "דָּרוֹם, צָפוֹן, מִזְרָח, מַעְלָה, מַטָּה, מַעֲרָב:";

/** La consigne d'ouverture : comment on tient les espèces avant de bénir. */
export const HALAKHA_LOULAV = {
  fr: "On prend le loulav de la main droite, la main gauche pour les gauchers, et l'étrog de l'autre main. On ne réunit pas l'étrog au loulav avant d'avoir dit la bénédiction : elle se dit sur une mitsva qui n'est pas encore accomplie.",
  en: "The lulav is taken in the right hand, the left for left-handed people, and the etrog in the other. The etrog is not brought together with the lulav before the blessing is said: it is said over a mitzvah not yet fulfilled.",
  he: "נוטל הלולב בימין והאתרוג בשמאל (ואטר בהיפוך), ואין מחברים האתרוג ללולב עד אחר הברכה",
};

/** Entre les deux bénédictions : on réunit les espèces, et l'on ajoute. */
export const RUBRIC_CHEHEHIYANOU = {
  fr: "On rapproche alors l'étrog du loulav. La première fois de l'année seulement, on ajoute :",
  en: "The etrog is then brought together with the lulav. The first time of the year only, add:",
  he: "מחבר האתרוג ללולב, ובפעם הראשונה בלבד מוסיף:",
};

/** Après les bénédictions : les six côtés, dans leur ordre. */
export const RUBRIC_NAANOUIM = {
  fr: "On agite ensuite le loulav de chaque côté, dans cet ordre :",
  en: "The lulav is then waved on each side, in this order:",
  he: "ומנענע לשש קצוות כסדר הזה:",
};
