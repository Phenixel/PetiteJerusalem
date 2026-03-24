import { describe, it, expect, beforeEach } from "vitest";
import { SeoService } from "../services/seoService";

describe("SeoService.setMeta", () => {
  let seo: SeoService;

  beforeEach(() => {
    document.head.innerHTML = "";
    seo = new SeoService();
  });

  const getMeta = (attr: "name" | "property", value: string) =>
    document.head
      .querySelector(`meta[${attr}="${value}"]`)
      ?.getAttribute("content") ?? null;

  const getCanonical = () =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;

  describe("titre", () => {
    it("met à jour document.title", () => {
      seo.setMeta({ title: "Ma session | Petite Jerusalem" });
      expect(document.title).toBe("Ma session | Petite Jerusalem");
    });

    it("propage le titre dans og:title et twitter:title", () => {
      seo.setMeta({ title: "Ma session" });
      expect(getMeta("property", "og:title")).toBe("Ma session");
      expect(getMeta("name", "twitter:title")).toBe("Ma session");
    });

    it("utilise og.title et twitter.title spécifiques si fournis", () => {
      seo.setMeta({
        title: "Titre page",
        og: { title: "Titre OG" },
        twitter: { title: "Titre Twitter" },
      });
      expect(getMeta("property", "og:title")).toBe("Titre OG");
      expect(getMeta("name", "twitter:title")).toBe("Titre Twitter");
    });
  });

  describe("description", () => {
    it("définit les meta de description", () => {
      seo.setMeta({ description: "Une belle session." });
      expect(getMeta("name", "description")).toBe("Une belle session.");
      expect(getMeta("property", "og:description")).toBe("Une belle session.");
      expect(getMeta("name", "twitter:description")).toBe("Une belle session.");
    });

    it("utilise og.description et twitter.description spécifiques si fournis", () => {
      seo.setMeta({
        description: "Description générique",
        og: { description: "Description OG" },
        twitter: { description: "Description Twitter" },
      });
      expect(getMeta("property", "og:description")).toBe("Description OG");
      expect(getMeta("name", "twitter:description")).toBe("Description Twitter");
    });
  });

  describe("canonical et og:url", () => {
    it("crée le link canonical", () => {
      seo.setMeta({ canonical: "https://example.com/session/mon-slug" });
      expect(getCanonical()).toBe("https://example.com/session/mon-slug");
    });

    it("propage l'URL dans og:url", () => {
      seo.setMeta({ canonical: "https://example.com/session/mon-slug" });
      expect(getMeta("property", "og:url")).toBe("https://example.com/session/mon-slug");
    });

    it("utilise og.url spécifique si fourni", () => {
      seo.setMeta({
        canonical: "https://example.com/session/mon-slug",
        og: { url: "https://example.com/og-url" },
      });
      expect(getMeta("property", "og:url")).toBe("https://example.com/og-url");
    });
  });

  describe("valeurs par défaut", () => {
    it("og:type vaut 'website' par défaut", () => {
      seo.setMeta({});
      expect(getMeta("property", "og:type")).toBe("website");
    });

    it("og:type utilise la valeur fournie", () => {
      seo.setMeta({ og: { type: "article" } });
      expect(getMeta("property", "og:type")).toBe("article");
    });

    it("og:site_name vaut 'Petite Jerusalem' par défaut", () => {
      seo.setMeta({});
      expect(getMeta("property", "og:site_name")).toBe("Petite Jerusalem");
    });

    it("twitter:card vaut 'summary' par défaut", () => {
      seo.setMeta({});
      expect(getMeta("name", "twitter:card")).toBe("summary");
    });

    it("twitter:card utilise la valeur fournie", () => {
      seo.setMeta({ twitter: { card: "summary_large_image" } });
      expect(getMeta("name", "twitter:card")).toBe("summary_large_image");
    });
  });

  describe("images", () => {
    it("ne crée pas og:image si absent", () => {
      seo.setMeta({ title: "Test" });
      expect(getMeta("property", "og:image")).toBeNull();
    });

    it("crée og:image si fourni", () => {
      seo.setMeta({ og: { image: "https://example.com/og-session.png" } });
      expect(getMeta("property", "og:image")).toBe("https://example.com/og-session.png");
    });

    it("crée twitter:image si fourni", () => {
      seo.setMeta({ twitter: { image: "https://example.com/og-session.png" } });
      expect(getMeta("name", "twitter:image")).toBe("https://example.com/og-session.png");
    });
  });

  describe("comportement upsert", () => {
    it("met à jour le tag existant sans créer de doublon", () => {
      seo.setMeta({ title: "Premier titre" });
      seo.setMeta({ title: "Second titre" });

      const tags = document.head.querySelectorAll('meta[property="og:title"]');
      expect(tags).toHaveLength(1);
      expect(tags[0].getAttribute("content")).toBe("Second titre");
    });

    it("met à jour le canonical existant sans créer de doublon", () => {
      seo.setMeta({ canonical: "https://example.com/v1" });
      seo.setMeta({ canonical: "https://example.com/v2" });

      const links = document.head.querySelectorAll('link[rel="canonical"]');
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute("href")).toBe("https://example.com/v2");
    });
  });

  describe("robots", () => {
    it("définit meta robots si fourni", () => {
      seo.setMeta({ robots: "noindex, nofollow" });
      expect(getMeta("name", "robots")).toBe("noindex, nofollow");
    });
  });
});
