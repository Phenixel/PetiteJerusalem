/**
 * Formulaire de support : dépose chaque message dans la base Notion
 * « Formulaire de support » (celle que remplissait l'ancien formulaire Notion
 * public, lié depuis le pied de page).
 *
 * Le client (FeedbackModal.vue) envoie ce que la personne a écrit (le type de
 * demande, les détails, un moyen de la recontacter si elle l'accepte) et ce
 * qu'il sait de lui-même (site ou app, iOS ou Android, version). Ici on
 * valide, on met en forme pour l'API Notion (feedbackNotion.ts) et on crée la
 * page. La clé d'intégration Notion est un secret de Cloud Functions
 * (NOTION_API_KEY), jamais embarquée dans le bundle web.
 *
 * Pas de compte requis : un visiteur sans compte doit pouvoir signaler un
 * bug. En contrepartie, un garde-fou par adresse IP borne le nombre d'envois.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import {
  buildNotionPage,
  FeedbackValidationError,
  KINDS,
  parseFeedback,
  PLATFORMS,
  SUPPORTS,
} from "./feedbackNotion";

const NOTION_API_KEY = defineSecret("NOTION_API_KEY");
const NOTION_VERSION = "2025-09-03";

// ---- Garde-fou : au plus N envois par adresse et par fenêtre, par instance.
// Suffisant contre un script qui boucle ; une vraie personne n'envoie pas
// cinq messages en dix minutes.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const recentByIp = new Map<string, number[]>();

function assertNotRateLimited(ip: string | undefined): void {
  if (!ip) return;
  const now = Date.now();
  const recent = (recentByIp.get(ip) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    throw new HttpsError("resource-exhausted", "Trop d'envois, réessayez plus tard.");
  }
  recent.push(now);
  recentByIp.set(ip, recent);
  // Les adresses qu'on ne voit plus ne s'accumulent pas.
  if (recentByIp.size > 1000) {
    for (const [key, stamps] of recentByIp) {
      if (stamps.every((ts) => now - ts >= RATE_WINDOW_MS)) recentByIp.delete(key);
    }
  }
}

export const submitFeedback = onCall<unknown, Promise<{ ok: true }>>(
  { secrets: [NOTION_API_KEY] },
  async (request) => {
    assertNotRateLimited(request.rawRequest.ip);

    let input;
    try {
      input = parseFeedback(request.data);
    } catch (err) {
      if (err instanceof FeedbackValidationError) {
        throw new HttpsError("invalid-argument", err.message);
      }
      throw err;
    }

    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY.value()}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildNotionPage(input)),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Le détail reste dans les journaux : le client n'a besoin que de savoir
      // que ça n'est pas passé, pas de la réponse de Notion.
      const body = await response.text().catch(() => "");
      logger.error(`submitFeedback: Notion a répondu ${response.status}`, { body });
      throw new HttpsError("unavailable", "Le message n'a pas pu être transmis.");
    }

    logger.info(
      `submitFeedback: ${KINDS[input.kind]} depuis ${SUPPORTS[input.support]} ${PLATFORMS[input.platform]}` +
        (input.version ? ` ${input.version}` : "") +
        (input.contact ? " (avec contact)" : "") +
        ".",
    );
    return { ok: true };
  },
);
