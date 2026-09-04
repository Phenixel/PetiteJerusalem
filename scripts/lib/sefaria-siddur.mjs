/**
 * Les outils partagés par les scripts qui construisent les textes de tefila à
 * partir de l'export public du Siddur Edot HaMizrach (Sefaria, GCS) : le
 * nettoyage des balises, la lecture des consignes que la source met en
 * <small>, et le découpage d'un segment entre deux repères hébreux.
 *
 * Deux scripts s'en servent : build-sidour.mjs (Cha'harit, Min'ha, Arvit) et
 * build-brahot.mjs (les bénédictions et les rites qui les entourent).
 *
 * Licence des textes : l'export Sefaria « merged » combine des sources du
 * domaine public.
 */

export const SOURCE_URL =
  "https://storage.googleapis.com/sefaria-export/json/Liturgy/Siddur/Siddur%20Edot%20HaMizrach/Hebrew/merged.json";

/** Le siddour source, tel que l'export le sert. */
export async function fetchSiddur() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${SOURCE_URL}`);
  const merged = await res.json();
  return merged.text;
}

// ---------- Nettoyage ----------

/** Balises et entités retirées, tirets longs bannis du dépôt remplacés. */
export function cleanFinal(s) {
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
export function dropSmalls(s) {
  let prev;
  do {
    prev = s;
    s = s.replace(/<small>(?:(?!<\/?small>)[\s\S])*<\/small>/g, " ");
  } while (s !== prev);
  return s;
}

/** Contenu des <small> de premier niveau, balises internes conservées. */
export function outerSmalls(s) {
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
export function segText(raw, mode = "body") {
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
export const HEBREW_MARKS = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4-\u05C7]/;

/**
 * Le texte débarrassé de ses signes, et la table qui ramène chaque caractère
 * restant à sa place dans l'original : c'est ainsi qu'on cherche un repère
 * sans dépendre de la vocalisation de l'édition.
 */
export function bareMap(text) {
  const map = [];
  let bare = "";
  for (let i = 0; i < text.length; i++) {
    if (HEBREW_MARKS.test(text[i])) continue;
    map.push(i);
    bare += text[i];
  }
  return { map, bare };
}

export const stripMarks = (marker) => marker.replace(new RegExp(HEBREW_MARKS, "g"), "");

/**
 * Coupe `text` juste après `marker` : ce qui précède, ce qui suit. Les signes
 * qui suivent la dernière lettre du repère (voyelle, ta'am) restent avec lui.
 */
export function splitAfter(text, marker) {
  const { map, bare } = bareMap(text);
  const cible = stripMarks(marker);
  const j = bare.indexOf(cible);
  if (j < 0) throw new Error(`Repère introuvable : ${marker}`);
  const fin = j + cible.length < map.length ? map[j + cible.length] : text.length;
  return [text.slice(0, fin).trim(), text.slice(fin).trim()];
}

/**
 * Découpe `text` entre deux repères (`from` inclus, `until` exclu), cherchés
 * sans signes. Un repère absent fait échouer la construction : mieux vaut pas
 * de fichier qu'un passage amputé en silence.
 */
export function sliceBetween(text, { from, until }) {
  const { map, bare } = bareMap(text);
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
