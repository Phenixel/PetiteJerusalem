export interface SefariaText {
  ref: string;
  heRef: string;
  he: string[];
  text: string[];
}

function flattenText(arr: unknown): string[] {
  if (!arr) return [];
  if (typeof arr === "string") return arr ? [arr] : [];
  if (Array.isArray(arr)) {
    const flat: string[] = [];
    for (const item of arr) {
      if (typeof item === "string") {
        if (item) flat.push(item);
      } else if (Array.isArray(item)) {
        flat.push(...flattenText(item));
      }
    }
    return flat;
  }
  return [];
}

/**
 * Derives a clean Sefaria API reference from a Sefaria URL.
 * Spaces become underscores so the ref is URL-safe.
 */
export function getSefariaRef(link: string, section?: number): string {
  const baseRef = link.replace("https://www.sefaria.org/", "").replace(/ /g, "_");
  if (section !== undefined) {
    return `${baseRef}.${section}`;
  }
  return baseRef;
}

export async function fetchSefariaText(ref: string): Promise<SefariaText> {
  const url = `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0&pad=0`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Erreur Sefaria (${res.status}) pour "${ref}"`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return {
    ref: data.ref ?? ref,
    heRef: data.heRef ?? ref,
    he: flattenText(data.he),
    text: flattenText(data.text),
  };
}
