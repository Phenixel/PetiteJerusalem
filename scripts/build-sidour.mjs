/**
 * Construit les textes du sidour de semaine (Cha'harit, Min'ha, Arvit) à
 * partir du Siddur Edot HaMizrach de l'export public Sefaria (GCS), au format
 * des fichiers de tefila (public/texts/tefila/*, voir loadTefila dans
 * src/services/textService.ts).
 *
 * Lancer avec : node scripts/build-sidour.mjs
 *
 * La mise en forme est une recette explicite, bloc par bloc : quels segments
 * de la source entrent, avec quelles didascalies (trilingues), quelles
 * conditions de calendrier (`when`, voir dailyCycles.activeOccasions), quelles
 * halakhot et quels marqueurs d'horaires (`zman`) et de lecture de la Torah
 * (`torahWeekly`). La source porte ses consignes en hébreu dans des balises
 * <small> ; la recette les remplace par des didascalies dans les trois
 * langues, le reste des <small> (références, acronymes) est retiré.
 *
 * Licence des textes : l'export Sefaria « merged » combine des sources du
 * domaine public.
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/texts/tefila");
const SOURCE_URL =
  "https://storage.googleapis.com/sefaria-export/json/Liturgy/Siddur/Siddur%20Edot%20HaMizrach/Hebrew/merged.json";

// ---------- Nettoyage ----------

/** Balises et entités retirées, tirets longs bannis du dépôt remplacés. */
function cleanFinal(s) {
  return s
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&thinsp;|&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Retire tous les <small>…</small>, même imbriqués (consignes, références). */
function dropSmalls(s) {
  let prev;
  do {
    prev = s;
    s = s.replace(/<small>(?:(?!<\/?small>)[\s\S])*<\/small>/g, " ");
  } while (s !== prev);
  return s;
}

/** Contenu des <small> de premier niveau, balises internes conservées. */
function outerSmalls(s) {
  const parts = [];
  let depth = 0;
  let buf = "";
  const tokens = s.split(/(<small>|<\/small>)/);
  for (const tok of tokens) {
    if (tok === "<small>") {
      depth += 1;
      if (depth === 1) buf = "";
      else buf += tok;
      continue;
    }
    if (tok === "</small>") {
      depth -= 1;
      if (depth === 0) parts.push(buf);
      else buf += tok;
      continue;
    }
    if (depth >= 1) buf += tok;
  }
  return parts;
}

/**
 * Le texte d'un segment selon le mode choisi :
 * - "body" (défaut) : le fil du texte, consignes <small> retirées ;
 * - "full" : tout le texte, balises retirées ;
 * - "small" : le contenu des <small> (les passages que la source met en
 *   retrait : kedoucha, ajouts du calendrier, kaddich…).
 */
function segText(raw, mode = "body") {
  const s = String(raw ?? "");
  if (mode === "full") return cleanFinal(s);
  if (mode === "small") return cleanFinal(dropSmalls(outerSmalls(s).join(" ")));
  if (mode === "smallAll") return cleanFinal(outerSmalls(s).join(" "));
  return cleanFinal(dropSmalls(s));
}

/**
 * Signes hébraïques (voyelles, teamim) ignorés quand on cherche un repère :
 * les consonnes font foi, les signes varient d'une édition à l'autre. La
 * ponctuation (maqaf, paseq) reste : elle structure le texte.
 */
const HEBREW_MARKS = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4-\u05C7]/;

/**
 * Découpe `text` entre deux repères (`from` inclus, `until` exclu), cherchés
 * sans signes. Un repère absent fait échouer la construction : mieux vaut pas
 * de fichier qu'un passage amputé en silence.
 */
function sliceBetween(text, { from, until }) {
  const map = [];
  let bare = "";
  for (let i = 0; i < text.length; i++) {
    if (HEBREW_MARKS.test(text[i])) continue;
    map.push(i);
    bare += text[i];
  }
  const stripMarks = (marker) => marker.replace(new RegExp(HEBREW_MARKS, "g"), "");
  let start = 0;
  let bareStart = 0;
  if (from) {
    bareStart = bare.indexOf(stripMarks(from));
    if (bareStart < 0) throw new Error(`Repère introuvable : ${from}`);
    start = map[bareStart];
  }
  let end = text.length;
  if (until) {
    const j = bare.indexOf(stripMarks(until), from ? bareStart + 1 : 0);
    if (j < 0) throw new Error(`Repère introuvable : ${until}`);
    end = map[j];
  }
  return text.slice(start, end).trim();
}

// ---------- Recette → fichier ----------

/**
 * Une ligne de recette :
 *   { seg, mode?, strip?: [..], from?, until?, he?: "littéral", rubric?,
 *     when?, muted?, tight?, lead?, repeat?, strong?, alt?: { rubric, text } }
 * `strip` retire des consignes restées dans le texte extrait ; `from`/`until`
 * découpent le segment entre deux repères (voir sliceBetween) ; `when` ne dit
 * la ligne qu'à cette occasion ; `alt` ajoute dans le fil une didascalie
 * suivie du texte qu'elle affecte, rendu à la couleur du thème.
 */
function buildLine(spec, segs) {
  let text;
  if (spec.he !== undefined) {
    text = cleanFinal(spec.he);
  } else {
    text = segText(segs[spec.seg], spec.mode);
  }
  for (const cut of spec.strip ?? []) {
    text = text.split(cut).join(" ");
  }
  if (spec.from || spec.until) text = sliceBetween(text, spec);
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const line = {};
  if (spec.rubric) line.rubric = spec.rubric;
  if (spec.strong) line.he = [{ b: text }];
  else if (spec.alt) {
    const when = spec.alt.when ? { when: spec.alt.when } : {};
    line.he = [text, { r: spec.alt.rubric, ...when }, { v: spec.alt.text, ...when }];
  }
  else line.he = text;
  if (spec.repeat) line.repeat = spec.repeat;
  if (spec.when) line.when = spec.when;
  if (spec.muted) line.muted = true;
  if (spec.tight) line.tight = true;
  if (spec.lead) line.lead = true;
  // Sans autre attribut, une simple chaîne suffit au format.
  const keys = Object.keys(line);
  if (keys.length === 1 && typeof line.he === "string") return line.he;
  return line;
}

function buildBlock(spec, sections) {
  const block = {};
  if (spec.labelText) {
    block.label = spec.labelText.fr;
    block.labelText = spec.labelText;
  }
  if (spec.when) block.when = spec.when;
  if (spec.plain) block.plain = true;
  if (spec.fold) block.fold = spec.fold;
  if (spec.halakha) block.halakha = spec.halakha;
  if (spec.zman) block.zman = spec.zman;
  if (spec.torahWeekly) block.torahWeekly = true;
  if (spec.numbered) block.numbered = true;
  const segs = spec.src ? sections[spec.src] : [];
  if (spec.src && !segs) throw new Error(`Section source inconnue : ${spec.src}`);
  block.lines = (spec.lines ?? [])
    .map((line) => buildLine(line, segs ?? []))
    .filter((line) => line !== null);
  if (!block.zman && !block.torahWeekly && block.lines.length === 0) {
    throw new Error(`Bloc vide : ${spec.labelText?.fr ?? spec.when ?? "?"}`);
  }
  return block;
}

// ---------- Didascalies et halakhot partagées ----------

const R = (fr, en, he) => ({ fr, en, he });

const RUBRIC = {
  hazan: R("Le 'hazan dit :", "The chazan says:", "ואומר החזן:"),
  kahal: R("L'assemblée répond :", "The congregation answers:", "ועונים הקהל:"),
  hazanReprend: R("Le 'hazan reprend :", "The chazan repeats:", "וחוזר החזן:"),
  bassevoix: R("À voix basse :", "In an undertone:", "בלחש:"),
  hautevoix: R("À voix haute :", "Aloud:", "בקול רם:"),
  assis: R("Assis, on dit :", "Seated, say:", "ישב ויאמר:"),
  debout: R("Debout, on dit :", "Standing, say:", "עומדים ואומרים:"),
  certains: R("Certains ajoutent :", "Some add:", "יש נוהגים לומר:"),
  repetition: R(
    "Pendant la répétition du 'hazan, l'assemblée dit :",
    "During the chazan's repetition, the congregation says:",
    "בחזרת הש״ץ אומרים:",
  ),
  teshuvaOn: R(
    "Pendant les dix jours de techouva, on ajoute :",
    "During the Ten Days of Repentance, add:",
    "בעשרת ימי תשובה מוסיפים:",
  ),
  ete: R("En été :", "In summer:", "בקיץ:"),
  hiver: R("En hiver :", "In winter:", "בחורף:"),
  roshHodesh: R("À Roch Hodech :", "On Rosh Hodesh:", "בראש חודש:"),
  holPessah: R("À 'Hol haMoed Pessah :", "On Chol haMoed Pesach:", "בחוה״מ פסח:"),
  holSouccot: R("À 'Hol haMoed Souccot :", "On Chol haMoed Sukkot:", "בחוה״מ סוכות:"),
  hanouka: R("À 'Hanouka :", "On Hanukkah:", "בחנוכה:"),
  pourim: R("À Pourim :", "On Purim:", "בפורים:"),
};

const STRIP = {
  teshuvaDisent: "בעשרת ימי תשובה אומרים:",
  bassevoix: "בלחש:",
};

// Les trois offices partagent la même 'Amida : la recette de ses blocs est
// écrite une fois, avec la table des index propres à chaque office.
const HALAKHA = {
  amida: R(
    "La 'Amida se dit debout, pieds joints, face à Jérusalem, à voix basse et sans interruption. Les ajouts qui dépendent du jour ou de la saison apparaissent à leur place, à la couleur du thème.",
    "The Amidah is said standing, feet together, facing Jerusalem, in an undertone and without interruption. Additions that depend on the day or the season appear in their place, in the theme color.",
    "העמידה נאמרת בעמידה, ברגליים צמודות, לכיוון ירושלים, בלחש וללא הפסקה. התוספות התלויות ביום או בעונה מופיעות במקומן, בצבע הערכה.",
  ),
  eteMention: R(
    "Si l'on a dit machiv haroua'h oumorid haguéchem en été, on reprend au début de la bénédiction ; si la 'Amida est achevée, on la recommence.",
    "If mashiv haruach umorid hageshem was said in summer, go back to the start of the blessing; if the Amidah was finished, repeat it.",
    "אמר משיב הרוח ומוריד הגשם בקיץ, חוזר לראש הברכה؛ סיים את העמידה, חוזר לראשה.",
  ),
  hiverMention: R(
    "Si l'on a oublié machiv haroua'h mais dit morid hatal, on ne recommence pas.",
    "If mashiv haruach was omitted but morid hatal was said, do not repeat.",
    "שכח משיב הרוח ואמר מוריד הטל, אינו חוזר.",
  ),
  eteDemande: R(
    "Si l'on a demandé la pluie (barekh 'alénou) en été, on reprend au début de la bénédiction ; si la 'Amida est achevée, on la recommence.",
    "If rain was requested (barech aleinu) in summer, go back to the start of the blessing; if the Amidah was finished, repeat it.",
    "שאל גשם (ברך עלינו) בקיץ, חוזר לראש הברכה؛ סיים את העמידה, חוזר לראשה.",
  ),
  hiverDemande: R(
    "Si l'on a oublié la demande de pluie, on la rattrape dans Choméa' tefila. Passé cela, on reprend à Barekh 'alénou, et si la 'Amida est achevée, on la recommence.",
    "If the request for rain was omitted, insert it in Shomea tefillah. Past that, go back to Barech aleinu; if the Amidah was finished, repeat it.",
    "שכח שאלת גשם, אומרה בשומע תפילה؛ עבר, חוזר לברך עלינו, ואם סיים את העמידה חוזר לראשה.",
  ),
  melekhKadosh: R(
    "Si l'on a conclu haEl hakadoch pendant les dix jours de techouva, on recommence la 'Amida.",
    "If haEl hakadosh was said during the Ten Days of Repentance, repeat the Amidah.",
    "חתם האל הקדוש בעשרת ימי תשובה, חוזר לראש העמידה.",
  ),
  yaaleVeyavo: R(
    "À Cha'harit et à Min'ha, si l'on a oublié Ya'alé véyavo, on recommence (depuis Retsé). Le soir de Roch Hodech, on ne recommence pas.",
    "At Shacharit and Mincha, if Yaale veyavo was omitted, go back (to Retseh). On the night of Rosh Hodesh, do not repeat.",
    "בשחרית ובמנחה, שכח יעלה ויבוא חוזר לרצה. בליל ראש חודש אינו חוזר.",
  ),
  alHanissim: R(
    "Si l'on a oublié 'Al hanissim, on ne recommence pas.",
    "If Al hanissim was omitted, do not repeat.",
    "שכח על הניסים, אינו חוזר.",
  ),
  ataHonantanu: R(
    "Si l'on a oublié Ata 'honantanou, on ne recommence pas : la havdala sur la coupe en tient lieu.",
    "If Atah chonantanu was omitted, do not repeat: havdalah over the cup takes its place.",
    "שכח אתה חוננתנו, אינו חוזר؛ סומך על ההבדלה שעל הכוס.",
  ),
  shemaMatin: R(
    "Avant le Chéma, on a en tête d'accomplir la mitsva de le lire et de proclamer l'unité du Nom. On couvre les yeux de la main droite pour le premier verset, qu'on dit avec concentration.",
    "Before the Shema, intend to fulfill the mitzvah of reading it and of proclaiming God's oneness. Cover your eyes with the right hand for the first verse, said with full concentration.",
    "קודם קריאת שמע יכוין לקיים מצוות הקריאה וליחד את השם. יכסה עיניו ביד ימין בפסוק הראשון, ויאמרנו בכוונה.",
  ),
  pessoukeDezimra: R(
    "De Baroukh chéamar à Yichtaba'h, on ne s'interrompt pas pour parler.",
    "From Baruch sheamar to Yishtabach, do not interrupt to speak.",
    "מברוך שאמר עד ישתבח אין מפסיקים בדיבור.",
  ),
  birkotHashahar: R(
    "Ces bénédictions se disent chaque matin, même si l'on n'en a pas eu l'occasion sur le moment ; on peut les rattraper toute la matinée.",
    "These blessings are said every morning, even past their moment; they may be made up all morning.",
    "ברכות אלו נאמרות בכל בוקר, ואפשר להשלימן כל שעות הבוקר.",
  ),
  tahanoun: R(
    "Le ta'hanoun ne se dit pas à Roch Hodech, à 'Hanouka, à Pourim, tout le mois de Nissan et les jours de fête : ces jours-là, cette section n'apparaît pas.",
    "Tachanun is not said on Rosh Hodesh, Hanukkah, Purim, all of Nissan and festive days: on those days this section does not appear.",
    "אין אומרים תחנון בראש חודש, בחנוכה, בפורים, בכל חודש ניסן ובימים טובים؛ בימים אלו הקטע אינו מופיע.",
  ),
  torahSemaine: R(
    "Le lundi et le jeudi matin, on lit dans la Torah le début de la paracha de la semaine, en trois montées.",
    "On Monday and Thursday mornings, the beginning of the week's parasha is read from the Torah, in three aliyot.",
    "בימי שני וחמישי קוראים בתורה את תחילת פרשת השבוע, בשלושה עולים.",
  ),
  hallel: R(
    "À Roch Hodech, le Hallel se dit debout, en sautant les passages indiqués (Hallel « abrégé ») ; selon l'usage séfarade, l'individuel le dit alors sans bénédiction.",
    "On Rosh Hodesh, Hallel is said standing, skipping the indicated passages (“half” Hallel); by Sephardic custom, an individual then says it without a blessing.",
    "בראש חודש אומרים הלל בדילוג, מעומד؛ למנהג הספרדים היחיד אומרו בלא ברכה.",
  ),
};

// ---------- 'Amida commune ----------

/**
 * Les blocs de la 'Amida d'un office. `ix` : index des segments dans la
 * source de cet office ; `opts` : ce qui n'existe pas partout (kedoucha,
 * modim derabanan, Ata 'honantanou à la sortie de Chabbat…).
 */
function amidaBlocks(src, ix) {
  const blocks = [];
  blocks.push({
    src,
    labelText: R("'Amida", "The Amidah", "עמידה"),
    halakha: HALAKHA.amida,
    lines: [{ seg: 1 }, { seg: ix.avot, strip: [STRIP.teshuvaDisent] }],
  });

  blocks.push({
    src,
    when: "teshuva",
    lines: [
      {
        seg: ix.avot,
        mode: "small",
        strip: [STRIP.teshuvaDisent],
        rubric: R(
          "Dix jours de techouva, avant la fin de la bénédiction :",
          "Ten Days of Repentance, before the end of the blessing:",
          "בעשרת ימי תשובה, לפני חתימת הברכה:",
        ),
      },
    ],
  });

  blocks.push({ src, lines: [{ seg: ix.gevurot }] });
  blocks.push({
    src,
    when: "ete",
    halakha: HALAKHA.eteMention,
    lines: [{ he: "מוֹרִיד הַטָּל.", rubric: RUBRIC.ete }],
  });
  blocks.push({
    src,
    when: "hiver",
    halakha: HALAKHA.hiverMention,
    lines: [{ he: "מַשִּׁיב הָרֽוּחַ וּמוֹרִיד הַגֶּֽשֶׁם.", rubric: RUBRIC.hiver }],
  });
  blocks.push({ src, lines: [{ seg: ix.mekhalkel, strip: [STRIP.teshuvaDisent] }] });
  blocks.push({
    src,
    when: "teshuva",
    lines: [
      {
        seg: ix.mekhalkel,
        mode: "small",
        strip: [STRIP.teshuvaDisent],
        rubric: R(
          "Dix jours de techouva, avant « וְנֶאֱמָן » :",
          "Ten Days of Repentance, before “vene'eman”:",
          "בעשרת ימי תשובה, לפני « וְנֶאֱמָן »:",
        ),
      },
    ],
  });

  // La kedoucha ne se dit qu'avec la répétition du 'hazan : elle reste là,
  // dans un encadré replié, sans couper le fil de qui prie seul.
  if (ix.kedushaText !== undefined) {
    blocks.push({
      src,
      labelText: R("Kedoucha", "Kedushah", "קדושה"),
      fold: "hazan",
      lines: [{ seg: ix.kedushaText, mode: "small", rubric: RUBRIC.repetition }],
    });
  }

  blocks.push({
    src,
    lines: [{ seg: ix.ataKadosh, strip: [STRIP.teshuvaDisent, "הַמֶּלֶךְ הַקָּדוֹשׁ:"] }],
  });
  blocks.push({
    src,
    when: "teshuva",
    halakha: HALAKHA.melekhKadosh,
    lines: [
      {
        he: "הַמֶּלֶךְ הַקָּדוֹשׁ:",
        rubric: R(
          "Dix jours de techouva : on conclut ainsi :",
          "Ten Days of Repentance: conclude with:",
          "בעשרת ימי תשובה חותמים:",
        ),
      },
    ],
  });

  // Bénédictions intermédiaires.
  blocks.push({ src, lines: [{ seg: ix.honen }] });
  if (ix.ataHonantanu !== undefined) {
    blocks.push({
      src,
      when: "jour-0",
      halakha: HALAKHA.ataHonantanu,
      lines: [
        {
          seg: ix.ataHonantanu,
          mode: "small",
          rubric: R(
            "À la sortie de Chabbat et de Yom Tov, on ajoute :",
            "At the close of Shabbat and Yom Tov, add:",
            "במוצאי שבת ויום טוב מוסיפים:",
          ),
        },
      ],
    });
    blocks.push({ src, lines: [{ seg: ix.vehonenu, tight: true }] });
  }
  blocks.push({
    src,
    lines: [{ seg: ix.hashivenu }, { seg: ix.selah }, { seg: ix.reeh }, { seg: ix.refaenu }],
  });

  blocks.push({
    src,
    when: "barkhenou",
    halakha: HALAKHA.eteDemande,
    lines: [{ seg: ix.barkhenu, rubric: RUBRIC.ete }],
  });
  blocks.push({
    src,
    when: "barekh-alenou",
    halakha: HALAKHA.hiverDemande,
    lines: [{ seg: ix.barekhAlenu, rubric: RUBRIC.hiver }],
  });

  blocks.push({
    src,
    lines: [{ seg: ix.teka }, { seg: ix.hashiva, strip: [STRIP.teshuvaDisent, "הַמֶּלֶךְ הַמִּשְׁפָּט:"] }],
  });
  blocks.push({
    src,
    when: "teshuva",
    lines: [
      {
        he: "הַמֶּלֶךְ הַמִּשְׁפָּט:",
        rubric: R(
          "Dix jours de techouva : on conclut ainsi (en cas d'oubli, on ne recommence pas) :",
          "Ten Days of Repentance: conclude with (if omitted, do not repeat):",
          "בעשרת ימי תשובה חותמים (ואם שכח אינו חוזר):",
        ),
      },
    ],
  });

  const middle = [{ seg: ix.laminim }, { seg: ix.tsadikim }, { seg: ix.tishkon }];
  if (ix.tishkonHatima !== undefined) middle.push({ seg: ix.tishkonHatima, tight: true });
  middle.push({ seg: ix.tsemah }, { seg: ix.shemaKolenu }, { seg: ix.kiAta, tight: true });
  middle.push({ seg: ix.retse });
  blocks.push({ src, lines: middle });

  // Ya'alé véyavo : Roch Hodech et 'Hol haMoed.
  blocks.push({
    src,
    when: "moed",
    halakha: HALAKHA.yaaleVeyavo,
    lines: [
      {
        seg: ix.yv,
        mode: "small",
        rubric: R(
          "À Roch Hodech et à 'Hol haMoed, on ajoute :",
          "On Rosh Hodesh and Chol haMoed, add:",
          "בראש חודש ובחול המועד אומרים:",
        ),
      },
      { seg: ix.yvRH, mode: "small", strip: ["בראש חדש:"], rubric: RUBRIC.roshHodesh, tight: true },
      { seg: ix.yvPessah, mode: "small", strip: ["בחוה״מ פסח:"], rubric: RUBRIC.holPessah, tight: true },
      { seg: ix.yvSouccot, mode: "small", strip: ["בחוה״מ סוכות:"], rubric: RUBRIC.holSouccot, tight: true },
      { seg: ix.yvSuite, mode: "small", tight: true },
    ],
  });

  blocks.push({
    src,
    lines: [
      { seg: ix.veata },
      {
        seg: ix.modim,
        rubric: R(
          "On s'incline à « Modim » et on se redresse au Nom :",
          "Bow at “Modim” and straighten at God's name:",
          "יכרע ב« מודים » ויזקוף בשם:",
        ),
      },
    ],
  });

  if (ix.modimDerabanan !== undefined) {
    blocks.push({
      src,
      labelText: R("Modim dérabanan", "Modim derabanan", "מודים דרבנן"),
      fold: "hazan",
      lines: [
        {
          seg: ix.modimDerabanan,
          mode: "small",
          // La consigne de la source, avec ses deux graphies de guillemet.
          strip: [
            "מודים דרבנן",
            'בחזרת הש"ץ כשהחזן אומר מודים, הקהל אומרים:',
            "בחזרת הש״ץ כשהחזן אומר מודים, הקהל אומרים:",
          ],
          rubric: R(
            "Pendant la répétition, quand le 'hazan dit Modim, l'assemblée dit :",
            "During the repetition, as the chazan says Modim, the congregation says:",
            "בחזרת הש״ץ, כשהחזן אומר מודים, הקהל אומרים:",
          ),
        },
      ],
    });
  }

  blocks.push({
    src,
    when: "nissim",
    halakha: HALAKHA.alHanissim,
    lines: [
      {
        seg: ix.alHanissim,
        mode: "small",
        rubric: R(
          "À 'Hanouka et à Pourim, on ajoute :",
          "On Hanukkah and Purim, add:",
          "בחנוכה ופורים אומרים:",
        ),
      },
      { seg: ix.hanouka, mode: "small", strip: ["בחנוכה אומרים:"], rubric: RUBRIC.hanouka, tight: true },
      { seg: ix.pourim, mode: "small", strip: ["בפורים אומרים"], rubric: RUBRIC.pourim, tight: true },
    ],
  });

  blocks.push({ src, lines: [{ seg: ix.vealKoulam, strip: [STRIP.teshuvaDisent] }] });
  blocks.push({
    src,
    when: "teshuva",
    lines: [{ seg: ix.vealKoulam, mode: "small", strip: [STRIP.teshuvaDisent], rubric: RUBRIC.teshuvaOn }],
  });
  blocks.push({ src, lines: [{ seg: ix.simShalom, strip: [STRIP.teshuvaDisent] }] });
  blocks.push({
    src,
    when: "teshuva",
    lines: [{ seg: ix.simShalom, mode: "small", strip: [STRIP.teshuvaDisent], rubric: RUBRIC.teshuvaOn }],
  });

  blocks.push({
    src,
    lines: [
      { seg: ix.yihyu1 },
      { seg: ix.elohaiNetsor },
      { seg: ix.lemaan },
      { seg: ix.yihyu2, tight: true },
      {
        seg: ix.osse,
        alt: {
          when: "teshuva",
          rubric: R(
            "Dix jours de techouva, on dit :",
            "Ten Days of Repentance, say:",
            "בעשרת ימי תשובה אומרים:",
          ),
          text: "עוֹשֶׂה הַשָּׁלוֹם",
        },
      },
      { seg: ix.yehiRatson, mode: "small" },
    ],
  });

  return blocks;
}

/**
 * Le Kaddich du 'hazan, replié : celui qui prie seul ne le dit pas, mais à
 * l'office on veut pouvoir le suivre. Le texte vit dans les segments 4 à 7 de
 * « Uva LeSion » de Cha'harit (yitgadal, titkabal, yehé chelama, 'ossé
 * chalom) ; Min'ha et Arvit le reçoivent sous la clé source `src`.
 */
function kaddishHalf(src) {
  return {
    src,
    fold: "hazan",
    labelText: R("Demi-Kaddich (le 'hazan)", "Half Kaddish (the chazan)", "חצי קדיש (החזן)"),
    lines: [{ seg: 4, mode: "small", rubric: RUBRIC.hazan }],
  };
}

function kaddishTitkabal(src) {
  return {
    src,
    fold: "hazan",
    labelText: R(
      "Kaddich Titkabal (le 'hazan)",
      "Kaddish Titkabbal (the chazan)",
      "קדיש תתקבל (החזן)",
    ),
    lines: [
      { seg: 4, mode: "small", rubric: RUBRIC.hazan },
      { seg: 5, mode: "small", tight: true },
      { seg: 6, mode: "small", tight: true },
      {
        seg: 7,
        mode: "small",
        strip: ["יפסע שלש פסיעות לאחור"],
        rubric: R(
          "Il recule de trois pas et dit :",
          "He steps back three steps and says:",
          "יפסע שלוש פסיעות לאחור ויאמר:",
        ),
        tight: true,
      },
    ],
  };
}

/** Avinou Malkénou (dix jours de techouva), après la 'Amida. */
function avinouMalkenou(src, from, to) {
  const lines = [];
  for (let i = from; i <= to; i++) {
    lines.push({ seg: i, mode: "small", tight: i !== from });
  }
  return {
    src,
    when: "teshuva",
    plain: true,
    labelText: R(
      "Avinou Malkénou (dix jours de techouva)",
      "Avinu Malkenu (Ten Days of Repentance)",
      "אבינו מלכנו (עשרת ימי תשובה)",
    ),
    lines,
  };
}

// ---------- Recettes des trois offices ----------

function chaharitRecipe() {
  const amida = amidaBlocks("Amida", {
    avot: 2,
    gevurot: 3,
    mekhalkel: 5,
    kedushaText: 8,
    ataKadosh: 9,
    honen: 10,
    hashivenu: 11,
    selah: 12,
    reeh: 13,
    refaenu: 17,
    barkhenu: 19,
    barekhAlenu: 21,
    teka: 22,
    hashiva: 23,
    laminim: 24,
    tsadikim: 25,
    tishkon: 26,
    tsemah: 27,
    shemaKolenu: 28,
    kiAta: 31,
    retse: 32,
    yv: 34,
    yvRH: 35,
    yvPessah: 36,
    yvSouccot: 37,
    yvSuite: 38,
    veata: 39,
    modim: 41,
    modimDerabanan: 44,
    alHanissim: 46,
    hanouka: 47,
    pourim: 48,
    vealKoulam: 49,
    simShalom: 65,
    yihyu1: 66,
    elohaiNetsor: 67,
    lemaan: 68,
    yihyu2: 69,
    osse: 70,
    yehiRatson: 71,
  });

  const chirJours = [
    ["jour-0", 2, 3],
    ["jour-1", 4, 5],
    ["jour-2", 6, 7],
    ["jour-3", 8, 9],
    ["jour-4", 10, 11],
    ["jour-5", 12, 13],
  ].map(([when, intro, psaume]) => ({
    src: "Song of the Day",
    when,
    plain: true,
    labelText: R("Chir chel yom", "Psalm of the day", "שיר של יום"),
    lines: [{ seg: intro }, { seg: psaume, tight: true }],
  }));

  return {
    title: "שחרית של חול (Chaharit)",
    blocks: [
      { zman: "chaharit" },
      {
        src: "PP.Modeh Ani",
        labelText: R("Au réveil", "Upon waking", "השכמת הבוקר"),
        lines: [
          {
            seg: 3,
            rubric: R(
              "Au réveil, avant toute chose :",
              "Upon waking, before anything else:",
              "כשיעור משנתו יאמר:",
            ),
          },
        ],
      },
      {
        src: "PP.Morning Blessings",
        labelText: R("Bénédictions du matin", "Morning blessings", "ברכות השחר"),
        halakha: HALAKHA.birkotHashahar,
        lines: [
          {
            seg: 2,
            rubric: R(
              "Après la netilat yadayim :",
              "After washing the hands:",
              "אחר נטילת ידיים:",
            ),
          },
          { seg: 4 },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 12 },
          { seg: 13 },
          { seg: 14 },
          { seg: 16 },
          { seg: 17 },
          { seg: 18 },
          { seg: 19 },
          { seg: 20 },
          { seg: 22 },
          {
            seg: 24,
            muted: true,
            rubric: R(
              "Les femmes disent :",
              "Women say:",
              "האשה אומרת:",
            ),
          },
          { seg: 25 },
          { seg: 26, tight: true },
        ],
      },
      {
        src: "PP.Torah Blessings",
        labelText: R("Bénédictions de la Torah", "Torah blessings", "ברכות התורה"),
        lines: [
          { seg: 1 },
          { seg: 2, tight: true },
          { seg: 3 },
          {
            seg: 4,
            rubric: R(
              "Puis on lit la bénédiction des cohanim :",
              "Then read the priestly blessing:",
              "ואחר כך קוראים ברכת כהנים:",
            ),
          },
        ],
      },
      {
        src: "Morning Prayer",
        labelText: R("'Akédat Its'hak", "The Binding of Isaac", "עקידת יצחק"),
        lines: [
          { seg: 3 },
          { seg: 4 },
          { seg: 6, muted: true, rubric: RUBRIC.certains },
          { seg: 7 },
          { seg: 8 },
        ],
      },
      {
        src: "Morning Prayer",
        labelText: R(
          "Acceptation du joug divin",
          "Accepting the yoke of Heaven",
          "קבלת עול מלכות שמים",
        ),
        halakha: R(
          "Si l'on craint de dépasser l'heure du Chéma, on lit dès ici les trois paragraphes du Chéma, avec l'intention d'accomplir la mitsva.",
          "If the time of the Shema may pass, read all three paragraphs of the Shema here, intending to fulfill the mitzvah.",
          "אם רואה שזמן קריאת שמע עובר, יאמר כאן קריאת שמע כולה בכוונה.",
        ),
        lines: [
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 13, strong: true },
          { seg: 14, mode: "small", strip: ["ואומר בלחש"], rubric: RUBRIC.bassevoix, tight: true },
          { seg: 15 },
          { seg: 16 },
          { seg: 17 },
        ],
      },
      {
        src: "Morning Prayer",
        labelText: R("Korban tamid", "The daily offering", "פרשת התמיד"),
        lines: [{ seg: 18 }],
      },
      {
        src: "Incense Offering",
        labelText: R("Pitoum haketoret", "The incense offering", "פטום הקטורת"),
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 3 },
          { seg: 4 },
          { seg: 5 },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          {
            seg: 9,
            lead: true,
            rubric: R(
              "Ana bekhoa'h, ligne à ligne :",
              "Ana bechoach, line by line:",
              "אנא בכח:",
            ),
          },
          { seg: 10, tight: true },
          { seg: 11, tight: true },
          { seg: 12, tight: true },
          { seg: 13, tight: true },
          { seg: 14, tight: true },
          { seg: 15, tight: true },
          { seg: 17, rubric: RUBRIC.bassevoix, tight: true },
          { seg: 18 },
          { seg: 19 },
          { seg: 20 },
          { seg: 21 },
          { seg: 22 },
          { seg: 23 },
          { seg: 24 },
          { seg: 25 },
          { seg: 26 },
          { seg: 27 },
          { seg: 28 },
          { seg: 29 },
          { seg: 30 },
        ],
      },
      {
        src: "Hodu",
        labelText: R("Hodou", "Hodu", "הודו"),
        lines: [
          {
            seg: 1,
            rubric: R(
              "Le 'hazan dit ici le Kaddich 'al Israël, puis :",
              "The chazan says here the Kaddish al Israel, then:",
              "ואומרים קדיש « על ישראל », ואחר כך:",
            ),
          },
          { seg: 2 },
          { seg: 3 },
          { seg: 4 },
          { seg: 5 },
        ],
      },
      {
        src: "Hodu",
        when: "teshuva",
        lines: [
          {
            seg: 7,
            mode: "small",
            strip: ["שתי פעמים"],
            repeat: 2,
            rubric: R(
              "Pendant les dix jours de techouva et à Hochana Rabba :",
              "During the Ten Days of Repentance and on Hoshana Rabbah:",
              "בעשרת ימי תשובה והושענא רבה אומרים:",
            ),
          },
        ],
      },
      {
        src: "Hodu",
        lines: [
          { seg: 9, mode: "full", strip: ["שתי פעמים"], repeat: 2, rubric: RUBRIC.debout },
          { seg: 10, tight: true },
          { seg: 11 },
          {
            seg: 14,
            rubric: R(
              "Il est bon de dire ce psaume avec l'image de la menora :",
              "It is good to say this psalm picturing the menorah:",
              "טוב לומר מזמור זה בצורת המנורה:",
            ),
          },
        ],
      },
      {
        src: "Pesukei D'Zimra",
        labelText: R("Pessouké dezimra", "Pesukei dezimra", "פסוקי דזמרה"),
        halakha: HALAKHA.pessoukeDezimra,
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 4 },
          { seg: 5 },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 12 },
          {
            seg: 14,
            until: "אתה־הוא יהוה האלהים",
            rubric: R("Debout :", "Standing:", "יאמר מעומד:"),
          },
          {
            seg: 14,
            from: "אתה־הוא יהוה האלהים",
            rubric: R(
              "On peut s'asseoir à partir d'ici :",
              "One may be seated from here:",
              "מכאן אפשר לשבת:",
            ),
            tight: true,
          },
          { seg: 15 },
          { seg: 16 },
          { seg: 17 },
          { seg: 18 },
        ],
      },
      {
        src: "Pesukei D'Zimra",
        when: "teshuva",
        lines: [{ seg: 20, mode: "small", rubric: RUBRIC.teshuvaOn }],
      },
      kaddishHalf("Uva LeSion"),
      {
        src: "Pesukei D'Zimra",
        labelText: R("Barékhou", "Barechu", "ברכו"),
        lines: [
          { seg: 23, mode: "full", strip: ["ואומר החזן:"], rubric: RUBRIC.hazan },
          { seg: 24, mode: "full", strip: ["ועונים הקהל:"], rubric: RUBRIC.kahal, tight: true },
          { seg: 25, mode: "full", strip: ["ואומר החזן:"], rubric: RUBRIC.hazanReprend, tight: true },
        ],
      },
      { zman: "shema" },
      {
        src: "The Shema",
        labelText: R("Chéma et ses bénédictions", "The Shema and its blessings", "קריאת שמע וברכותיה"),
        halakha: HALAKHA.shemaMatin,
        lines: [
          { seg: 1 },
          { seg: 2 },
          {
            seg: 4,
            rubric: R(
              "La kedoucha de Yotser se dit assis :",
              "The Kedushah of Yotser is said seated:",
              "קדושת יוצר נאמרת מיושב:",
            ),
          },
          { seg: 5 },
          { seg: 6 },
          { seg: 7, tight: true },
          { seg: 8, tight: true },
          { seg: 10, strong: true },
          { seg: 11, mode: "small", strip: [STRIP.bassevoix], rubric: RUBRIC.bassevoix, tight: true },
          { seg: 12 },
          { seg: 13 },
          { seg: 14 },
          { seg: 15, tight: true },
          { seg: 16 },
          { seg: 17 },
          { seg: 18 },
          {
            seg: 20,
            rubric: R(
              "On se lève à « Tehilot » :",
              "Rise at “Tehilot”:",
              "בתחילת מלת תהלות יקום לעמוד:",
            ),
          },
        ],
      },
      { zman: "amida" },
      ...amida,
      avinouMalkenou("Amida", 74, 105),
      {
        src: "Vidui",
        when: "tahanoun",
        plain: true,
        labelText: R("Ta'hanoun", "Tachanun", "תחנון"),
        halakha: HALAKHA.tahanoun,
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 3 },
          { seg: 4 },
          { seg: 6, rubric: RUBRIC.assis },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
        ],
      },
      {
        src: "Vidui",
        when: "tahanoun-lundi-jeudi",
        plain: true,
        labelText: R(
          "Supplications du lundi et du jeudi",
          "Monday and Thursday supplications",
          "תחנונים לשני וחמישי",
        ),
        lines: [
          {
            seg: 14,
            rubric: R(
              "Le lundi et le jeudi, on ajoute :",
              "On Monday and Thursday, add:",
              "בימי שני וחמישי מוסיפים:",
            ),
          },
          { seg: 15 },
          { seg: 16 },
          { seg: 17 },
          { seg: 18 },
          { seg: 19 },
          { seg: 20 },
          { seg: 21 },
          { seg: 22 },
          { seg: 23 },
          { seg: 24 },
          { seg: 25 },
          { seg: 26 },
          { seg: 27 },
          { seg: 28 },
          { seg: 29 },
          { seg: 30 },
          { seg: 31 },
          { seg: 32 },
        ],
      },
      {
        src: "RH.Hallel",
        when: "rosh-chodesh",
        plain: true,
        labelText: R("Hallel de Roch Hodech", "Hallel for Rosh Hodesh", "הלל לראש חודש"),
        halakha: HALAKHA.hallel,
        lines: [
          { seg: 5 },
          { seg: 6 },
          { seg: 9, rubric: R(
            "À Roch Hodech, on saute « לֹא לָנוּ » :",
            "On Rosh Hodesh, skip “Lo lanu”:",
            "בראש חודש מדלגים « לֹא לָנוּ »:",
          ) },
          { seg: 12, rubric: R(
            "On saute « אָהַבְתִּי » :",
            "Skip “Ahavti”:",
            "מדלגים « אָהַבְתִּי »:",
          ) },
          { seg: 13 },
          { seg: 14 },
          { seg: 15, tight: true },
          { seg: 16, tight: true },
          { seg: 17, tight: true },
          { seg: 18 },
          { seg: 19, mode: "full" },
          { seg: 20, repeat: 2 },
          { seg: 21, repeat: 2, tight: true },
          { seg: 22, mode: "full" },
        ],
      },
      {
        src: "RH.Hallel",
        when: "rosh-chodesh",
        plain: true,
        labelText: R(
          "Lecture de la Torah de Roch Hodech",
          "Torah reading for Rosh Hodesh",
          "קריאת התורה לראש חודש",
        ),
        lines: [
          { seg: 35, rubric: R(
            "Avant la sortie du séfer Torah :",
            "Before taking out the Torah scroll:",
            "קודם הוצאת ספר תורה אומרים:",
          ) },
          { seg: 37, rubric: R(
            "On ouvre le hékhal et l'on dit :",
            "The ark is opened and one says:",
            "פותחים ההיכל ואומרים:",
          ) },
          { seg: 39, rubric: R(
            "On lit quatre montées dans la paracha des moussafim (Bamidbar 28) :",
            "Four aliyot are read from the portion of the musaf offerings (Numbers 28):",
            "מוציאים ספר תורה וקוראים ארבעה עולים (במדבר כח):",
          ) },
        ],
      },
      {
        src: "Torah Reading",
        when: "torah-semaine",
        plain: true,
        labelText: R("Sortie du séfer Torah", "Taking out the Torah", "הוצאת ספר תורה"),
        halakha: HALAKHA.torahSemaine,
        lines: [
          { seg: 2, rubric: R(
            "Avant la sortie du séfer, les jours où le ta'hanoun se dit :",
            "Before taking out the scroll, on days when tachanun is said:",
            "לפני הוצאת ספר תורה ביום שיש בו תחנון:",
          ) },
          { seg: 3, tight: true },
          { seg: 6, rubric: R(
            "Quand on sort le séfer Torah :",
            "As the Torah scroll is taken out:",
            "כשמוציאים ספר תורה אומרים:",
          ) },
          { seg: 8, rubric: R(
            "On montre l'écriture à l'assemblée :",
            "The script is shown to the congregation:",
            "מגביה ומראה הכתב לקהל ואומרים:",
          ) },
          { seg: 11, mode: "full", strip: ["ואומר העולה:"], rubric: R(
            "L'appelé dit :",
            "The one called up says:",
            "ואומר העולה:",
          ) },
          { seg: 12, mode: "full", strip: ["ועונים הקהל:"], rubric: RUBRIC.kahal, tight: true },
          { seg: 13, mode: "full", strip: ["וחוזר העולה:"], rubric: R(
            "L'appelé reprend :",
            "The one called up repeats:",
            "וחוזר העולה:",
          ), tight: true },
          { seg: 15, rubric: R(
            "Avant la lecture, l'appelé bénit :",
            "Before the reading, the one called up blesses:",
            "ומברך העולה לפני הקריאה:",
          ) },
        ],
      },
      {
        when: "torah-semaine",
        plain: true,
        torahWeekly: true,
      },
      {
        src: "Torah Reading",
        when: "torah-semaine",
        plain: true,
        lines: [
          { seg: 17, rubric: R(
            "Après la lecture, l'appelé bénit :",
            "After the reading, the one called up blesses:",
            "אחר הקריאה מברך העולה:",
          ) },
        ],
      },
      {
        src: "Ashrei",
        labelText: R("Achré", "Ashrei", "אשרי"),
        lines: [{ seg: 1 }, { seg: 2 }, { seg: 3 }],
      },
      {
        src: "Ashrei",
        when: "tahanoun",
        plain: true,
        lines: [
          {
            seg: 5,
            rubric: R(
              "Les jours sans ta'hanoun, on ne dit pas Lamnatséa'h :",
              "On days without tachanun, Lamnatseach is not said:",
              "ביום שאין אומרים בו תחנון מדלגים למנצח:",
            ),
          },
        ],
      },
      {
        src: "Uva LeSion",
        labelText: R("Ouva letsion", "Uva letzion", "ובא לציון"),
        halakha: R(
          "Dans la kedoucha de Ouva letsion, les versets se disent à voix haute, leur targoum (araméen) à voix basse.",
          "In the Kedushah of Uva letzion, the verses are said aloud and their Aramaic Targum in an undertone.",
          "בקדושת ובא לציון אומרים את הפסוקים בקול רם ואת התרגום בלחש.",
        ),
        lines: [
          { seg: 1, until: "וקרא זה אל־זה" },
          { seg: 1, from: "וקרא זה אל־זה", until: "ומקבלין דין מן דין", rubric: RUBRIC.hautevoix, tight: true },
          { seg: 1, from: "ומקבלין דין מן דין", until: "ותשאני רוח", rubric: RUBRIC.bassevoix, tight: true },
          { seg: 1, from: "ותשאני רוח", until: "ונטלתני רוחא", rubric: RUBRIC.hautevoix, tight: true },
          { seg: 1, from: "ונטלתני רוחא", until: "יהוה ׀ ימלך", rubric: RUBRIC.bassevoix, tight: true },
          { seg: 1, from: "יהוה ׀ ימלך", until: "יהוה מלכותיה קאים", rubric: RUBRIC.hautevoix, tight: true },
          { seg: 1, from: "יהוה מלכותיה קאים", until: "יהוה אלהי אברהם", rubric: RUBRIC.bassevoix, tight: true },
          { seg: 1, from: "יהוה אלהי אברהם", tight: true },
          { seg: 2 },
        ],
      },
      kaddishTitkabal("Uva LeSion"),
      {
        src: "Uva LeSion",
        when: "sefer-torah",
        plain: true,
        lines: [
          {
            seg: 9,
            mode: "small",
            rubric: R(
              "Quand on rapporte le séfer Torah :",
              "As the Torah scroll is returned:",
              "כשמחזירים ספר תורה:",
            ),
          },
        ],
      },
      {
        src: "Beit Yaakov",
        when: "tahanoun",
        plain: true,
        lines: [
          {
            seg: 2,
            rubric: R(
              "Les jours sans ta'hanoun, on ne dit pas Tefila leDavid :",
              "On days without tachanun, Tefillah leDavid is not said:",
              "בימים שאין אומרים תחנון אין אומרים תפלה לדוד:",
            ),
          },
        ],
      },
      {
        src: "Beit Yaakov",
        labelText: R("Beit Yaakov", "Beit Yaakov", "בית יעקב"),
        lines: [{ seg: 3 }, { seg: 4 }],
      },
      ...chirJours,
      {
        src: "Alenu",
        when: "ledavid",
        plain: true,
        labelText: R(
          "Lédavid (d'Eloul à Hochana Rabba)",
          "LeDavid (from Elul to Hoshana Rabbah)",
          "לדוד ה' אורי",
        ),
        lines: [{ seg: 5 }],
      },
      {
        src: "RH.Mussaf",
        when: "rosh-chodesh",
        plain: true,
        labelText: R("Moussaf de Roch Hodech", "Musaf for Rosh Hodesh", "מוסף לראש חודש"),
        halakha: R(
          "Moussaf se dit après le Hallel et la lecture de la Torah. On y garde la mention de la saison (morid hatal en été, machiv haroua'h oumorid haguéchem en hiver).",
          "Musaf is said after Hallel and the Torah reading. The seasonal mention is kept in it (morid hatal in summer, mashiv haruach umorid hageshem in winter).",
          "מוסף נאמר אחר ההלל וקריאת התורה, ומזכירים בו את העונה (מוריד הטל בקיץ, משיב הרוח ומוריד הגשם בחורף).",
        ),
        lines: [
          { seg: 2 },
          { seg: 3 },
          { seg: 4 },
          { he: "מוֹרִיד הַטָּל.", rubric: RUBRIC.ete, tight: true },
          { he: "מַשִּׁיב הָרֽוּחַ וּמוֹרִיד הַגֶּֽשֶׁם.", rubric: RUBRIC.hiver, tight: true },
          { seg: 6 },
        ],
      },
      {
        src: "RH.Mussaf",
        when: "rosh-chodesh",
        fold: "hazan",
        labelText: R("Kedoucha de Moussaf (Keter)", "Kedushah of Musaf (Keter)", "כתר (קדושת מוסף)"),
        lines: [
          {
            seg: 7,
            mode: "small",
            rubric: R(
              "Pendant la répétition, la kedoucha « Keter » :",
              "During the repetition, the “Keter” Kedushah:",
              "בחזרה אומרים כתר:",
            ),
          },
        ],
      },
      {
        src: "RH.Mussaf",
        when: "rosh-chodesh",
        plain: true,
        lines: [
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 12 },
          { seg: 13 },
          { seg: 15 },
          { seg: 20 },
          { seg: 34 },
          { seg: 35 },
          { seg: 36 },
          { seg: 38, tight: true },
          { seg: 39 },
        ],
      },
      {
        src: "RH.Barchi Nafshi",
        when: "rosh-chodesh",
        plain: true,
        labelText: R("Barkhi nafchi", "Barchi nafshi", "ברכי נפשי"),
        lines: [{ seg: 2 }],
      },
      {
        src: "Kaveh",
        labelText: R("Kavé · Ein kélohénou", "Kaveh · Ein keloheinu", "קוה · אין כאלהינו"),
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 4 },
          { seg: 5 },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
        ],
      },
      {
        src: "Alenu",
        labelText: R("'Alénou léchabéa'h", "Aleinu", "עלינו לשבח"),
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 3, mode: "small", tight: true },
          { seg: 4, tight: true },
        ],
      },
    ],
  };
}

function minhaRecipe() {
  const amida = amidaBlocks("Amida", {
    avot: 2,
    gevurot: 3,
    mekhalkel: 5,
    kedushaText: 7,
    ataKadosh: 8,
    honen: 9,
    hashivenu: 10,
    selah: 11,
    reeh: 12,
    refaenu: 16,
    barkhenu: 18,
    barekhAlenu: 20,
    teka: 21,
    hashiva: 22,
    laminim: 23,
    tsadikim: 24,
    tishkon: 25,
    tishkonHatima: 28,
    tsemah: 29,
    shemaKolenu: 30,
    kiAta: 33,
    retse: 34,
    yv: 36,
    yvRH: 37,
    yvPessah: 38,
    yvSouccot: 39,
    yvSuite: 40,
    veata: 41,
    modim: 43,
    modimDerabanan: 44,
    alHanissim: 46,
    hanouka: 47,
    pourim: 48,
    vealKoulam: 49,
    simShalom: 63,
    yihyu1: 64,
    elohaiNetsor: 65,
    lemaan: 66,
    yihyu2: 67,
    osse: 70,
    yehiRatson: 71,
  });

  return {
    title: "מנחה של חול (Min'ha)",
    blocks: [
      { zman: "minha" },
      {
        src: "Offerings",
        labelText: R("Korbanot et Achré", "Offerings and Ashrei", "קרבנות ואשרי"),
        lines: [
          { seg: 2 },
          { seg: 3 },
          { seg: 4 },
          { seg: 5 },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
          { seg: 11 },
          { seg: 12 },
          { seg: 13 },
        ],
      },
      kaddishHalf("Kaddish"),
      ...amida,
      avinouMalkenou("Amida", 73, 104),
      {
        src: "Vidui",
        when: "tahanoun-minha",
        plain: true,
        labelText: R("Ta'hanoun", "Tachanun", "תחנון"),
        halakha: HALAKHA.tahanoun,
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 3 },
          { seg: 4 },
          { seg: 6, rubric: RUBRIC.assis },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
        ],
      },
      kaddishTitkabal("Kaddish"),
      {
        src: "Alenu",
        labelText: R("'Alénou léchabéa'h", "Aleinu", "עלינו לשבח"),
        lines: [{ seg: 1 }, { seg: 2 }, { seg: 3, mode: "small", tight: true }],
      },
    ],
  };
}

function arvitRecipe() {
  const amida = amidaBlocks("Amidah", {
    avot: 2,
    gevurot: 3,
    mekhalkel: 5,
    ataKadosh: 6,
    honen: 7,
    ataHonantanu: 9,
    vehonenu: 10,
    hashivenu: 11,
    selah: 12,
    reeh: 13,
    refaenu: 14,
    barkhenu: 16,
    barekhAlenu: 18,
    teka: 19,
    hashiva: 20,
    laminim: 21,
    tsadikim: 22,
    tishkon: 23,
    tsemah: 24,
    shemaKolenu: 25,
    kiAta: 28,
    retse: 29,
    yv: 31,
    yvRH: 32,
    yvPessah: 33,
    yvSouccot: 34,
    yvSuite: 35,
    veata: 36,
    modim: 38,
    alHanissim: 40,
    hanouka: 41,
    pourim: 42,
    vealKoulam: 43,
    simShalom: 44,
    yihyu1: 45,
    elohaiNetsor: 46,
    lemaan: 47,
    yihyu2: 48,
    osse: 49,
    yehiRatson: 50,
  });

  return {
    title: "ערבית של חול (Arvit)",
    blocks: [
      { zman: "arvit" },
      {
        src: "Barchu",
        when: "rosh-chodesh",
        plain: true,
        labelText: R(
          "Veille de Roch Hodech : Barkhi nafchi",
          "Rosh Hodesh eve: Barchi nafshi",
          "ליל ראש חודש : ברכי נפשי",
        ),
        lines: [
          {
            seg: 2,
            mode: "small",
            rubric: R(
              "Le soir de Roch Hodech, certains disent :",
              "On Rosh Hodesh night, some say:",
              "בליל ראש חודש יש הנוהגים לומר:",
            ),
          },
        ],
      },
      {
        src: "Barchu",
        labelText: R("Ouverture", "Opening", "פתיחה"),
        lines: [{ seg: 4 }],
      },
      kaddishHalf("Kaddish"),
      {
        src: "Barchu",
        lines: [
          { seg: 7 },
          { seg: 8, mode: "full", strip: ["ואומר החזן:"], rubric: RUBRIC.hazan },
          { seg: 9, mode: "full", strip: ["ועונים הקהל:"], rubric: RUBRIC.kahal, tight: true },
          { seg: 10, mode: "full", strip: ["ואומר החזן:"], rubric: RUBRIC.hazanReprend, tight: true },
        ],
      },
      {
        src: "The Shema",
        labelText: R("Chéma et ses bénédictions", "The Shema and its blessings", "קריאת שמע וברכותיה"),
        halakha: R(
          "Le Chéma du soir se dit après la sortie des étoiles. On couvre les yeux de la main droite pour le premier verset, dit avec concentration.",
          "The evening Shema is said after nightfall. Cover your eyes with the right hand for the first verse, said with full concentration.",
          "קריאת שמע של ערבית נאמרת אחר צאת הכוכבים. יכסה עיניו ביד ימין בפסוק הראשון, ויאמרנו בכוונה.",
        ),
        lines: [
          { seg: 1 },
          { seg: 2 },
          { seg: 4, strong: true },
          { seg: 5, mode: "small", strip: [STRIP.bassevoix], rubric: RUBRIC.bassevoix, tight: true },
          { seg: 6 },
          { seg: 7 },
          { seg: 8 },
          { seg: 9 },
          { seg: 10 },
        ],
      },
      ...amida,
      {
        src: "Amidah",
        when: "jour-0",
        plain: true,
        labelText: R("À la sortie de Chabbat", "At the close of Shabbat", "מוצאי שבת"),
        lines: [
          { seg: 56, mode: "small", muted: true, rubric: RUBRIC.certains },
          { seg: 57, mode: "small" },
          { seg: 58, mode: "small" },
          { seg: 59, mode: "small" },
          { seg: 60, mode: "small" },
        ],
      },
      kaddishTitkabal("Kaddish"),
      {
        src: "Amidah",
        labelText: R("Fin de l'office", "Closing", "סיום"),
        lines: [{ seg: 51 }, { seg: 66 }],
      },
      {
        src: "Alenu",
        labelText: R("'Alénou léchabéa'h", "Aleinu", "עלינו לשבח"),
        lines: [{ seg: 1 }, { seg: 2 }, { seg: 3, mode: "small", tight: true }],
      },
    ],
  };
}

// ---------- Construction ----------

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

console.log("Téléchargement du Siddur Edot HaMizrach (export Sefaria)…");
const merged = await fetchJson(SOURCE_URL);
const text = merged.text;

/** Les sections sources d'un office, aplaties par la recette (clé `src`). */
function sourcesFor(office) {
  const ws = text["Weekday Shacharit"];
  const rh = text["Rosh Hodesh"];
  const pp = text["Preparatory Prayers"];
  if (office === "chaharit") {
    return {
      "PP.Modeh Ani": pp["Modeh Ani"],
      "PP.Morning Blessings": pp["Morning Blessings"],
      "PP.Torah Blessings": pp["Torah Blessings"],
      "Morning Prayer": ws["Morning Prayer"],
      "Incense Offering": ws["Incense Offering"],
      Hodu: ws["Hodu"],
      "Pesukei D'Zimra": ws["Pesukei D'Zimra"],
      "The Shema": ws["The Shema"],
      Amida: ws["Amida"],
      Vidui: ws["Vidui"],
      "Torah Reading": ws["Torah Reading"],
      Ashrei: ws["Ashrei"],
      "Uva LeSion": ws["Uva LeSion"],
      "Beit Yaakov": ws["Beit Yaakov"],
      "Song of the Day": ws["Song of the Day"],
      Kaveh: ws["Kaveh"],
      Alenu: ws["Alenu"],
      "RH.Hallel": rh["Hallel"],
      "RH.Mussaf": rh["Mussaf"],
      "RH.Barchi Nafshi": rh["Barchi Nafshi"],
    };
  }
  // Le Kaddich (segments 4 à 7 de « Uva LeSion ») est le même aux trois
  // offices : Min'ha et Arvit le reçoivent de Cha'harit.
  if (office === "minha") {
    const wm = text["Weekday Mincha"];
    return {
      Offerings: wm["Offerings"],
      Amida: wm["Amida"],
      Vidui: wm["Vidui"],
      Alenu: wm["Alenu"],
      Kaddish: ws["Uva LeSion"],
    };
  }
  const wa = text["Weekday Arvit"];
  return {
    Barchu: wa["Barchu"],
    "The Shema": wa["The Shema"],
    Amidah: wa["Amidah"],
    Alenu: wa["Alenu"],
    Kaddish: ws["Uva LeSion"],
  };
}

const RECIPES = {
  chaharit: chaharitRecipe(),
  minha: minhaRecipe(),
  arvit: arvitRecipe(),
};

for (const [name, recipe] of Object.entries(RECIPES)) {
  const sections = sourcesFor(name);
  const blocks = recipe.blocks.map((spec) => buildBlock(spec, sections));
  const out = { title: recipe.title, blocks };
  const path = resolve(OUT, `${name}.json`);
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  const lineCount = blocks.reduce((sum, b) => sum + (b.lines?.length ?? 0), 0);
  console.log(`  ${name}.json : ${blocks.length} blocs, ${lineCount} paragraphes`);
}
console.log("Terminé.");
