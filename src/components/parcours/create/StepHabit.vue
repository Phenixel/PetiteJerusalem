<script setup lang="ts">
/**
 * Une habitude : son nom (celui du modèle s'il reste vide), ses jours, son
 * moment. Les trois tefilot ont chacune le leur : le matin, l'après-midi, le
 * soir.
 */
import { useI18n } from "vue-i18n";
import type { HabitPreset, MomentId } from "../../../services/parcours/model";
import DaysPicker from "../pickers/DaysPicker.vue";
import MomentPicker from "../pickers/MomentPicker.vue";

defineProps<{ preset: HabitPreset }>();
const name = defineModel<string>("name", { required: true });
const days = defineModel<number[]>("days", { required: true });
const moment = defineModel<MomentId>("moment", { required: true });
const emit = defineEmits<{ (e: "create"): void }>();

const { t } = useI18n();
</script>

<template>
  <div class="space-y-8">
    <label class="block">
      <span class="text-sm font-bold">{{ t("parcours.form.name") }}</span>
      <input
        v-model="name"
        class="field mt-2"
        :placeholder="t(`parcours.habits.${preset}`)"
        maxlength="60"
      />
    </label>
    <section>
      <h2 class="text-sm font-bold">{{ t("parcours.form.days") }}</h2>
      <DaysPicker v-model="days" class="mt-2" />
      <p class="mt-2 text-[13px] text-text-secondary">{{ t("parcours.form.daysHint") }}</p>
    </section>
    <section v-if="preset !== 'tefilot'">
      <h2 class="text-sm font-bold">{{ t("parcours.form.moment") }}</h2>
      <MomentPicker v-model="moment" class="mt-2" />
    </section>
    <p v-else class="text-[13px] text-text-secondary">{{ t("parcours.create.tefilotHint") }}</p>
    <button
      type="button"
      class="btn btn-primary w-full"
      :disabled="days.length === 0"
      @click="emit('create')"
    >
      {{ t("parcours.create.add") }}
    </button>
  </div>
</template>
