<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import { useAnnouncements } from "../../composables/useAnnouncements";
import { analyticsService } from "../../services/analyticsService";
import { localized, type Announcement, type Poll } from "../../services/announcements";

/**
 * Les choix d'un sondage, sous la question : un seul ou plusieurs, chacun
 * avec son image s'il en a une. On vote sans compte ; un nouveau vote
 * remplace le précédent tant que le sondage est ouvert. Clos, les choix
 * restent lisibles, celui de l'appareil marqué.
 *
 * `preview` (l'aperçu du backoffice) montre les choix sans permettre de voter.
 */
const props = defineProps<{
  announcement: Announcement & { poll: Poll };
  preview?: boolean;
}>();

const { t, locale } = useI18n();
const { votes, answerPoll } = useAnnouncements();

const poll = computed(() => props.announcement.poll);
const mine = computed(() => votes.value[props.announcement.id] ?? null);
const hasImages = computed(() => poll.value.options.some((o) => o.image));

/**
 * Des choix qui valent pour le sondage tel qu'il est : dans son ordre, sans
 * un choix retiré depuis, un seul s'il n'en permet plus plusieurs. Un vote
 * gardé sur l'appareil peut dater d'avant une correction du sondage, et les
 * règles refuseraient de le renvoyer tel quel.
 */
function valid(ids: readonly string[]): string[] {
  const kept = poll.value.options.map((o) => o.id).filter((id) => ids.includes(id));
  return poll.value.multiple ? kept : kept.slice(0, 1);
}

/**
 * En train de choisir : jamais voté, « Changer mon choix », ou un vote dont
 * aucun choix n'existe plus (tous retirés depuis) : il n'y a rien à montrer
 * comme choisi, on rechoisit.
 */
const editing = ref(!valid(mine.value ?? []).length);
const selected = ref<string[]>(valid(mine.value ?? []));
const choices = computed(() => valid(selected.value));
const sending = ref(false);
/** « network » : pas de connexion ; « refused » : le sondage ne prend plus ce vote. */
const failed = ref<"network" | "refused" | null>(null);

watch(mine, (value) => {
  if (value && !sending.value && valid(value).length) {
    selected.value = valid(value);
    editing.value = false;
  }
});

const canVote = computed(() => !props.preview && !poll.value.closed && editing.value);

function toggle(id: string): void {
  if (!canVote.value) return;
  if (!poll.value.multiple) {
    selected.value = [id];
    return;
  }
  selected.value = selected.value.includes(id)
    ? selected.value.filter((c) => c !== id)
    : [...selected.value, id];
}

async function submit(): Promise<void> {
  // Dans l'ordre des choix, pas dans celui des clics.
  const sent = choices.value;
  if (!sent.length || sending.value) return;
  sending.value = true;
  failed.value = null;
  const changed = !!mine.value;
  try {
    await answerPoll(props.announcement, sent);
    editing.value = false;
    analyticsService.capture("announcement_poll_answered", {
      id: props.announcement.id,
      choices_count: sent.length,
      changed,
    });
  } catch (error) {
    console.warn("Vote non enregistré:", error);
    failed.value =
      (error as { code?: string }).code === "permission-denied" ? "refused" : "network";
    // Refusé : le sondage a changé depuis la lecture de la liste, gardée en
    // cache. La prochaine ouverture le relira du serveur.
    if (failed.value === "refused") {
      void import("../../services/announcementService").then((m) =>
        m.announcementService.invalidate(),
      );
    }
  } finally {
    sending.value = false;
  }
}

function change(): void {
  selected.value = valid(selected.value);
  editing.value = true;
}
</script>

<template>
  <section class="mt-6" :aria-label="t('announcements.poll.title')">
    <!-- Closed, the « Sondage clos » chip of the announcement just above says it. -->
    <p v-if="!poll.closed" class="mb-3 text-sm font-semibold text-text-secondary">
      {{ poll.multiple ? t("announcements.poll.chooseMany") : t("announcements.poll.chooseOne") }}
    </p>

    <div :class="hasImages ? 'grid grid-cols-2 gap-3 sm:grid-cols-3' : 'space-y-2'">
      <label
        v-for="option in poll.options"
        :key="option.id"
        class="card flex overflow-hidden transition-colors"
        :class="[
          hasImages ? 'flex-col' : 'items-center gap-3 p-4',
          selected.includes(option.id) ? 'ring-2 ring-primary' : '',
          canVote ? 'card-hover cursor-pointer' : '',
        ]"
      >
        <img
          v-if="hasImages && option.image"
          :src="option.image"
          :alt="localized(option.label, locale)"
          loading="lazy"
          class="aspect-[4/3] w-full bg-surface-soft object-cover"
        />
        <div
          v-else-if="hasImages"
          class="aspect-[4/3] w-full bg-surface-soft"
          aria-hidden="true"
        ></div>
        <span class="flex items-center gap-3" :class="{ 'p-3': hasImages }">
          <input
            :type="poll.multiple ? 'checkbox' : 'radio'"
            :name="`poll-${announcement.id}`"
            :value="option.id"
            :checked="selected.includes(option.id)"
            :disabled="!canVote"
            class="h-5 w-5 shrink-0 accent-primary"
            @change="toggle(option.id)"
          />
          <span class="font-medium leading-snug text-text-primary">
            {{ localized(option.label, locale) }}
          </span>
        </span>
      </label>
    </div>

    <div v-if="!preview" class="mt-4 flex flex-wrap items-center justify-center gap-3">
      <template v-if="!poll.closed">
        <button
          v-if="editing"
          type="button"
          class="btn btn-primary"
          :disabled="!choices.length || sending"
          @click="submit"
        >
          <AppIcon v-if="sending" name="spinner" :size="14" class="animate-spin" />
          <AppIcon v-else name="check" :size="14" />
          {{ t("announcements.poll.submit") }}
        </button>
        <template v-else>
          <p class="flex items-center gap-1.5 text-sm font-medium text-primary">
            <AppIcon name="circle-check" :size="16" />
            {{ t("announcements.poll.thanks") }}
          </p>
          <button type="button" class="btn btn-soft" @click="change">
            <AppIcon name="pencil" :size="14" />
            {{ t("announcements.poll.change") }}
          </button>
        </template>
      </template>
      <p v-else-if="mine" class="text-sm text-text-secondary">
        {{ t("announcements.poll.closedVoted") }}
      </p>
    </div>
    <p
      v-if="failed"
      class="mt-3 flex items-center justify-center gap-1.5 text-sm text-red-600 dark:text-red-400"
    >
      <AppIcon name="alert-circle" :size="14" />
      {{ failed === "refused" ? t("announcements.poll.refused") : t("announcements.poll.error") }}
    </p>
  </section>
</template>
