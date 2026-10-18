<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import SettingsGroup from "../../components/settings/SettingsGroup.vue";
import HelpVideoCard from "../../components/help/HelpVideoCard.vue";
import HelpGuideRow from "../../components/help/HelpGuideRow.vue";
import { HELP_ILLUSTRATION_COMPONENTS } from "../../components/help/illustrations";
import { isNativeApp } from "../../composables/useNativeApp";
import { useHelpText } from "../../composables/useHelpText";
import { HELP_TOPICS, guideBySlug, relatedGuides } from "../../content/help/catalog";
import { loadHelpVideos, type HelpVideo } from "../../services/helpVideos";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";

/**
 * A guide of the help center (/aide/:slug): its title and what it is about,
 * then its blocks, in order (catalog.ts): a paragraph; a point, its title,
 * two sentences and, when it is a gesture, its drawn screenshot playing
 * above; a way into the part of the app it explains. The team's videos that
 * go with it follow (services/helpVideos.ts), then other guides.
 *
 * An address that names no guide (a guide renamed, a link mistyped) leads
 * back to the help center rather than to an empty page.
 */

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const text = useHelpText();

const slug = computed(() => String(route.params.slug ?? ""));
const guide = computed(() => guideBySlug(slug.value));
const topic = computed(() => HELP_TOPICS.find((item) => item.id === guide.value?.topic));
const related = computed(() => relatedGuides(slug.value));

const allVideos = ref<HelpVideo[]>([]);
const videos = computed(() => allVideos.value.filter((video) => video.guide === slug.value));

function goBack(): void {
  if (router.options.history.state.back != null) router.back();
  else void router.replace("/aide");
}

watch(
  guide,
  (current) => {
    if (!current) {
      void router.replace("/aide");
      return;
    }
    const url = `${SITE_URL}/aide/${current.slug}`;
    seoService.setMeta({
      title: `${text(current.title)} · ${t("help.title")}`,
      description: text(current.summary),
      canonical: url,
      og: { url },
    });
  },
  { immediate: true },
);

void loadHelpVideos().then((list) => {
  allVideos.value = list;
});
</script>

<template>
  <main
    v-if="guide"
    class="mx-auto w-full max-w-2xl px-6 py-12"
    :class="{ '!px-4 !pt-6': isNativeApp }"
  >
    <button type="button" class="back-link mb-4" @click="goBack">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("help.title") }}
    </button>

    <header class="mb-8 text-center">
      <p v-if="topic" class="text-sm font-semibold text-primary">{{ text(topic.title) }}</p>
      <h1 class="font-display mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
        {{ text(guide.title) }}
      </h1>
      <p class="mt-3 text-lg leading-relaxed text-text-secondary">{{ text(guide.summary) }}</p>
    </header>

    <div class="flex flex-col gap-8">
      <template v-for="(block, i) in guide.blocks" :key="`${slug}-${i}`">
        <p v-if="block.kind === 'text'" class="leading-relaxed text-text-primary">
          {{ text(block.text) }}
        </p>

        <section v-else-if="block.kind === 'point'">
          <component
            :is="HELP_ILLUSTRATION_COMPONENTS[block.illustration]"
            v-if="block.illustration"
            class="mb-4"
          />
          <h2 class="text-lg font-semibold text-text-primary">{{ text(block.title) }}</h2>
          <p class="mt-1 leading-relaxed text-text-secondary">{{ text(block.text) }}</p>
        </section>

        <div v-else-if="block.kind === 'link'">
          <RouterLink :to="block.to" class="btn btn-soft">
            {{ text(block.label) }}
            <AppIcon name="arrow-left" :size="14" class="rotate-180 rtl:rotate-0" />
          </RouterLink>
        </div>
      </template>

      <section v-if="videos.length">
        <h2 class="mb-3 px-1 text-sm font-semibold text-text-secondary">
          {{ t("help.videos") }}
        </h2>
        <ul class="grid gap-4 sm:grid-cols-2">
          <li v-for="video in videos" :key="video.youtube" class="flex">
            <HelpVideoCard :video="video" place="guide" :guide="guide.slug" class="w-full" />
          </li>
        </ul>
      </section>

      <SettingsGroup v-if="related.length" :title="t('help.more')" class="mt-4">
        <HelpGuideRow v-for="other in related" :key="other.slug" :guide="other" />
      </SettingsGroup>
    </div>
  </main>
</template>
