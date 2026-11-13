<script setup lang="ts">
/**
 * The aliyot of the week, to check off without scrolling through the text
 * (ChneiMikraPage): whoever reads chnei mikra in a printed book, or has
 * read an aliyah elsewhere, opens it from the paracha's name and ticks
 * what is done. The same checks as « Marquer comme lue » at the end of each
 * aliyah in the text (useChneiMikraChecks): ticking one here checks it
 * there.
 *
 * A double paracha lists its fourteen aliyot under the name of each of its
 * two parachiot.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ALIYOT_PER_PARASHA, aliyaName } from "../services/parcours/aliyot";
import AppIcon from "./icons/AppIcon.vue";
import BottomSheet from "./parcours/BottomSheet.vue";

const props = defineProps<{
  open: boolean;
  /** The name of the paracha, as the page title gives it. */
  title: string;
  /** The names of the week's parachiot (two for a double paracha). */
  names: string[];
  /** The checked aliyot of the week, counted from 0 across the week. */
  checked: ReadonlySet<number>;
}>();
const emit = defineEmits<{
  (e: "close"): void;
  /** An aliyah (counted from 0 across the week) checked or unchecked. */
  (e: "toggle", aliya: number, done: boolean): void;
}>();

const { t } = useI18n();

const groups = computed(() =>
  props.names.map((name, entry) => ({
    name,
    aliyot: Array.from({ length: ALIYOT_PER_PARASHA }, (_, index) => ({
      aliya: entry * ALIYOT_PER_PARASHA + index,
      label: aliyaName(index, t),
    })),
  })),
);
</script>

<template>
  <BottomSheet :open="open" :label="t('chneiMikra.aliyotTitle')" @close="emit('close')">
    <p class="text-xl font-extrabold">{{ title }}</p>
    <p class="mt-0.5 text-sm text-text-secondary">{{ t("chneiMikra.aliyotHint") }}</p>
    <div v-for="group in groups" :key="group.name" class="mt-3">
      <p v-if="groups.length > 1" class="mt-4 mb-1 text-sm font-semibold text-text-secondary">
        {{ group.name }}
      </p>
      <button
        v-for="row in group.aliyot"
        :key="row.aliya"
        type="button"
        role="checkbox"
        class="aliya-row"
        :class="{ 'is-done': checked.has(row.aliya) }"
        :aria-checked="checked.has(row.aliya)"
        @click="emit('toggle', row.aliya, !checked.has(row.aliya))"
      >
        <AppIcon v-if="checked.has(row.aliya)" name="circle-check" :size="20" />
        <span v-else class="aliya-ring" />
        <span class="text-[15px] font-semibold">{{ row.label }}</span>
      </button>
    </div>
    <button type="button" class="btn btn-primary sheet-close" @click="emit('close')">
      {{ t("common.close") }}
    </button>
  </BottomSheet>
</template>

<style scoped>
/* A row per aliyah, the whole row being the checkbox: the ring of
   « Marquer comme lue », filled with its check once read. */
.aliya-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  text-align: start;
  color: var(--color-text-primary);
}
.aliya-row.is-done {
  color: var(--color-primary);
}
.aliya-ring {
  flex: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-line-strong);
  border-radius: var(--radius-pill);
}
.sheet-close {
  width: 100%;
  min-height: 44px;
  margin-top: 16px;
  font-size: 14px;
  font-weight: 700;
}
</style>
