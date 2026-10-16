<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import AppSelect from "../../components/AppSelect.vue";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";
import AdminStatus from "../../components/admin/AdminStatus.vue";
import AdminSupportStatus from "../../components/admin/AdminSupportStatus.vue";
import SupportConversation from "../../components/SupportConversation.vue";
import { adminService } from "../../services/adminService";
import { dateTimeFormat } from "../../services/intlCache";
import { useAdminReturnTo } from "../../composables/useAdminQueryFilter";
import { refreshAdminSummary } from "../../composables/useAdminSummary";
import { useConfirm } from "../../composables/useConfirm";
import { useToast } from "../../composables/useToast";
import {
  mailtoReply,
  replyEmail,
  SUPPORT_KINDS,
  SUPPORT_STATUSES,
  threadSubject,
  type AdminSupportThread,
  type SupportStatus,
} from "../../services/support";
import type { FeedbackKind } from "../../services/feedbackService";

/**
 * Un message et sa suite : la conversation, la réponse de l'équipe, et ce
 * qui se règle à côté (statut, nature, note privée). La réponse arrive dans
 * l'app ou sur le site de la personne, avec une notification si son appareil
 * l'accepte ; quand on connaît son email, on peut aussi lui écrire.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { confirm } = useConfirm();
const returnTo = useAdminReturnTo("/admin/messages");

const id = computed(() => String(route.params.id));
const isLoading = ref(true);
const thread = ref<AdminSupportThread | null>(null);
const reply = ref("");
const note = ref("");
const busy = ref<"reply" | "status" | "note" | "delete" | null>(null);

async function load() {
  thread.value = await adminService.getSupportThread(id.value);
  note.value = thread.value?.note ?? "";
}

onMounted(async () => {
  try {
    await load();
  } catch (error) {
    console.error("Erreur lors du chargement du message:", error);
    toast.error(t("admin.error"));
  } finally {
    isLoading.value = false;
  }
});

const statusOptions = computed(() =>
  SUPPORT_STATUSES.map((s) => ({ value: s, label: t(`admin.support.statuses.${s}`) })),
);
const kindOptions = computed(() =>
  SUPPORT_KINDS.map((k) => ({ value: k, label: t(`admin.support.kinds.${k}`) })),
);

const email = computed(() => (thread.value ? replyEmail(thread.value) : null));

/** Ouvre la messagerie, la réponse en cours déjà écrite et le message cité. */
const mailto = computed(() => {
  const th = thread.value;
  if (!th || !email.value) return "";
  return mailtoReply(
    email.value,
    t("admin.support.mailSubject"),
    reply.value.trim(),
    th.messages.map((m) => m.text).join("\n\n"),
  );
});

const formatWhen = (ms: number) =>
  ms ? dateTimeFormat("fr", { dateStyle: "long", timeStyle: "short" }).format(new Date(ms)) : "";

/** Ce que l'app a joint au message : de quoi reproduire un bug. */
const facts = computed(() => {
  const th = thread.value;
  if (!th) return [];
  const rows: { label: string; value: string; href?: string }[] = [];
  const who = th.accountName || th.accountEmail;
  rows.push({
    label: t("admin.support.facts.author"),
    value: who
      ? [th.accountName, th.accountEmail].filter(Boolean).join(" · ")
      : th.fromDevice
        ? t("admin.support.device")
        : t("admin.support.anonymous"),
  });
  if (th.contact) rows.push({ label: t("admin.support.facts.contact"), value: th.contact });
  rows.push({
    label: t("admin.support.facts.platform"),
    value:
      th.support === "app"
        ? `${t("feedback.context.app")} ${t(`feedback.context.${th.platform}`)}`
        : t("feedback.context.web"),
  });
  if (th.version) rows.push({ label: t("admin.support.facts.version"), value: th.version });
  if (th.page) rows.push({ label: t("admin.support.facts.page"), value: th.page, href: th.page });
  rows.push({ label: t("admin.support.facts.locale"), value: th.locale });
  rows.push({ label: t("admin.support.facts.createdAt"), value: formatWhen(th.createdAt) });
  return rows;
});

/** Où la réponse arrivera, dit avant d'envoyer. */
const deliveryNote = computed(() => {
  const th = thread.value;
  if (!th) return "";
  if (th.uid || th.fromDevice) {
    return th.canNotify ? t("admin.support.deliveryPush") : t("admin.support.deliveryApp");
  }
  return email.value ? t("admin.support.deliveryEmailOnly") : t("admin.support.deliveryNone");
});
const repliesInApp = computed(
  () => !!thread.value && (!!thread.value.uid || thread.value.fromDevice),
);

async function sendReply(status: SupportStatus) {
  const text = reply.value.trim();
  if (!thread.value || !text) return;
  busy.value = "reply";
  try {
    await adminService.replySupportThread(thread.value.id, text, status);
    reply.value = "";
    toast.success(t("admin.support.replied"));
    await load();
    void refreshAdminSummary(true);
  } catch (error) {
    console.error("Erreur lors de l'envoi de la réponse:", error);
    toast.error(t("admin.error"));
  } finally {
    busy.value = null;
  }
}

async function setField(fields: Partial<{ status: SupportStatus; kind: FeedbackKind }>) {
  if (!thread.value) return;
  busy.value = "status";
  try {
    await adminService.updateSupportThread(thread.value.id, fields);
    thread.value = { ...thread.value, ...fields };
    void refreshAdminSummary(true);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du message:", error);
    toast.error(t("admin.error"));
  } finally {
    busy.value = null;
  }
}

const status = computed({
  get: () => thread.value?.status ?? "new",
  set: (value: string) => void setField({ status: value as SupportStatus }),
});
const kind = computed({
  get: () => thread.value?.kind ?? "other",
  set: (value: string) => void setField({ kind: value as FeedbackKind }),
});

async function saveNote() {
  if (!thread.value) return;
  busy.value = "note";
  try {
    await adminService.updateSupportThread(thread.value.id, { note: note.value.trim() });
    thread.value = { ...thread.value, note: note.value.trim() };
    toast.success(t("admin.support.noteSaved"));
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la note:", error);
    toast.error(t("admin.error"));
  } finally {
    busy.value = null;
  }
}

async function remove() {
  if (!thread.value) return;
  const accepted = await confirm({
    title: t("admin.support.deleteConfirm"),
    message: t("admin.support.deleteHint"),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!accepted) return;
  busy.value = "delete";
  try {
    await adminService.deleteSupportThread(thread.value.id);
    toast.success(t("admin.support.deleted"));
    void refreshAdminSummary(true);
    await router.push(returnTo);
  } catch (error) {
    console.error("Erreur lors de la suppression du message:", error);
    toast.error(t("admin.error"));
    busy.value = null;
  }
}
</script>

<template>
  <AdminSkeleton v-if="isLoading" :rows="3" />

  <p v-else-if="!thread" class="card p-8 text-center text-text-secondary">
    {{ t("admin.support.notFound") }}
  </p>

  <div v-else class="animate-[fadeIn_0.3s_ease]">
    <router-link
      :to="returnTo"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary"
    >
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("admin.support.back") }}
    </router-link>

    <div class="mb-6 flex flex-wrap items-center gap-2">
      <AdminStatus tone="neutral" :label="t(`admin.support.kinds.${thread.kind}`)" />
      <AdminSupportStatus :status="thread.status" />
      <span v-if="thread.otherKind" class="text-sm text-text-secondary">
        {{ thread.otherKind }}
      </span>
    </div>
    <h2
      class="mb-6 break-words font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl"
    >
      {{ threadSubject(thread, 90) }}
    </h2>

    <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
      <!-- La conversation, et la réponse -->
      <section class="space-y-4">
        <div class="card p-4 md:p-5">
          <SupportConversation :messages="thread.messages" viewer="team" />
        </div>

        <form class="card space-y-3 p-4 md:p-5" @submit.prevent="sendReply('answered')">
          <label for="support-reply" class="block text-sm font-semibold text-text-secondary">
            {{ t("admin.support.replyLabel") }}
          </label>
          <textarea
            id="support-reply"
            v-model="reply"
            rows="5"
            maxlength="2000"
            class="field resize-y"
            :placeholder="t('admin.support.replyPlaceholder')"
          ></textarea>
          <p class="flex items-start gap-1.5 text-xs text-text-secondary">
            <AppIcon name="info" :size="12" class="mt-0.5 shrink-0" />
            {{ deliveryNote }}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="repliesInApp"
              type="submit"
              class="btn btn-primary"
              :disabled="busy !== null || !reply.trim()"
            >
              <AppIcon v-if="busy === 'reply'" name="spinner" :size="14" class="animate-spin" />
              <AppIcon v-else name="message" :size="14" />
              {{ t("admin.support.reply") }}
            </button>
            <button
              v-if="repliesInApp"
              type="button"
              class="btn btn-soft"
              :disabled="busy !== null || !reply.trim()"
              @click="sendReply('done')"
            >
              <AppIcon name="check" :size="14" />
              {{ t("admin.support.replyAndClose") }}
            </button>
            <a v-if="mailto" :href="mailto" class="btn btn-soft">
              <AppIcon name="envelope" :size="14" />
              {{ t("admin.support.replyByEmail") }}
            </a>
          </div>
        </form>
      </section>

      <!-- Ce qui se règle à côté -->
      <aside class="space-y-4">
        <div class="card space-y-4 p-4">
          <div>
            <label
              for="support-status"
              class="mb-2 block text-sm font-semibold text-text-secondary"
            >
              {{ t("admin.support.statusLabel") }}
            </label>
            <AppSelect
              id="support-status"
              v-model="status"
              :options="statusOptions"
              :disabled="busy !== null"
            />
          </div>
          <div>
            <label for="support-kind" class="mb-2 block text-sm font-semibold text-text-secondary">
              {{ t("admin.support.kindLabel") }}
            </label>
            <AppSelect
              id="support-kind"
              v-model="kind"
              :options="kindOptions"
              :disabled="busy !== null"
            />
          </div>
        </div>

        <dl class="card space-y-2.5 p-4 text-sm">
          <div v-for="fact in facts" :key="fact.label">
            <dt class="text-xs font-semibold text-text-secondary">{{ fact.label }}</dt>
            <dd class="break-words text-text-primary">
              <a
                v-if="fact.href"
                :href="fact.href"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 hover:text-primary"
              >
                {{ fact.value }}
                <AppIcon name="external-link" :size="11" class="opacity-60" />
              </a>
              <template v-else>{{ fact.value }}</template>
            </dd>
          </div>
        </dl>

        <form class="card space-y-2 p-4" @submit.prevent="saveNote">
          <label for="support-note" class="block text-sm font-semibold text-text-secondary">
            {{ t("admin.support.noteLabel") }}
          </label>
          <textarea
            id="support-note"
            v-model="note"
            rows="3"
            maxlength="2000"
            class="field resize-y"
            :placeholder="t('admin.support.notePlaceholder')"
          ></textarea>
          <button
            type="submit"
            class="btn btn-soft btn-sm"
            :disabled="busy !== null || note.trim() === thread.note"
          >
            <AppIcon name="check" :size="13" />
            {{ t("admin.support.saveNote") }}
          </button>
        </form>

        <button
          type="button"
          class="btn btn-soft btn-sm w-full hover:!bg-red-600/10 hover:!text-red-600 dark:hover:!text-red-400"
          :disabled="busy !== null"
          @click="remove"
        >
          <AppIcon name="trash" :size="13" />
          {{ t("admin.support.delete") }}
        </button>
      </aside>
    </div>
  </div>
</template>
