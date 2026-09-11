<script setup lang="ts">
/**
 * Le choix de l'opinion suivie pour les horaires, en deux lignes qui se
 * touchent : le nom de l'avis, ce qu'il retient, et une marque sur celui qui
 * est suivi.
 *
 * Le même sélecteur sert à deux endroits, et c'est voulu : l'onglet
 * Préférences des réglages dans l'app, une fenêtre ouverte depuis la page des
 * horaires sur le site, où il n'y a pas de page de réglages sans compte.
 */
import { useI18n } from "vue-i18n";
import { ZMANIM_OPINIONS, type ZmanimOpinion } from "../../services/zmanimOpinions";
import { useZmanimOpinion } from "../../composables/useZmanimOpinion";
import { analyticsService } from "../../services/analyticsService";
import AppIcon from "../icons/AppIcon.vue";

const props = defineProps<{ source: string }>();
const emit = defineEmits<{ (e: "choose", opinion: ZmanimOpinion): void }>();

const { t } = useI18n();
const { opinion, choose } = useZmanimOpinion();

function select(value: ZmanimOpinion): void {
  const changed = value !== opinion.value;
  // Appelé même quand rien ne change : toucher l'avis déjà suivi, c'est le
  // CHOISIR, et le composable a besoin de le savoir pour l'écrire sur
  // l'appareil et dans le compte plutôt que de le laisser au rang de défaut.
  choose(value);
  if (changed) {
    analyticsService.capture("zmanim_opinion_chosen", { opinion: value, source: props.source });
  }
  emit("choose", value);
}
</script>

<template>
  <ul class="flex flex-col divide-y divide-line">
    <li v-for="option in ZMANIM_OPINIONS" :key="option">
      <button
        type="button"
        class="flex w-full items-start gap-3 py-3 text-start transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
        :aria-pressed="opinion === option"
        @click="select(option)"
      >
        <AppIcon
          name="check"
          :size="16"
          class="mt-1 shrink-0"
          :class="opinion === option ? 'text-primary' : 'opacity-0'"
        />
        <span class="min-w-0">
          <span class="block font-semibold text-text-primary">
            {{ t(`zmanim.opinions.${option}.name`) }}
          </span>
          <span class="block text-sm text-text-secondary leading-relaxed">
            {{ t(`zmanim.opinions.${option}.hint`) }}
          </span>
        </span>
      </button>
    </li>
  </ul>
</template>
