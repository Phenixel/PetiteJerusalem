<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import WhatsNewCard from "../../components/help/WhatsNewCard.vue";
import { isNativeApp } from "../../composables/useNativeApp";
import { useHelpText } from "../../composables/useHelpText";
import { useWhatsNew, WHATS_NEW_VERSION } from "../../composables/useWhatsNew";
import { guideBySlug } from "../../content/help/catalog";
import {
  passageChapter,
  versionByName,
  type HelpPassage,
  type VideoChapter,
} from "../../content/help/versions";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";

/**
 * The page of a version (/aide/nouveautes/:version, content/help/versions.ts):
 * what it changed, passage by passage, in the order of its "what's new"
 * video. Each passage is a question list that opens in place: its title and
 * where it starts in the video; opened, « Revoir ce passage » plays the
 * video from there, then the questions it raises and their answers, and the
 * way to the guide and to the part of the app it is about.
 *
 * An address ending in a passage (`#calme`) opens on it: a guide, an
 * announcement or a message can point to one answer.
 *
 * Only the current version's video is served (useWhatsNew): an older
 * version's page keeps its passages and answers, without the video.
 */

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const text = useHelpText();
const { replayWhatsNew } = useWhatsNew();

const name = computed(() => String(route.params.version ?? ""));
const version = computed(() => versionByName(name.value));
const playable = computed(() => version.value?.version === WHATS_NEW_VERSION);
const title = computed(() => t("help.whatsNew.title", { version: name.value }));

/** The passages opened, by chapter. */
const opened = ref(new Set<string>());

function chapterOf(passage: HelpPassage): VideoChapter | null {
  if (!playable.value) return null;
  return passageChapter(name.value, locale.value, passage.chapter);
}

/** Seconds as a video counts them: 1:05. */
function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function onToggle(passage: HelpPassage, event: Event): void {
  const next = new Set(opened.value);
  if ((event.target as HTMLDetailsElement).open) next.add(passage.chapter);
  else next.delete(passage.chapter);
  opened.value = next;
}

function play(passage: HelpPassage): void {
  const chapter = chapterOf(passage);
  if (chapter) replayWhatsNew({ id: passage.chapter, start: chapter.start });
}

function guidesOf(passage: HelpPassage) {
  return (passage.guides ?? []).flatMap((slug) => guideBySlug(slug) ?? []);
}

function goBack(): void {
  if (router.options.history.state.back != null) router.back();
  else void router.replace("/aide");
}

watch(
  version,
  (current) => {
    if (!current) {
      void router.replace("/aide");
      return;
    }
    const url = `${SITE_URL}/aide/nouveautes/${current.version}`;
    seoService.setMeta({
      title: `${title.value} · ${t("help.title")}`,
      description: t("help.version.seoDescription", { version: current.version }),
      canonical: url,
      og: { url },
    });
  },
  { immediate: true },
);

/** `#calme`: that passage, opened and brought into view. */
async function openFromAddress(): Promise<void> {
  const chapter = route.hash.slice(1);
  if (!version.value?.passages.some((passage) => passage.chapter === chapter)) return;
  opened.value = new Set([...opened.value, chapter]);
  await nextTick();
  document.getElementById(chapter)?.scrollIntoView({ block: "start" });
}

onMounted(openFromAddress);
// A link to another passage of the same page changes only the address's end.
watch(() => route.hash, openFromAddress);
</script>

<template>
  <main
    v-if="version"
    class="mx-auto w-full max-w-2xl px-6 py-12"
    :class="{ '!px-4 !pt-6': isNativeApp }"
  >
    <button type="button" class="back-link mb-4" @click="goBack">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("help.title") }}
    </button>

    <header class="mb-8 text-center">
      <p class="text-sm font-semibold text-primary">{{ t("help.version.kicker") }}</p>
      <h1 class="font-display mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
        {{ title }}
      </h1>
      <p class="mt-3 text-lg leading-relaxed text-text-secondary">{{ text(version.intro) }}</p>
    </header>

    <div class="flex flex-col gap-8">
      <WhatsNewCard v-if="playable" :title="t('help.version.whole')" />

      <section>
        <h2 class="mb-3 px-1 text-sm font-semibold text-text-secondary">
          {{ t("help.version.passages") }}
        </h2>
        <ol class="flex flex-col gap-3">
          <li
            v-for="passage in version.passages"
            :id="passage.chapter"
            :key="passage.chapter"
            class="passage card"
          >
            <details :open="opened.has(passage.chapter)" @toggle="onToggle(passage, $event)">
              <summary class="flex cursor-pointer items-center gap-3 p-4">
                <span class="time" :aria-hidden="chapterOf(passage) ? undefined : 'true'">
                  {{ chapterOf(passage) ? clock(chapterOf(passage)!.start) : "" }}
                </span>
                <span class="min-w-0 flex-1 font-semibold text-text-primary">
                  {{ text(passage.title) }}
                </span>
                <AppIcon name="chevron-down" :size="16" class="chevron text-text-secondary" />
              </summary>

              <div class="flex flex-col gap-5 px-4 pb-5">
                <div v-if="chapterOf(passage)">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :aria-label="
                      t('help.version.playLabel', {
                        title: text(passage.title),
                        time: clock(chapterOf(passage)!.start),
                      })
                    "
                    @click="play(passage)"
                  >
                    <AppIcon name="play-solid" :size="12" />
                    {{ t("help.version.play") }}
                  </button>
                </div>

                <dl class="flex flex-col gap-4">
                  <div
                    v-for="(entry, i) in passage.questions"
                    :key="`${passage.chapter}-${i}`"
                    class="question"
                  >
                    <dt class="font-semibold text-text-primary">{{ text(entry.question) }}</dt>
                    <dd class="mt-1 leading-relaxed text-text-secondary">
                      {{ text(entry.answer) }}
                    </dd>
                  </div>
                </dl>

                <div v-if="guidesOf(passage).length || passage.link" class="flex flex-wrap gap-2">
                  <RouterLink
                    v-for="guide in guidesOf(passage)"
                    :key="guide.slug"
                    :to="`/aide/${guide.slug}`"
                    class="btn btn-soft btn-sm"
                  >
                    <AppIcon name="book-open" :size="14" />
                    {{ text(guide.title) }}
                  </RouterLink>
                  <RouterLink v-if="passage.link" :to="passage.link.to" class="btn btn-soft btn-sm">
                    {{ text(passage.link.label) }}
                    <AppIcon name="arrow-left" :size="14" class="rotate-180 rtl:rotate-0" />
                  </RouterLink>
                </div>
              </div>
            </details>
          </li>
        </ol>
      </section>

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

<style scoped>
/* An anchor (#calme) lands below the banner, not under it. */
.passage {
  scroll-margin-top: 5rem;
}

summary {
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

/* Where the passage starts in the video, in figures that keep their width. */
.time {
  min-width: 2.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-primary);
}

.chevron {
  flex: none;
  transition: transform 0.2s ease;
}

details[open] .chevron {
  transform: rotate(180deg);
}

/* One question from the next: a fine rule, as between two comments. */
.question + .question {
  border-top: 1px solid var(--color-line);
  padding-top: 1rem;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}
</style>
