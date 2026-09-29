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

/**
 * Après les bénédictions : les six côtés, dans leur ordre. La didascalie les
 * nomme en toutes lettres dans la langue du lecteur, la ligne qui suit ne les
 * portant qu'en hébreu ; le cadran du lecteur (NaanouimCompass) les pose au
 * même ordre, numérotés.
 */
export const RUBRIC_NAANOUIM = {
  fr: "On agite ensuite le loulav trois fois de chaque côté, en l'éloignant puis en le ramenant vers la poitrine, dans cet ordre : sud, nord, est, haut, bas, ouest.",
  en: "The lulav is then waved three times on each side, away from you and back towards the chest, in this order: south, north, east, up, down, west.",
  he: "ויעשה הנענועים שלש פעמים בהולכה והובאה אל החזה, כסדר הזה:",
};

/**
 * Les trois paragraphes des brahot, tels que les deux recettes les posent : la
 * page du livre Moadim (build-moadim.mjs) et la Cha'harit de 'Hol haMoed
 * (build-sidour.mjs). Ils vivent ici pour que les deux textes restent
 * d'accord : un paragraphe ajouté, déplacé ou remis en forme l'est aux deux
 * endroits à la fois.
 */
export const LIGNES_LOULAV = [
  { he: BRAKHA_LOULAV },
  { he: BRAKHA_CHEHEHIYANOU, rubric: RUBRIC_CHEHEHIYANOU },
  { he: NAANOUIM, rubric: RUBRIC_NAANOUIM, muted: true },
];

/**
 * Les na'anou'im du Hallel, là où le sidour les marque : au premier « Hodou »,
 * à « Ana Hachem hochia na », et au « Hodou » qui ferme le psaume 118.
 *
 * Le sidour donne un côté par mot, ou par syllabe pour « Ana », et note qu'on
 * n'agite pas sur le Nom. La didascalie française nomme les côtés ; le cadran
 * du lecteur (NaanouimCompass) en donne l'ordre.
 */
export const RUBRIC_NAANOUIM_HODOU = {
  fr: "Le loulav en main, un côté par mot : « Hodou » au sud, « ki » au nord, « tov » à l'est face à soi, « ki » en haut, « lé'olam » en bas, « hasdo » à l'ouest. Rien sur le Nom.",
  en: "Lulav in hand, one side per word: “Hodu” to the south, “ki” to the north, “tov” to the east, straight ahead, “ki” up, “le'olam” down, “hasdo” to the west. Nothing on the Name.",
  he: "וינענע בלולב כך: הוֹדוּ : לצד דרום. לַה' : אסור לנענע. כִּי : לצד צפון. טוֹב : לצד מזרח לנוכח. כִּי : למעלה. לְעוֹלָם : למטה. חַסְדּוֹ : לצד מערב.",
};

export const RUBRIC_NAANOUIM_ANA = {
  fr: "Une syllabe par côté : « A » au sud, « na » au nord, « ho » à l'est face à soi, « chi » en haut, « 'a » en bas, « na » à l'ouest. Rien sur le Nom. Chaque mot se dit d'un seul souffle : on ne reprend jamais sa respiration au milieu d'un mot, et « A » et « na » ne se séparent pas en deux souffles. On se tourne ensuite vers la droite et l'on agite de même au second « Ana Hachem hochia na » ; à Djerba, on agite des deux côtés à chaque mot. « Ana Hachem hatsli'ha na » se dit deux fois, sans na'anou'im.",
  en: "One syllable per side: “A” to the south, “na” to the north, “ho” to the east, straight ahead, “shi” up, “a” down, “na” to the west. Nothing on the Name. Each word is said in a single breath: never stop for breath in the middle of a word, so “A” and “na” are not split across two breaths. Then turn to the right and wave the same way at the second “Ana Hashem hoshia na”; in Djerba each word is waved on both sides. “Ana Hashem hatzlicha na” is said twice, without waving.",
  he: "וינענע בלולב כך: אָ : לצד דרום. נָּא : לצד צפון. ה' : אסור לנענע. הוֹ : לצד מזרח לנוכח. שִׁי : למעלה. עָה : למטה. נָּא : לצד מערב. ויסתובב לצד ימין וינענע שוב כנ\"ל (ובג'רבא נוהגים בכל מלה לנענע לשני צדדים), ואחר כך יאמר אנא ה' הצליחה נא, ב\"פ.",
};

/**
 * Le « Hodou » qui ferme le psaume : les mêmes six côtés qu'au premier, une
 * seule fois, bien que le verset se redise. L'hébreu est celui de la page
 * 623 du sidour.
 */
export const RUBRIC_NAANOUIM_HODOU_FIN = {
  fr: "On agite encore une fois, comme au premier « Hodou » : un côté par mot, sud, nord, est, haut, bas, ouest.",
  en: "Wave once more, as at the first “Hodu”: one side per word, south, north, east, up, down, west.",
  he: "וינענע שוב פעם אחת כנ\"ל בהודו לה' וגו'",
};

/**
 * Ce qui se dit avant de prendre le loulav : le Léchem yihoud, la kavana des
 * six côtés (« Vaharéni moukhan »), le Yehi ratson, dont le verset « Vihi
 * no'am » se dit deux fois, et les trois « Ribon 'alma » du Zohar.
 *
 * Transcrit des pages 614 à 617 du sidour et relu contre les photos. Le texte
 * n'y est vocalisé qu'en partie, et irrégulièrement : il est recopié tel
 * quel, sans voyelle ajoutée. Les formes araméennes aussi (« קַמָּךְ »,
 * « יֵאוּת » à la page 616 et « יָאוּת » à la page 617) : c'est l'imprimé qui
 * fait foi, pas le texte qu'on connaît par ailleurs.
 *
 * Le sidour donne le Léchem yihoud des jours de 'Hol haMoed : une note dit
 * qu'il en retire un passage, sur une tradition du rav Rafaël Jami. C'est la
 * mitsva « דְרַבָּנָן » qu'il nomme, celle des jours qui suivent le premier.
 */
export const RUBRIC_AVANT_LOULAV = {
  fr: "Avant de prendre le loulav, on dit cette prière :",
  en: "Before taking the lulav, this prayer is said:",
  he: "בקשה לאומרה קודם נטילת לולב (לשון חכמים ח\"א סי' ל\"ב)",
};

export const HALAKHA_AVANT_LOULAV = {
  fr: "Le sidour donne ce Léchem yihoud dans sa version de 'Hol haMoed : sur une tradition du rav Rafaël Jami, on y saute un passage ces jours-là, et il est omis ici.",
  en: "The siddur gives this Leshem yichud in its Chol HaMoed form: following a tradition of Rav Rafael Jami, a passage is skipped on those days, and it is omitted here.",
  he: "בנוסח לשם יחוד דלקמן: שמעתי מאבא מארי הגאון זצ\"ל שקבל מהרה\"ג המקובל ר' רפאל ג'אמי זצ\"ל שיש לדלג בחוה\"מ מן \"ויהרמ\"י או\"א וכו' לתקן את כל פגמינו וכו'\" עד \"והריני מוכן לנענע הלולב וכו'\", וטעמו ונימוקו עמו. (מרן ראש הישיבה שליט\"א). ועל כן השמטנו פה את הקטע הנ\"ל.",
};

/** Le verset « Vihi no'am », qui ferme le Yehi ratson, se dit deux fois. */
export const RUBRIC_VIHI_NOAM = {
  fr: "On dit ce verset deux fois :",
  en: "This verse is said twice:",
  he: "ויכפול פסוק זה ב' פעמים",
};

export const LIGNES_AVANT_LOULAV = [
  {
    he: "לְשֵׁם יִחוּד קֻדְשָׁא בְרִיךְ הוּא וּשְׁכִינְתֵּהּ (יאהדונהי), בִּדְחִילוּ וּרְחִימוּ (יאההויהה) וּרְחִימוּ וּדְחִילוּ (איההיוהה), לְיַחֲדָא אוֹת י' וְאוֹת ה' (או\"א) בְּאוֹת ו' וְאוֹת ה' (זו\"נ) בְּיִחוּדָא שְׁלִים (יהוה) בְּשֵׁם כׇּל יִשְׂרָאֵל, וּבְשֵׁם כׇּל הַנְּפָשׁוֹת רוּחוֹת וּנְשָׁמוֹת הַמִּתְיַחֲסִים אֶל שׇׁרְשֵׁי נַפְשֵׁנוּ רוּחֵנוּ וְנִשְׁמָתֵנוּ וּמַלְבּוּשֵׁיהֶם וְהַקְּרוֹבִים לָהֶם, שֶׁמִּכְּלָלוּת אֲצִילוּת בְּרִיאָה יְצִירָה עֲשִׂיָּה. וּמִכׇּל פְּרָטֵי אֲצִילוּת בְּרִיאָה יְצִירָה עֲשִׂיָּה, דְּכׇל פַּרְצוּף וּסְפִירָה דִּפְרָטֵי אֲצִילוּת בְּרִיאָה יְצִירָה עֲשִׂיָּה.",
    rubric: RUBRIC_AVANT_LOULAV,
  },
  { he: "הִנֵּה אֲנַחְנוּ בָּאִים לְקַיֵּם מִצְוַת עֲשֵׂה דְרַבָּנָן שֶׁל נְטִילַת לוּלָב, הֲדָס, עֲרָבָה וְאֶתְרֹג בַּמּוֹעֵד שֶׁל חַג הַסֻּכּוֹת. לְתַקֵּן אֶת שׇׁרְשָׁם בְּמָקוֹם עֶלְיוֹן בְּשִׁעוּר קוֹמָה, לַעֲשׂוֹת אֶת כַּוָּנַת יוֹצְרֵנוּ שֶׁצִּוָּנוּ לַעֲשׂוֹת מִצְוָה זוֹ, לְהַשְׁלִים אִילָן הָעֶלְיוֹן וּלְהַשְׁלִים אָדָם הָעֶלְיוֹן, וּלְהָקִים אֶת סֻכַּת דָּוִיד לְהַחֲזִיר הָעֲטָרָה לְיׇשְׁנָהּ, לְבָרֵר וּלְתַקֵּן וּלְהַעֲלוֹת כׇּל־הַנְּפָשׁוֹת וְהָרוּחוֹת וְהַנְּשָׁמוֹת וְנִיצוֹצֵי הַקְּדֻשָּׁה שֶׁנָּֽפְלוּ בַקְּלִפָּה עַל יְדֵי אָדָם הָרִאשׁוֹן וְעַל יָדֵינוּ, בְּגִלְגּוּלִים אֵלּוּ וּבְגִלְגּוּלִים אֲחֵרִים, וּשְׁאֵרִית הָרְפַ\"ח נִיצוֹצִין, וּלְהַשְׁלִים שְׁלֵמוּת תִּקּוּן נַפְשֵׁנוּ רוּחֵנוּ וְנִשְׁמָתֵנוּ שֶׁמִּכְּלָלוּת אֲצִילוּת בְּרִיאָה יְצִירָה עֲשִׂיָּה, וּמִכׇּל־פְּרָטֵי אֲצִילוּת בְּרִיאָה יְצִירָה עֲשִׂיָּה, דְּכׇל־פַּרְצוּף וּסְפִירָה דִּפְרָטֵי אֲצִילוּת בְּרִיאָה יְצִירָה עֲשִׂיָּה, הַמִּתְיַחֲסִים אֶל תִּקּוּן מִצְוָה זוֹ. וְגַם לְהַשְׁלִים שְׁלֵמוּת תִּקּוּן אֶבְרֵי נְפָשׁוֹת רוּחוֹת וּנְשָׁמוֹת שֶׁל כׇּל יִשְׂרָאֵל, הַחַיִּים וְהַמֵּתִים הַחֲסֵרִים מִתִּקּוּן מִצְוָה זוֹ:", tight: true },
  { he: "וַהֲרֵינִי מוּכָן לְנַעְנֵעַ הַלּוּלָב, הַהֲדַס, הָעֲרָבָה וְהָאֶתְרֹג לְצַד דָּרוֹם שֶׁהוּא בַחֶסֶד, שָׁלֹשׁ פְּעָמִים בְּהוֹלָכָה וְהוֹבָאָה אֶל הֶחָזֶה: וּלְצַד צָפוֹן שֶׁהוּא בַגְּבוּרָה, שָׁלֹשׁ פְּעָמִים בְּהוֹלָכָה וְהוֹבָאָה אֶל הֶחָזֶה: וּלְצַד מִזְרָח שֶׁהוּא בַתִּפְאֶרֶת, שָׁלֹשׁ פְּעָמִים בְּהוֹלָכָה וְהוֹבָאָה אֶל הֶחָזֶה: וּלְצַד מַעְלָה שֶׁהוּא בַנֶּצַח, שָׁלֹשׁ פְּעָמִים בְּהוֹלָכָה וְהוֹבָאָה אֶל הֶחָזֶה: וּלְצַד מַטָּה שֶׁהוּא בַהוֹד, שָׁלֹשׁ פְּעָמִים בְּהוֹלָכָה וְהוֹבָאָה אֶל הֶחָזֶה: וּלְצַד מַעֲרָב שֶׁהוּא בַיְסוֹד, שָׁלֹשׁ פְּעָמִים בְּהוֹלָכָה וְהוֹבָאָה אֶל הֶחָזֶה." },
  { he: "וִיהִי רָצוֹן מִלְּפָנֶיךָ יְהֹוָה אֱלֹהֵינוּ וֵאלֹהֵי אֲבוֹתֵינוּ שֶׁתְּהֵא שָׁעָה זוֹ שְׁעַת רָצוֹן לְפָנֶיךָ, וְתִהְיֶה עוֹלָה לְפָנֶיךָ מִצְוָה זוֹ שֶׁל נְטִילַת הַלּוּלָב הַהֲדַס וְהָעֲרָבָה וְהָאֶתְרֹג וְסֵדֶר הַנִּעְנוּעִים, לְהַמְשִׁיךְ הַחֲסָדִים הָרְאוּיִים לְהִמָּשֵׁךְ עַל יָדָם בְּיוֹם זֶה, וְיַעֲלֶה לְפָנֶיךָ כְּאִלּוּ כִוַּנְתִּי בְּכׇל הַכַּוָּנוֹת שֶׁצָּרִיךְ לְכַוֵּן בְּלוּלָב, הֲדַס, עֲרָבָה וְאֶתְרֹג, שֶׁהֵם רוֹמְזִים אֶל אַרְבַּע אוֹתִיּוֹת שֵׁם הֲוָיָ\"ה בְּמִלוּי הֵהִי\"ן שֶׁהֵם (יו\"ד ה\"ה ו\"ו ה\"ה), וּכְאִלוּ כִוַּנְתִּי בְסֵדֶר הַנִּעְנוּעִים שֶׁלָּהֶם, וְיִמָּשֵׁךְ חֶסֶד מֵחֲסָדִים בְּאוֹר פְּנִימִי כָּרָאוּי לִהְיוֹת נִמְשָׁךְ בְּיוֹם זֶה." },
  { he: "וִיהִי נֹעַם אֲדֹנָי אֱלֹהֵינוּ עָלֵינוּ. וּמַעֲשֵׂה יָדֵינוּ כּוֹנְנָה עָלֵינוּ, וּמַעֲשֵׂה יָדֵינוּ כּוֹנְנֵהוּ.", rubric: RUBRIC_VIHI_NOAM, repeat: 2 },
  { he: "רִבּוֹן עָלְמָא טִיבוּ סַגִּי עַבְדַת עִם עַמָּךְ יִשְׂרָאֵל דְּאִתְרְעִית בְּהוּ בִלְחוֹדַיְיהוּ. וְעָבַדְת לוֹן עַמָּא יְחִידָאָה בְּעָלְמָא וְקָרִית לוֹן גּוֹי אֶחָד. וְיָהַבְתְּ לוֹן אוֹרַיְיתָא דִקְשׁוֹט. וּפָּקַדְתְּ לוֹן בְּכַמָּה פִּקּוּדִין לְאִתְעַטְּרָא בְּהוּ, וְיָהַבְתְּ לוֹן חֵילָא לְמֶעְבַּד רְעוּתָךְ. וּבְאִתְעָרוּתָא דִּילְהוֹן לְתַתָּא. בְּמִלּין וּבְעוֹבָדָא יִתְעַר חֵילָא דִּלְעֵלָּא:" },
  { he: "רִבּוֹן עָלְמָא כַּמָּה עִלָּאִין עוֹבָדָךְ. דְּהָא בְּאִנּוּן עוֹבָדֵי דְּעָבַדְתְּ לְתַתָּא, דְּאִנּוּן לוּלָב וַהֲדַס וַעֲרָבָה וְאֶתְרוֹג. כֻּלְּהוּ אֲחִידָן בִּשְׁמָא קַדִּישָׁא, וְכַד נַטְלִין לוֹן יִשְׂרָאֵל לְתַתָּא וְעַבְדֵי בְּהוּ עוֹבָדָא. אִתְּעַר הַהוּא עוֹבָדָא דִּלְעֵלָּא דְּקָטִיר בְּהוּ. וְעַל דָּא בָּעֵינָן לְאַחָדָא לוֹן וּלְמֶעְבַּד בְּהוּ עוֹבָדָא. בְּגִין לְאִתְעָרָא בְּהוּ חֵילָא דִּלְעֵלָּא:" },
  { he: "רִבּוֹן עָלְמָא אַנָּן בָּעֵינָן לְאִשְׁתַּדְּלָא בִּיקָרָךְ. יְהֵא רַעֲוָא קַמָּךְ לְמֵיהַב לָן חֵילָא לְאִתְעָרָא בִּיקָרָךְ, וּלְמֶעְבַּד רְעוּתָךְ וּלְסַדָּרָא כֹלָא כִּדְקָא יֵאוּת. וְאַף עַל גַּב דְּלֵית אַנָּן יַדְעֵי לְשַׁוָּאָה רְעוּתָא וְלִבָּא לְתַקָּנָא כֹּלָּא, יְהֵא רַעֲוָא קַמָּךְ דְּתִתְרְעֵי בְּעוֹבָדָא דִּילָן, וּתְתַקֵן תִּקּוּנָא דִּלְעֵלָּא כִּדְקָא יֵאוּת. וְתַחְשִׁיב לָן כְּאִלוּ אִשְׁתַּדַּלְנָא בִּיקָרָךְ כִּרְעוּתָךְ לְסַדָּרָא כֹּלָּא כִּדְקָא יֵאוּת. וְעַל דָּא צַלֵּי קֳדָמָךְ דָּוִד עַבְדָּךְ וְאָמַר. וִיהִי נֹעַם ה' אֱלֹקֵינוּ עָלֵינוּ, דְּהָא לֵית כׇּל בַּר נָשׁ חַכִּים לְשַׁוָּאָה רְעוּתָא וְלִבָּא לְתַקָּנָא כֹּלָּא וְיַעֲבִיד עוֹבָדָא דְּמִצְוָה. עַל דָּא צַלֵּי צְלוֹתָא דָא וּמַעֲשֵׂה יָדֵינוּ כּוֹנְנָה עָלֵינוּ. כּוֹנְנָה וְאַתְקִין תִּקּוּנָא לְעֵלָּא כִּדְקָא יֵאוּת. עָלֵינוּ אַף עַל גַּב דְּלֵית אַנָּן יַדְעֵי לְשַׁוָּאָה רְעוּתָא אֶלָּא עוֹבָדָא בִּלְחוֹדוֹי. מַעֲשֵׂה יָדֵינוּ כּוֹנְנֵהוּ לְמָאן לְהַהוּא דַּרְגָּא דְּאִצְטְרִיךְ לְאִתְתַּקְּנָא, כּוֹנְנָה בְּחִבּוּרָא חֲדָא, אַבָּהָן לְמֶהֱוֵי מִתְתַּקְּנָא בְּהוֹן בְּהַאי עוֹבָדָא כִּדְקָא יָאוּת, וִיהִי נֹעַם ה' אֱלֹהֵינוּ עָלֵינוּ וּמַעֲשֵׂה יָדֵינוּ כּוֹנְנָה עָלֵינוּ וּמַעֲשֵׂה יָדֵינוּ כּוֹנְנֵהוּ, בָּרוּךְ ה' לְעוֹלָם אָמֵן וְאָמֵן:" },
];

/**
 * Les dinim du loulav, en tête de sa page du livre Moadim (build-moadim.mjs) :
 * des halakhot sans texte à dire, comme celles des Hochanot. Rédigées ici,
 * chacune avec sa source dans le Choul'han Aroukh ; l'ordre des six côtés
 * est celui du cadran du lecteur (NaanouimCompass).
 */
export const DINIM_LOULAV = [
  {
    fr: "Chaque jour de Souccot, sauf le Chabbat, on prend les quatre espèces : un loulav, trois branches de myrte (hadassim), deux branches de saule (aravot) et un étrog. Le premier jour, c'est une mitsva de la Torah ; les autres jours, une institution des sages en souvenir du Temple.",
    en: "Every day of Sukkot except Shabbat, the four species are taken: a lulav, three myrtle branches (hadassim), two willow branches (aravot) and an etrog. On the first day it is a Torah commandment; on the other days, a rabbinic institution in memory of the Temple.",
    he: 'מצות עשה ליטול ארבעה מינים בכל יום מימי החג חוץ משבת: לולב, שלשה הדסים, שתי ערבות ואתרוג. ביום הראשון מן התורה, ובשאר הימים מדרבנן זכר למקדש. (שו"ע סי\' תרנ"א ס"א, וסי\' תרנ"ח ס"א וס"ב)',
  },
  {
    fr: "On lie ensemble le loulav, les hadassim et les aravot : le dos du loulav face à soi, les hadassim à sa droite, les aravot à sa gauche, les hadassim un peu plus haut que les aravot.",
    en: "The lulav, hadassim and aravot are bound together: the spine of the lulav facing you, the hadassim on its right, the aravot on its left, the hadassim a little higher than the aravot.",
    he: 'אוגד הלולב וההדסים והערבות יחד, שדרת הלולב כנגד פניו, ההדסים מימין הלולב והערבות משמאלו, ויהיו ההדסים גבוהים מן הערבות. (שו"ע סי\' תרנ"א ס"א, וכה"ח שם)',
  },
  {
    fr: "Le loulav se prend de jour, dès le lever du soleil, et a posteriori dès l'aube, jusqu'au coucher du soleil. On ne mange pas avant de l'avoir pris.",
    en: "The lulav is taken by day, from sunrise, and after the fact from dawn, until sunset. One does not eat before taking it.",
    he: 'זמן נטילת לולב ביום, מהנץ החמה, ובדיעבד מעלות השחר, עד שקיעת החמה. ואסור לאכול קודם שיטול לולב. (שו"ע סי\' תרנ"ב ס"א וס"ב)',
  },
  {
    fr: "Le premier jour, le loulav doit appartenir à celui qui le prend : on ne s'acquitte pas avec un loulav emprunté. Qui n'en a pas le reçoit en cadeau, à condition de le rendre. Ce jour-là, on ne donne pas son loulav à un enfant avant d'avoir soi-même accompli la mitsva : un enfant peut l'acquérir, mais ne peut pas le rendre.",
    en: "On the first day, the lulav must belong to the one who takes it: a borrowed lulav does not fulfil the obligation. One who has none receives it as a gift, on condition that it be returned. On that day, one does not give one's lulav to a child before fulfilling the mitzvah oneself: a child can acquire it, but cannot give it back.",
    he: 'ביום ראשון צריך שיהיה הלולב שלו, ואינו יוצא בשאול. ומי שאין לו, יקבלנו במתנה על מנת להחזיר. ולא יתן אדם לולבו ביום ראשון לקטן קודם שיצא בו, מפני שהקטן קונה ואינו מקנה. (שו"ע סי\' תרנ"ח ס"ג, ס"ד וס"ו)',
  },
  {
    fr: "Les espèces se tiennent dans le sens où elles ont poussé, la pointe vers le haut. On agite pendant la bénédiction, puis dans le Hallel, au premier « Hodou », à « Ana Hachem hochia na » et au « Hodou » de la fin : chaque fois trois fois de chaque côté, en éloignant puis en ramenant vers la poitrine, dans l'ordre sud, nord, est, haut, bas, ouest, le visage tourné vers l'est. Pour le bas, on abaisse les mains, la pointe du loulav restant vers le haut.",
    en: "The species are held the way they grew, tip upwards. They are waved during the blessing, then in the Hallel, at the first “Hodu”, at “Ana Hashem hoshia na” and at the final “Hodu”: each time three times on each side, away and back towards the chest, in the order south, north, east, up, down, west, facing east. For down, the hands are lowered, the tip of the lulav still pointing up.",
    he: "נוטלם דרך גדילתן. ומנענע בשעת הברכה, ובהלל בהודו לה' הראשון, באנא ה' הושיעה נא, ובהודו לה' שבסוף: בכל פעם ג' פעמים לכל צד בהולכה והובאה אל החזה, כסדר דרום צפון מזרח מעלה מטה מערב, ופניו למזרח. ולמטה משפיל ידיו, וראש הלולב למעלה. (שו\"ע סי' תרנ\"א ס\"ה וס\"ט, וכה\"ח שם)",
  },
  {
    fr: "Les femmes sont dispensées du loulav, une mitsva liée au temps. Selon Maran, si elles le prennent, elles ne disent pas la bénédiction.",
    en: "Women are exempt from the lulav, a time-bound mitzvah. According to Maran, if they take it, they do not say the blessing.",
    he: 'נשים פטורות מלולב, שהיא מצות עשה שהזמן גרמא. ואם באו ליטול, לא יברכו. (שו"ע סי\' תקפ"ט ס"ו)',
  },
];
