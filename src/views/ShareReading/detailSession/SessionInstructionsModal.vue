<script setup lang="ts">
/**
 * Comment on réserve, en trois phrases.
 *
 * C'était un bloc posé au milieu de la page, entre l'avancement et la liste
 * des textes : il repoussait les textes vers le bas à chaque visite, alors
 * qu'on ne le lit qu'une fois. Il est devenu une pastille « Instructions »
 * parmi celles qui décrivent la chaîne, et cette fenêtre.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppModal from "../../../components/AppModal.vue";
import AppIcon from "../../../components/icons/AppIcon.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

// Écrites une à une plutôt que composées : une clé qui ne s'écrit pas en
// entier échappe au test qui vérifie que chacune est lue quelque part.
const steps = computed(() => [
  t("detailSession.instructions.step1"),
  t("detailSession.instructions.step2"),
  t("detailSession.instructions.step3"),
]);
</script>

<template>
  <AppModal :open="open" :label="t('detailSession.instructions.title')" @close="emit('close')">
    <div class="mb-5 flex items-center justify-between gap-3">
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

    <!-- Numérotées : ce sont des gestes qui se font dans cet ordre. -->
    <ol class="space-y-3">
      <li v-for="(step, index) in steps" :key="step" class="flex items-start gap-3">
        <span
          class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-primary/10 text-xs font-bold text-primary"
        >
          {{ index + 1 }}
        </span>
        <span class="text-sm text-text-secondary">{{ step }}</span>
      </li>
    </ol>

    <button type="button" class="btn btn-primary mt-6 w-full" @click="emit('close')">
      {{ t("common.close") }}
    </button>
  </AppModal>
</template>
