<script setup lang="ts">
/**
 * Prendre de l'avance, sur la page d'un programme : une fois la portion du
 * jour (ou de la semaine) faite, « Lire la suite » ouvre la portion d'après,
 * que le bas de la lecture marque lue aujourd'hui (ReaderTaskCard,
 * `?avance=1`). L'avance prise se dit, sans fanfare : les portions gardent
 * leur taille, la fin vient plus tôt.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import type { ProgramObjective } from "../../services/parcours/model";
import { unitOf } from "../../services/parcours/texts";

const props = defineProps<{
  program: ProgramObjective;
  /** La portion du créneau est faite, ou il n'y en a pas : la suite se propose. */
  offer: boolean;
}>();

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();

const today = computed(() => store.today.value);
const state = computed(
  () => store.context.value.plans.get(props.program.id)?.state(today.value) ?? null,
);
const paused = computed(() => props.program.pausedFrom !== undefined);

const ahead = computed(() => (paused.value ? 0 : (state.value?.ahead ?? 0)));
const next = computed(() =>
  props.offer && !paused.value ? views.nextPortionOf(props.program, today.value) : null,
);
const target = computed(() => (next.value ? views.aheadRoute(props.program, today.value) : null));
const nextText = computed(() =>
  next.value ? views.rangeText(props.program, next.value.from, next.value.to) : "",
);
</script>

<template>
  <div v-if="ahead > 0 || target" class="read-ahead">
    <p v-if="ahead > 0" class="text-[15px] leading-snug">
      <span class="font-bold">{{
        t("parcours.program.ahead", { units: views.unitsLabel(unitOf(program.corpus), ahead) })
      }}</span>
      <br />
      <span class="text-text-secondary">{{ t("parcours.program.aheadSub") }}</span>
    </p>
    <div
      v-if="target"
      class="flex items-center justify-between gap-3"
      :class="{ 'mt-3': ahead > 0 }"
    >
      <p class="min-w-0 text-[14px] leading-snug text-text-secondary">
        {{ t("parcours.program.nextUp", { portion: nextText }) }}
      </p>
      <RouterLink :to="target" class="btn btn-soft ahead-btn flex-none" data-tour="program-ahead">
        {{ t("parcours.reader.readAhead") }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.ahead-btn {
  min-height: 40px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
}
</style>
