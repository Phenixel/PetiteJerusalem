<script setup lang="ts">
/**
 * Les hiloulot du jour, en bas de la page des horaires.
 *
 * Pas de cadre : ce n'est pas une réponse à une question qu'on se pose en
 * ouvrant la page (voir docs/design.md, « Le cadre se mérite »), c'est ce
 * qu'on trouve en arrivant au bout, comme le calendrier imprimé le met au bas
 * de sa colonne. Un titre de groupe, comme ceux des moments de la journée, et
 * des noms.
 *
 * Certains jours en portent dix-neuf. On en montre quatre, le reste se déplie :
 * la page se termine sur une ligne, pas sur un annuaire.
 *
 * La liste (2 600 noms, deux écritures) n'arrive qu'ici, par import
 * dynamique : elle ne pèse rien tant qu'on n'ouvre pas les horaires.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { HDate } from "@hebcal/core";
import { hiloulotOn, loadHiloulot, type HiloulotIndex } from "../../services/hiloulot";
import { analyticsService } from "../../services/analyticsService";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{ day: HDate }>();

const { t, locale } = useI18n();

const index = ref<HiloulotIndex | null>(null);

/** Les noms de l'écriture en cours : l'hébreu a les siens (voir hiloulot). */
watch(
  locale,
  (value) => {
    index.value = null;
    void loadHiloulot(value).then((loaded) => {
      // La langue a pu changer pendant le chargement : on ne pose que la
      // liste qu'on attendait.
      if (locale.value === value) index.value = loaded;
    });
  },
  { immediate: true },
);

const names = computed(() => (index.value ? hiloulotOn(index.value, props.day) : []));

/** Ce qu'on montre sans déplier. */
const VISIBLE = 4;

const expanded = ref(false);
// Changer de jour referme : la liste dépliée d'hier n'a rien à dire d'aujourd'hui.
watch(
  () => props.day.abs(),
  () => {
    expanded.value = false;
  },
);

const shown = computed(() => (expanded.value ? names.value : names.value.slice(0, VISIBLE)));
const hidden = computed(() => Math.max(0, names.value.length - VISIBLE));

function expand(): void {
  expanded.value = true;
  analyticsService.capture("hiloulot_expanded", { count: names.value.length });
}
</script>

<template>
  <section v-if="names.length > 0" class="mt-5 border-t border-line pt-4">
    <h2 class="flex items-center gap-2 pb-1 text-base font-bold text-text-secondary">
      <AppIcon name="candle" :size="16" class="text-primary" />
      {{ t("zmanim.hiloulot.title") }}
    </h2>
    <ul class="flex flex-col gap-0.5">
      <li v-for="name in shown" :key="name" class="text-text-primary leading-relaxed">
        {{ name }}
      </li>
    </ul>
    <button v-if="!expanded && hidden > 0" type="button" class="btn btn-soft mt-2" @click="expand">
      {{ t("zmanim.hiloulot.more", hidden) }}
    </button>
    <p class="mt-2 text-sm text-text-secondary leading-relaxed">
      {{ t("zmanim.hiloulot.note") }}
    </p>
  </section>
</template>
