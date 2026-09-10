<script setup lang="ts">
/**
 * Le champ de date de la maison, à la place de `<input type="date">`.
 *
 * Le champ natif ouvre le calendrier du système : roue grise sur iOS, boîte
 * bleue sur Android, une fenêtre qui n'a rien de l'app d'où elle sort. Celui-ci
 * ouvre le calendrier de la maison (DayPicker).
 *
 * La valeur reste celle qu'un `<input type="date">` donnait, `YYYY-MM-DD` :
 * les appelants n'ont rien à changer, et surtout pas à manipuler des dates UTC
 * (voir endOfLocalDay dans dateService, la date limite d'une chaîne se lit
 * toujours en heure locale).
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import DayPicker from "./DayPicker.vue";
import AppIcon from "./icons/AppIcon.vue";
import { DateService, localDayFrom } from "../services/dateService";

defineProps<{
  /** Premier jour choisissable, au format YYYY-MM-DD (les précédents sont éteints). */
  min?: string;
  id?: string;
  disabled?: boolean;
  /** Ce que la fenêtre annonce, à défaut « Choisir une date ». */
  label?: string;
}>();

const model = defineModel<string>({ required: true });

const { t } = useI18n();
const open = ref(false);

const selected = computed(() => localDayFrom(model.value));

const buttonLabel = computed(() =>
  selected.value ? DateService.formatDate(selected.value) : t("common.chooseDate"),
);
</script>

<template>
  <div>
    <button
      :id="id"
      type="button"
      class="field flex w-full items-center justify-between gap-3 text-start"
      :class="[
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        selected ? '' : 'text-text-secondary',
      ]"
      :disabled="disabled"
      @click="open = true"
    >
      <span>{{ buttonLabel }}</span>
      <AppIcon name="calendar" :size="16" class="shrink-0 text-text-secondary" />
    </button>

    <DayPicker
      v-model="model"
      :open="open"
      :min="min"
      :label="label ?? t('common.chooseDate')"
      @close="open = false"
    />
  </div>
</template>
