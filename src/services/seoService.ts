export type SeoMeta = {
  title?: string
  description?: string
  canonical?: string
  robots?: string
  og?: Partial<{
    type: string
    title: string
    description: string
    image: string
    url: string
    site_name: string
  }>
  twitter?: Partial<{
    card: string
    title: string
    description: string
    image: string
  }>
}

export class SeoService {
  setMeta(meta: SeoMeta) {
    if (meta.title) {
      document.title = meta.title
      this.upsertMeta('property', 'og:title', meta.og?.title || meta.title)
      this.upsertMeta('name', 'twitter:title', meta.twitter?.title || meta.title)
    }

    if (meta.description) {
      this.upsertMeta('name', 'description', meta.description)
      this.upsertMeta('property', 'og:description', meta.og?.description || meta.description)
      this.upsertMeta('name', 'twitter:description', meta.twitter?.description || meta.description)
    }

    if (meta.canonical) {
      this.upsertLink('canonical', meta.canonical)
      this.upsertMeta('property', 'og:url', meta.og?.url || meta.canonical)
    }

    if (meta.robots) {
      this.upsertMeta('name', 'robots', meta.robots)
    }

    // Open Graph fallbacks
    this.upsertMeta('property', 'og:type', meta.og?.type || 'website')
    this.upsertMeta('property', 'og:site_name', meta.og?.site_name || 'Petite Jerusalem')
    if (meta.og?.image) {
      this.upsertMeta('property', 'og:image', meta.og.image)
    }

    // Twitter fallbacks
    this.upsertMeta('name', 'twitter:card', meta.twitter?.card || 'summary')
    if (meta.twitter?.image) {
      this.upsertMeta('name', 'twitter:image', meta.twitter.image)
    }
  }

  private upsertMeta(attrName: 'name' | 'property', attrValue: string, content?: string) {
    if (!content) return
    let el = document.head.querySelector(
      `meta[${attrName}="${attrValue}"]`,
    ) as HTMLMetaElement | null
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute(attrName, attrValue)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  private upsertLink(rel: string, href: string) {
    let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
    if (!el) {
      el = document.createElement('link')
      el.setAttribute('rel', rel)
      document.head.appendChild(el)
    }
    el.setAttribute('href', href)
  }
}

export const seoService = new SeoService()
