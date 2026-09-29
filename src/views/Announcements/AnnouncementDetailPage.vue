<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import AnnouncementItem from "../../components/announcements/AnnouncementItem.vue";
import { useAnnouncements } from "../../composables/useAnnouncements";
import { openFeedback } from "../../composables/useFeedback";
import { isExternalLink, localized, type Announcement } from "../../services/announcements";
import { analyticsService } from "../../services/analyticsService";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";

/**
 * Une information en entier : c'est là qu'ouvre la notification. Une
 * question s'y termine par « Répondre », qui ouvre le formulaire de support
 * déjà amorcé : la réponse arrive dans la même base Notion que le reste.
 */
const route = useRoute();
const { t, locale } = useI18n();
const { markSeenUpTo } = useAnnouncements();

const announcement = ref<Announcement | null>(null);
const status = ref<"loading" | "ready" | "missing">("loading");

const id = computed(() => String(route.params.id ?? ""));
const linkLabel = computed(() => {
  const link = announcement.value?.link;
  if (!link) return "";
  return localized(link.label, locale.value) || t("announcements.openLink");
});

watch(
  id,
  async (value) => {
    status.value = "loading";
    const { announcementService } = await import("../../services/announcementService");
    const found = await announcementService.get(value);
    announcement.value = found;
    status.value = found ? "ready" : "missing";
    if (!found) return;
    markSeenUpTo(found.publishedAt);
    analyticsService.capture("announcement_viewed", { id: found.id, kind: found.kind });
    const url = `${SITE_URL}/informations/${found.id}`;
    seoService.setMeta({
      title: `${localized(found.title, locale.value)} | ${t("announcements.seoTitle")}`,
      description: localized(found.body, locale.value).slice(0, 200),
      canonical: url,
      og: { url },
    });
  },
  { immediate: true },
);

function reply(): void {
  const a = announcement.value;
  if (!a) return;
  analyticsService.capture("announcement_reply_opened", { id: a.id });
  openFeedback({
    kind: "other",
    details: t("announcements.replyPrefill", { title: localized(a.title, "fr") }),
  });
}
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-6 py-12">
    <div v-if="status === 'loading'" class="card h-48 animate-pulse"></div>

    <p v-else-if="status === 'missing'" class="card p-8 text-center text-text-secondary">
      {{ t("announcements.notFound") }}
    </p>

    <template v-else-if="announcement">
      <AnnouncementItem :announcement="announcement" class="animate-[fadeIn_0.3s_ease]" />

      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <template v-if="announcement.link">
          <a
            v-if="isExternalLink(announcement.link.url)"
            :href="announcement.link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-primary"
          >
            {{ linkLabel }}
            <AppIcon name="external-link" :size="14" />
          </a>
          <RouterLink v-else :to="announcement.link.url" class="btn btn-primary">
            {{ linkLabel }}
          </RouterLink>
        </template>
        <button
          v-if="announcement.kind === 'question'"
          type="button"
          class="btn"
          :class="announcement.link ? 'btn-soft' : 'btn-primary'"
          @click="reply"
        >
          <AppIcon name="message" :size="14" />
          {{ t("announcements.reply") }}
        </button>
      </div>
    </template>

    <p class="mt-10 text-center">
      <RouterLink
        to="/informations"
        class="text-sm font-medium text-text-secondary underline decoration-line underline-offset-4 hover:text-primary transition-colors"
      >
        {{ t("announcements.all") }}
      </RouterLink>
    </p>
  </main>
</template>
