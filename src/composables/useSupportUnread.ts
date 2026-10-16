import { ref } from "vue";
import { hasSupportHistory, listSupportThreads } from "../services/feedbackService";
import { unreadCount } from "../services/support";

/**
 * Les réponses de l'équipe pas encore lues : la pastille de l'onglet du
 * profil dans la barre du bas de l'app, et la ligne « Nous écrire » du
 * profil. Un seul compte, partagé : ouvrir le fil d'une réponse l'éteint
 * partout à la fois.
 *
 * Relu seulement si l'on a de quoi : un compte, ou un appareil qui a déjà
 * écrit (sinon, aucun appel au serveur). Une lecture qui échoue (hors ligne)
 * garde le dernier compte connu.
 */
const unread = ref(0);
let inflight: Promise<void> | null = null;

export function refreshSupportUnread(signedIn: boolean): Promise<void> {
  if (!signedIn && !hasSupportHistory()) {
    unread.value = 0;
    return Promise.resolve();
  }
  inflight ??= (async () => {
    try {
      unread.value = unreadCount(await listSupportThreads());
    } catch {
      // Hors ligne : on garde ce qu'on savait.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Le fil ouvert vient d'être marqué lu : le compte suit sans relire le serveur. */
export function setSupportUnread(count: number): void {
  unread.value = count;
}

export function useSupportUnread() {
  return { unread, check: refreshSupportUnread };
}
