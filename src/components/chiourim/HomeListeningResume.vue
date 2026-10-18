<script setup lang="ts">
/**
 * « Reprendre l'écoute » on the home page: the audio courses begun and not
 * finished on this device, the most recent first, as at the top of the
 * Chiourim catalog (ResumeTile): a touch picks the course up where it was
 * left. A home page block, hidden until one shows it (useHomeLayout);
 * nothing to resume, it disappears.
 *
 * Loaded on demand (see HomeView): it reads the catalog of courses, and only
 * when there is something to resume.
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { Chiour } from "../../models/models";
import { chiourService } from "../../services/chiourService";
import { serieService } from "../../services/serieService";
import { inProgressSlugs } from "../../services/listeningProgress";
import ChiourRail from "./ChiourRail.vue";
import ResumeTile from "./ResumeTile.vue";

const MAX_TILES = 8;

const { t } = useI18n();

const slugs = inProgressSlugs();
const chiourim = ref<Chiour[]>(chiourService.getCachedChiourim() ?? []);

onMounted(() => {
  if (!slugs.length || (chiourim.value.length && !chiourService.isCacheStale())) return;
  chiourService
    .getAllChiourim()
    .then((list) => (chiourim.value = list))
    .catch(() => {
      // Offline, with nothing in the cache: the block stays silent.
    });
});

const bySlug = computed(() => new Map(chiourim.value.map((c) => [c.slug, c])));
const items = computed(() =>
  slugs
    .map((slug) => bySlug.value.get(slug))
    .filter((c): c is Chiour => !!c && !!c.mediaUrl)
    .slice(0, MAX_TILES),
);

/** The episodes of a series, in order: the queue of a course resumed. */
const queueOf = (chiour: Chiour): Chiour[] =>
  chiour.serieId ? serieService.episodesOf(chiour.serieId, chiourim.value) : [chiour];
</script>

<template>
  <ChiourRail v-if="items.length" :title="t('chiourim.resume')" see-all-to="/chiourim">
    <ResumeTile
      v-for="chiour in items"
      :key="chiour.slug"
      :chiour="chiour"
      :queue="queueOf(chiour)"
    />
  </ChiourRail>
</template>
