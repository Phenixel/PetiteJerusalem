import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const BASE_URL = "https://petite-jerusalem.fr";

// User-agents known to not execute JavaScript (link preview bots)
const BOT_UA_PATTERNS = [
  "discordbot",
  "twitterbot",
  "facebot",
  "facebookexternalhit",
  "slackbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "googlebot",
  "bingbot",
  "applebot",
  "embedly",
  "ia_archiver",
  "pinterest",
  "vkshare",
  "w3c_validator",
];

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => lower.includes(p));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const ogRenderer = onRequest(
  { region: "europe-west1" },
  async (req, res) => {
    const match = req.path.match(/^\/share-reading\/session\/(.+?)(?:\/)?$/);
    if (!match) {
      res.redirect(302, BASE_URL);
      return;
    }

    const slug = match[1];
    const ua = req.headers["user-agent"] || "";
    const sessionUrl = `${BASE_URL}/share-reading/session/${slug}`;

    // Fetch session from Firestore
    let session: admin.firestore.DocumentData | null = null;
    try {
      const snap = await db
        .collection("sessions")
        .where("slug", "==", slug)
        .limit(1)
        .get();
      if (!snap.empty) {
        session = snap.docs[0].data();
      }
    } catch (e) {
      console.error("Firestore error:", e);
    }

    const title = session
      ? `${session.name} | Petite Jerusalem`
      : "Petite Jerusalem | Étude et Partage de Textes";
    const description =
      session?.description ||
      "Partage de lectures, sessions collaboratives et ressources d'étude pour la communauté juive francophone.";

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");

    if (isBot(ua)) {
      // Bots don't execute JS — return minimal HTML with correct OG tags
      res.send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Petite Jerusalem" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(sessionUrl)}" />
  <meta property="og:image" content="${BASE_URL}/favicon.png" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${BASE_URL}/favicon.png" />
</head>
<body></body>
</html>`);
      return;
    }

    // For humans: fetch the real index.html (static file, not intercepted by rewrite)
    // and inject dynamic OG tags so the page is correct even before Vue hydrates
    try {
      const indexRes = await fetch(`${BASE_URL}/index.html`);
      let html = await indexRes.text();

      // Replace static OG meta tags with dynamic ones
      html = html
        .replace(
          /(<title>)[^<]*(<\/title>)/,
          `$1${escapeHtml(title)}$2`
        )
        .replace(
          /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
          `$1${escapeHtml(title)}$2`
        )
        .replace(
          /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
          `$1${escapeHtml(description)}$2`
        )
        .replace(
          /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
          `$1${escapeHtml(sessionUrl)}$2`
        )
        .replace(
          /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
          `$1${escapeHtml(title)}$2`
        )
        .replace(
          /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
          `$1${escapeHtml(description)}$2`
        )
        .replace(
          /(<meta\s+name="description"\s+content=")[^"]*(")/,
          `$1${escapeHtml(description)}$2`
        );

      res.send(html);
    } catch (e) {
      console.error("Failed to fetch index.html:", e);
      // Fallback: serve a redirect page
      res.send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(sessionUrl)}" />
  <meta property="og:image" content="${BASE_URL}/favicon.png" />
</head>
<body></body>
</html>`);
    }
  }
);
