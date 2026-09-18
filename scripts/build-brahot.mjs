/**
 * Construit les bénédictions et les rites qui les entourent (public/texts/tefila/*)
 * à partir du Siddur Edot HaMizrach de l'export public Sefaria, comme
 * build-sidour.mjs le fait des trois offices de semaine.
 *
 * Lancer avec : node scripts/build-brahot.mjs
 *
 * Ce sont les textes qu'on cherche quand on n'est pas à l'office : le Chema du
 * coucher, la havdala, la prière du voyageur, les bénédictions sur ce dont on
 * jouit, l'allumage de Hanouka, le prélèvement de la halla et des maasrot, la
 * bénédiction des arbres, la brit mila, la hachkava, le tikoun hatsot.
 *
 * La recette reste explicite, segment par segment : la source alterne des
 * consignes en hébreu et le texte lui-même, et chaque consigne retenue devient
 * une didascalie dans les trois langues (son hébreu vient de la source, le
 * français et l'anglais sont écrits ici). Le moteur qui les lit vit dans
 * scripts/lib/tefila-recipe.mjs, partagé avec build-moadim.mjs.
 *
 * Licence des textes : l'export Sefaria « merged » combine des sources du
 * domaine public.
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchSiddur } from "./lib/sefaria-siddur.mjs";
import { writeRecipes } from "./lib/tefila-recipe.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/texts/tefila");

// ---------- Les recettes ----------

/** Le Chema du coucher : segments de « Bedtime Shema ». */
const chemaAlHamita = {
  file: "chema-al-hamita",
  title: "קריאת שמע שעל המיטה (Chema al Hamita)",
  src: (t) => t["Bedtime Shema"],
  blocks: [
    {
      halakha: {
        fr: "Le Chema du coucher est l'une des quatre lectures du Chema de la journée : on le dit avec attention.",
        en: "The bedtime Shema is one of the four daily readings of the Shema: say it attentively.",
      },
      halakhaSeg: 7,
      lines: [{ seg: 2 }],
    },
    {
      lines: [
        {
          seg: 4,
          rubric: {
            fr: "Avant la bénédiction Hamapil, on pardonne à qui nous a fait du tort :",
            en: "Before the Hamapil blessing, forgive whoever wronged you:",
          },
          rubricSeg: 3,
        },
      ],
    },
    {
      halakha: {
        fr: "Le Nom et la royauté de cette bénédiction se pensent, ils ne se prononcent pas.",
        en: "In this blessing the Name and kingship are thought, not spoken.",
      },
      halakhaSeg: 5,
      lines: [{ seg: 6 }],
    },
    {
      label: "Chema Israël",
      lines: [
        { seg: 8 },
        { seg: 9, muted: true },
        { seg: 10 },
        { seg: 11 },
        { seg: 12 },
        {
          seg: 13,
          from: "יְהֹוָה אֱלֹהֵיכֶם",
          rubric: {
            fr: "On reprend les trois derniers mots :",
            en: "The last three words are repeated:",
            he: "וחוזר ואומר",
          },
        },
      ],
    },
    { lines: [{ seg: 14 }, { seg: 15 }, { seg: 16 }, { seg: 17 }] },
    {
      label: "Vidouy",
      halakha: {
        fr: "Debout, la tête inclinée. Il ne se dit pas les soirs où l'on ne dit pas tahanoun.",
        en: "Standing, head bowed. It is not said on evenings when tahanun is omitted.",
      },
      halakhaSeg: 18,
      lines: [{ seg: 19 }],
    },
    {
      label: "Ana bekhoah",
      halakha: {
        fr: "On le dit en entier chaque nuit, puis on répète trois fois le verset de la nuit.",
        en: "Say it in full each night, then repeat the verse of that night three times.",
      },
      halakhaSeg: 20,
      lines: [
        { seg: 21, rubric: { fr: "1re nuit :", en: "1st night:", he: "ליל א" } },
        { seg: 22, rubric: { fr: "2e nuit :", en: "2nd night:", he: "ליל ב" } },
        { seg: 23, rubric: { fr: "3e nuit :", en: "3rd night:", he: "ליל ג" } },
        { seg: 24, rubric: { fr: "4e nuit :", en: "4th night:", he: "ליל ד" } },
        { seg: 25, rubric: { fr: "5e nuit :", en: "5th night:", he: "ליל ה" } },
        { seg: 26, rubric: { fr: "6e nuit :", en: "6th night:", he: "ליל ו" } },
        {
          seg: 27,
          rubric: { fr: "Nuit de Chabbat :", en: "Shabbat night:", he: "ליל שבת" },
        },
        { seg: 28, muted: true },
      ],
    },
    { lines: [{ seg: 29 }] },
  ],
};

/** La havdala, sur la coupe : segments de « Havdalah / Havdala ». */
const havdala = {
  file: "havdala",
  title: "הבדלה (Havdala)",
  src: (t) => t["Havdalah"]["Havdala"],
  blocks: [
    { lines: [{ seg: 1 }, { seg: 2 }] },
    {
      lines: [
        {
          seg: 4,
          rubric: {
            fr: "La coupe dans la main droite, les parfums dans la gauche :",
            en: "Cup in the right hand, spices in the left:",
          },
          rubricSeg: 3,
        },
        { seg: 5 },
        { seg: 6 },
        { seg: 7 },
      ],
    },
    {
      label: "Les bénédictions",
      halakha: {
        fr: "À la sortie d'un Yom Tov qui n'est pas une sortie de Chabbat, on ne dit ni les parfums ni la flamme.",
        en: "At the close of a festival that is not the close of Shabbat, the spices and the flame are omitted.",
      },
      halakhaSeg: 10,
      lines: [
        { seg: 8 },
        { seg: 9 },
        { seg: 11 },
        {
          seg: 13,
          rubric: {
            fr: "On replie les doigts de la main droite vers la paume, face à la flamme :",
            en: "Curl the fingers of the right hand toward the palm, facing the flame:",
            he: "כשיברך על הנר, יכוף ראשי אצבעותיו הימנים אל תוך כפו",
          },
        },
        { seg: 14 },
      ],
    },
    {
      label: "Après avoir bu",
      lines: [
        {
          seg: 16,
          rubric: {
            fr: "On boit un révi'it, puis on dit la bénédiction d'après :",
            en: "Drink a revi'it, then say the blessing after it:",
          },
          rubricSeg: 15,
        },
        { seg: 20 },
      ],
    },
  ],
};

/** La prière du voyageur : segments de « Traveler's Prayer ». */
const tefilatHaderekh = {
  file: "tefilat-haderekh",
  title: "תפלת הדרך (Tefilat Haderekh)",
  src: (t) => t["Assorted Blessings and Prayers"]["Traveler's Prayer"],
  blocks: [
    {
      halakha: {
        fr: "Elle se dit une fois sorti de la ville, pour un trajet d'au moins une parsa (72 minutes) hors de la ville.",
        en: "Say it once out of town, for a journey of at least a parsa (72 minutes) outside the city.",
      },
      halakhaSeg: 1,
      lines: [{ seg: 2 }],
    },
    {
      label: "Versets de protection",
      lines: [
        {
          seg: 4,
          rubric: { fr: "Certains ajoutent ces versets :", en: "Some add these verses:" },
          rubricSeg: 3,
        },
        { seg: 5 },
        { seg: 6 },
        { seg: 7 },
        { seg: 8 },
      ],
    },
  ],
};

/** Les bénédictions sur ce dont on jouit : segments de « Blessings on Enjoyments ». */
const birkotHanehenin = {
  file: "birkot-hanehenin",
  title: "ברכות הנהנין (Birkot Hanehenin)",
  src: (t) => t["Blessings on Enjoyments"],
  blocks: [
    {
      label: "Avant de manger",
      variants: true,
      lines: [
        {
          seg: 2,
          rubric: {
            fr: "Sur un plat ou une pâtisserie des cinq céréales (le pain excepté), et sur le riz :",
            en: "On a dish or pastry of the five grains (bread excepted), and on rice:",
          },
          rubricSeg: 1,
        },
        { seg: 4, rubric: { fr: "Sur le vin :", en: "On wine:" }, rubricSeg: 3 },
        {
          seg: 6,
          rubric: { fr: "Sur les fruits de l'arbre :", en: "On fruit of the tree:" },
          rubricSeg: 5,
        },
        {
          seg: 8,
          rubric: { fr: "Sur les fruits de la terre :", en: "On fruit of the ground:" },
          rubricSeg: 7,
        },
        {
          seg: 10,
          rubric: {
            fr: "Sur ce qui ne pousse pas de la terre (viande, poisson, laitage) et sur les boissons autres que le vin :",
            en: "On what does not grow from the ground (meat, fish, dairy) and on drinks other than wine:",
          },
          rubricSeg: 9,
        },
      ],
    },
    {
      label: "Après avoir mangé",
      halakha: {
        fr: "Après un kazayit de fruits de l'arbre (hors des sept espèces), de fruits de la terre ou de ce qui ne pousse pas de la terre, ou un révi'it bu d'un trait.",
        en: "After a kazayit of fruit of the tree (outside the seven species), fruit of the ground, or what does not grow from the ground, or a revi'it drunk at once.",
      },
      halakhaSeg: 11,
      lines: [{ seg: 12 }],
    },
    {
      label: "Sur les parfums",
      variants: true,
      lines: [
        {
          seg: 14,
          rubric: { fr: "Sur le parfum d'un arbre :", en: "On the fragrance of a tree:" },
          rubricSeg: 13,
        },
        {
          seg: 16,
          rubric: { fr: "Sur le parfum d'une herbe :", en: "On the fragrance of a herb:" },
          rubricSeg: 15,
        },
        {
          seg: 18,
          rubric: {
            fr: "Sur un parfum qui n'est ni arbre ni herbe, ou dont on doute :",
            en: "On a fragrance that is neither tree nor herb, or when in doubt:",
          },
          rubricSeg: 17,
        },
      ],
    },
    {
      label: "Chéhéhéyanou",
      halakha: {
        fr: "Sur un vêtement qui réjouit, et sur un fruit nouveau de l'année qui se distingue de l'ancien.",
        en: "On a garment that gladdens, and on a new fruit of the year that is distinguishable from last year's.",
      },
      halakhaSeg: 19,
      lines: [{ seg: 20 }],
    },
  ],
};

/** Acher yatsar et ce qui l'entoure : segments de « Morning Blessings ». */
const acherYatsar = {
  file: "acher-yatsar",
  title: "אשר יצר (Acher Yatsar)",
  src: (t) => t["Preparatory Prayers"]["Morning Blessings"],
  blocks: [
    {
      label: "Sur le lavage des mains",
      lines: [{ seg: 2 }],
    },
    {
      halakha: {
        fr: "Après être allé aux toilettes, dans la demi-heure qui suit.",
        en: "After relieving oneself, within the following half hour.",
      },
      halakhaSeg: 3,
      lines: [{ seg: 4 }],
    },
    {
      label: "Elohaï nechama",
      halakha: {
        fr: "Elle suit Acher yatsar sans qu'on parle entre les deux.",
        en: "It follows Asher yatzar with no talking in between.",
      },
      halakhaSeg: 5,
      lines: [{ seg: 6 }],
    },
  ],
};

/** L'allumage de Hanouka : segments de « Hanukkah / Menorah Lighting ». */
const nerotHanouka = {
  file: "nerot-hanouka",
  title: "נרות חנוכה (Nerot Hanouka)",
  src: (t) => t["Hanukkah"]["Menorah Lighting"],
  blocks: [
    { lines: [{ seg: 2 }] },
    {
      label: "Les bénédictions",
      lines: [
        { seg: 3 },
        { seg: 4 },
        {
          seg: 6,
          rubric: { fr: "Le premier soir, on ajoute :", en: "On the first night, add:" },
          rubricSeg: 5,
        },
      ],
    },
    {
      lines: [
        {
          seg: 8,
          rubric: {
            fr: "Une fois la première bougie allumée :",
            en: "Once the first light is kindled:",
          },
          rubricSeg: 7,
        },
        { seg: 9 },
      ],
    },
    {
      halakha: {
        fr: "Chaque soir après l'allumage, on dit Vihi noam, puis le psaume Yochev besseter sept fois.",
        en: "Each night after kindling, say Vihi noam, then the psalm Yoshev beseter seven times.",
      },
      halakhaSeg: 10,
      lines: [{ seg: 11 }, { seg: 12, strip: ["(תהילים צ״א:א׳-ב׳)"], repeat: 7 }],
    },
    {
      label: "Maoz tsour",
      lines: [
        { seg: 15, lead: true },
        { seg: 16 },
        { seg: 17 },
        { seg: 18 },
        { seg: 19 },
        { seg: 20 },
      ],
    },
  ],
};

/** Le prélèvement de la halla : segments de « Separating Hallah ». */
const hafrashatHalla = {
  file: "hafrashat-halla",
  title: "הפרשת חלה (Hafrashat Halla)",
  src: (t) => t["Assorted Blessings and Prayers"]["Separating Hallah"],
  blocks: [
    {
      halakha: {
        fr: "On prélève avec bénédiction à partir de 1 566,5 g de farine.",
        en: "Separate with a blessing from 1,566.5 g of flour.",
      },
      halakhaSeg: 4,
      lines: [
        {
          seg: 7,
          rubric: { fr: "Avant de prélever, on dit :", en: "Before separating, say:" },
          rubricSeg: 6,
        },
      ],
    },
    {
      halakha: {
        fr: "La part prélevée se brûle ; on ne la jette pas avant de l'avoir brûlée.",
        en: "What is separated is burned; it is not thrown away before being burned.",
      },
      halakhaSeg: 2,
      lines: [
        {
          seg: 9,
          rubric: {
            fr: "Puis on prend un morceau de pâte, si petit soit-il :",
            en: "Then take a piece of dough, however small:",
          },
          rubricSeg: 8,
        },
      ],
    },
  ],
};

/** Teroumot et maasrot : segments de « Separating Tithes ». */
/** Les consignes que la source glisse dans les formules de prélèvement. */
const MINIM = [
  "אם מעשר כמה מינים יחד יאמר: כָּל־מִין עַל מִינוֹ",
  "ביותר ממין אחד יאמר: כָּל־מִין עַל מִינוֹ",
];

const teroumotOumaasrot = {
  file: "teroumot-oumaasrot",
  title: "תרומות ומעשרות (Teroumot ouMaasrot)",
  src: (t) => t["Assorted Blessings and Prayers"]["Separating Tithes"],
  blocks: [
    {
      label: "Tevel douteux",
      halakha: {
        fr: "Tout ce qui pousse en terre d'Israël chez un juif est soumis aux teroumot et maasrot ; ce dont on ignore s'il a été prélevé se prélève sans bénédiction. Quand le prélèvement porte sur plusieurs espèces à la fois, chaque formule reçoit כָּל־מִין עַל מִינוֹ.",
        en: "Whatever grows in the Land of Israel on Jewish-owned land is subject to terumot and maasrot; produce of unknown status is separated without a blessing. When several species are separated at once, each formula takes כָּל־מִין עַל מִינוֹ.",
        he: "כל גידולי קרקע הגדלים בארץ ישראל בבעלות יהודי חייבים בתרומות ומעשרות, וספק טבל מפרישים בלי ברכה. ביותר ממין אחד יאמר בכל נוסח: כָּל־מִין עַל מִינוֹ",
      },
      lines: [
        {
          seg: 4,
          strip: MINIM,
          rubric: {
            fr: "On sépare un peu plus d'un centième des fruits et l'on dit :",
            en: "Set aside slightly more than one hundredth of the produce and say:",
          },
          rubricSeg: 3,
        },
        { seg: 5, strip: MINIM },
      ],
    },
    {
      label: "Tevel certain",
      halakha: {
        fr: "Quand on est le producteur et que l'on sait quand chaque fruit a poussé et a été cueilli, on prélève avec la bénédiction.",
        en: "When you are the grower and know when each fruit formed and was picked, separate with the blessing.",
      },
      halakhaSeg: 7,
      lines: [{ seg: 8 }, { seg: 9, strip: MINIM }],
    },
    {
      label: "Maaser cheni",
      lines: [
        {
          seg: 11,
          strip: MINIM,
          rubric: {
            fr: "Les fruits des années 1, 2, 4 et 5 du cycle chemita sont soumis au maaser cheni :",
            en: "Produce of years 1, 2, 4 and 5 of the shemita cycle is subject to maaser sheni:",
          },
          rubricSeg: 10,
        },
        {
          seg: 13,
          rubric: {
            fr: "On le rachète sur une perouta, et avant le rachat on dit :",
            en: "It is redeemed on a perutah; before redeeming, say:",
          },
          rubricSeg: 12,
        },
        {
          seg: 15,
          rubric: { fr: "Puis la formule du rachat :", en: "Then the wording of the redemption:" },
          rubricSeg: 14,
        },
      ],
    },
    {
      label: "Maaser ani",
      lines: [
        {
          seg: 17,
          strip: MINIM,
          rubric: {
            fr: "Les fruits des années 3 et 6 sont soumis au maaser ani, qui ne se rachète pas :",
            en: "Produce of years 3 and 6 is subject to maaser ani, which is not redeemed:",
          },
          rubricSeg: 16,
        },
      ],
    },
    {
      label: "Neta revaï",
      lines: [
        {
          seg: 19,
          rubric: {
            fr: "Pour des fruits de quatrième année encore non rachetés :",
            en: "For fourth-year produce not yet redeemed:",
          },
          rubricSeg: 18,
        },
        {
          seg: 21,
          rubric: { fr: "Puis la formule du rachat :", en: "Then the wording of the redemption:" },
          rubricSeg: 20,
        },
      ],
    },
  ],
};

/** La bénédiction des arbres : segments de « Nissan / Blessing of the Trees ». */
const birkatHailanot = {
  file: "birkat-hailanot",
  title: "ברכת האילנות (Birkat Hailanot)",
  src: (t) => t["Nissan"]["Blessing of the Trees"],
  blocks: [
    {
      halakha: {
        fr: "Au mois de Nissan, devant deux arbres fruitiers en fleur, une fois l'an.",
        en: "In the month of Nisan, before two blossoming fruit trees, once a year.",
        he: "בחודש ניסן, על שני אילני מאכל שהוציאו פרח, פעם אחת בשנה",
      },
      lines: [{ seg: 2 }, { seg: 3 }, { seg: 4 }],
    },
    { lines: [{ seg: 5 }, { seg: 6 }, { seg: 7 }] },
    { label: "La bénédiction", lines: [{ seg: 8 }] },
    {
      lines: [
        {
          seg: 10,
          rubric: {
            fr: "Après la bénédiction, on dit cette demande :",
            en: "After the blessing, say this request:",
          },
          rubricSeg: 9,
        },
        { seg: 11 },
        { seg: 12 },
        { seg: 13 },
      ],
    },
  ],
};

/** La brit mila : segments de « Assorted Blessings and Prayers / Brit Mila ». */
const britMila = {
  file: "brit-mila",
  title: "ברית מילה (Brit Mila)",
  src: (t) => t["Assorted Blessings and Prayers"]["Brit Mila"],
  blocks: [
    {
      label: "Avant la mila",
      lines: [
        {
          seg: 2,
          strip: ["ואביו יאמר:"],
          rubric: { fr: "Prière à dire avant la mila :", en: "Prayer said before the mila:" },
          rubricSeg: 1,
        },
        {
          seg: 4,
          rubric: { fr: "Prière du sandak :", en: "The sandak's prayer:" },
          rubricSeg: 3,
        },
      ],
    },
    {
      label: "L'entrée de l'enfant",
      lines: [
        {
          seg: 6,
          rubric: {
            fr: "Quand on apporte l'enfant, l'assemblée se lève et dit :",
            en: "As the child is brought in, the congregation rises and says:",
          },
          rubricSeg: 5,
        },
        {
          seg: 8,
          rubric: {
            fr: "Le père prend l'enfant dans ses bras et dit :",
            en: "The father takes the child in his arms and says:",
          },
          rubricSeg: 7,
        },
        {
          seg: 10,
          rubric: { fr: "Puis le père dit :", en: "Then the father says:" },
          rubricSeg: 9,
        },
        {
          seg: 12,
          rubric: { fr: "L'assemblée répond :", en: "The congregation answers:" },
          rubricSeg: 11,
        },
        {
          seg: 14,
          rubric: {
            fr: "En terre d'Israël, on ajoute ces versets :",
            en: "In the Land of Israel, these verses are added:",
          },
          rubricSeg: 13,
        },
        {
          seg: 16,
          rubric: { fr: "Puis on dit :", en: "Then say:" },
          rubricSeg: 15,
        },
        { seg: 17, repeat: 2 },
        { seg: 18, repeat: 2 },
        { seg: 19, repeat: 2 },
      ],
    },
    {
      label: "La mila",
      lines: [
        {
          seg: 20,
          from: "הֲרֵינִי",
          rubric: {
            fr: "Le père désigne le mohel comme son envoyé :",
            en: "The father appoints the mohel as his agent:",
            he: "אומר אבי הבן",
          },
        },
        {
          seg: 21,
          from: "בִּרְשׁוּת",
          rubric: { fr: "Puis le père dit :", en: "Then the father says:", he: "ואומר אבי הבן" },
        },
        {
          seg: 23,
          rubric: { fr: "Debout, il bénit :", en: "Standing, he blesses:" },
          rubricSeg: 22,
        },
        {
          seg: 25,
          rubric: {
            fr: "L'assemblée et le mohel répondent :",
            en: "The congregation and the mohel answer:",
          },
          rubricSeg: 24,
        },
        {
          seg: 27,
          rubric: {
            fr: "On pose l'enfant sur le siège d'Élie, et l'on dit :",
            en: "The child is laid on Elijah's chair, and one says:",
          },
          rubricSeg: 26,
        },
        {
          seg: 29,
          rubric: {
            fr: "Le mohel bénit avant de circoncire :",
            en: "The mohel blesses before circumcising:",
          },
          rubricSeg: 28,
        },
        {
          seg: 31,
          rubric: {
            fr: "Après la mila, le père bénit :",
            en: "After the mila, the father blesses:",
          },
          rubricSeg: 30,
        },
      ],
    },
    {
      label: "Sur la coupe",
      lines: [
        {
          seg: 33,
          rubric: { fr: "On prend une coupe de vin :", en: "A cup of wine is taken:" },
          rubricSeg: 32,
        },
        { seg: 34 },
        {
          seg: 36,
          rubric: { fr: "Puis on prend un myrte :", en: "Then a myrtle is taken:" },
          rubricSeg: 35,
        },
        { seg: 37 },
        {
          seg: 38,
          from: "אֱלֹהֵינוּ",
          rubric: {
            fr: "On goûte à la coupe et l'on dit (le père dit ce qui est entre parenthèses) :",
            en: "Taste from the cup and say (the father says what is in parentheses):",
            he: "טועם מן הכוס ואומר",
          },
        },
        { seg: 39 },
      ],
    },
  ],
};

/** La hachkava : segments de « Fast Days and Mourning / Mourning ». */
const hachkava = {
  file: "hachkava",
  title: "השכבה (Hachkava)",
  src: (t) => t["Fast Days and Mourning"]["Mourning"],
  blocks: [
    {
      label: "Pour un homme",
      lines: [{ seg: 20 }],
    },
    {
      label: "Pour un homme d'étude",
      lines: [
        {
          seg: 22,
          rubric: {
            fr: "Pour un homme grand en Torah et en crainte du Ciel, on dit :",
            en: "For a man great in Torah and in fear of Heaven, one says:",
          },
          rubricSeg: 21,
        },
        { seg: 23 },
      ],
    },
    {
      label: "Pour une femme",
      lines: [
        {
          seg: 26,
          rubric: { fr: "Certains disent :", en: "Some say:" },
          rubricSeg: 25,
        },
        { seg: 27 },
      ],
    },
    {
      label: "Pour une femme de valeur",
      lines: [
        {
          seg: 29,
          rubric: {
            fr: "Pour une femme grande et estimée, certains disent :",
            en: "For a great and esteemed woman, some say:",
          },
          rubricSeg: 28,
        },
        { seg: 30 },
      ],
    },
    {
      label: "Bénédiction du cimetière",
      lines: [{ seg: 32 }],
    },
  ],
};

/** Les autres bénédictions : sections de « Assorted Blessings and Prayers ». */
const brahotChonot = {
  file: "brahot-chonot",
  title: "ברכות שונות (Brahot Chonot)",
  // Chaque bénédiction est une section à elle : la recette les met bout à bout
  // en numérotant les segments dans l'ordre où elles sont listées ici.
  src: (t) => {
    const a = t["Assorted Blessings and Prayers"];
    return [
      ...a["Mezuza"],
      ...a["Building a Fence"],
      ...a["Tevillat Kelim"],
      ...a["Rainbow"],
      ...a["Blessings on Lighting and Thunder"],
      ...a["Prayer for Taking Medicine"],
    ];
  },
  blocks: [
    {
      label: "Mezouza",
      halakha: {
        fr: "La mezouza se fixe au montant droit en entrant, dans le tiers supérieur du chambranle.",
        en: "The mezuzah is affixed to the right doorpost as one enters, in the upper third of the frame.",
        he: "קובע אותה במזוזת ימין הנכנס, בתחילת שליש העליון של גובה השער",
      },
      lines: [
        { seg: 2 },
        {
          seg: 4,
          rubric: {
            fr: "Une fois fixée, on l'embrasse et l'on dit :",
            en: "Once affixed, kiss it and say:",
          },
          rubricSeg: 3,
        },
      ],
    },
    {
      label: "Maaké",
      halakha: {
        fr: "On pose une balustrade au toit d'une maison habitée, non à celui d'un simple débarras.",
        en: "A parapet is placed on the roof of a dwelling, not on that of a mere storeroom.",
        he: "מצות עשה לעשות מעקה לגגו אם הבית שתחת הגג הוא בית דירה",
      },
      lines: [{ seg: 7 }],
    },
    {
      label: "Tevilat kelim",
      halakha: {
        fr: "Pour un seul ustensile, on dit כְּלִי au lieu de כֵּלִים.",
        en: "For a single vessel, say כְּלִי instead of כֵּלִים.",
        he: "על כלי אחד אומר כְּלִי",
      },
      lines: [
        {
          seg: 11,
          strip: ["על כלי אחד אומר כְּלִי"],
          rubric: {
            fr: "Avant de tremper une vaisselle de métal ou de verre achetée à un non-juif :",
            en: "Before immersing metal or glass tableware bought from a non-Jew:",
          },
          rubricSeg: 10,
        },
      ],
    },
    {
      label: "Sur l'arc-en-ciel",
      halakha: {
        fr: "On regarde brièvement, le temps de la bénédiction, sans s'attarder.",
        en: "Look only briefly, for the blessing, without lingering.",
      },
      halakhaSeg: 13,
      lines: [{ seg: 14 }],
    },
    {
      label: "Éclairs et tonnerre",
      halakha: {
        fr: "L'usage est de bénir sans le Nom ni la royauté.",
        en: "The custom is to bless without the Name and kingship.",
      },
      halakhaSeg: 16,
      lines: [
        {
          seg: 17,
          from: "בָּרוּךְ",
          rubric: { fr: "Sur les éclairs :", en: "On lightning:", he: "על הברקים מברך" },
        },
        {
          seg: 19,
          rubric: { fr: "Sur le tonnerre :", en: "On thunder:" },
          rubricSeg: 18,
        },
      ],
    },
    {
      label: "Avant de prendre un remède",
      lines: [
        {
          seg: 22,
          rubric: {
            fr: "Avant de prendre un remède, on dit :",
            en: "Before taking a medicine, say:",
          },
          rubricSeg: 21,
        },
      ],
    },
  ],
};

/** Le tikoun hatsot : sections de « The Midnight Rite ». */
const tikounHatsot = {
  file: "tikoun-hatsot",
  title: "תיקון חצות (Tikoun Hatsot)",
  src: (t) => {
    const m = t["The Midnight Rite"];
    return [...m["LeShem Yichud"], ...m["Tikkun Rachel"], ...m["Tikkun Leah"]];
  },
  blocks: [
    {
      halakha: {
        fr: "Il ne se dit pas les nuits de Chabbat ni de fête. Tikoun Rahel ne se dit pas les nuits où l'on ne dit pas tahanoun, ni du 1er Nissan à la fin du mois.",
        en: "It is not said on Shabbat or festival nights. Tikkun Rachel is omitted on nights when tahanun is not said, and from 1 Nisan to the end of the month.",
      },
      halakhaSeg: 1,
      lines: [{ seg: 2 }, { seg: 3 }],
    },
    {
      label: "Tikoun Rahel",
      lines: [
        { seg: 5 },
        { seg: 6 },
        { seg: 7 },
        { seg: 8 },
        { seg: 9 },
        {
          seg: 10,
          from: "אוֹי לִי",
          rubric: {
            fr: "À la fin des versets de lamentation :",
            en: "At the end of the verses of lament:",
            he: "בסוף פסוקי הקינות יאמר",
          },
        },
        { seg: 11 },
        { seg: 12 },
      ],
    },
    {
      label: "Tikoun Léa",
      lines: [
        { seg: 14 },
        { seg: 15 },
        {
          seg: 17,
          rubric: {
            fr: "Ce psaume ne se dit pas les jours sans tahanoun :",
            en: "This psalm is not said on days without tahanun:",
          },
          rubricSeg: 16,
        },
        { seg: 18 },
        { seg: 19 },
        { seg: 20 },
        { seg: 21 },
        {
          seg: 23,
          rubric: {
            fr: "Ce qui suit ne se dit pas les jours sans tahanoun :",
            en: "What follows is not said on days without tahanun:",
          },
          rubricSeg: 22,
        },
        { seg: 24 },
      ],
    },
    {
      label: "Pour finir sur une consolation",
      halakha: {
        fr: "L'usage est de finir le tikoun Léa par Mélekh rahaman et le psaume Bechouv, pour conclure sur une consolation.",
        en: "The custom is to end Tikkun Leah with Melekh rachaman and the psalm Beshuv, closing on consolation.",
      },
      halakhaSeg: 25,
      lines: [{ seg: 26 }, { seg: 27 }],
    },
  ],
};

const RECIPES = [
  acherYatsar,
  birkatHailanot,
  birkotHanehenin,
  brahotChonot,
  britMila,
  chemaAlHamita,
  hachkava,
  hafrashatHalla,
  havdala,
  nerotHanouka,
  teroumotOumaasrot,
  tefilatHaderekh,
  tikounHatsot,
];

console.log("Téléchargement du Siddur Edot HaMizrach (export Sefaria)…");
const text = await fetchSiddur();

writeRecipes(RECIPES, text, OUT);
console.log("Terminé.");
