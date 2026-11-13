<script lang="ts">
import type { CycleChoice, HabitPreset } from "../../../services/parcours/model";

/** Un modèle tout prêt qu'on regarde avant de le prendre : une habitude, ou un cycle. */
export type PresetChoice =
  | { kind: "habit"; preset: HabitPreset }
  | { kind: "cycle"; cycle: CycleChoice };
</script>

<script setup lang="ts">
/**
 * Un modèle tout prêt, avant de le prendre : ce qu'il demande, quels jours,
 * à quel moment, et un vrai bouton pour l'ajouter. Rien ne s'ajoute plus
 * d'un seul toucher sur la liste : on s'y était surpris à ajouter les tefilot
 * sans le vouloir. Une habitude peut se régler d'abord (ses jours, son
 * moment) : l'étape de l'habitude s'ouvre alors, avec ses réglages d'office.
 *
 * Le bouton ne répond qu'un instant après l'ouverture : un double toucher sur
 * la liste ne l'atteint pas.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { HABIT_DEFAULTS } from "../../../services/parcours/create";
import BottomSheet from "../BottomSheet.vue";

const props = defineProps<{ choice: PresetChoice | null }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "add"): void;
  (e: "adjust"): void;
}>();

const { t } = useI18n();

/** Le temps que la feuille monte : avant, le bouton ne prend pas le toucher. */
const ARM_MS = 400;
const armed = ref(false);
let armTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.choice,
  (choice) => {
    armed.value = false;
    clearTimeout(armTimer);
    if (choice) armTimer = setTimeout(() => (armed.value = true), ARM_MS);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearTimeout(armTimer));

const title = computed(() => {
  const choice = props.choice;
  if (!choice) return "";
  return choice.kind === "habit"
    ? t(`parcours.habits.${choice.preset}`)
    : t(`parcours.cycles.${choice.cycle}.pick`);
});

const about = computed(() => {
  const choice = props.choice;
  if (!choice) return "";
  return choice.kind === "habit"
    ? t(`parcours.habitAbout.${choice.preset}`)
    : t(`parcours.cycles.${choice.cycle}.hint`);
});

/** Ses jours et son moment, d'office : « Chaque jour », « Au coucher ». */
const tags = computed(() => {
  const choice = props.choice;
  if (choice?.kind !== "habit") return [];
  const defaults = HABIT_DEFAULTS[choice.preset];
  const days =
    defaults.days.length === 7
      ? t("parcours.create.tagEveryDay")
      : t("parcours.create.tagWeekdays");
  const when =
    choice.preset === "tefilot"
      ? t("parcours.create.eachAtItsTime")
      : defaults.anchor
        ? t(`parcours.anchors.${defaults.anchor}`)
        : t(`parcours.moments.${defaults.moment}`);
  return [days, when];
});

function add(): void {
  if (armed.value) emit("add");
}
</script>

<template>
  <BottomSheet :open="choice !== null" :label="title" @close="emit('close')">
    <template v-if="choice">
      <p class="text-[13px] font-semibold text-text-secondary">
        {{
          choice.kind === "habit" ? t("parcours.create.kindHabit") : t("parcours.create.kindCycle")
        }}
      </p>
      <p class="mt-1 text-2xl font-extrabold">{{ title }}</p>
      <p class="mt-2 text-[15px] leading-normal text-text-secondary">{{ about }}</p>
      <div v-if="tags.length" class="mt-3 flex flex-wrap gap-2">
        <span v-for="tag in tags" :key="tag" class="preset-tag">{{ tag }}</span>
      </div>

      <button
        type="button"
        class="btn btn-primary preset-add"
        :aria-disabled="armed ? undefined : 'true'"
        @click="add"
      >
        {{ t("parcours.create.confirmAdd") }}
      </button>
      <div class="mt-2 grid gap-2" :class="choice.kind === 'habit' ? 'grid-cols-2' : 'grid-cols-1'">
        <button
          v-if="choice.kind === 'habit'"
          type="button"
          class="btn btn-soft preset-btn"
          @click="emit('adjust')"
        >
          {{ t("parcours.create.adjustFirst") }}
        </button>
        <button type="button" class="btn btn-soft preset-btn" @click="emit('close')">
          {{ t("common.cancel") }}
        </button>
      </div>
    </template>
  </BottomSheet>
</template>

<style scoped>
.preset-tag {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-soft);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.preset-add {
  width: 100%;
  min-height: 50px;
  margin-top: 22px;
  font-size: 15px;
  font-weight: 800;
}
.preset-btn {
  min-height: 44px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 700;
}
</style>
