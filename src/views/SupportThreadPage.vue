<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../components/icons/AppIcon.vue";
import type { IconName } from "../components/icons/registry";
import SupportConversation from "../components/SupportConversation.vue";
import SupportThreadChips from "../components/SupportThreadChips.vue";
import { isNativeApp } from "../composables/useNativeApp";
import { setSupportUnread } from "../composables/useSupportUnread";
import { useToast } from "../composables/useToast";
import { analyticsService } from "../services/analyticsService";
import { listSupportThreads, replyToSupportThread } from "../services/feedbackService";
import { seoService } from "../services/seoService";
import { dateTimeFormat } from "../services/intlCache";
import { threadSubject, type SupportStatus, type SupportThreadView } from "../services/support";

/**
 * Un message envoyé à l'équipe, sur sa propre page (/contact/:id) : où il en
 * est et ce que cela veut dire pour la personne, la conversation et de quoi
 * répondre, puis ce qu'elle nous a envoyé (nature, date, depuis quoi, page,
 * contact laissé). La notification d'une réponse mène ici.
 *
 * Ouvrir le fil le marque lu : la pastille « Nouvelle réponse » s'éteint
 * dans la liste et sur le profil. Elle reste affichée le temps de la visite.
 */
const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const id = computed(() => String(route.params.id));
const status = ref<"loading" | "ready" | "missing" | "error">("loading");
const thread = ref<SupportThreadView | null>(null);
const draft = ref("");
const sending = ref(false);

onMounted(async () => {
  seoService.setMeta({ title: t("support.title"), robots: "noindex, nofollow" });
  try {
    const list = await listSupportThreads(id.value);
    thread.value = list.find((th) => th.id === id.value) ?? null;
    status.value = thread.value ? "ready" : "missing";
    // Ce fil vient d'être marqué lu : la pastille de la barre du bas et du
    // profil ne compte plus que les autres.
    setSupportUnread(list.filter((th) => th.unread && th.id !== id.value).length);
  } catch (error) {
    console.error("Erreur lors du chargement du message:", error);
    status.value = "error";
  }
});

function goBack(): void {
  const back = router.options.history.state.back;
  if (typeof back === "string" && back.split(/[?#]/)[0] === "/contact") router.back();
  else void router.replace("/contact");
}

const when = (ms: number, withTime = false) =>
  ms
    ? dateTimeFormat(
        locale.value,
        withTime ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" },
      ).format(new Date(ms))
    : "";

const STATUS_ICONS: Record<SupportStatus, IconName> = {
  new: "check",
  in_progress: "hourglass",
  answered: "message",
  done: "circle-check",
};

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
    { label: t("support.thread.facts.sentOn"), value: when(th.createdAt, true) },
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

async function sendReply() {
  const th = thread.value;
  const text = draft.value.trim();
  if (!th || !text || sending.value) return;
  sending.value = true;
  try {
    thread.value = await replyToSupportThread(th.id, text);
    draft.value = "";
    analyticsService.capture("support_reply_sent", { kind: th.kind });
    toast.success(t("support.replySent"));
  } catch (error) {
    console.error("Erreur lors de l'envoi de la relance:", error);
    toast.errorFromException(error, t("feedback.error"));
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-6 py-12" :class="{ '!px-4 !pt-6': isNativeApp }">
    <button type="button" class="back-link mb-4" @click="goBack">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("support.thread.back") }}
    </button>

    <div v-if="status === 'loading'" class="space-y-4" aria-busy="true">
      <div class="card h-24 animate-pulse"></div>
      <div class="card h-48 animate-pulse"></div>
    </div>

    <p v-else-if="status === 'error'" class="card p-8 text-center text-text-secondary">
      <AppIcon name="alert-circle" :size="20" class="mx-auto mb-3" />
      {{ t("support.loadError") }}
    </p>

    <p v-else-if="status === 'missing'" class="card p-8 text-center text-text-secondary">
      {{ t("support.thread.notFound") }}
    </p>

    <div v-else-if="thread" class="space-y-5 animate-[fadeIn_0.3s_ease]">
      <header>
        <SupportThreadChips :thread="thread" />
        <h1
          class="mt-3 break-words font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl"
        >
          {{ threadSubject(thread, 80) }}
        </h1>
      </header>

      <!-- Où il en est, et ce que cela veut dire pour la personne. -->
      <!-- Le dessin accompagne la première ligne seulement : le texte de
           dessous reprend toute la largeur, sans la marge de l'icône. -->
      <section class="card p-4 text-sm">
        <p class="flex items-start gap-2 font-semibold text-text-primary">
          <AppIcon
            :name="STATUS_ICONS[thread.status]"
            :size="16"
            class="mt-px shrink-0 text-primary"
          />
          {{ t(`support.thread.statusHelp.${thread.status}`) }}
        </p>
        <p class="mt-1.5 text-text-secondary">{{ deliveryNote }}</p>
      </section>

      <!-- La conversation, et la réponse de la personne. -->
      <section class="card p-4 md:p-5">
        <SupportConversation :messages="thread.messages" viewer="user" />

        <form class="mt-5 space-y-2 border-t border-line pt-4" @submit.prevent="sendReply">
          <label for="support-reply" class="block text-sm font-semibold text-text-secondary">
            {{ t("support.replyLabel") }}
          </label>
          <textarea
            id="support-reply"
            v-model="draft"
            rows="3"
            maxlength="2000"
            class="field resize-y"
            :placeholder="t('support.replyPlaceholder')"
          ></textarea>
          <p v-if="thread.status === 'done'" class="text-xs text-text-secondary">
            {{ t("support.thread.reopenHint") }}
          </p>
          <div class="flex justify-end">
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              :disabled="sending || !draft.trim()"
            >
              <AppIcon v-if="sending" name="spinner" :size="13" class="animate-spin" />
              <AppIcon v-else name="message" :size="13" />
              {{ t("support.reply") }}
            </button>
          </div>
        </form>
      </section>

      <!-- Ce qu'elle nous a envoyé. -->
      <section>
        <h2 class="mb-2 text-sm font-semibold text-text-secondary">
          {{ t("support.thread.factsTitle") }}
        </h2>
        <dl class="card divide-y divide-line overflow-hidden text-sm">
          <div
            v-for="fact in facts"
            :key="fact.label"
            class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3"
          >
            <dt class="text-text-secondary">{{ fact.label }}</dt>
            <dd
              class="min-w-0 break-words text-end"
              :class="fact.muted ? 'text-text-secondary' : 'text-text-primary'"
            >
              <RouterLink v-if="fact.to" :to="fact.to" class="text-primary hover:underline">
                {{ fact.value }}
              </RouterLink>
              <template v-else>{{ fact.value }}</template>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </main>
</template>
