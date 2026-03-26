const CHIOURIM_URL =
  "https://n8n.phenixel.fr/webhook/1e7e1be1-1f2c-4916-a6f6-34ff8f437ef6";
const CATEGORIES_URL =
  "https://n8n.phenixel.fr/webhook/1f26ba9d-6cbd-41d1-8f81-524635020b20";

export interface WebhookChiour {
  name: string;
  property_description: string;
  property_auteur: string | null;
  property_cat_gorie: string[];
  property_medias: string;
  property_niveau: string | null;
}

export class ChiourRepository {
  async fetchAll(): Promise<WebhookChiour[]> {
    const response = await fetch(CHIOURIM_URL);
    if (!response.ok) throw new Error("Failed to fetch chiourim");
    return await response.json();
  }

  async fetchCategories(): Promise<string[]> {
    const response = await fetch(CATEGORIES_URL);
    if (!response.ok) throw new Error("Failed to fetch categories");
    const data: { categorie: string[] }[] = await response.json();
    return data[0]?.categorie ?? [];
  }
}

export const chiourRepository = new ChiourRepository();
