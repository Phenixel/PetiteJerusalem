<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import SettingsGroup from "../settings/SettingsGroup.vue";
import { useHelpText } from "../../composables/useHelpText";
import { guideBySlug } from "../../content/help/catalog";
import { HELP_FAQ } from "../../content/help/faq";

/**
 * The help center's frequently asked questions (content/help/faq.ts): a
 * panel per topic, like the guides, each row a question that opens in
 * place on its answer, then the guide that explains more and the way into
 * the app. All closed, the questions read as a list; one opens at a time
 * under the finger, the others stay as they were.
 *
 * `/aide#compte` opens on that question: the team can answer a message
 * with a link to it.
 */

const { t } = useI18n();
const route = useRoute();
const text = useHelpText();

const opened = ref(new Set<string>());

function onToggle(id: string, event: Event): void {
  const next = new Set(opened.value);
  if ((event.target as HTMLDetailsElement).open) next.add(id);
  else next.delete(id);
  opened.value = next;
}

async function openFromAddress(): Promise<void> {
  const id = route.hash.slice(1);
  if (!HELP_FAQ.some((group) => group.entries.some((entry) => entry.id === id))) return;
  opened.value = new Set([...opened.value, id]);
  await nextTick();
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}

onMounted(openFromAddress);
watch(() => route.hash, openFromAddress);
</script>

<template>
  <section class="flex flex-col gap-5">
    <h2 class="font-display px-1 text-2xl font-bold text-text-primary">
      {{ t("help.faq.title") }}
    </h2>
    <SettingsGroup v-for="group in HELP_FAQ" :key="group.entries[0].id" :title="text(group.title)">
      <li v-for="entry in group.entries" :id="entry.id" :key="entry.id" class="question">
        <details :open="opened.has(entry.id)" @toggle="onToggle(entry.id, $event)">
          <summary class="flex cursor-pointer items-center gap-3 px-4 py-3.5">
            <span class="min-w-0 flex-1 font-medium leading-snug text-text-primary">
              {{ text(entry.question) }}
            </span>
            <AppIcon name="chevron-down" :size="16" class="chevron text-text-secondary/60" />
          </summary>
          <div class="flex flex-col gap-3 px-4 pb-4">
            <p class="leading-relaxed text-text-secondary">{{ text(entry.answer) }}</p>
            <div v-if="entry.guide || entry.link" class="flex flex-wrap gap-2">
              <RouterLink
                v-if="entry.guide && guideBySlug(entry.guide)"
                :to="`/aide/${entry.guide}`"
                class="btn btn-soft btn-sm"
              >
                <AppIcon name="book-open" :size="14" />
                {{ text(guideBySlug(entry.guide)!.title) }}
              </RouterLink>
              <RouterLink v-if="entry.link" :to="entry.link.to" class="btn btn-soft btn-sm">
                {{ text(entry.link.label) }}
                <AppIcon name="arrow-left" :size="14" class="rotate-180 rtl:rotate-0" />
              </RouterLink>
            </div>
          </div>
        </details>
      </li>
    </SettingsGroup>
  </section>
</template>

<style scoped>
/* An anchor (/aide#compte) lands below the banner, not under it. */
.question {
  scroll-margin-top: 5rem;
}

summary {
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

.chevron {
  flex: none;
  transition: transform 0.2s ease;
}

details[open] .chevron {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}
</style>
