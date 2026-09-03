/**
 * Le contenu de « Les zmanim expliqués » (/zmanim), dans les trois langues.
 *
 * Données pures : ce module n'importe rien de seoPages.ts, qui l'importe. Il
 * répond aux recherches que les pages d'horaires ne peuvent pas porter, parce
 * qu'elles portent des heures et non des définitions : « c'est quoi alot
 * hachahar », « à quelle heure finit le Chéma », « plag hamin'ha ».
 *
 * Chaque langue est écrite, pas traduite mot à mot : on cherche « sof zman
 * kriat shema » en anglais et « סוף זמן קריאת שמע » en hébreu, pas la
 * transposition du français.
 */

export type GuideLinks = {
  /** Le chemin des horaires, dans la langue de la page. */
  horaires: string;
  /** Le chemin du calendrier des fêtes, dans la langue de la page. */
  calendrier: string;
};

export type GuideStrings = {
  /** L'étiquette BCP-47, pour le `inLanguage` du JSON-LD. */
  lang: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  sections: { h2: string; html: string }[];
  faqHeading: string;
  faq: { q: string; a: string }[];
  breadcrumbHome: string;
  breadcrumbName: string;
  headline: string;
};

const ZMANIM_GUIDE_FR = (links: GuideLinks): GuideStrings => ({
  lang: "fr",
  title: "Les zmanim expliqués : alot, netz, fin du Chéma, chkia, tsét | Petite Jérusalem",
  description:
    "Ce que marque chaque zman : alot haCha'har, misheyakir, le netz, la fin du Chéma et de la Amida (Maguen Avraham et Gaon de Vilna), 'hatsot, min'ha, le plag, la chkia et le tsét haKokhavim.",
  h1: "Les zmanim expliqués : tous les horaires halakhiques de la journée",
  lead: `Alot haCha'har, misheyakir, le netz, la fin du Chéma et de la Amida, 'hatsot, min'ha
      guedola et ketana, le plag hamin'ha, la chkia, le tsét haKokhavim : ce que chacun de ces
      horaires marque, comment il se calcule, et où le trouver pour votre ville. Les heures du
      jour, elles, sont sur la page des <a href="${links.horaires}">horaires</a>.`,
  sections: [
    {
      h2: "Le jour halakhique et les heures zmaniot",
      html: `<p>Les zmanim ne suivent pas l'horloge mais le soleil. Le jour halakhique est divisé en
      douze parts égales, les <strong>heures zmaniot</strong> (cha'ot zmaniot) : longues l'été,
      courtes l'hiver. « La troisième heure du jour » ne tombe donc jamais à la même heure de la
      montre, et change d'une ville à l'autre.</p>
      <p>Deux écoles découpent ce jour différemment. Le <strong>Maguen Avraham</strong> le fait
      courir de l'aube à la tombée de la nuit ; le <strong>Gaon de Vilna</strong> du lever au
      coucher du soleil. Là où la pratique les distingue vraiment, la fin du Chéma et la fin de
      la Amida, les deux heures sont données côte à côte.</p>`,
    },
    {
      h2: "L'aube et le lever",
      html: `<p><strong>Alot haCha'har</strong> : l'aube, quand le soleil est à 16,1° sous l'horizon.
      Le jour halakhique commence là ; c'est aussi le début des jeûnes qui ne commencent pas la
      veille au soir.</p>
      <p><strong>Misheyakir</strong> : le soleil à 11,5° sous l'horizon, quand la lumière suffit
      à reconnaître un visage familier. C'est l'heure à partir de laquelle on met le talit et les
      téfilines.</p>
      <p><strong>Netz haHama</strong> : le lever du soleil. Dire la Amida de Cha'harit juste à
      cet instant est le meilleur usage (la prière des vatikin).</p>`,
    },
    {
      h2: "Les limites du matin",
      html: `<p><strong>Fin du Chéma</strong> : la fin de la troisième heure zmanit. Passé ce moment, on
      lit encore le Chéma, mais on n'accomplit plus l'obligation de sa lecture au temps voulu.</p>
      <p><strong>Fin de la Amida</strong> : la fin de la quatrième heure zmanit, dernière limite
      pour la prière du matin.</p>
      <p>Chacune de ces deux limites est donnée selon le Maguen Avraham (plus tôt) et selon le
      Gaon de Vilna.</p>`,
    },
    {
      h2: "L'après-midi",
      html: `<p><strong>'Hatsot</strong> : le milieu du jour, à mi-chemin exact du lever et du coucher
      du soleil.</p>
      <p><strong>Min'ha guedola</strong> : une demi-heure zmanit après 'hatsot, l'ouverture du
      temps de Min'ha.</p>
      <p><strong>Min'ha ketana</strong> : deux heures et demie zmaniot avant la fin du jour, le
      moment privilégié pour dire Min'ha.</p>
      <p><strong>Plag hamin'ha</strong> : une heure et quart zmanit avant la fin du jour. C'est
      la limite à partir de laquelle on peut, selon l'opinion qui le permet, dire Arvit et
      accueillir Chabbat par anticipation.</p>`,
    },
    {
      h2: "Le soir et la nuit",
      html: `<p><strong>Chkia</strong> : le coucher du soleil, la fin du jour.</p>
      <p><strong>Bein hachmachot</strong> : l'intervalle entre la chkia et la nuit, de statut
      douteux. C'est pour l'enjamber que Chabbat commence avant la chkia et ne se termine qu'à
      la nuit faite.</p>
      <p><strong>Tsét haKokhavim</strong> : la sortie des étoiles, le soleil à 8,5° sous
      l'horizon. C'est l'heure d'Arvit, la fin de Chabbat et des fêtes, la fin des jeûnes.</p>
      <p><strong>'Hatsot de la nuit</strong> : le milieu de la nuit, le moment des Sli'hot et du
      Tikoun 'Hatsot.</p>`,
    },
    {
      h2: "Chabbat et les fêtes",
      html: `<p>L'entrée de Chabbat est fixée <strong>18 minutes avant la chkia</strong> dans la plupart
      des communautés, et <strong>40 minutes à Jérusalem</strong>, où l'usage local est plus
      large. La sortie est au tsét haKokhavim, le moment de la havdala.</p>
      <p>Les heures de votre ville sont sur la page des <a href="${links.horaires}">horaires de
      Chabbat</a>, semaine par semaine et ville par ville, et les dates des fêtes sur le
      <a href="${links.calendrier}">calendrier des fêtes juives</a>.</p>`,
    },
    {
      h2: "Comment nous les calculons",
      html: `<p>Par la position du soleil à vos coordonnées, au niveau de la mer. Le calcul se fait
      entièrement <strong>sur votre appareil</strong> : il fonctionne sans connexion, et votre
      position ne part nulle part. Pour la pratique, suivez les horaires de votre communauté :
      les usages locaux priment sur un calcul astronomique.</p>`,
    },
  ],
  faqHeading: "Questions fréquentes sur les zmanim",
  faq: [
    {
      q: "Qu'est-ce que les zmanim ?",
      a: "Les zmanim sont les heures de la journée qui commandent la pratique : l'aube, le lever du soleil, la limite pour dire le Chéma et la Amida, le milieu du jour, les moments de Min'ha, le coucher du soleil et la sortie des étoiles. Ils suivent le soleil, pas l'horloge : ils changent chaque jour et d'un lieu à l'autre.",
    },
    {
      q: "Qu'est-ce qu'une heure zmanit (cha'a zmanit) ?",
      a: "Le jour halakhique est divisé en douze parts égales, quelle que soit sa longueur : ces douzièmes sont les heures zmaniot. En été une heure zmanit dépasse soixante minutes, en hiver elle est plus courte. C'est pourquoi « la troisième heure du jour » ne tombe jamais à la même heure de la montre.",
    },
    {
      q: "A quelle heure faut-il dire le Chéma du matin ?",
      a: "Le Chéma se dit jusqu'à la fin de la troisième heure zmanit de la journée. Deux opinions donnent deux limites : le Maguen Avraham, qui compte le jour de l'aube à la nuit, et le Gaon de Vilna, qui le compte du lever au coucher du soleil. L'écart atteint facilement une demi-heure ; les deux heures sont affichées côte à côte.",
    },
    {
      q: "Quelle différence entre le Maguen Avraham et le Gaon de Vilna ?",
      a: "Les deux découpent le jour en douze heures égales, mais pas le même jour : le Maguen Avraham le fait courir de l'aube (72 minutes avant le lever du soleil) à la tombée de la nuit, le Gaon de Vilna du lever au coucher du soleil. Le jour du Maguen Avraham est donc plus long, et ses limites du matin tombent plus tôt.",
    },
    {
      q: "Qu'est-ce que le plag hamin'ha ?",
      a: "Le plag hamin'ha est le milieu de la dernière portion de l'après-midi, une heure et quart zmanit avant la fin du jour. C'est la limite à partir de laquelle on peut, selon l'opinion qui le permet, dire Arvit et accueillir Chabbat par anticipation.",
    },
    {
      q: "A partir de quand peut-on dire Min'ha ?",
      a: "Min'ha guedola ouvre le temps de Min'ha, une demi-heure zmanit après le milieu du jour ('hatsot). Min'ha ketana, deux heures et demie zmaniot avant la nuit, est le moment privilégié pour la dire.",
    },
    {
      q: "Quelle différence entre la chkia et le tsét haKokhavim ?",
      a: "La chkia est le coucher du soleil, le tsét haKokhavim la sortie des étoiles, quand la nuit est faite. Entre les deux se place le bein hachmachot, un intervalle de statut douteux : c'est pourquoi Chabbat commence avant la chkia et ne se termine qu'au tsét.",
    },
    {
      q: "Qu'est-ce qu'alot haCha'har et misheyakir ?",
      a: "Alot haCha'har est l'aube, le premier jour dans le ciel : le jour halakhique commence là. Misheyakir vient ensuite, quand la lumière suffit à reconnaître un visage familier : c'est l'heure à partir de laquelle on met le talit et les téfilines.",
    },
    {
      q: "A quelle heure allume-t-on les bougies de Chabbat ?",
      a: "Dix-huit minutes avant le coucher du soleil dans la plupart des communautés, quarante minutes à Jérusalem. Chabbat se termine à la sortie des étoiles, le moment de la havdala. Les heures de votre ville sont sur la page des horaires.",
    },
    {
      q: "Comment ces horaires sont-ils calculés ?",
      a: "Par la position du soleil à vos coordonnées, au niveau de la mer : l'aube et la sortie des étoiles par la hauteur du soleil sous l'horizon (16,1° pour alot, 11,5° pour misheyakir, 8,5° pour le tsét), les limites du matin et de l'après-midi en heures zmaniot. Tout le calcul se fait sur votre appareil, sans connexion, et votre position ne part nulle part. Pour la pratique, suivez les horaires de votre communauté.",
    },
  ],
  breadcrumbHome: "Accueil",
  breadcrumbName: "Les zmanim expliqués",
  headline: "Les zmanim expliqués : tous les horaires halakhiques de la journée",
});

const ZMANIM_GUIDE_EN = (links: GuideLinks): GuideStrings => ({
  lang: "en",
  title: "Zmanim explained: alot, sunrise, sof zman Shema, shkia, tzeit | Petite Jérusalem",
  description:
    "What each zman marks: alot hashachar, misheyakir, sunrise, sof zman Shema and Tefillah (Magen Avraham and the Vilna Gaon), chatzot, mincha, plag, shkia and tzeit hakochavim.",
  h1: "Zmanim explained: every halachic time of the day",
  lead: `Alot hashachar, misheyakir, sunrise, sof zman Shema and Tefillah, chatzot, mincha gedola
      and ketana, plag hamincha, shkia, tzeit hakochavim: what each of these times marks, how it
      is worked out, and where to find it for your city. For today's actual times, see the
      <a href="${links.horaires}">Shabbat times page</a>.`,
  sections: [
    {
      h2: "The halachic day and seasonal hours",
      html: `<p>Zmanim follow the sun, not the clock. The halachic day is divided into twelve equal
      parts, the <strong>seasonal hours</strong> (sha'ot zmaniyot): long in summer, short in
      winter. "The third hour of the day" therefore never falls at the same clock time, and it
      differs from one city to the next.</p>
      <p>Two schools divide that day differently. The <strong>Magen Avraham</strong> runs it from
      dawn to nightfall; the <strong>Vilna Gaon</strong> from sunrise to sunset. Where practice
      really tells them apart, sof zman Shema and sof zman Tefillah, both times are given side by
      side.</p>`,
    },
    {
      h2: "Dawn and sunrise",
      html: `<p><strong>Alot hashachar</strong>: dawn, when the sun is 16.1° below the horizon. The
      halachic day begins here; it is also when the minor fasts begin.</p>
      <p><strong>Misheyakir</strong>: the sun 11.5° below the horizon, when there is enough light
      to recognise a familiar face. This is the earliest time for tallit and tefillin.</p>
      <p><strong>Netz hachama</strong>: sunrise. Saying the Amidah of Shacharit exactly then is
      the preferred practice (the vatikin minyan).</p>`,
    },
    {
      h2: "The morning deadlines",
      html: `<p><strong>Sof zman Shema</strong>: the end of the third seasonal hour. After it one still
      reads the Shema, but no longer fulfils the obligation to read it in its time.</p>
      <p><strong>Sof zman Tefillah</strong>: the end of the fourth seasonal hour, the last time
      for the morning Amidah.</p>
      <p>Each of these two deadlines is given according to the Magen Avraham (earlier) and
      according to the Vilna Gaon.</p>`,
    },
    {
      h2: "The afternoon",
      html: `<p><strong>Chatzot</strong>: midday, exactly halfway between sunrise and sunset.</p>
      <p><strong>Mincha gedola</strong>: half a seasonal hour after chatzot, when the time for
      Mincha opens.</p>
      <p><strong>Mincha ketana</strong>: two and a half seasonal hours before the end of the day,
      the preferred time to daven Mincha.</p>
      <p><strong>Plag hamincha</strong>: an hour and a quarter (seasonal) before the end of the
      day. From then on one may, according to the opinion that allows it, say Maariv and accept
      Shabbat early.</p>`,
    },
    {
      h2: "Evening and night",
      html: `<p><strong>Shkia</strong>: sunset, the end of the day.</p>
      <p><strong>Bein hashmashot</strong>: the interval between shkia and nightfall, of doubtful
      status. It is to clear it that Shabbat starts before shkia and only ends once night has
      fallen.</p>
      <p><strong>Tzeit hakochavim</strong>: nightfall, the sun 8.5° below the horizon. This is
      the time for Maariv, the end of Shabbat and festivals, and the end of fasts.</p>
      <p><strong>Chatzot halayla</strong>: midnight in the halachic sense, the time for Selichot
      and Tikkun Chatzot.</p>`,
    },
    {
      h2: "Shabbat and festivals",
      html: `<p>Shabbat is brought in <strong>18 minutes before shkia</strong> in most communities, and
      <strong>40 minutes in Jerusalem</strong>, where the local custom is wider. It ends at tzeit
      hakochavim, the time for havdalah.</p>
      <p>The times for your own city are on the <a href="${links.horaires}">Shabbat times
      page</a>, week by week and city by city, and the festival dates on the
      <a href="${links.calendrier}">Jewish holiday calendar</a>.</p>`,
    },
    {
      h2: "How we compute them",
      html: `<p>From the position of the sun at your coordinates, at sea level. The whole computation
      runs <strong>on your device</strong>: it works with no connection, and your location goes
      nowhere. For practice, follow your community's published times: local custom comes before
      an astronomical calculation.</p>`,
    },
  ],
  faqHeading: "Frequently asked questions about zmanim",
  faq: [
    {
      q: "What are zmanim?",
      a: "Zmanim are the times of day that govern practice: dawn, sunrise, the deadlines for the Shema and the Amidah, midday, the times for Mincha, sunset and nightfall. They follow the sun rather than the clock, so they change every day and from one place to another.",
    },
    {
      q: "What is a seasonal hour (sha'a zmanit)?",
      a: "The halachic day is divided into twelve equal parts, however long it happens to be: those twelfths are the seasonal hours. In summer a seasonal hour runs over sixty minutes, in winter it is shorter. That is why “the third hour of the day” never falls at the same clock time.",
    },
    {
      q: "What is the latest time to say the morning Shema?",
      a: "The Shema is said until the end of the third seasonal hour of the day. Two opinions give two deadlines: the Magen Avraham, who counts the day from dawn to nightfall, and the Vilna Gaon, who counts it from sunrise to sunset. The gap easily reaches half an hour; both times are shown side by side.",
    },
    {
      q: "What is the difference between the Magen Avraham and the Vilna Gaon?",
      a: "Both divide the day into twelve equal hours, but not the same day: the Magen Avraham runs it from dawn (72 minutes before sunrise) to nightfall, the Vilna Gaon from sunrise to sunset. The Magen Avraham's day is therefore longer, and his morning deadlines fall earlier.",
    },
    {
      q: "What is plag hamincha?",
      a: "Plag hamincha is the midpoint of the last stretch of the afternoon, an hour and a quarter (seasonal) before the end of the day. From then on one may, according to the opinion that allows it, say Maariv and accept Shabbat early.",
    },
    {
      q: "From when may Mincha be said?",
      a: "Mincha gedola opens the time for Mincha, half a seasonal hour after midday (chatzot). Mincha ketana, two and a half seasonal hours before nightfall, is the preferred time to say it.",
    },
    {
      q: "What is the difference between shkia and tzeit hakochavim?",
      a: "Shkia is sunset, tzeit hakochavim is nightfall, when three stars are out. Between the two lies bein hashmashot, an interval of doubtful status: that is why Shabbat begins before shkia and only ends at tzeit.",
    },
    {
      q: "What are alot hashachar and misheyakir?",
      a: "Alot hashachar is dawn, the first light in the sky: the halachic day begins there. Misheyakir comes next, when there is enough light to recognise a familiar face: it is the earliest time to put on tallit and tefillin.",
    },
    {
      q: "What time are Shabbat candles lit?",
      a: "Eighteen minutes before sunset in most communities, forty minutes in Jerusalem. Shabbat ends at nightfall, the time for havdalah. The times for your city are on the Shabbat times page.",
    },
    {
      q: "How are these times calculated?",
      a: "From the position of the sun at your coordinates, at sea level: dawn and nightfall from the sun's depression below the horizon (16.1° for alot, 11.5° for misheyakir, 8.5° for tzeit), the morning and afternoon deadlines in seasonal hours. The whole computation runs on your device, offline, and your location goes nowhere. For practice, follow your community's published times.",
    },
  ],
  breadcrumbHome: "Home",
  breadcrumbName: "Zmanim explained",
  headline: "Zmanim explained: every halachic time of the day",
});

const ZMANIM_GUIDE_HE = (links: GuideLinks): GuideStrings => ({
  lang: "he",
  title: "זמני היום ההלכתיים: עלות, נץ, סוף זמן שמע, שקיעה, צאת הכוכבים | פטיט ירושלים",
  description:
    "מה מציין כל זמן: עלות השחר, משיכיר, הנץ, סוף זמן קריאת שמע ותפילה (מגן אברהם והגר״א), חצות, מנחה גדולה וקטנה, פלג המנחה, השקיעה וצאת הכוכבים.",
  h1: "זמני היום ההלכתיים, מוסברים",
  lead: `עלות השחר, משיכיר, הנץ, סוף זמן קריאת שמע ותפילה, חצות, מנחה גדולה וקטנה, פלג המנחה,
      השקיעה וצאת הכוכבים: מה כל זמן מציין, כיצד הוא מחושב, והיכן למצוא אותו לעיר שלך. הזמנים
      של היום עצמם נמצאים בעמוד <a href="${links.horaires}">זמני שבת</a>.`,
  sections: [
    {
      h2: "היום ההלכתי והשעות הזמניות",
      html: `<p>הזמנים הולכים אחרי השמש ולא אחרי השעון. היום ההלכתי מחולק לשנים עשר חלקים שווים,
      <strong>שעות זמניות</strong>: ארוכות בקיץ, קצרות בחורף. לכן ״השעה השלישית של היום״ אינה
      נופלת לעולם באותה שעת שעון, והיא משתנה מעיר לעיר.</p>
      <p>שתי שיטות מחלקות את היום אחרת. <strong>המגן אברהם</strong> מונה אותו מעלות השחר ועד צאת
      הכוכבים; <strong>הגר״א</strong> מהנץ ועד השקיעה. במקום שבו ההבדל נוגע למעשה, סוף זמן קריאת
      שמע וסוף זמן תפילה, שני הזמנים מוצגים זה לצד זה.</p>`,
    },
    {
      h2: "עלות השחר והנץ",
      html: `<p><strong>עלות השחר</strong>: כאשר השמש נמצאת 16.1 מעלות מתחת לאופק. כאן מתחיל היום
      ההלכתי, וכאן מתחילים גם הצומות הקצרים.</p>
      <p><strong>משיכיר</strong>: השמש 11.5 מעלות מתחת לאופק, כאשר האור מספיק כדי להכיר פנים
      מוכרות. זהו הזמן המוקדם ביותר לטלית ותפילין.</p>
      <p><strong>נץ החמה</strong>: זריחת השמש. תפילת העמידה של שחרית בדיוק בזמן זה היא המנהג
      המהודר, תפילת ותיקין.</p>`,
    },
    {
      h2: "זמני הבוקר",
      html: `<p><strong>סוף זמן קריאת שמע</strong>: סוף השעה הזמנית השלישית. לאחר מכן עדיין קוראים
      את שמע, אך אין יוצאים ידי חובת קריאתה בזמנה.</p>
      <p><strong>סוף זמן תפילה</strong>: סוף השעה הזמנית הרביעית, הזמן האחרון לתפילת שחרית.</p>
      <p>כל אחד משני הזמנים הללו ניתן לפי המגן אברהם (המוקדם יותר) ולפי הגר״א.</p>`,
    },
    {
      h2: "אחר הצהריים",
      html: `<p><strong>חצות</strong>: אמצע היום, בדיוק במחצית הדרך שבין הנץ לשקיעה.</p>
      <p><strong>מנחה גדולה</strong>: חצי שעה זמנית אחרי חצות, שעה שבה נפתח זמן מנחה.</p>
      <p><strong>מנחה קטנה</strong>: שעתיים וחצי זמניות לפני סוף היום, הזמן המועדף לתפילת
      מנחה.</p>
      <p><strong>פלג המנחה</strong>: שעה ורבע זמנית לפני סוף היום. ממנו ואילך אפשר, לדעה
      המתירה, להתפלל ערבית ולקבל שבת מבעוד יום.</p>`,
    },
    {
      h2: "ערב ולילה",
      html: `<p><strong>שקיעה</strong>: שקיעת השמש, סוף היום.</p>
      <p><strong>בין השמשות</strong>: הזמן שבין השקיעה לצאת הכוכבים, שספק יום ספק לילה. משום כך
      השבת נכנסת לפני השקיעה ואינה יוצאת אלא משחשכה.</p>
      <p><strong>צאת הכוכבים</strong>: השמש 8.5 מעלות מתחת לאופק. זהו זמן ערבית, צאת השבת והחג,
      וסוף הצומות.</p>
      <p><strong>חצות הלילה</strong>: אמצע הלילה, זמן הסליחות ותיקון חצות.</p>`,
    },
    {
      h2: "שבת וחגים",
      html: `<p>כניסת השבת נקבעת <strong>18 דקות לפני השקיעה</strong> ברוב הקהילות, ו<strong>40 דקות
      בירושלים</strong>, שם המנהג מוקדם יותר. היציאה היא בצאת הכוכבים, זמן ההבדלה.</p>
      <p>הזמנים של העיר שלך נמצאים בעמוד <a href="${links.horaires}">זמני שבת</a>, שבוע אחר שבוע
      ועיר אחר עיר, ותאריכי החגים ב<a href="${links.calendrier}">לוח החגים</a>.</p>`,
    },
    {
      h2: "כיצד אנחנו מחשבים אותם",
      html: `<p>לפי מיקום השמש בנקודות הציון שלך, בגובה פני הים. כל החישוב נעשה
      <strong>במכשיר שלך</strong>: הוא פועל גם ללא חיבור לאינטרנט, והמיקום שלך אינו נשלח לשום
      מקום. למעשה, לכו אחרי הזמנים של הקהילה שלכם: המנהג המקומי קודם לחישוב אסטרונומי.</p>`,
    },
  ],
  faqHeading: "שאלות נפוצות על זמני היום",
  faq: [
    {
      q: "מה הם זמני היום ההלכתיים?",
      a: "הזמנים הם שעות היום שקובעות את המעשה: עלות השחר, הנץ, סוף זמן קריאת שמע ותפילה, חצות, זמני מנחה, השקיעה וצאת הכוכבים. הם הולכים אחרי השמש ולא אחרי השעון, ולכן משתנים מיום ליום וממקום למקום.",
    },
    {
      q: "מהי שעה זמנית?",
      a: "היום ההלכתי מחולק לשנים עשר חלקים שווים, יהיה אורכו אשר יהיה, והחלקים הללו הם השעות הזמניות. בקיץ שעה זמנית ארוכה משישים דקות, ובחורף היא קצרה יותר. לכן ״השעה השלישית של היום״ אינה נופלת באותה שעת שעון.",
    },
    {
      q: "עד מתי אפשר לקרוא קריאת שמע של שחרית?",
      a: "קריאת שמע נאמרת עד סוף השעה הזמנית השלישית. שתי דעות נותנות שני זמנים: המגן אברהם, המונה את היום מעלות השחר עד צאת הכוכבים, והגר״א, המונה אותו מהנץ עד השקיעה. הפער מגיע בקלות לחצי שעה, ושני הזמנים מוצגים זה לצד זה.",
    },
    {
      q: "מה ההבדל בין המגן אברהם לגר״א?",
      a: "שניהם מחלקים את היום לשתים עשרה שעות שוות, אך לא את אותו היום: המגן אברהם מונה אותו מעלות השחר (72 דקות לפני הנץ) עד צאת הכוכבים, והגר״א מהנץ עד השקיעה. היום של המגן אברהם ארוך יותר, ולכן זמני הבוקר שלו מוקדמים יותר.",
    },
    {
      q: "מהו פלג המנחה?",
      a: "פלג המנחה הוא אמצע החלק האחרון של אחר הצהריים, שעה ורבע זמנית לפני סוף היום. ממנו ואילך אפשר, לדעה המתירה, להתפלל ערבית ולקבל שבת מבעוד יום.",
    },
    {
      q: "ממתי אפשר להתפלל מנחה?",
      a: "מנחה גדולה פותחת את זמן מנחה, חצי שעה זמנית אחרי חצות היום. מנחה קטנה, שעתיים וחצי זמניות לפני צאת הכוכבים, היא הזמן המועדף.",
    },
    {
      q: "מה ההבדל בין שקיעה לצאת הכוכבים?",
      a: "השקיעה היא שקיעת השמש, וצאת הכוכבים היא חשכת הלילה. ביניהן נמצא בין השמשות, שספק יום ספק לילה: משום כך השבת נכנסת לפני השקיעה ואינה יוצאת אלא בצאת הכוכבים.",
    },
    {
      q: "מהם עלות השחר ומשיכיר?",
      a: "עלות השחר הוא האור הראשון ברקיע, ובו מתחיל היום ההלכתי. משיכיר בא אחריו, כאשר האור מספיק כדי להכיר פנים מוכרות: זהו הזמן המוקדם ביותר לטלית ותפילין.",
    },
    {
      q: "באיזו שעה מדליקים נרות שבת?",
      a: "שמונה עשרה דקות לפני השקיעה ברוב הקהילות, וארבעים דקות בירושלים. השבת יוצאת בצאת הכוכבים, זמן ההבדלה. הזמנים של העיר שלך נמצאים בעמוד זמני שבת.",
    },
    {
      q: "כיצד מחושבים הזמנים הללו?",
      a: "לפי מיקום השמש בנקודות הציון שלך, בגובה פני הים: עלות השחר וצאת הכוכבים לפי מעלות השמש מתחת לאופק (16.1 לעלות, 11.5 למשיכיר, 8.5 לצאת), וזמני הבוקר ואחר הצהריים בשעות זמניות. כל החישוב נעשה במכשיר שלך, גם ללא חיבור לאינטרנט, והמיקום שלך אינו נשלח לשום מקום. למעשה, לכו אחרי הזמנים של הקהילה שלכם.",
    },
  ],
  breadcrumbHome: "דף הבית",
  breadcrumbName: "זמני היום ההלכתיים",
  headline: "זמני היום ההלכתיים, מוסברים",
});

/** Le guide, langue par langue : la fonction reçoit les liens de sa langue. */
export const ZMANIM_GUIDE: Record<string, (links: GuideLinks) => GuideStrings> = {
  fr: ZMANIM_GUIDE_FR,
  en: ZMANIM_GUIDE_EN,
  he: ZMANIM_GUIDE_HE,
};
