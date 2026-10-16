<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../components/icons/AppIcon.vue";
import SupportConversation from "../components/SupportConversation.vue";
import { openFeedback, resumeStashedFeedback, supportVersion } from "../composables/useFeedback";
import { useToast } from "../composables/useToast";
import { analyticsService } from "../services/analyticsService";
import { listSupportThreads, replyToSupportThread } from "../services/feedbackService";
import { seoService } from "../services/seoService";
import { dateTimeFormat } from "../services/intlCache";
import { threadSubject, type SupportThreadView } from "../services/support";

/**
 * Nous écrire : les messages envoyés à l'équipe et ses réponses, et de quoi
 * en écrire un nouveau (la fenêtre du formulaire, la même partout). Dans
 * l'app, sans compte aussi : l'appareil retrouve ses messages. Sur le site,
 * la page demande un compte (garde de route), sans quoi la réponse n'aurait
 * nulle part où arriver.
 *
 * La visite vaut lecture : les réponses ouvertes ici cessent d'être
 * nouvelles. Les pastilles se calculent sur l'état d'avant, rendu par la même
 * lecture, sinon elles s'éteindraient à l'instant où on vient les lire.
 */
const { t, locale } = useI18n();
const toast = useToast();

const status = ref<"loading" | "ready" | "error">("loading");
const threads = ref<SupportThreadView[]>([]);
/** Les fils dépliés : ceux qui portent une réponse nouvelle, à l'arrivée. */
const expanded = ref(new Set<string>());
const drafts = ref<Record<string, string>>({});
const sending = ref<string | null>(null);

async function load() {
  try {
    const list = await listSupportThreads(true);
    threads.value = list;
    const open = new Set(list.filter((th) => th.unread).map((th) => th.id));
    // Un seul message, sans réponse nouvelle : on le montre déplié aussi.
    if (list.length === 1) open.add(list[0].id);
    expanded.value = open;
    status.value = "ready";
  } catch (error) {
    console.error("Erreur lors du chargement des messages:", error);
    status.value = threads.value.length ? "ready" : "error";
  }
}

onMounted(() => {
  seoService.setMeta({ title: t("support.title"), robots: "noindex, nofollow" });
  void load();
  // De retour de la connexion demandée par le formulaire : il se rouvre sur
  // ce qui était amorcé.
  resumeStashedFeedback();
});

// Un message tout juste envoyé depuis la fenêtre : la liste le montre.
watch(supportVersion, () => void load());

function toggle(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

const when = (ms: number) =>
  ms ? dateTimeFormat(locale.value, { dateStyle: "medium" }).format(new Date(ms)) : "";

const STATUS_TONES: Record<SupportThreadView["status"], string> = {
  new: "bg-black/5 text-text-secondary dark:bg-white/10",
  in_progress: "bg-primary/10 text-primary",
  answered: "bg-green-600/10 text-green-700 dark:text-green-300",
  done: "bg-black/5 text-text-secondary dark:bg-white/10",
};

const hasThreads = computed(() => threads.value.length > 0);

async function sendReply(thread: SupportThreadView) {
  const text = (drafts.value[thread.id] ?? "").trim();
  if (!text || sending.value) return;
  sending.value = thread.id;
  try {
    const updated = await replyToSupportThread(thread.id, text);
    threads.value = threads.value.map((th) => (th.id === thread.id ? updated : th));
    drafts.value = { ...drafts.value, [thread.id]: "" };
    analyticsService.capture("support_reply_sent", { kind: thread.kind });
    toast.success(t("support.replySent"));
  } catch (error) {
    console.error("Erreur lors de l'envoi de la relance:", error);
    toast.errorFromException(error, t("feedback.error"));
  } finally {
    sending.value = null;
  }
}
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-6 py-12">
    <div class="mb-8 text-center animate-[fadeIn_0.5s_ease]">
      <h1 class="font-display text-4xl md:text-5xl font-bold text-text-primary tracking-tight">
        {{ t("support.title") }}
      </h1>
      <p class="mt-4 text-lg text-text-secondary leading-relaxed">
        {{ t("support.subtitle") }}
      </p>
      <button type="button" class="btn btn-primary mt-6" @click="openFeedback()">
        <AppIcon name="plus" :size="15" />
        {{ t("support.newMessage") }}
      </button>
    </div>

    <div v-if="status === 'loading'" class="space-y-4" aria-busy="true">
      <div v-for="n in 2" :key="n" class="card h-24 animate-pulse"></div>
    </div>

    <p v-else-if="status === 'error'" class="card p-8 text-center text-text-secondary">
      <AppIcon name="alert-circle" :size="20" class="mx-auto mb-3" />
      {{ t("support.loadError") }}
    </p>

    <p v-else-if="!hasThreads" class="card p-8 text-center text-text-secondary">
      {{ t("support.empty") }}
    </p>

    <template v-else>
      <h2 class="mb-3 text-lg font-bold text-text-primary">{{ t("support.historyTitle") }}</h2>
      <ul class="space-y-4">
        <li v-for="thread in threads" :key="thread.id" class="card overflow-hidden">
          <button
            type="button"
            class="flex w-full items-start gap-3 p-4 text-start md:p-5"
            :aria-expanded="expanded.has(thread.id)"
            @click="toggle(thread.id)"
          >
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-1.5">
                <span class="chip bg-primary/10 text-primary">
                  {{ t(`feedback.kinds.${thread.kind}`) }}
                </span>
                <span class="chip" :class="STATUS_TONES[thread.status]">
                  {{ t(`support.statuses.${thread.status}`) }}
                </span>
                <span v-if="thread.unread" class="chip bg-brand text-on-brand">
                  {{ t("support.newReply") }}
                </span>
              </span>
              <span class="mt-2 block break-words font-semibold text-text-primary">
                {{ threadSubject(thread) }}
              </span>
              <span class="mt-0.5 block text-sm text-text-secondary">
                {{ when(thread.createdAt) }}
                <template v-if="thread.messages.length > 1">
                  ·
                  {{
                    t(
                      "support.messagesCount",
                      { n: thread.messages.length },
                      thread.messages.length,
                    )
                  }}
                </template>
              </span>
            </span>
            <AppIcon
              name="chevron-down"
              :size="16"
              class="mt-1 shrink-0 text-text-secondary transition-transform"
              :class="expanded.has(thread.id) ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="expanded.has(thread.id)" class="border-t border-line p-4 md:p-5">
            <SupportConversation :messages="thread.messages" viewer="user" />
            <p
              v-if="!thread.messages.some((m) => m.from === 'team')"
              class="mt-4 text-sm text-text-secondary"
            >
              {{ t("support.waiting") }}
            </p>

            <form class="mt-4 space-y-2" @submit.prevent="sendReply(thread)">
              <label :for="`support-reply-${thread.id}`" class="sr-only">
                {{ t("support.replyLabel") }}
              </label>
              <textarea
                :id="`support-reply-${thread.id}`"
                v-model="drafts[thread.id]"
                rows="3"
                maxlength="2000"
                class="field resize-y"
                :placeholder="t('support.replyPlaceholder')"
              ></textarea>
              <div class="flex justify-end">
                <button
                  type="submit"
                  class="btn btn-soft btn-sm"
                  :disabled="sending !== null || !(drafts[thread.id] ?? '').trim()"
                >
                  <AppIcon
                    v-if="sending === thread.id"
                    name="spinner"
                    :size="13"
                    class="animate-spin"
                  />
                  <AppIcon v-else name="message" :size="13" />
                  {{ t("support.reply") }}
                </button>
              </div>
            </form>
          </div>
        </li>
      </ul>
    </template>
  </main>
</template>
