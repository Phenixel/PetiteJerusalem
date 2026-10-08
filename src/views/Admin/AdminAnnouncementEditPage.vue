<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import AnnouncementItem from "../../components/announcements/AnnouncementItem.vue";
import AnnouncementHomeCard from "../../components/announcements/AnnouncementHomeCard.vue";
import { adminService, type AnnouncementAdminFields } from "../../services/adminService";
import {
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_KINDS,
  type Announcement,
  type AnnouncementKind,
  type LocalizedText,
} from "../../services/announcements";
import { dateTimeFormat } from "../../services/intlCache";
import { useConfirm } from "../../composables/useConfirm";
import { useToast } from "../../composables/useToast";
import { refreshAdminSummary } from "../../composables/useAdminSummary";
import { useAdminReturnTo } from "../../composables/useAdminQueryFilter";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";

/**
 * Écrire une information : sa nature, son titre et son texte (en français,
 * les traductions en option), un lien, et la publier. La case « notifier »
 * envoie la notification au moment de la publication, une seule fois : la
 * confirmation le rappelle, puisqu'on ne rattrape pas une notification.
 *
 * `/admin/informations/nouvelle` crée ; tout autre identifiant modifie.
 */
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { confirm } = useConfirm();
const toast = useToast();

// Retour à la liste telle qu'on l'a quittée (filtre, tri), voir useAdminReturnTo.
const returnTo = useAdminReturnTo("/admin/informations");

const NEW_ID = "nouvelle";
const routeId = computed(() => String(route.params.id ?? ""));
const isNew = computed(() => routeId.value === NEW_ID);

const existing = ref<Announcement | null>(null);
const isLoading = ref(true);
const isSaving = ref(false);
const isDeleting = ref(false);
const errorMessage = ref("");

const kind = ref<AnnouncementKind>("news");
const title = ref<{ fr: string; en: string; he: string }>({ fr: "", en: "", he: "" });
const body = ref<{ fr: string; en: string; he: string }>({ fr: "", en: "", he: "" });
const linkUrl = ref("");
const linkLabel = ref<{ fr: string; en: string; he: string }>({ fr: "", en: "", he: "" });
const version = ref("");
const resolved = ref(false);
const published = ref(false);
const notify = ref(true);

const notifiedLabel = computed(() =>
  existing.value?.notifiedAt
    ? t("admin.announcements.notifiedAt", {
        date: dateTimeFormat("fr", { dateStyle: "long", timeStyle: "short" }).format(
          existing.value.notifiedAt,
        ),
      })
    : "",
);

onMounted(async () => {
  try {
    if (isNew.value) return;
    const found = await adminService.getAnnouncement(routeId.value);
    existing.value = found;
    if (!found) return;
    kind.value = found.kind;
    title.value = { fr: found.title.fr, en: found.title.en ?? "", he: found.title.he ?? "" };
    body.value = { fr: found.body.fr, en: found.body.en ?? "", he: found.body.he ?? "" };
    linkUrl.value = found.link?.url ?? "";
    linkLabel.value = {
      fr: found.link?.label.fr ?? "",
      en: found.link?.label.en ?? "",
      he: found.link?.label.he ?? "",
    };
    version.value = found.version ?? "";
    resolved.value = found.resolved;
    published.value = found.published;
    notify.value = found.notify;
  } finally {
    isLoading.value = false;
  }
});

/** Les champs remplis seulement : une traduction vide n'est pas enregistrée. */
function text(value: { fr: string; en: string; he: string }): LocalizedText {
  const out: LocalizedText = { fr: value.fr.trim() };
  if (value.en.trim()) out.en = value.en.trim();
  if (value.he.trim()) out.he = value.he.trim();
  return out;
}

const fields = computed<AnnouncementAdminFields>(() => ({
  kind: kind.value,
  title: text(title.value),
  body: text(body.value),
  link: linkUrl.value.trim() ? { url: linkUrl.value.trim(), label: text(linkLabel.value) } : null,
  version:
    (kind.value === "release" || kind.value === "incident") && version.value.trim()
      ? version.value.trim()
      : null,
  resolved: kind.value === "incident" ? resolved.value : false,
  published: published.value,
  notify: notify.value,
}));

/** L'aperçu : l'information telle que la liste la montrera. */
const preview = computed<Announcement>(() => ({
  ...fields.value,
  id: existing.value?.id ?? "apercu",
  publishedAt: existing.value?.publishedAt ?? (published.value ? new Date() : null),
  updatedAt: null,
  notifiedAt: existing.value?.notifiedAt ?? null,
}));

/** Cette sauvegarde déclenchera-t-elle l'envoi ? */
// Même règle que la Cloud Function (isNotifyTransition) : l'envoi part quand
// l'annonce DEVIENT publiée avec la case cochée, jamais sur une correction.
const willNotify = computed(
  () =>
    published.value &&
    notify.value &&
    !existing.value?.notifiedAt &&
    !(existing.value?.published && existing.value?.notify),
);

async function save(): Promise<void> {
  errorMessage.value = "";
  if (!title.value.fr.trim() || !body.value.fr.trim()) {
    errorMessage.value = t("admin.announcements.missingFields");
    return;
  }
  const url = linkUrl.value.trim();
  if (url && !url.startsWith("/") && !/^https?:\/\//i.test(url)) {
    errorMessage.value = t("admin.announcements.invalidLink");
    return;
  }
  if (willNotify.value) {
    const accepted = await confirm({
      title: t("admin.announcements.notifyConfirmTitle"),
      message: t("admin.announcements.notifyConfirmMessage"),
      confirmLabel: t("admin.announcements.notifyConfirmLabel"),
    });
    if (!accepted) return;
  }
  isSaving.value = true;
  try {
    await adminService.saveAnnouncement(
      isNew.value ? null : routeId.value,
      fields.value,
      existing.value,
    );
    toast.success(t("admin.announcements.saved"));
    void refreshAdminSummary(true);
    router.push(returnTo);
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'information:", error);
    errorMessage.value = t("admin.error");
  } finally {
    isSaving.value = false;
  }
}

async function remove(): Promise<void> {
  if (!existing.value) return;
  const accepted = await confirm({
    title: t("admin.announcements.deleteConfirm"),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!accepted) return;
  isDeleting.value = true;
  try {
    await adminService.deleteAnnouncement(existing.value.id);
    toast.success(t("admin.announcements.deleted"));
    void refreshAdminSummary(true);
    router.push(returnTo);
  } catch (error) {
    console.error("Erreur lors de la suppression de l'information:", error);
    toast.error(t("admin.error"));
    isDeleting.value = false;
  }
}
</script>

<template>
  <AdminSkeleton v-if="isLoading" :rows="3" />

  <p v-else-if="!isNew && !existing" class="card p-8 text-center text-text-secondary">
    {{ t("admin.announcements.notFound") }}
  </p>

  <div v-else class="animate-[fadeIn_0.3s_ease]">
    <router-link
      :to="returnTo"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary"
    >
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("admin.announcements.back") }}
    </router-link>
    <h2 class="mb-6 font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
      {{ isNew ? t("admin.announcements.create") : t("admin.announcements.editTitle") }}
    </h2>

    <!-- Le formulaire à gauche, l'aperçu à droite, qui suit le défilement :
         on voit l'annonce se composer telle que les lecteurs la verront. -->
    <div class="grid items-start gap-6 lg:grid-cols-5">
      <form class="card space-y-6 p-5 text-left md:p-6 lg:col-span-3" @submit.prevent="save">
        <div>
          <span class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("admin.announcements.kind")
          }}</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="k in ANNOUNCEMENT_KINDS"
              :key="k"
              type="button"
              class="chip cursor-pointer transition-colors"
              :class="
                kind === k
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'opacity-70 hover:opacity-100'
              "
              @click="kind = k"
            >
              <AppIcon :name="ANNOUNCEMENT_ICONS[k]" :size="13" />
              {{ t(`announcements.kinds.${k}`) }}
            </button>
          </div>
          <p class="mt-2 text-xs text-text-secondary">
            {{ t(`admin.announcements.kindHint.${kind}`) }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2" for="ann-title">{{
            t("admin.announcements.titleFr")
          }}</label>
          <input id="ann-title" v-model="title.fr" type="text" maxlength="120" class="field" />
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2" for="ann-body">{{
            t("admin.announcements.bodyFr")
          }}</label>
          <textarea id="ann-body" v-model="body.fr" rows="6" class="field resize-y"></textarea>
        </div>

        <div v-if="kind === 'release' || kind === 'incident'">
          <label class="block text-sm font-semibold text-text-secondary mb-2" for="ann-version">{{
            t(
              kind === "incident"
                ? "admin.announcements.fixVersionLabel"
                : "admin.announcements.versionLabel",
            )
          }}</label>
          <input
            id="ann-version"
            v-model="version"
            type="text"
            placeholder="3.11.0"
            class="field sm:w-48"
          />
          <p class="mt-2 text-xs text-text-secondary">
            {{
              t(
                kind === "incident"
                  ? "admin.announcements.fixVersionHint"
                  : "admin.announcements.versionHint",
              )
            }}
          </p>
        </div>

        <label v-if="kind === 'incident'" class="inline-flex items-center gap-2 cursor-pointer">
          <input
            v-model="resolved"
            type="checkbox"
            class="w-5 h-5 rounded accent-primary cursor-pointer"
          />
          <span class="font-semibold text-text-primary">{{
            t("admin.announcements.resolvedLabel")
          }}</span>
        </label>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2" for="ann-link">{{
              t("admin.announcements.linkUrl")
            }}</label>
            <input
              id="ann-link"
              v-model="linkUrl"
              type="text"
              placeholder="/bibliotheque/sidour"
              class="field"
            />
          </div>
          <div>
            <label
              class="block text-sm font-semibold text-text-secondary mb-2"
              for="ann-link-label"
              >{{ t("admin.announcements.linkLabel") }}</label
            >
            <input
              id="ann-link-label"
              v-model="linkLabel.fr"
              type="text"
              :placeholder="t('announcements.openLink')"
              class="field"
            />
          </div>
        </div>

        <details class="rounded-control bg-surface-soft p-4">
          <summary class="cursor-pointer font-semibold text-text-primary">
            {{ t("admin.announcements.translations") }}
          </summary>
          <p class="mt-2 text-xs text-text-secondary">
            {{ t("admin.announcements.translationsHint") }}
          </p>
          <div v-for="lang in ['en', 'he'] as const" :key="lang" class="mt-4 space-y-3">
            <p class="text-sm font-semibold text-text-secondary">
              {{ t(`admin.announcements.lang.${lang}`) }}
            </p>
            <input
              v-model="title[lang]"
              type="text"
              maxlength="120"
              :dir="lang === 'he' ? 'rtl' : 'ltr'"
              :placeholder="t('admin.announcements.titlePlaceholder')"
              class="field"
            />
            <textarea
              v-model="body[lang]"
              rows="4"
              :dir="lang === 'he' ? 'rtl' : 'ltr'"
              :placeholder="t('admin.announcements.bodyPlaceholder')"
              class="field resize-y"
            ></textarea>
            <input
              v-if="linkUrl.trim()"
              v-model="linkLabel[lang]"
              type="text"
              :dir="lang === 'he' ? 'rtl' : 'ltr'"
              :placeholder="t('admin.announcements.linkLabel')"
              class="field"
            />
          </div>
        </details>

        <div class="space-y-3">
          <label class="flex items-start gap-2 cursor-pointer">
            <input
              v-model="published"
              type="checkbox"
              class="w-5 h-5 mt-0.5 rounded accent-primary cursor-pointer"
            />
            <span class="font-semibold text-text-primary">{{
              t("admin.announcements.publishedLabel")
            }}</span>
          </label>
          <label
            class="flex items-start gap-2"
            :class="existing?.notifiedAt ? 'opacity-60' : 'cursor-pointer'"
          >
            <input
              v-model="notify"
              type="checkbox"
              :disabled="!!existing?.notifiedAt"
              class="w-5 h-5 mt-0.5 rounded accent-primary cursor-pointer"
            />
            <span>
              <span class="block font-semibold text-text-primary">{{
                t("admin.announcements.notifyLabel")
              }}</span>
              <span class="block text-sm text-text-secondary">
                {{ notifiedLabel || t("admin.announcements.notifyHint") }}
              </span>
            </span>
          </label>
        </div>

        <p
          v-if="errorMessage"
          class="text-sm text-red-600 flex items-center gap-1.5 dark:text-red-400"
        >
          <AppIcon name="alert-circle" :size="14" />
          {{ errorMessage }}
        </p>

        <div class="flex flex-col-reverse sm:flex-row gap-4 pt-2">
          <button
            v-if="existing"
            type="button"
            class="btn btn-danger w-full sm:w-auto"
            :disabled="isDeleting || isSaving"
            @click="remove"
          >
            <AppIcon v-if="isDeleting" name="spinner" :size="14" class="animate-spin" />
            <AppIcon v-else name="trash" :size="14" />
            {{ t("common.delete") }}
          </button>
          <router-link :to="returnTo" class="btn btn-soft w-full sm:w-auto sm:ml-auto">
            {{ t("common.cancel") }}
          </router-link>
          <button type="submit" class="btn btn-primary w-full sm:w-auto" :disabled="isSaving">
            <AppIcon v-if="isSaving" name="spinner" :size="15" class="animate-spin" />
            <AppIcon v-else-if="willNotify" name="bell" :size="15" />
            {{
              isSaving
                ? t("common.saving")
                : willNotify
                  ? t("admin.announcements.saveAndNotify")
                  : t("common.save")
            }}
          </button>
        </div>
      </form>

      <section class="lg:sticky lg:top-24 lg:col-span-2">
        <h3 class="mb-3 text-sm font-semibold text-text-secondary">
          {{ t("admin.announcements.preview") }}
        </h3>
        <AnnouncementItem :announcement="preview" />
        <h3 class="mb-3 mt-6 text-sm font-semibold text-text-secondary">
          {{ t("admin.announcements.previewHome") }}
        </h3>
        <AnnouncementHomeCard :announcement="preview" mode="preview" :unread-count="1" no-link />
      </section>
    </div>
  </div>
</template>
