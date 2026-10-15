<script setup lang="ts">
/**
 * Les jours d'une habitude, du dimanche au Chabbat : un toucher prend le
 * jour, un autre le laisse. Des cases plates : c'est un choix, pas le mur.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const model = defineModel<number[]>({ required: true });
const { t } = useI18n();

const initials = computed(() => t("parcours.weekdayInitials").split(","));

function toggle(day: number): void {
  const days = new Set(model.value);
  if (days.has(day)) days.delete(day);
  else days.add(day);
  model.value = [...days].sort((a, b) => a - b);
}
</script>

<template>
  <div class="grid grid-cols-7 gap-1" role="group" :aria-label="t('parcours.form.days')">
    <button
      v-for="(initial, day) in initials"
      :key="day"
      type="button"
      class="day-cell"
      :class="{ 'is-on': model.includes(day) }"
      :aria-pressed="model.includes(day)"
      :aria-label="t(`parcours.weekdays.${day}`)"
      @click="toggle(day)"
    >
      {{ initial }}
    </button>
  </div>
</template>

<style scoped>
.day-cell {
  height: 44px;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 700;
  background: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  color: var(--color-text-secondary);
}
.day-cell.is-on {
  background: #e6cd9c;
  box-shadow: inset 0 0 0 3px #cfb07a;
  color: #5a4626;
}
</style>
