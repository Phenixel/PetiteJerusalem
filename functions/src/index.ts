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
 * The response depends only on the URL, so it is safe to cache on the CDN — and
 * the SPA still boots normally for human visitors.
 */
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

// Cap concurrency to keep costs bounded; previews are tiny and cached.
setGlobalOptions({ maxInstances: 3 });

const SITE_URL = "https://petite-jerusalem.web.app";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;
const CHIOURIM_WEBHOOK =
  "https://n8n.phenixel.fr/webhook/1e7e1be1-1f2c-4916-a6f6-34ff8f437ef6";

const DEFAULT_TITLE = "Petite Jérusalem | Partage de lectures et d'études de Torah";
const DEFAULT_DESCRIPTION =
  "Créez et rejoignez des sessions de partage de lectures et d'études de Torah. Réservez des textes, étudiez à plusieurs et suivez votre progression.";

type Meta = {
  title: string;
  description: string;
  url: string;
  type?: string;
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

/** Inject page-specific metadata into the SPA shell. */
function injectMeta(shell: string, meta: Meta): string {
  let html = shell;
  html = setTitle(html, meta.title);
  html = setMeta(html, "name", "description", meta.description);
  html = setMeta(html, "property", "og:title", meta.title);
  html = setMeta(html, "property", "og:description", meta.description);
  html = setMeta(html, "property", "og:url", meta.url);
  html = setMeta(html, "property", "og:type", meta.type ?? "website");
  html = setMeta(html, "property", "og:image", OG_IMAGE);
  html = setMeta(html, "name", "twitter:title", meta.title);
  html = setMeta(html, "name", "twitter:description", meta.description);
  html = setMeta(html, "name", "twitter:image", OG_IMAGE);
  html = setCanonical(html, meta.url);
  return html;
}

// ---- SPA shell (fetched once, cached in the warm instance) ----

let shellCache: { html: string; ts: number } | null = null;
const SHELL_TTL = 10 * 60 * 1000;

async function getShell(): Promise<string> {
  if (shellCache && Date.now() - shellCache.ts < SHELL_TTL) {
    return shellCache.html;
  }
  // The root "/" is served statically (not routed to this function), so this
  // fetch returns the current built index.html with up-to-date asset hashes.
  const res = await fetch(`${SITE_URL}/`, {
    headers: { "User-Agent": "PetiteJerusalem-SocialPreview" },
  });
  const html = await res.text();
  shellCache = { html, ts: Date.now() };
  return html;
}

// ---- Chiourim (external webhook, cached) ----

type WebhookChiour = {
  name: string;
  property_description: string;
  property_auteur: string | null;
};

let chiourimCache: { data: WebhookChiour[]; ts: number } | null = null;
const CHIOURIM_TTL = 10 * 60 * 1000;

function chiourSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/'"""''`?#]/g, "");
}

async function getChiourim(): Promise<WebhookChiour[]> {
  if (chiourimCache && Date.now() - chiourimCache.ts < CHIOURIM_TTL) {
    return chiourimCache.data;
  }
  const res = await fetch(CHIOURIM_WEBHOOK);
  if (!res.ok) throw new Error(`Chiourim webhook failed: ${res.status}`);
  const data = (await res.json()) as WebhookChiour[];
  chiourimCache = { data, ts: Date.now() };
  return data;
}

// ---- Metadata resolution per route ----

async function resolveSessionMeta(slug: string): Promise<Meta | null> {
  // Match the client: try the slug field first, then the document id.
  const bySlug = await db.collection("sessions").where("slug", "==", slug).limit(1).get();
  const docSnap = bySlug.empty ? await db.collection("sessions").doc(slug).get() : bySlug.docs[0];
  if (!docSnap || !docSnap.exists) return null;

  const data = docSnap.data() as { name?: string; description?: string } | undefined;
  if (!data?.name) return null;

  const description = data.description
    ? clamp(data.description)
    : "Rejoignez cette session de partage de lecture et d'étude de Torah sur Petite Jérusalem.";

  return {
    title: `${data.name} | Session de partage de lecture – Petite Jérusalem`,
    description,
    url: `${SITE_URL}/share-reading/session/${slug}`,
    type: "article",
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
