<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PrayerName, PrayerNameKind } from "../../../models/models";
import { formatPrayerName } from "../../../services/perpetualChain";
import AppIcon from "../../../components/icons/AppIcon.vue";
import type { IconName } from "../../../components/icons/registry";

/**
 * Pour qui la chaîne perpétuelle lit : les noms, rangés en deux groupes (le
 * cœur pour une refoua chelema, la bougie pour un leilouy nichmat, celle des
 * dates du calendrier).
 *
 * Les noms courent à la suite, comme une dédicace qu'on dit avant de lire,
 * plutôt qu'en lignes : une liste de vingt noms aurait repoussé la lecture
 * sous trois écrans. Les noms du lecteur sont des pastilles à la couleur du
 * thème, avec un crayon : ce sont les seuls qui s'ouvrent (docs/design.md,
 * « une pastille énonce, sauf celle qui porte une icône, qui ouvre »).
 */
const props = defineProps<{
  /** Les noms lus aujourd'hui, ceux du lecteur en tête. */
  listed: PrayerName[];
  /** Tous les noms du lecteur, pour retrouver ceux qui ne sont pas lus en ce moment. */
  mine: PrayerName[];
  currentUserId: string | null;
  loadError?: boolean;
}>();

const emit = defineEmits<{
  (e: "propose"): void;
  (e: "edit", name: PrayerName): void;
}>();

const { t } = useI18n();

/** Au-delà, le groupe se déplie : la page se lit d'abord, la liste ensuite. */
const FOLDED_COUNT = 8;

const GROUPS: { kind: PrayerNameKind; icon: IconName; labelKey: string }[] = [
  { kind: "refoua", icon: "heart", labelKey: "perpetual.names.refoua" },
  { kind: "leilouy", icon: "candle", labelKey: "perpetual.names.leilouy" },
];

const expanded = ref<Set<PrayerNameKind>>(new Set());

const groups = computed(() =>
  GROUPS.map(({ kind, icon, labelKey }) => {
    const names = props.listed.filter((name) => name.kind === kind);
    const open = expanded.value.has(kind);
    return {
      kind,
      icon,
      labelKey,
      count: names.length,
      shown: open ? names : names.slice(0, FOLDED_COUNT),
      hidden: Math.max(0, names.length - FOLDED_COUNT),
      open,
    };
  }).filter((group) => group.count > 0),
);

/** Les noms du lecteur qu'on ne lit pas en ce moment : échus, ou hors de leur semaine. */
const waiting = computed(() => {
  const listedIds = new Set(props.listed.map((name) => name.id));
  return props.mine.filter((name) => !listedIds.has(name.id));
});

const isMine = (name: PrayerName) =>
  props.currentUserId !== null && name.ownerId === props.currentUserId;

function toggle(kind: PrayerNameKind): void {
  const next = new Set(expanded.value);
  if (next.has(kind)) next.delete(kind);
  else next.add(kind);
  expanded.value = next;
}
</script>

<template>
  <section
    class="card p-5 md:p-6 max-w-3xl mx-auto w-full flex flex-col gap-5"
    aria-labelledby="prayer-names-title"
    data-prayer-names
  >
    <div class="flex items-baseline justify-between gap-3">
      <h2 id="prayer-names-title" class="text-lg md:text-xl font-bold text-text-primary">
        {{ t("perpetual.names.title") }}
      </h2>
      <span v-if="listed.length" class="text-sm text-text-secondary">
        {{ t("perpetual.names.count", { n: listed.length }, listed.length) }}
      </span>
    </div>

    <p v-if="loadError" class="text-sm text-text-secondary">
      {{ t("perpetual.names.loadError") }}
    </p>
    <p v-else-if="groups.length === 0" class="text-sm leading-relaxed text-text-secondary">
      {{ t("perpetual.names.empty") }}
    </p>

    <div
      v-for="(group, index) in groups"
      :key="group.kind"
      class="flex flex-col gap-2"
      :class="index > 0 ? 'pt-4 border-t border-line' : ''"
    >
      <h3 class="flex items-center gap-2 text-sm font-semibold text-text-secondary">
        <AppIcon :name="group.icon" :size="16" class="text-primary" />
        {{ t(group.labelKey) }}
        <span class="font-medium">{{ group.count }}</span>
      </h3>
      <ul class="text-[15px] md:text-base font-medium leading-loose text-text-primary">
        <li v-for="(name, i) in group.shown" :key="name.id" class="inline">
          <button
            v-if="isMine(name)"
            type="button"
            class="chip !text-[15px] md:!text-base !font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors align-baseline"
            :aria-label="t('perpetual.names.edit', { name: formatPrayerName(name) })"
            @click="emit('edit', name)"
          >
            <AppIcon name="pencil" :size="12" />
            {{ formatPrayerName(name) }}
          </button>
          <span v-else class="whitespace-nowrap">{{ formatPrayerName(name) }}</span>
          <span v-if="i < group.shown.length - 1" class="text-text-secondary/50" aria-hidden="true">
            ·
          </span>
        </li>
      </ul>
      <button
        v-if="group.hidden > 0"
        type="button"
        class="self-start inline-flex items-center gap-1 text-sm font-semibold text-primary"
        :aria-expanded="group.open"
        @click="toggle(group.kind)"
      >
        {{
          group.open
            ? t("perpetual.names.seeLess")
            : t("perpetual.names.seeMore", { n: group.hidden }, group.hidden)
        }}
        <AppIcon
          name="chevron-down"
          :size="14"
          class="transition-transform"
          :class="group.open ? 'rotate-180' : ''"
        />
      </button>
    </div>

    <!-- Les noms du lecteur que la liste ne montre pas en ce moment (échus, ou
         un défunt hors de la semaine de son anniversaire) : il doit pouvoir
         les retrouver pour les prolonger ou les retirer. -->
    <div v-if="waiting.length" class="flex flex-col gap-2 pt-4 border-t border-line">
      <h3 class="text-sm font-semibold text-text-secondary">
        {{ t("perpetual.names.waiting") }}
      </h3>
      <ul class="flex flex-wrap gap-2">
        <li v-for="name in waiting" :key="name.id">
          <button
            type="button"
            class="chip !text-sm bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10 transition-colors"
            :aria-label="t('perpetual.names.edit', { name: formatPrayerName(name) })"
            @click="emit('edit', name)"
          >
            <AppIcon name="pencil" :size="12" />
            {{ formatPrayerName(name) }}
          </button>
        </li>
      </ul>
    </div>

    <button
      type="button"
      class="btn btn-soft w-full sm:w-auto sm:self-start"
      @click="emit('propose')"
    >
      <AppIcon name="plus" :size="16" />
      {{ t("perpetual.names.propose") }}
    </button>
  </section>
</template>
