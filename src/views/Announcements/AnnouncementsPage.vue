<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import AnnouncementItem from "../../components/announcements/AnnouncementItem.vue";
import AnnouncementsPushPrompt from "../../components/announcements/AnnouncementsPushPrompt.vue";
import { useAnnouncements } from "../../composables/useAnnouncements";
import { unreadAnnouncements } from "../../services/announcements";
import { analyticsService } from "../../services/analyticsService";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";

/**
 * Les informations de l'équipe, de la plus récente à la plus ancienne :
 * nouveautés, notes de version, incidents, questions.
 *
 * La visite vaut lecture : dès que la liste est là, tout est marqué vu (en
 * partant, ce serait trop tard si l'app se ferme sur cette page). Les
 * pastilles « Nouveau » se calculent sur la visite PRÉCÉDENTE, figée à
 * l'arrivée, sinon elles s'éteindraient à l'instant où on vient les lire.
 */
const { t } = useI18n();
const { items, status, seenAt, seenVersion, installed, load, markAllSeen } = useAnnouncements();

const seenBefore = ref(seenAt.value);
const seenVersionBefore = ref(seenVersion.value);
// Les mêmes que l'accueil : une note de version pas encore installée n'est
// pas « Nouveau » (elle ne le sera qu'une fois la version là).
const newIds = computed(
  () =>
    new Set(
      unreadAnnouncements(
        items.value,
        seenBefore.value,
        installed.value,
        Date.now(),
        seenVersionBefore.value,
      ).map((a) => a.id),
    ),
);

onMounted(async () => {
  const url = `${SITE_URL}/informations`;
  seoService.setMeta({
    title: t("announcements.seoTitle"),
    description: t("announcements.subtitle"),
    canonical: url,
    og: { url },
  });
  await load(true);
  if (status.value !== "ready") return;
  markAllSeen();
  analyticsService.capture("announcements_viewed", { unread: newIds.value.size });
});
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-6 py-12">
    <div class="mb-10 text-center animate-[fadeIn_0.5s_ease]">
      <h1 class="font-display text-4xl md:text-5xl font-bold text-text-primary tracking-tight">
        {{ t("announcements.title") }}
      </h1>
      <p class="mt-4 text-lg text-text-secondary leading-relaxed">
        {{ t("announcements.subtitle") }}
      </p>
      <AnnouncementsPushPrompt class="mt-5" />
    </div>

    <div v-if="status === 'loading'" class="space-y-4">
      <div v-for="n in 3" :key="n" class="card h-32 animate-pulse"></div>
    </div>

    <p v-else-if="status === 'error'" class="card p-8 text-center text-text-secondary">
      <AppIcon name="alert-circle" :size="20" class="mx-auto mb-3" />
      {{ t("announcements.loadError") }}
    </p>

    <p v-else-if="items.length === 0" class="card p-8 text-center text-text-secondary">
      {{ t("announcements.empty") }}
    </p>

    <ul v-else class="space-y-4">
      <li v-for="a in items" :key="a.id">
        <AnnouncementItem
          :announcement="a"
          :is-new="newIds.has(a.id)"
          :to="`/informations/${a.id}`"
          @click="analyticsService.capture('announcement_opened', { id: a.id, source: 'list' })"
        />
      </li>
    </ul>
  </main>
</template>
