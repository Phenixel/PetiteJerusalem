<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ALIYOT_PER_PARASHA } from "../services/parcours/aliyot";
import AliyaCheck from "./AliyaCheck.vue";

/**
 * Les montées de la semaine, à cocher une à une (ChneiMikraPage) : Cohen,
 * Lévi, Chlichi… sous le nom de la paracha, sept par paracha (quatorze pour
 * une paracha double, chacune sous le sien). On les coche dans l'ordre qu'on
 * veut, le jour qu'on veut ; la page tient les coches (useChneiMikraChecks).
 */

const props = defineProps<{
  /** Les parachiot de la semaine, dans l'ordre : une ou deux. */
  names: string[];
  /** Les montées cochées, comptées de 0 sur la semaine. */
  checked: Set<number>;
}>();
const emit = defineEmits<{ toggle: [aliya: number] }>();

const { t } = useI18n();

const total = computed(() => props.names.length * ALIYOT_PER_PARASHA);
const done = computed(() => [...props.checked].filter((aliya) => aliya < total.value).length);

const groups = computed(() =>
  props.names.map((name, index) => ({
    name,
    aliyot: Array.from({ length: ALIYOT_PER_PARASHA }, (_, i) => ({
      index: index * ALIYOT_PER_PARASHA + i,
      label: t(`chneiMikra.aliyaNames.n${i + 1}`),
    })),
  })),
);
</script>

<template>
  <section class="card px-4 py-3" :aria-label="t('chneiMikra.listTitle')">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="text-[13px] font-semibold text-text-secondary">
        {{ t("chneiMikra.listTitle") }}
      </h2>
      <span class="text-[13px] tabular-nums text-text-secondary">
        {{ t("chneiMikra.listCount", { done, total }) }}
      </span>
    </div>
    <div v-for="group in groups" :key="group.name" class="mt-2">
      <p class="font-bold text-text-primary">{{ group.name }}</p>
      <ul class="mt-2 flex flex-wrap gap-2">
        <li v-for="aliya in group.aliyot" :key="aliya.index">
          <AliyaCheck
            :checked="checked.has(aliya.index)"
            :label="aliya.label"
            :spoken="t('chneiMikra.aliyaCheck', { aliya: `${group.name}, ${aliya.label}` })"
            @toggle="emit('toggle', aliya.index)"
          />
        </li>
      </ul>
    </div>
  </section>
</template>
