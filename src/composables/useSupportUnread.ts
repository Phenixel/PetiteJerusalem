import { computed, ref } from "vue";
import { hasSupportHistory, listSupportThreads } from "../services/feedbackService";
import type { SupportThreadView } from "../services/support";

/**
 * Les réponses de l'équipe pas encore lues : la pastille de l'onglet du
 * profil dans la barre du bas de l'app, et l'encart « Nouvelle réponse » en
 * tête du profil. Un seul état, partagé : ouvrir le fil d'une réponse
 * l'éteint partout à la fois.
 *
 * Relu seulement si l'on a de quoi : un compte, ou un appareil qui a déjà
 * écrit (sinon, aucun appel au serveur). Une lecture qui échoue (hors ligne)
 * garde le dernier état connu.
 */

/** Les fils qui portent une réponse non lue, le plus récent en tête. */
const unreadThreads = ref<Pick<SupportThreadView, "id" | "messages">[]>([]);
const unread = computed(() => unreadThreads.value.length);
let inflight: Promise<void> | null = null;

export function refreshSupportUnread(signedIn: boolean): Promise<void> {
  if (!signedIn && !hasSupportHistory()) {
    unreadThreads.value = [];
    return Promise.resolve();
  }
  inflight ??= (async () => {
    try {
      unreadThreads.value = (await listSupportThreads()).filter((th) => th.unread);
    } catch {
      // Hors ligne : on garde ce qu'on savait.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Un fil vient d'être ouvert, donc marqué lu : l'état suit la liste que la
 * page vient de lire (sans ce fil), sans relire le serveur.
 */
export function syncSupportUnread(threads: SupportThreadView[], readId: string): void {
  unreadThreads.value = threads.filter((th) => th.unread && th.id !== readId);
}

/**
 * Où mène l'encart : le fil lui-même quand une seule réponse attend, la
 * liste « Nous écrire » quand il y en a plusieurs.
 */
const unreadTarget = computed(() =>
  unreadThreads.value.length === 1 ? `/contact/${unreadThreads.value[0].id}` : "/contact",
);

/** La dernière réponse de l'équipe dans le fil non lu le plus récent : l'aperçu de l'encart. */
const unreadPreview = computed(() => {
  const th = unreadThreads.value[0];
  if (!th) return "";
  const reply = [...th.messages].reverse().find((m) => m.from === "team");
  return (reply?.text ?? "").replace(/\s+/g, " ").trim();
});

export function useSupportUnread() {
  return { unread, unreadTarget, unreadPreview, check: refreshSupportUnread };
}
