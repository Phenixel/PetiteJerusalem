import { ref } from "vue";
import { hasSupportHistory, listSupportThreads } from "../services/feedbackService";
import { unreadCount } from "../services/support";

/**
 * Les réponses de l'équipe pas encore lues, pour la ligne « Nous écrire » du
 * profil. Relu seulement si l'on a de quoi : un compte, ou un appareil qui a
 * déjà écrit. Une lecture qui échoue (hors ligne) ne montre rien.
 */
export function useSupportUnread() {
  const unread = ref(0);

  async function check(signedIn: boolean): Promise<void> {
    if (!signedIn && !hasSupportHistory()) {
      unread.value = 0;
      return;
    }
    try {
      unread.value = unreadCount(await listSupportThreads());
    } catch {
      unread.value = 0;
    }
  }

  return { unread, check };
}
