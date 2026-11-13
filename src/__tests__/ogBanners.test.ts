import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ogBannerFiles, ogImageOf } from "../content/ogBanners";
import { allPages, injectMeta, SITE_URL } from "../content/seoPages";

/**
 * The share banners: a link pasted on WhatsApp shows the image of its
 * section, in its language. A wrong mapping or a missing file breaks no build:
 * the preview just comes out generic, or empty, and nobody notices before
 * sharing.
 */

const OG_DIR = join(__dirname, "../../public/og");

/** Width and height read from the PNG header. */
function pngSize(file: string): [number, number] {
  const data = readFileSync(join(OG_DIR, file));
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

const fileOf = (path: string): string => ogImageOf(path).url.replace(`${SITE_URL}/og/`, "");

describe("share banner files", () => {
  it("has every banner in public/og, at the Open Graph size", () => {
    const files = ogBannerFiles();
    expect(readdirSync(OG_DIR).sort()).toEqual([...files].sort());
    for (const file of files) expect([file, ...pngSize(file)]).toEqual([file, 1200, 630]);
  });
});

describe("banner of a page", () => {
  it.each([
    ["/", "site-fr.png"],
    ["/en", "site-en.png"],
    ["/he", "site-he.png"],
    ["/horaires", "horaires-fr.png"],
    ["/horaires/lyon", "horaires-fr.png"],
    ["/en/shabbat-times/lyon", "horaires-en.png"],
    ["/he/zmanei-shabbat/lyon", "horaires-he.png"],
    ["/calendrier/pessah", "fetes-fr.png"],
    ["/en/holidays/passover", "fetes-en.png"],
    ["/he/chagim", "fetes-he.png"],
    ["/share-reading", "partage-lectures-fr.png"],
    ["/finir-le-chass", "partage-lectures-fr.png"],
    ["/partage-tehilim", "partage-lectures-fr.png"],
    ["/bibliotheque", "bibliotheque-fr.png"],
    ["/bibliotheque/talmud/berakhot/2", "bibliotheque-fr.png"],
    ["/tehilim/guerison", "bibliotheque-fr.png"],
    ["/sidour", "bibliotheque-fr.png"],
    ["/chiourim", "site-fr.png"],
    ["/zmanim", "site-fr.png"],
  ])("%s shares %s", (path, file) => {
    expect(fileOf(path)).toBe(file);
  });

  it("falls back on the general banner of the same language, never another language", () => {
    // The designer drew the reading sharing banner in French only: an English
    // page gets the English general banner, not the French sharing one.
    expect(fileOf("/en/finish-the-shas")).toBe("site-en.png");
    expect(fileOf("/he/siyum-hashas")).toBe("site-he.png");
  });

  it("does not take a path that only starts like a section for that section", () => {
    expect(fileOf("/horaires-du-jour")).toBe("site-fr.png");
  });

  it("gives every prerendered page an existing banner in its own language", () => {
    const files = new Set(ogBannerFiles());
    const wrong = allPages
      .map((page) => ({
        path: page.path,
        locale: page.locale ?? "fr",
        file: ogImageOf(page.path, page.locale ?? "fr").url,
      }))
      .filter(({ locale, file }) => {
        const name = file.replace(`${SITE_URL}/og/`, "");
        return !files.has(name) || !name.endsWith(`-${locale}.png`);
      });
    expect(wrong).toEqual([]);
  });
});

describe("share banner in the prerendered head", () => {
  const template = `<!doctype html>
<html lang="fr">
  <head>
    <title>Base</title>
    <meta property="og:image" content="https://petite-jerusalem.fr/og/site-fr.png" />
    <meta property="og:image:alt" content="Base" />
    <meta name="twitter:image" content="https://petite-jerusalem.fr/og/site-fr.png" />
  </head>
  <body><div id="app"></div></body>
</html>`;

  it("writes the section's banner, its alt text and the Twitter image", () => {
    const html = injectMeta(template, {
      file: "en/shabbat-times/lyon.html",
      path: "/en/shabbat-times/lyon",
      locale: "en",
      title: "Shabbat times in Lyon",
      description: "Candle lighting and Shabbat end in Lyon.",
      bodyHtml: "",
    });
    const url = `${SITE_URL}/og/horaires-en.png`;
    expect(html).toContain(`<meta property="og:image" content="${url}" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${url}" />`);
    expect(html).toContain(
      '<meta property="og:image:alt" content="Petite Jerusalem, Shabbat times: candle lighting and Shabbat end, for your city." />',
    );
  });
});
