/**
 * La page /sidour pour les moteurs : son titre, sa description, et le corps
 * statique que le prérendu sert (tous les textes de liturgie, en liens, rangés
 * comme sur la page). La vue reprend le même titre et la même description en
 * français : Googlebot rend le JavaScript, et un titre différent de celui du
 * HTML servi lui laisserait choisir.
 *
 * Elle remplace les trois pages de liste /bibliotheque/sidour, /moadim et
 * /brahot, redirigées vers elle (firebase.json, routes.ts).
 */
import { SITE_URL } from "./etudeTexts";
import { SIDOUR_LABELS_FR, sidourSections } from "./sidourGroups";

export const SIDOUR_HUB_PATH = "/sidour";

export const SIDOUR_SEO = {
  title: "Le Sidour en ligne : tefilot, brahot et fêtes | Petite Jérusalem",
  description:
    "Le Sidour en ligne, en hébreu avec la phonétique : Cha'harit, Min'ha, Arvit, le Birkat Hamazon et les brahot, les Sli'hot et les textes des fêtes.",
  h1: "Le Sidour en ligne",
  lead: "Les prières de la semaine, les bénédictions et les textes des fêtes, chacun sur sa page, en hébreu avec la phonétique. Dans l'application, l'office du moment vient en tête.",
};

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Le corps prérendu de /sidour : chaque texte en lien, par usage, les fêtes en bas. */
export function buildSidourHubBody(): string {
  const sections = sidourSections(null)
    .map((section) => {
      const label =
        section.kind === "feasts"
          ? SIDOUR_LABELS_FR.fetes
          : SIDOUR_LABELS_FR[section.id as keyof typeof SIDOUR_LABELS_FR];
      const rows = section.items
        .map((text) => `<li><a href="${text.path}">${esc(text.latin)}</a></li>`)
        .join("\n        ");
      return `<section class="seo-section">
      <h2>${esc(label)}</h2>
      <ul class="chapter-list">
        ${rows}
      </ul>
    </section>`;
    })
    .join("\n\n    ");

  return `
  <main class="seo-article reading-page">
    <h1>${esc(SIDOUR_SEO.h1)}</h1>
    <p class="seo-lead">${esc(SIDOUR_SEO.lead)}</p>

    ${sections}

    <section class="seo-section">
      <h2>Aller plus loin</h2>
      <ul>
        <li><a href="/horaires">Les horaires du jour (zmanim)</a></li>
        <li><a href="/calendrier">Le calendrier des fêtes</a></li>
        <li><a href="/bibliotheque">Bibliothèque (Tehilim, Michna, Talmud, Tanakh)</a></li>
      </ul>
    </section>
  </main>`;
}

export function sidourHubJsonLd(): Record<string, unknown>[] {
  const items = sidourSections(null).flatMap((section) => section.items);
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Sidour", item: `${SITE_URL}${SIDOUR_HUB_PATH}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: SIDOUR_SEO.h1,
      itemListElement: items.map((text, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: text.latin,
        url: `${SITE_URL}${text.path}`,
      })),
    },
  ];
}
