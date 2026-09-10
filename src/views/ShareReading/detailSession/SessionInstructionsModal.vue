<script setup lang="ts">
/**
 * Comment on réserve, montré plutôt qu'expliqué.
 *
 * C'était trois phrases posées au milieu de la page, entre l'avancement et la
 * liste des textes : elles repoussaient les textes à chaque visite, et une
 * phrase comme « cochez les cases pour réserver » ne dit pas grand-chose tant
 * qu'on n'a pas vu la case se cocher. Une pastille « Instructions » ouvre
 * maintenant cette fenêtre, et chaque geste s'y joue en petit.
 *
 * Les captures sont dessinées, pas filmées (voir components/mock) : elles
 * suivent le thème et la langue, ne pèsent presque rien, et ne vieillissent
 * pas d'une refonte à l'autre comme le ferait une vidéo.
 */
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppModal from "../../../components/AppModal.vue";
import AppIcon from "../../../components/icons/AppIcon.vue";
import MockSessionSearch from "../../../components/mock/MockSessionSearch.vue";
import MockSessionReserve from "../../../components/mock/MockSessionReserve.vue";
import MockSessionCancel from "../../../components/mock/MockSessionCancel.vue";
import MockSessionMarkRead from "../../../components/mock/MockSessionMarkRead.vue";
import MockSessionRead from "../../../components/mock/MockSessionRead.vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

// Les clés s'écrivent en entier : une clé composée à la volée échappe au test
// qui vérifie que chacune est lue quelque part.
const steps = [
  {
    mock: MockSessionSearch,
    title: "detailSession.instructions.steps.search.title",
    text: "detailSession.instructions.steps.search.text",
  },
  {
    mock: MockSessionReserve,
    title: "detailSession.instructions.steps.reserve.title",
    text: "detailSession.instructions.steps.reserve.text",
  },
  {
    mock: MockSessionCancel,
    title: "detailSession.instructions.steps.cancel.title",
    text: "detailSession.instructions.steps.cancel.text",
  },
  {
    mock: MockSessionMarkRead,
    title: "detailSession.instructions.steps.markRead.title",
    text: "detailSession.instructions.steps.markRead.text",
  },
  {
    mock: MockSessionRead,
    title: "detailSession.instructions.steps.read.title",
    text: "detailSession.instructions.steps.read.text",
  },
];

const index = ref(0);

// Rouvrir, c'est recommencer : on ne retombe pas sur l'étape où l'on avait
// refermé la fenêtre trois jours plus tôt.
watch(
  () => props.open,
  (open) => {
    if (open) index.value = 0;
  },
);

function go(next: number): void {
  if (next >= steps.length) emit("close");
  else index.value = Math.max(0, next);
}
</script>

<template>
  <AppModal
    :open="open"
    :label="t('detailSession.instructions.title')"
    panel-class="modal-panel !max-w-md animate-[scaleIn_0.3s_ease]"
    @close="emit('close')"
  >
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="flex items-center gap-2 text-lg font-bold text-text-primary">
        <AppIcon name="info" :size="18" class="text-primary" />
        {{ t("detailSession.instructions.title") }}
      </h3>
      <button
        type="button"
        class="icon-btn -me-1.5"
        :aria-label="t('common.close')"
        @click="emit('close')"
      >
        <AppIcon name="x" :size="18" />
      </button>
    </div>

    <!-- La capture est remontée à chaque étape (`key`) : les animations
         repartent du début, on ne tombe pas au milieu d'un geste. -->
    <component :is="steps[index].mock" :key="index" />

    <div :key="`text-${index}`" class="mt-4 animate-[fadeIn_0.3s_ease]">
      <p class="font-semibold text-text-primary">{{ t(steps[index].title) }}</p>
      <p class="mt-1 text-sm text-text-secondary">{{ t(steps[index].text) }}</p>
    </div>

    <div class="mt-6 flex items-center justify-between gap-4">
      <div class="flex items-center gap-1.5">
        <span
          v-for="(step, i) in steps"
          :key="step.title"
          class="h-1.5 rounded-full transition-all duration-300"
          :class="
            i === index
              ? 'w-5 bg-primary'
              : i < index
                ? 'w-2.5 bg-primary/50'
                : 'w-2.5 bg-black/10 dark:bg-white/15'
          "
        ></span>
      </div>

      <div class="flex items-center gap-2">
        <button v-if="index > 0" type="button" class="btn btn-soft" @click="go(index - 1)">
          {{ t("common.back") }}
        </button>
        <button type="button" class="btn btn-primary" @click="go(index + 1)">
          {{
            index === steps.length - 1
              ? t("detailSession.instructions.done")
              : t("detailSession.instructions.next")
          }}
        </button>
      </div>
    </div>
  </AppModal>
</template>
