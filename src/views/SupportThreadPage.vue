<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../components/icons/AppIcon.vue";
import AppModal from "../components/AppModal.vue";
import SupportConversation from "../components/SupportConversation.vue";
import { isNativeApp } from "../composables/useNativeApp";
import { syncSupportUnread } from "../composables/useSupportUnread";
import { useToast } from "../composables/useToast";
import { useConfirm } from "../composables/useConfirm";
import { analyticsService } from "../services/analyticsService";
import {
  listSupportThreads,
  replyToSupportThread,
  resolveSupportThread,
} from "../services/feedbackService";
import { seoService } from "../services/seoService";
import { dateTimeFormat } from "../services/intlCache";
import { threadSubject, type SupportThreadView } from "../services/support";

/**
 * Un message envoyé à l'équipe, en messagerie (/contact/:id) : l'en-tête
 * (retour, sujet, état, « Détails »), le fil qui défile, et la barre pour
 * écrire, fixée en bas. Dans l'app, l'écran prend toute la place, barre du
 * bas comprise, et la barre d'écriture reste au-dessus du clavier. Sur le
 * site, la même messagerie tient dans une carte de la page.
 *
 * L'état du fil se dit comme une ligne de la messagerie, sous le dernier
 * message (« Bien reçu, nous vous répondrons ici »). Ce que la personne a
 * envoyé (nature, date, depuis quoi, page, contact) et la façon dont la
 * réponse lui parvient s'ouvrent par « Détails ».
 *
 * Ouvrir le fil le marque lu : la pastille de la barre du bas et du profil
 * ne compte plus que les autres. La notification d'une réponse mène ici.
 */
const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { confirm } = useConfirm();

const id = computed(() => String(route.params.id));
const status = ref<"loading" | "ready" | "missing" | "error">("loading");
const thread = ref<SupportThreadView | null>(null);
const draft = ref("");
const sending = ref(false);
const showDetails = ref(false);

const scroller = ref<HTMLElement | null>(null);
const composer = ref<HTMLTextAreaElement | null>(null);

/** Le fil défile jusqu'au dernier message, comme à l'ouverture d'une messagerie. */
async function scrollToEnd(smooth = false): Promise<void> {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

onMounted(async () => {
  seoService.setMeta({ title: t("support.title"), robots: "noindex, nofollow" });
  try {
    const list = await listSupportThreads(id.value);
    thread.value = list.find((th) => th.id === id.value) ?? null;
    status.value = thread.value ? "ready" : "missing";
    // Ce fil vient d'être marqué lu : la pastille de la barre du bas et du
    // profil ne compte plus que les autres.
    syncSupportUnread(list, id.value);
    void scrollToEnd();
  } catch (error) {
    console.error("Erreur lors du chargement du message:", error);
    status.value = "error";
  }
});

// ---- Le clavier (app) -------------------------------------------------------
// L'écran suit la partie visible de la page : quand le clavier s'ouvre, il
// raccourcit, et la barre d'écriture reste posée juste au-dessus de lui au
// lieu de passer dessous (iOS ne redimensionne pas la page de lui-même).
const viewportHeight = ref<number | null>(null);
const viewportTop = ref(0);

function syncViewport(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const shrank = viewportHeight.value !== null && vv.height < viewportHeight.value;
  viewportHeight.value = vv.height;
  viewportTop.value = vv.offsetTop;
  if (shrank) void scrollToEnd();
}

onMounted(() => {
  if (!isNativeApp || !window.visualViewport) return;
  syncViewport();
  window.visualViewport.addEventListener("resize", syncViewport);
  window.visualViewport.addEventListener("scroll", syncViewport);
});
onUnmounted(() => {
  window.visualViewport?.removeEventListener("resize", syncViewport);
  window.visualViewport?.removeEventListener("scroll", syncViewport);
});

const screenStyle = computed(() =>
  isNativeApp
    ? {
        height: viewportHeight.value ? `${viewportHeight.value}px` : "100dvh",
        transform: viewportTop.value ? `translateY(${viewportTop.value}px)` : undefined,
      }
    : undefined,
);

function goBack(): void {
  const back = router.options.history.state.back;
  if (typeof back === "string" && back.split(/[?#]/)[0] === "/contact") router.back();
  else void router.replace("/contact");
}

const subline = computed(() =>
  thread.value
    ? `${t(`support.kinds.${thread.value.kind}`)} · ${t(`support.statuses.${thread.value.status}`)}`
    : "",
);

const when = (ms: number) =>
  ms
    ? dateTimeFormat(locale.value, { dateStyle: "long", timeStyle: "short" }).format(new Date(ms))
    : "";

/** Où la réponse arrive, et comment la personne l'apprend. */
const deliveryNote = computed(() =>
  isNativeApp ? t("support.thread.deliveryApp") : t("support.thread.deliveryWeb"),
);

/** Ce qu'elle nous a envoyé, en lignes : de quoi se souvenir, et vérifier. */
const facts = computed(() => {
  const th = thread.value;
  if (!th) return [];
  const rows: { label: string; value: string; to?: string; muted?: boolean }[] = [
    {
      label: t("support.thread.facts.kind"),
      value: th.otherKind
        ? `${t(`support.kinds.${th.kind}`)} (${th.otherKind})`
        : t(`support.kinds.${th.kind}`),
    },
    { label: t("support.thread.facts.sentOn"), value: when(th.createdAt) },
    {
      label: t("support.thread.facts.from"),
      value: [
        th.support === "app"
          ? `${t("feedback.context.app")} ${t(`feedback.context.${th.platform}`)}`
          : t("feedback.context.web"),
        th.version ? t("feedback.context.version", { version: th.version }) : "",
      ]
        .filter(Boolean)
        .join(", "),
    },
  ];
  if (th.page && th.page !== "/contact" && !th.page.startsWith("/contact/")) {
    rows.push({ label: t("support.thread.facts.page"), value: th.page, to: th.page });
  }
  rows.push(
    th.contact
      ? { label: t("support.thread.facts.contact"), value: th.contact }
      : {
          label: t("support.thread.facts.contact"),
          value: t("support.thread.facts.noContact"),
          muted: true,
        },
  );
  return rows;
});

/** Le champ grandit avec le texte, jusqu'à six lignes environ, puis défile. */
function autoGrow(): void {
  const el = composer.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

/** Sur un clavier physique, Ctrl ou Cmd + Entrée envoie ; Entrée seule va à la ligne. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void sendReply();
  }
}

/**
 * L'état du fil, dit à la personne. Un fil qu'elle a dit réglé le lui
 * rappelle avec ses mots à elle, plutôt que « terminé » par l'équipe.
 */
const statusLine = computed(() => {
  const th = thread.value;
  if (!th) return "";
  if (th.status === "done" && th.resolvedByUser)
    return t("support.thread.statusHelp.resolvedByUser");
  return t(`support.thread.statusHelp.${th.status}`);
});

/** « C'est réglé » : la personne clôt la conversation ; écrire ici la rouvre. */
const resolving = ref(false);
async function markResolved() {
  const th = thread.value;
  if (!th || resolving.value) return;
  const accepted = await confirm({
    title: t("support.thread.resolveConfirm"),
    message: t("support.thread.resolveHint"),
    confirmLabel: t("support.thread.resolve"),
  });
  if (!accepted) return;
  resolving.value = true;
  try {
    thread.value = await resolveSupportThread(th.id);
    analyticsService.capture("support_thread_resolved", { kind: th.kind });
    void scrollToEnd(true);
  } catch (error) {
    console.error("Erreur lors de la clôture du message:", error);
    toast.errorFromException(error, t("feedback.error"));
  } finally {
    resolving.value = false;
  }
}

async function sendReply() {
  const th = thread.value;
  const text = draft.value.trim();
  if (!th || !text || sending.value) return;
  sending.value = true;
  try {
    thread.value = await replyToSupportThread(th.id, text);
    draft.value = "";
    await nextTick();
    autoGrow();
    analyticsService.capture("support_reply_sent", { kind: th.kind });
    void scrollToEnd(true);
  } catch (error) {
    console.error("Erreur lors de l'envoi de la relance:", error);
    toast.errorFromException(error, t("feedback.error"));
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div :class="isNativeApp ? 'contents' : 'mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-10'">
    <div
      class="flex flex-col overflow-hidden"
      :class="
        isNativeApp
          ? 'fixed inset-x-0 top-0 z-[60] bg-page'
          : 'card h-[min(80dvh,760px)] min-h-[480px]'
      "
      :style="screenStyle"
    >
      <!-- L'en-tête : retour, sujet et état, détails. -->
      <header
        class="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-2 py-2"
        :class="{ 'pt-[calc(var(--safe-top)+0.5rem)]': isNativeApp }"
      >
        <button
          type="button"
          class="icon-btn shrink-0"
          :aria-label="t('support.thread.back')"
          @click="goBack"
        >
          <AppIcon name="arrow-left" :size="18" class="rtl:rotate-180" />
        </button>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-text-primary">
            {{ thread ? threadSubject(thread, 80) : t("support.title") }}
          </p>
          <p v-if="thread" class="truncate text-xs text-text-secondary">{{ subline }}</p>
        </div>
        <button
          v-if="thread"
          type="button"
          class="btn btn-soft btn-sm shrink-0"
          @click="showDetails = true"
        >
          <AppIcon name="info" :size="13" />
          {{ t("support.thread.details") }}
        </button>
      </header>

      <!-- Le fil, qui défile seul. -->
      <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <div v-if="status === 'loading'" class="space-y-3" aria-busy="true">
          <div class="ms-auto h-14 w-3/5 animate-pulse rounded-control bg-primary/10"></div>
          <div class="h-20 w-2/3 animate-pulse rounded-control bg-surface-soft"></div>
        </div>

        <p v-else-if="status === 'error'" class="py-10 text-center text-text-secondary">
          <AppIcon name="alert-circle" :size="20" class="mx-auto mb-3" />
          {{ t("support.loadError") }}
        </p>

        <p v-else-if="status === 'missing'" class="py-10 text-center text-text-secondary">
          {{ t("support.thread.notFound") }}
        </p>

        <!-- Un fil court se pose en bas, contre la barre d'écriture, comme
             dans une messagerie ; un long remplit l'écran et défile. -->
        <div v-else-if="thread" class="flex min-h-full flex-col justify-end">
          <SupportConversation :messages="thread.messages" viewer="user">
            <!-- L'état du fil, dit comme une ligne de la messagerie, et, tant
                 qu'il est ouvert, de quoi dire que c'est réglé. -->
            <div class="flex flex-col items-center gap-2">
              <p
                class="max-w-[85%] rounded-pill bg-black/5 px-3.5 py-1.5 text-center text-xs text-text-secondary dark:bg-white/10"
              >
                {{ statusLine }}
              </p>
              <button
                v-if="thread.status !== 'done'"
                type="button"
                class="btn btn-soft btn-sm"
                :disabled="resolving"
                @click="markResolved"
              >
                <AppIcon v-if="resolving" name="spinner" :size="13" class="animate-spin" />
                <AppIcon v-else name="circle-check" :size="13" />
                {{ t("support.thread.resolve") }}
              </button>
            </div>
          </SupportConversation>
        </div>
      </div>

      <!-- La barre pour écrire, fixée en bas. -->
      <form
        v-if="thread"
        class="flex shrink-0 items-end gap-2 border-t border-line bg-surface px-3 py-2"
        :class="{ 'pb-[calc(var(--safe-bottom)+0.5rem)]': isNativeApp }"
        @submit.prevent="sendReply"
      >
        <label for="support-reply" class="sr-only">{{ t("support.replyLabel") }}</label>
        <textarea
          id="support-reply"
          ref="composer"
          v-model="draft"
          rows="1"
          maxlength="2000"
          class="field max-h-40 min-h-10 flex-1 resize-none !rounded-[1.25rem] !py-2"
          :placeholder="
            thread.status === 'done'
              ? t('support.thread.reopenHint')
              : t('support.replyPlaceholder')
          "
          @input="autoGrow"
          @keydown="onKeydown"
          @focus="scrollToEnd(true)"
        ></textarea>
        <button
          type="submit"
          class="btn btn-primary h-10 w-10 shrink-0 !p-0"
          :disabled="sending || !draft.trim()"
          :aria-label="t('support.reply')"
        >
          <AppIcon v-if="sending" name="spinner" :size="16" class="animate-spin" />
          <AppIcon v-else name="arrow-up" :size="18" />
        </button>
      </form>
    </div>

    <!-- Ce que la personne nous a envoyé, et comment la réponse lui parvient. -->
    <AppModal
      v-if="thread"
      :open="showDetails"
      labelledby="support-details-title"
      panel-class="modal-panel !max-w-md animate-[scaleIn_0.3s_ease]"
      @close="showDetails = false"
    >
      <div class="mb-3 flex items-center justify-between">
        <h3 id="support-details-title" class="text-xl font-bold text-text-primary">
          {{ t("support.thread.factsTitle") }}
        </h3>
        <button
          type="button"
          class="icon-btn"
          :aria-label="t('common.close')"
          @click="showDetails = false"
        >
          <AppIcon name="x" :size="16" />
        </button>
      </div>
      <dl class="divide-y divide-line text-sm">
        <div
          v-for="fact in facts"
          :key="fact.label"
          class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5"
        >
          <dt class="text-text-secondary">{{ fact.label }}</dt>
          <dd
            class="min-w-0 break-words text-end"
            :class="fact.muted ? 'text-text-secondary' : 'text-text-primary'"
          >
            <RouterLink
              v-if="fact.to"
              :to="fact.to"
              class="text-primary hover:underline"
              @click="showDetails = false"
            >
              {{ fact.value }}
            </RouterLink>
            <template v-else>{{ fact.value }}</template>
          </dd>
        </div>
      </dl>
      <p class="mt-4 text-sm text-text-secondary">{{ deliveryNote }}</p>
    </AppModal>
  </div>
</template>
