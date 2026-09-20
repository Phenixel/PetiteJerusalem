<script setup lang="ts">
// Corriger un jour passé : la liste de ce qu'il y avait à faire ce jour-là,
// à cocher après coup. C'est du déclaratif : un jour oublié (une fête, un
// téléphone resté dans la poche) ne doit pas coûter la série. La fenêtre va
// jusqu'à sept jours en arrière, pas plus : au-delà, on ne se souvient plus.
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppModal from "./AppModal.vue";
import AppIcon from "./icons/AppIcon.vue";

export interface DayEditorItem {
  key: string;
  label: string;
  /** Une précision sous le libellé (« 3 fois par semaine », « jour 12 sur 40 »). */
  hint?: string;
  done: boolean;
}

const props = defineProps<{
  open: boolean;
  /** Le jour corrigé (YYYY-MM-DD). */
  dayKey: string | null;
  items: DayEditorItem[];
}>();
const emit = defineEmits<{ (e: "close"): void; (e: "save", keys: string[]): void }>();

const { t, locale } = useI18n();

const checked = ref<Set<string>>(new Set());
watch(
  () => [props.open, props.items] as const,
  ([open, items]) => {
    if (open) checked.value = new Set(items.filter((i) => i.done).map((i) => i.key));
  },
  { immediate: true },
);

const title = computed(() => {
  if (!props.dayKey) return "";
  const [y, m, d] = props.dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale.value, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(y, m - 1, d, 12));
});
const allChecked = computed(() => props.items.every((i) => checked.value.has(i.key)));

function toggle(key: string) {
  const next = new Set(checked.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  checked.value = next;
}

function toggleAll() {
  checked.value = allChecked.value ? new Set() : new Set(props.items.map((i) => i.key));
}
</script>

<template>
  <AppModal :open="open" :label="t('dailyReading.editor.title')" @close="emit('close')">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <p class="text-xs font-semibold text-primary">{{ t("dailyReading.editor.title") }}</p>
        <h2 class="text-lg font-bold text-text-primary capitalize">{{ title }}</h2>
        <p class="mt-1 text-xs text-text-secondary">{{ t("dailyReading.editor.hint") }}</p>
      </div>
      <button class="btn btn-soft btn-sm shrink-0" @click="toggleAll">
        <AppIcon name="check-double" :size="13" />
        {{ allChecked ? t("dailyReading.editor.uncheckAll") : t("dailyReading.editor.checkAll") }}
      </button>
    </div>
    <ul class="max-h-[50vh] overflow-y-auto space-y-1 -mx-1 px-1">
      <li v-for="item in items" :key="item.key">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          :aria-pressed="checked.has(item.key)"
          @click="toggle(item.key)"
        >
          <AppIcon
            v-if="checked.has(item.key)"
            name="circle-check"
            :size="20"
            class="shrink-0 text-green-500"
          />
          <span
            v-else
            class="w-5 h-5 rounded-full border-2 border-text-secondary/50 shrink-0"
          ></span>
          <span class="min-w-0">
            <span class="block text-sm font-medium text-text-primary">{{ item.label }}</span>
            <span v-if="item.hint" class="block text-xs text-text-secondary">{{ item.hint }}</span>
          </span>
        </button>
      </li>
    </ul>
    <div class="mt-5 flex justify-end gap-2">
      <button class="btn btn-soft" @click="emit('close')">{{ t("common.cancel") }}</button>
      <button class="btn btn-primary" @click="emit('save', [...checked])">
        <AppIcon name="check" :size="14" />
        {{ t("dailyReading.editor.save") }}
      </button>
    </div>
  </AppModal>
</template>
