<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import SettingsGroup from "../../components/settings/SettingsGroup.vue";
import SettingsRow from "../../components/settings/SettingsRow.vue";
import WhatsNewCard from "../../components/help/WhatsNewCard.vue";
import HelpVideoCard from "../../components/help/HelpVideoCard.vue";
import HelpGuideRow from "../../components/help/HelpGuideRow.vue";
import { isNativeApp } from "../../composables/useNativeApp";
import { useOnboarding } from "../../composables/useOnboarding";
import { useFeatureTips } from "../../composables/useFeatureTips";
import { useToast } from "../../composables/useToast";
import { useHelpText } from "../../composables/useHelpText";
import { guidesByTopic } from "../../content/help/catalog";
import { HELP_VERSIONS } from "../../content/help/versions";
import { loadHelpVideos, type HelpVideo } from "../../services/helpVideos";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";

/**
 * The help center (docs/help-center.md, docs/design.md "The help center
 * shows how, part by part"): where one comes to understand a part of the
 * app nobody explained.
 *
 * From top to bottom:
 *  - the "what's new" video, for whoever skipped it at launch, and the
 *    versions, each explained passage by passage (/aide/nouveautes/4.0);
 *  - the team's videos, published on YouTube (none yet: the section shows
 *    once the site lists one);
 *  - the guides, by part of the app, each a page of its own;
 *  - in the app, the introduction and the tips to see again;
 *  - and, when nothing answered, « Nous écrire ».
 *
 * Its guides are local and it opens offline; the videos need a network.
 */

const { t } = useI18n();
const router = useRouter();
const text = useHelpText();
const toast = useToast();

const groups = computed(() => guidesByTopic());

const videos = ref<HelpVideo[]>([]);

// The introduction and the tips show once: this is where they come back.
const { replayOnboarding } = useOnboarding();
const { resetFeatureTips } = useFeatureTips();

function replayTips(): void {
  resetFeatureTips();
  toast.info(t("tips.replayed"));
}

/** The app arrives here from its profile: the page has its way back. */
function goBack(): void {
  if (router.options.history.state.back != null) router.back();
  else void router.replace("/profile");
}

onMounted(() => {
  const url = `${SITE_URL}/aide`;
  seoService.setMeta({
    title: t("help.title"),
    description: t("help.seoDescription"),
    canonical: url,
    og: { url },
  });
  void loadHelpVideos().then((list) => {
    videos.value = list;
  });
});
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-6 py-12" :class="{ '!px-4 !pt-6': isNativeApp }">
    <button v-if="isNativeApp" type="button" class="back-link mb-4" @click="goBack">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("common.profile") }}
    </button>

    <header class="mb-8 text-center animate-[fadeIn_0.5s_ease]">
      <h1 class="font-display text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
        {{ t("help.title") }}
      </h1>
      <p class="mt-4 text-lg leading-relaxed text-text-secondary">
        {{ t("help.subtitle") }}
      </p>
    </header>

    <div class="flex flex-col gap-8">
      <WhatsNewCard />

      <SettingsGroup :title="t('help.versions')">
        <SettingsRow
          v-for="entry in HELP_VERSIONS"
          :key="entry.version"
          icon="list"
          :label="t('help.version.row', { version: entry.version })"
          :to="`/aide/nouveautes/${entry.version}`"
        />
      </SettingsGroup>

      <section v-if="videos.length">
        <h2 class="mb-3 px-1 text-sm font-semibold text-text-secondary">
          {{ t("help.videos") }}
        </h2>
        <ul class="grid gap-4 sm:grid-cols-2">
          <li v-for="video in videos" :key="video.youtube" class="flex">
            <HelpVideoCard :video="video" place="center" class="w-full" />
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-7">
        <h2 class="sr-only">{{ t("help.guides") }}</h2>
        <SettingsGroup
          v-for="group in groups"
          :key="group.topic.id"
          :title="text(group.topic.title)"
        >
          <HelpGuideRow v-for="guide in group.guides" :key="guide.slug" :guide="guide" />
        </SettingsGroup>
      </section>

      <SettingsGroup v-if="isNativeApp" :title="t('help.replay')">
        <SettingsRow icon="rocket" :label="t('onboarding.replay')" @click="replayOnboarding" />
        <SettingsRow icon="lightbulb" :label="t('tips.replay')" @click="replayTips" />
      </SettingsGroup>

      <section class="px-1 text-center">
        <h2 class="font-semibold text-text-primary">{{ t("help.contact.title") }}</h2>
        <p class="mt-1 text-sm text-text-secondary">{{ t("help.contact.text") }}</p>
        <RouterLink to="/contact" class="btn btn-soft mt-4">
          <AppIcon name="message" :size="15" />
          {{ t("footer.reportIssue") }}
        </RouterLink>
      </section>
    </div>
  </main>
</template>
