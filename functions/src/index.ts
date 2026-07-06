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
import { renderOgPng, type OgCardOptions } from "./ogCard";

initializeApp();
const db = getFirestore();

// Cap concurrency to keep costs bounded; previews are tiny and cached.
setGlobalOptions({ maxInstances: 3 });

// Rappel quotidien de lecture (push FCM vers l'app mobile).
export { dailyReadingReminder } from "./dailyReminder";

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
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`);
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
    `<h1>${escapeAttr(meta.title.split(" | ")[0].split(" – ")[0])}</h1>` +
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
  html = html.replace(/(<div id="app">)(<\/div>)/, (_m, open, close) => `${open}${bodyFor(meta)}${close}`);
  return html;
}

// ---- SPA shell (fetched once, cached in the warm instance) ----

let shellCache: { html: string; ts: number } | null = null;
const SHELL_TTL = 10 * 60 * 1000;

async function getShell(): Promise<string> {
  if (shellCache && Date.now() - shellCache.ts < SHELL_TTL) {
    return shellCache.html;
  }
  // Fetch the bare SPA shell ("/app" → app.html, an empty `<div id="app"></div>`)
  // rather than "/", because "/" now ships prerendered homepage body content that
  // would otherwise leak into every dynamic preview. app.html carries the
  // up-to-date asset hashes and is served statically (not routed to this function).
  const res = await fetch(`${SITE_URL}/app`, {
    headers: { "User-Agent": "PetiteJerusalem-SocialPreview" },
  });
  const html = await res.text();
  shellCache = { html, ts: Date.now() };
  return html;
}

// ---- Chiourim (Firestore, cached) ----

type ChiourPreview = {
  name: string;
  property_description: string;
  property_auteur: string | null;
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
  const data: ChiourPreview[] = snap.docs.map((d) => {
    const x = d.data();
    return {
      name: (x.name as string) ?? "",
      property_description: (x.description as string) ?? "",
      property_auteur: (x.auteur as string | null) ?? null,
    };
  });
  chiourimCache = { data, ts: Date.now() };
  return data;
}

// ---- Metadata resolution per route ----

type SessionDoc = { name?: string; description?: string; type?: string };

/** Fetch a session by slug (then by document id), like the client does. */
async function fetchSession(slug: string): Promise<SessionDoc | null> {
  const bySlug = await db.collection("sessions").where("slug", "==", slug).limit(1).get();
  const docSnap = bySlug.empty ? await db.collection("sessions").doc(slug).get() : bySlug.docs[0];
  if (!docSnap || !docSnap.exists) return null;
  const data = docSnap.data() as SessionDoc | undefined;
  return data?.name ? data : null;
}

async function resolveSessionMeta(slug: string): Promise<Meta | null> {
  const data = await fetchSession(slug);
  if (!data?.name) return null;

  const description = data.description
    ? clamp(data.description)
    : "Rejoignez cette session de partage de lecture et d'étude de Torah sur Petite Jérusalem.";

  return {
    title: `${data.name} | Session de partage de lecture – Petite Jérusalem`,
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
  const chiourim = await getChiourim();
  const found = chiourim.find((c) => chiourSlug(c.name) === slug);
  if (!found) return null;

  const description = found.property_description
    ? clamp(found.property_description)
    : "Écoutez ce chiour : cours et leçons de Torah sur Petite Jérusalem.";

  const author = found.property_auteur ? ` par ${found.property_auteur}` : "";

  return {
    title: `${found.name}${author} | Chiour – Petite Jérusalem`,
    description,
    url: `${SITE_URL}/chiourim/${slug}`,
    type: "article",
  };
}

async function resolveAuteurMeta(slug: string): Promise<Meta | null> {
  const chiourim = await getChiourim();
  const author = chiourim
    .map((c) => c.property_auteur)
    .find((a): a is string => !!a && chiourSlug(a) === slug);
  if (!author) return null;

  const count = chiourim.filter((c) => c.property_auteur === author).length;

  return {
    title: `${author} | Chiourim – Petite Jérusalem`,
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

export const socialPreview = onRequest(async (req, res) => {
  const shell = await getShell();

  let meta: Meta | null = null;
  try {
    meta = await resolveMeta(req.path);
  } catch (err) {
    // On any data error, fall back to the default shell rather than 500.
    console.error("[socialPreview] resolveMeta failed:", err);
  }

  const html = injectMeta(shell, meta ?? {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: `${SITE_URL}${req.path}`,
  });

  // Safe to cache on the CDN: the response depends only on the URL.
  res.set("Cache-Control", "public, max-age=300, s-maxage=600");
  res.set("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
});

/**
 * Per-session Open Graph image. Wired in firebase.json for /og/session/**.
 * Returns a 1200×630 PNG with the session name + label; on any error (unknown
 * session, render failure) it redirects to the static og-image.jpg so shared
 * links never end up without a preview.
 */
export const ogImage = onRequest(async (req, res) => {
  try {
    const last = req.path.split("/").filter(Boolean).pop() ?? "";
    const slug = decodeURIComponent(last).replace(/\.png$/i, "");
    const card = slug ? await resolveSessionCard(slug) : null;

    if (!card) {
      res.redirect(302, OG_IMAGE);
      return;
    }

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
