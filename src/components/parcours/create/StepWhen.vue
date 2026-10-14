<script setup lang="ts">
/**
 * Nouvel objectif, 3 : pour quand, et à quel rythme. Chaque rythme dit ce
 * qu'il demanderait, à la date choisie : on choisit la portion autant que la
 * date.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../../composables/useParcours";
import { useParcoursViews } from "../../../composables/useParcoursViews";
import type {
  DayKey,
  MomentId,
  ProgramCorpus,
  ProgramObjective,
  ProgramPart,
  Rhythm,
} from "../../../services/parcours/model";
import { resolveParts, totalOf, unitOf } from "../../../services/parcours/texts";
import EndDatePicker from "../pickers/EndDatePicker.vue";
import MomentPicker from "../pickers/MomentPicker.vue";
import RhythmPicker from "../pickers/RhythmPicker.vue";

const props = defineProps<{ corpus: ProgramCorpus; parts: ProgramPart[] }>();
const end = defineModel<DayKey>("end", { required: true });
const rhythm = defineModel<Rhythm>("rhythm", { required: true });
const moment = defineModel<MomentId>("moment", { required: true });
const emit = defineEmits<{ (e: "create"): void }>();

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();

const units = computed(() => totalOf(resolveParts(props.corpus, props.parts)));
const title = computed(() =>
  views.objectiveTitle({
    kind: "program",
    corpus: props.corpus,
    parts: props.parts,
  } as ProgramObjective),
);
const paces = computed(() =>
  views.paceLabels(props.corpus, units.value, store.today.value, end.value),
);
</script>

<template>
  <div class="space-y-8">
    <p class="text-center text-text-secondary">
      <span class="font-bold text-text-primary">{{ title }}</span>
      · {{ views.unitsLabel(unitOf(corpus), units) }}
    </p>
    <section>
      <h2 class="text-sm font-bold">{{ t("parcours.form.end") }}</h2>
      <EndDatePicker v-model="end" class="mt-2" :today="store.today.value" />
    </section>
    <section>
      <h2 class="text-sm font-bold">{{ t("parcours.form.rhythm") }}</h2>
      <RhythmPicker v-model="rhythm" class="mt-2" :paces="paces" />
    </section>
    <section>
      <h2 class="text-sm font-bold">{{ t("parcours.form.moment") }}</h2>
      <MomentPicker v-model="moment" class="mt-2" />
    </section>
    <button type="button" class="btn btn-primary w-full" @click="emit('create')">
      {{ t("parcours.create.start") }}
    </button>
  </div>
</template>
