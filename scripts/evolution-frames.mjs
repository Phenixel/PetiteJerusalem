#!/usr/bin/env node
/**
 * Rejoue chaque version publiée du site et capture sa page d'accueil, pour
 * le diaporama de docs/evolution.
 *
 * Pour chaque tag listé dans docs/evolution/versions.json : un worktree git
 * détaché, `npm ci`, `vite build`, un petit serveur statique sur le dist, et
 * deux captures en visiteur (1280×800 et 390×844), converties en WebP.
 *
 * Usage :
 *   node scripts/evolution-frames.mjs                toutes les versions
 *   node scripts/evolution-frames.mjs v3.8.2 v3.9.0  seulement celles-ci
 *   node scripts/evolution-frames.mjs --force        refait aussi les builds
 *                                                    déjà en cache
 *   PJ_CHROMIUM=/chemin/chrome node scripts/evolution-frames.mjs
 *       utilise ce Chromium plutôt que celui de Playwright
 *   node scripts/evolution-frames.mjs --assets-locaux
 *       sert les polices Google, Bootstrap et Font Awesome depuis
 *       node_modules au lieu des CDN. Nécessaire sur une machine sans accès
 *       aux CDN (c'est le cas de l'environnement qui a produit les images du
 *       dépôt), sinon les captures perdraient les polices du site :
 *         npm i --no-save bootstrap @fortawesome/fontawesome-free \
 *           @fontsource/{inter,lora,nunito,heebo,roboto,david-libre} \
 *           @fontsource/{frank-ruhl-libre,noto-serif-hebrew}
 *
 * La v1.0 n'est pas dans la liste : c'était une application Django, elle se
 * rejoue autrement (voir docs/evolution/README.md).
 */
import { execFileSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const racine = join(import.meta.dirname, "..");
const dossier = join(racine, "docs/evolution");
const frames = join(dossier, "frames");
// Sous node_modules : les outils du dépôt (vitest, eslint, git) l'ignorent
// déjà, et le cache survit à tout sauf à une réinstallation des dépendances.
const travail = join(racine, "node_modules/.cache/evolution");
const cacheDist = join(travail, "dist");
const worktree = join(travail, "worktree");
const PORT = 5399;

const args = process.argv.slice(2);
const force = args.includes("--force");
const assetsLocaux = args.includes("--assets-locaux");
const demandes = args.filter((a) => !a.startsWith("--"));

const versions = JSON.parse(readFileSync(join(dossier, "versions.json"), "utf8"))
  .filter((v) => v.tag)
  .filter((v) => demandes.length === 0 || demandes.includes(v.tag));

const git = (...a) => execFileSync("git", a, { cwd: racine, stdio: "pipe" }).toString();
const npm = (a, cwd) => execFileSync("npm", a, { cwd, stdio: "pipe" });

// Capture en haute densité, puis réduction : le texte reste net sans que les
// images pèsent des mégaoctets dans le dépôt.
const VUES = [
  { nom: "desktop", viewport: { width: 1280, height: 800 }, dsf: 2, mobile: false, largeur: 1440 },
  { nom: "mobile", viewport: { width: 390, height: 844 }, dsf: 3, mobile: true, largeur: 585 },
];

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
  ".mp3": "audio/mpeg",
  ".avif": "image/avif",
};

/** Sert un dist avec repli SPA, le temps des captures. */
function servir(dist) {
  const serveur = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let fichier = join(dist, normalize(url).replace(/^(\.\.[/\\])+/, ""));
    if (!existsSync(fichier) || !extname(fichier) || statSync(fichier).isDirectory()) {
      fichier = join(dist, "index.html");
    }
    if (!existsSync(fichier)) return res.writeHead(404).end("introuvable");
    res.writeHead(200, { "content-type": TYPES[extname(fichier)] ?? "application/octet-stream" });
    createReadStream(fichier).pipe(res);
  });
  serveur.listen(PORT);
  return serveur;
}

/**
 * Polices et feuilles de style que les index.html vont chercher sur des CDN,
 * rejouées depuis node_modules quand ils ne sont pas joignables.
 */
function assetsHorsLigne() {
  const modules = join(racine, "node_modules");
  const familles = {
    Inter: "inter",
    "Frank Ruhl Libre": "frank-ruhl-libre",
    "Noto Serif Hebrew": "noto-serif-hebrew",
    Lora: "lora",
    Nunito: "nunito",
    "David Libre": "david-libre",
    Heebo: "heebo",
    Roboto: "roboto",
  };
  const sousEnsembles = ["latin", "latin-ext", "hebrew"];
  const hote = "https://fonts.gstatic.com/pj-local/";
  const fichiers = new Map();
  let css = "";
  for (const [famille, paquet] of Object.entries(familles)) {
    const dir = join(modules, "@fontsource", paquet, "files");
    if (!existsSync(dir)) continue;
    for (const fichier of readdirSync(dir)) {
      const m = fichier.match(/^(.+)-([a-z-]+)-(\d{3})-normal\.woff2$/);
      if (!m || !sousEnsembles.includes(m[2])) continue;
      fichiers.set(fichier, join(dir, fichier));
      css += `@font-face{font-family:'${famille}';font-style:normal;font-weight:${m[3]};font-display:swap;src:url(${hote}${fichier}) format('woff2');}\n`;
    }
  }
  const fa = join(modules, "@fortawesome/fontawesome-free");
  const faCss = existsSync(fa)
    ? readFileSync(join(fa, "css/all.min.css"), "utf8").replace(
        /\.\.\/webfonts\//g,
        "https://kit.fontawesome.com/pj-webfonts/",
      )
    : "";
  return { css, fichiers, faCss, hote, modules };
}

const locaux = assetsLocaux ? assetsHorsLigne() : null;

/** Coupe les appels réseau et sert les assets CDN en local si demandé. */
async function router(context) {
  await context.route("**/*", (route) => {
    const cible = new URL(route.request().url());
    const chemin = cible.pathname;
    if (locaux) {
      try {
        if (cible.hostname === "fonts.googleapis.com") {
          return route.fulfill({ contentType: "text/css", body: locaux.css });
        }
        if (cible.href.startsWith(locaux.hote)) {
          const fichier = locaux.fichiers.get(chemin.split("/").pop());
          if (fichier)
            return route.fulfill({ contentType: "font/woff2", body: readFileSync(fichier) });
        }
        if (cible.hostname === "cdn.jsdelivr.net" && chemin.includes("bootstrap")) {
          const f = chemin.endsWith(".css")
            ? "css/bootstrap.min.css"
            : "js/bootstrap.bundle.min.js";
          return route.fulfill({
            contentType: chemin.endsWith(".css") ? "text/css" : "application/javascript",
            body: readFileSync(join(locaux.modules, "bootstrap/dist", f)),
          });
        }
        if (cible.hostname === "kit.fontawesome.com") {
          if (chemin.startsWith("/pj-webfonts/")) {
            return route.fulfill({
              contentType: "font/woff2",
              body: readFileSync(
                join(
                  locaux.modules,
                  "@fortawesome/fontawesome-free/webfonts",
                  chemin.split("/").pop(),
                ),
              ),
            });
          }
          if (chemin.endsWith(".css"))
            return route.fulfill({ contentType: "text/css", body: locaux.faCss });
          return route.fulfill({
            contentType: "application/javascript",
            body: "const l=document.createElement('link');l.rel='stylesheet';l.href='https://kit.fontawesome.com/pj-local.css';document.head.appendChild(l);",
          });
        }
      } catch {
        return route.abort();
      }
      // Firebase et l'analytique ne répondent pas hors ligne : on coupe court
      // plutôt que d'attendre le délai réseau.
      if (cible.hostname !== "localhost" && cible.hostname !== "127.0.0.1") return route.abort();
    }
    return route.continue();
  });
}

/** Convertit un PNG en WebP dans le navigateur, faute d'encodeur côté Node. */
async function versWebp(page, png, largeur, qualite = 0.82) {
  const base64 = png.toString("base64");
  const encode = await page.evaluate(
    async ([donnees, l, q]) => {
      const image = new Image();
      image.src = "data:image/png;base64," + donnees;
      await image.decode();
      const echelle = Math.min(1, l / image.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * echelle);
      canvas.height = Math.round(image.naturalHeight * echelle);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", q).split(",")[1];
    },
    [base64, largeur, qualite],
  );
  return Buffer.from(encode, "base64");
}

mkdirSync(frames, { recursive: true });
mkdirSync(cacheDist, { recursive: true });

if (!existsSync(worktree)) {
  git("worktree", "add", "--detach", worktree, "HEAD");
}

// PJ_CHROMIUM permet de pointer un Chromium déjà présent sur la machine
// quand celui de Playwright n'y est pas installé.
const navigateur = await chromium.launch({
  executablePath: process.env.PJ_CHROMIUM || undefined,
  args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
});
const atelier = await navigateur.newPage(); // page de service, pour l'encodage WebP

for (const version of versions) {
  const dist = join(cacheDist, version.slug);
  console.log(`\n=== ${version.version} (${version.tag})`);

  if (force || !existsSync(join(dist, "index.html"))) {
    git("-C", worktree, "checkout", "-q", "--force", version.tag);
    execFileSync("git", ["-C", worktree, "clean", "-qfd", "-e", "node_modules"]);
    try {
      npm(["ci", "--no-audit", "--no-fund"], worktree);
    } catch {
      npm(["install", "--no-audit", "--no-fund"], worktree);
    }
    // Les versions récentes lisent un manifeste de textes généré au build.
    if (existsSync(join(worktree, "scripts/texts-manifest.mjs"))) {
      try {
        execFileSync("node", ["scripts/texts-manifest.mjs"], { cwd: worktree, stdio: "pipe" });
      } catch {
        console.log("  manifeste des textes non généré, on continue");
      }
    }
    npm(["exec", "--", "vite", "build"], worktree);
    rmSync(dist, { recursive: true, force: true });
    execFileSync("cp", ["-r", join(worktree, "dist"), dist]);
  }

  const serveur = servir(dist);
  for (const vue of VUES) {
    const context = await navigateur.newContext({
      viewport: vue.viewport,
      deviceScaleFactor: vue.dsf,
      isMobile: vue.mobile,
      hasTouch: vue.mobile,
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
      colorScheme: "light",
    });
    await router(context);
    // Deux surcouches masqueraient la page dans les versions récentes : la
    // bannière de mesure d'audience et l'introduction au premier lancement.
    await context.addInitScript(() => {
      try {
        localStorage.setItem("pj_analytics_consent", "denied");
        localStorage.setItem("pj_onboarding_seen", "1");
      } catch {
        /* stockage indisponible */
      }
    });
    const page = await context.newPage();
    try {
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 45000 });
    } catch {
      console.log(`  ${vue.nom} : la page a mis trop de temps, on capture en l'état`);
    }
    await page.waitForTimeout(6000);
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const png = await page.screenshot();
    writeFileSync(
      join(frames, `${version.slug}-${vue.nom}.webp`),
      await versWebp(atelier, png, vue.largeur),
    );
    console.log(`  ${vue.nom} : ${await page.title()}`);
    await context.close();
  }
  await new Promise((resoudre) => serveur.close(resoudre));
}

await navigateur.close();
console.log("\ncaptures rangées dans docs/evolution/frames");
