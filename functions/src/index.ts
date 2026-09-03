/**
 * Social sharing previews for dynamic pages.
 *
 * The site is a Vue SPA: social crawlers (WhatsApp, Facebook, X, LinkedIn…)
 * don't run JavaScript, so a shared link to a specific session or chiour shows
 * a generic preview. Static pages are handled at build time by
 * `scripts/prerender-seo.mjs`, but dynamic pages depend on data only known at
 * runtime (Firestore sessions, the chiourim webhook).
 *
 * This HTTP function is wired in `firebase.json` for the dynamic routes. For
 * every request it fetches the SPA shell once (cached), resolves the page data,
 * and injects page-specific <title> / description / Open Graph / Twitter tags.
 * The response depends only on the URL, so it is safe to cache on the CDN, and
 * the SPA still boots normally for human visitors.
 */
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { OgCardOptions } from "./ogCard";

initializeApp();
const db = getFirestore();

// Cap concurrency to keep costs bounded; previews are tiny and cached.
setGlobalOptions({ maxInstances: 3 });

// Rappel quotidien de lecture (push FCM vers l'app mobile).
export { dailyReadingReminder } from "./dailyReminder";
// Notification de test à la demande (bouton dans les réglages de l'app).
export { sendTestNotification } from "./testNotification";
// Studio auteurs : dépôt de chiourim via lien secret (/studio/:token).
export {
  studioSubmitChiour,
  studioUpdateChiour,
  studioDeleteChiour,
  studioCreateSerie,
  studioReorderSerie,
} from "./studio";
// Modération : compteur de signalements + masquage auto au 3e signalement.
export { onSessionReported } from "./moderation";

const SITE_URL = "https://petite-jerusalem.fr";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

const DEFAULT_TITLE = "Petite Jérusalem | Partage de lectures et d'études de Torah";
const DEFAULT_DESCRIPTION =
  "Créez et rejoignez des sessions de partage de lectures et d'études de Torah. Réservez des textes, étudiez à plusieurs et suivez votre progression.";

type Meta = {
  title: string;
  description: string;
  url: string;
  type?: string;
  /** Overrides the default OG/Twitter image (e.g. a per-session card). */
  image?: string;
};

/** Escape a value so it is safe inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Trim a description to a clean length for previews. */
function clamp(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function setTitle(html: string, title: string): string {
  // Fonction de remplacement, pas une chaîne : `$'`, `$&` ou `$1` dans un nom
  // de session seraient interprétés par String.replace (un titre « $' »
  // recopiait tout le HTML qui suit dans la balise).
  return html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeAttr(title)}</title>`);
}

function setMeta(html: string, attr: "name" | "property", value: string, content: string): string {
  const re = new RegExp(
    `(<meta\\b[^>]*\\b${attr}="${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*\\bcontent=")[\\s\\S]*?(")`,
  );
  return html.replace(re, (_m, p1, p2) => `${p1}${escapeAttr(content)}${p2}`);
}

function setCanonical(html: string, href: string): string {
  return html.replace(
    /(<link\b[^>]*rel="canonical"[^>]*href=")[^"]*(")/,
    (_m, p1, p2) => `${p1}${escapeAttr(href)}${p2}`,
  );
}

/** Build a small crawlable body so non-JS bots see real content, not an empty SPA shell. */
function bodyFor(meta: Meta): string {
  return (
    `<main class="seo-article">` +
    `<h1>${escapeAttr(meta.title.split(" | ")[0])}</h1>` +
    `<p>${escapeAttr(meta.description)}</p>` +
    `<p><a href="${escapeAttr(meta.url)}">Voir sur Petite Jérusalem</a></p>` +
    `</main>`
  );
}

/** Inject page-specific metadata + crawlable body into the (empty) SPA shell. */
function injectMeta(shell: string, meta: Meta): string {
  let html = shell;
  const image = meta.image ?? OG_IMAGE;
  html = setTitle(html, meta.title);
  html = setMeta(html, "name", "description", meta.description);
  html = setMeta(html, "property", "og:title", meta.title);
  html = setMeta(html, "property", "og:description", meta.description);
  html = setMeta(html, "property", "og:url", meta.url);
  html = setMeta(html, "property", "og:type", meta.type ?? "website");
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "name", "twitter:title", meta.title);
  html = setMeta(html, "name", "twitter:description", meta.description);
  html = setMeta(html, "name", "twitter:image", image);
  // Per-session cards are 1200×630; keep the dimensions in sync with the image.
  if (meta.image) {
    html = setMeta(html, "property", "og:image:width", "1200");
    html = setMeta(html, "property", "og:image:height", "630");
  }
  html = setCanonical(html, meta.url);
  // The shell ships an empty `<div id="app"></div>`; fill it. Vue clears and
  // re-renders #app on mount, so human visitors are unaffected.
  html = html.replace(
    /(<div id="app">)(<\/div>)/,
    (_m, open, close) => `${open}${bodyFor(meta)}${close}`,
  );
  return html;
}

// ---- SPA shell (fetched once, cached in the warm instance) ----

let shellCache: { html: string; ts: number } | null = null;
const SHELL_TTL = 10 * 60 * 1000;

async function getShell(): Promise<string | null> {
  if (shellCache && Date.now() - shellCache.ts < SHELL_TTL) {
    return shellCache.html;
  }
  // Fetch the bare SPA shell ("/app" → app.html, an empty `<div id="app"></div>`)
  // rather than "/", because "/" now ships prerendered homepage body content that
  // would otherwise leak into every dynamic preview. app.html carries the
  // up-to-date asset hashes and is served statically (not routed to this function).
  try {
    // Délai borné : sans lui, un visiteur humain attendrait le timeout de la
    // fonction entière avant la redirection de secours vers le shell.
    const res = await fetch(`${SITE_URL}/app`, {
      headers: { "User-Agent": "PetiteJerusalem-SocialPreview" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`shell fetch: HTTP ${res.status}`);
    const html = await res.text();
    shellCache = { html, ts: Date.now() };
    return html;
  } catch (err) {
    // Origin injoignable : un shell périmé (vieux hashes d'assets) vaut mieux
    // qu'une 500 sur une page visitée par des humains ; sans aucun cache, le
    // caller redirige vers le shell statique.
    console.error("[socialPreview] shell fetch failed:", err);
    return shellCache?.html ?? null;
  }
}

// ---- Chiourim (Firestore, cached) ----

type ChiourPreview = {
  name: string;
  description: string;
  auteur: string | null;
};

let chiourimCache: { data: ChiourPreview[]; ts: number } | null = null;
const CHIOURIM_TTL = 10 * 60 * 1000;

function chiourSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/'"""''`?#]/g, "");
}

async function getChiourim(): Promise<ChiourPreview[]> {
  if (chiourimCache && Date.now() - chiourimCache.ts < CHIOURIM_TTL) {
    return chiourimCache.data;
  }
  const snap = await db.collection("chiourim").get();
  const data: ChiourPreview[] = snap.docs
    // Brouillons exclus : pas d'aperçu social pour un chiour non publié.
    .filter((d) => d.data().published !== false)
    .map((d) => {
      const x = d.data();
      return {
        name: (x.name as string) ?? "",
        description: (x.description as string) ?? "",
        auteur: (x.auteur as string | null) ?? null,
      };
    });
  chiourimCache = { data, ts: Date.now() };
  return data;
}

// ---- Metadata resolution per route ----

type SessionDoc = { name?: string; description?: string; type?: string; hidden?: boolean };

/** Fetch a session by slug (then by document id), like the client does. */
async function fetchSession(slug: string): Promise<SessionDoc | null> {
  const bySlug = await db.collection("sessions").where("slug", "==", slug).limit(1).get();
  const docSnap = bySlug.empty ? await db.collection("sessions").doc(slug).get() : bySlug.docs[0];
  if (!docSnap || !docSnap.exists) return null;
  const data = docSnap.data() as SessionDoc | undefined;
  // Session masquée par la modération : pas d'aperçu social ni de carte OG.
  if (data?.hidden === true) return null;
  return data?.name ? data : null;
}

async function resolveSessionMeta(slug: string): Promise<Meta | null> {
  const data = await fetchSession(slug);
  if (!data?.name) return null;

  const description = data.description
    ? clamp(data.description)
    : "Rejoignez cette session de partage de lecture et d'étude de Torah sur Petite Jérusalem.";

  return {
    title: `${data.name} | Session de partage de lecture | Petite Jérusalem`,
    description,
    url: `${SITE_URL}/share-reading/session/${slug}`,
    type: "article",
    // Per-session Open Graph card (intention + name), generated by `ogImage`.
    image: `${SITE_URL}/og/session/${encodeURIComponent(slug)}.png`,
  };
}

/** Build the OG card options (label + title) for a session. */
async function resolveSessionCard(slug: string): Promise<OgCardOptions | null> {
  const data = await fetchSession(slug);
  if (!data?.name) return null;
  return {
    title: data.name,
    label: data.type === "Tehilim" ? "Chaîne de Tehilim" : "Partage d'étude",
    tagline: "petite-jerusalem.fr · Rejoignez le partage",
  };
}

async function resolveChiourMeta(slug: string): Promise<Meta | null> {
  // L'id du document EST le slug (comme côté client) : un seul doc suffit dans
  // le cas courant. Le scan du catalogue ne reste qu'en filet de sécurité pour
  // d'éventuels documents hérités dont l'id ne suit pas cette convention.
  let found: ChiourPreview | null = null;
  const direct = await db.collection("chiourim").doc(slug).get();
  const directData = direct.exists ? direct.data() : undefined;
  if (directData && directData.published !== false && directData.name) {
    found = {
      name: (directData.name as string) ?? "",
      description: (directData.description as string) ?? "",
      auteur: (directData.auteur as string | null) ?? null,
    };
  } else {
    const chiourim = await getChiourim();
    found = chiourim.find((c) => chiourSlug(c.name) === slug) ?? null;
  }
  if (!found) return null;

  const description = found.description
    ? clamp(found.description)
    : "Écoutez ce chiour : cours et leçons de Torah sur Petite Jérusalem.";

  const author = found.auteur ? ` par ${found.auteur}` : "";

  return {
    title: `${found.name}${author} | Chiour | Petite Jérusalem`,
    description,
    url: `${SITE_URL}/chiourim/${slug}`,
    type: "article",
  };
}

async function resolveAuteurMeta(slug: string): Promise<Meta | null> {
  const chiourim = await getChiourim();
  const author = chiourim
    .map((c) => c.auteur)
    .find((a): a is string => !!a && chiourSlug(a) === slug);
  if (!author) return null;

  const count = chiourim.filter((c) => c.auteur === author).length;

  return {
    title: `${author} | Chiourim | Petite Jérusalem`,
    description: `Tous les chiourim de ${author} sur Petite Jérusalem : ${count} cours et leçons de Torah à écouter.`,
    url: `${SITE_URL}/chiourim/auteur/${slug}`,
    type: "website",
  };
}

async function resolveMeta(pathname: string): Promise<Meta | null> {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);

  // /share-reading/session/:slug
  if (segments[0] === "share-reading" && segments[1] === "session" && segments[2]) {
    return resolveSessionMeta(segments[2]);
  }

  // /chiourim/auteur/:slug
  if (segments[0] === "chiourim" && segments[1] === "auteur" && segments[2]) {
    return resolveAuteurMeta(segments[2]);
  }

  // /chiourim/:slug
  if (segments[0] === "chiourim" && segments[1]) {
    return resolveChiourMeta(segments[1]);
  }

  return null;
}

// Ces deux routes servent aussi les visiteurs humains (liens partagés) : leur
// concurrence est dimensionnée à part du plafond global de 3 instances, pour
// qu'un lien qui circule (diffusion WhatsApp) ne mette pas les visiteurs en
// file d'attente derrière les callables studio et le rappel quotidien.
export const socialPreview = onRequest({ maxInstances: 10 }, async (req, res) => {
  const shell = await getShell();
  if (!shell) {
    // Origine injoignable et aucun shell en cache : on renvoie le visiteur
    // vers le shell statique plutôt que d'échouer.
    res.set("Cache-Control", "no-store");
    res.redirect(302, `${SITE_URL}/app`);
    return;
  }

  let meta: Meta | null = null;
  try {
    meta = await resolveMeta(req.path);
  } catch (err) {
    // On any data error, fall back to the default shell rather than 500.
    console.error("[socialPreview] resolveMeta failed:", err);
  }

  const html = injectMeta(
    shell,
    meta ?? {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: `${SITE_URL}${req.path}`,
    },
  );

  // Le CDN absorbe le trafic (la réponse ne dépend que de l'URL) mais le
  // navigateur revalide à chaque visite : ce HTML référence des chunks hashés,
  // le laisser vieillir en cache navigateur recréerait des pages cassées
  // après chaque déploiement (même politique que le no-cache du hosting).
  res.set("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  res.set("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
});

/**
 * Per-session Open Graph image. Wired in firebase.json for /og/session/**.
 * Returns a 1200×630 PNG with the session name + label; on any error (unknown
 * session, render failure) it redirects to the static og-image.jpg so shared
 * links never end up without a preview.
 */
export const ogImage = onRequest({ maxInstances: 5 }, async (req, res) => {
  try {
    const last = req.path.split("/").filter(Boolean).pop() ?? "";
    const slug = decodeURIComponent(last).replace(/\.png$/i, "");
    const card = slug ? await resolveSessionCard(slug) : null;

    if (!card) {
      res.redirect(302, OG_IMAGE);
      return;
    }

    // Import différé : le binaire natif resvg (et 1,3 Mo de polices) ne se
    // charge qu'ici, pas au démarrage à froid des callables, du trigger de
    // modération et du rappel planifié, qui partagent ce codebase.
    const { renderOgPng } = await import("./ogCard");
    const png = renderOgPng(card);
    // Depends only on the session content; cache hard on the CDN.
    res.set("Cache-Control", "public, max-age=600, s-maxage=86400");
    res.set("Content-Type", "image/png");
    res.status(200).send(png);
  } catch (err) {
    console.error("[ogImage] failed:", err);
    res.redirect(302, OG_IMAGE);
  }
});
