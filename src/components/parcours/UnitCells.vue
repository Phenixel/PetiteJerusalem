<script setup lang="ts">
/**
 * La portion en cases : une par michna (ou par côté de daf, par chapitre).
 * On touche la dernière lue, dans l'app ou dans son livre ; la toucher encore
 * revient d'une case. Des cases plates : un choix, pas le mur.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { placeOf, unitLabel } from "../../services/parcours/texts";

const props = defineProps<{
  texts: number[];
  from: number;
  to: number;
  /** Unités lues depuis `from`. */
  read: number;
}>();
const emit = defineEmits<{ (e: "read", units: number): void }>();

const { t, locale } = useI18n();

const cells = computed(() =>
  Array.from({ length: Math.max(0, props.to - props.from) }, (_, i) => {
    const place = placeOf(props.texts, props.from + i);
    const full = place ? unitLabel(place, locale.value, false) : String(i + 1);
    return { index: i, label: full, on: i < props.read };
  }),
);

function pick(index: number): void {
  emit("read", index + 1 === props.read ? index : index + 1);
}
</script>

<template>
  <div class="flex flex-wrap gap-[3px]" role="group" :aria-label="t('parcours.program.cells')">
    <button
      v-for="cell in cells"
      :key="cell.index"
      type="button"
      class="unit-cell"
      :class="{ 'is-on': cell.on }"
      :aria-pressed="cell.on"
      @click="pick(cell.index)"
    >
      {{ cell.label }}
    </button>
  </div>
</template>

<style scoped>
.unit-cell {
  min-width: 44px;
  height: 36px;
  flex: 1 0 auto;
  padding-inline: 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  color: var(--color-text-secondary);
}
.unit-cell.is-on {
  background: #e6cd9c;
  box-shadow: inset 0 0 0 3px #cfb07a;
  color: #5a4626;
}
</style>
