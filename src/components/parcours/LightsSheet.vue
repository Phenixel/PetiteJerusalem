<script setup lang="ts">
/**
 * Mes lumières : toutes les lumières de la série, de la vieille lampe à la
 * lumière du premier jour (services/parcours/lights.ts), en liste : le texte
 * au début de la ligne, la lumière au bout, dans son cadre. Celles qu'on a
 * gagnées (le record les garde) en couleur, avec leur nom, leur palier et
 * leur phrase ; celle de la série en cours, cerclée, « Votre lumière ». Les
 * autres, « À découvrir » : leur dessin réduit à une ombre floue, agrandi
 * dans son cadre qui le coupe, n'en laisse voir qu'un morceau. On sait dans
 * combien de jours, pas ce que c'est.
 *
 * On l'ouvre de Mon parcours et du profil.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { LIGHTS, lightOf } from "../../services/parcours/lights";
import BottomSheet from "./BottomSheet.vue";
import StreakLight from "./StreakLight.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t } = useI18n();
const store = useParcours();

const cells = computed(() => {
  const { current, best } = store.streak.value;
  const yours = lightOf(current).id;
  const firstHidden = LIGHTS.find((light) => light.from > best);
  return LIGHTS.map((light) => {
    const earned = light.from <= best;
    const isNext = light === firstHidden;
    return {
      ...light,
      earned,
      yours: light.id === yours,
      name: earned ? t(`parcours.lights.names.${light.id}`) : t("parcours.lights.hidden"),
      when: isNext
        ? t("parcours.lights.inDays", { n: light.from - best }, light.from - best)
        : light.from === 0
          ? t("parcours.lights.start")
          : t("parcours.lights.from", { n: light.from }, light.from),
    };
  });
});
</script>

<template>
  <BottomSheet :open="open" :label="t('parcours.lights.title')" @close="emit('close')">
    <!-- Le focus s'ouvre sur le titre : sur « Fermer », la feuille s'ouvrait au bas de la liste. -->
    <p class="font-display text-2xl font-bold outline-none" tabindex="-1" data-autofocus>
      {{ t("parcours.lights.title") }}
    </p>
    <p class="mt-1.5 text-[14px] leading-normal text-text-secondary">
      {{ t("parcours.lights.intro") }}
    </p>
    <ul class="mt-5 space-y-2">
      <li
        v-for="cell in cells"
        :key="cell.id"
        class="light-row"
        :class="{ 'is-yours': cell.yours, 'is-hidden': !cell.earned }"
        :aria-current="cell.yours ? 'true' : undefined"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-bold leading-tight">{{ cell.name }}</span>
          <span
            class="mt-0.5 block text-[13px] font-semibold"
            :class="cell.yours ? 'text-primary' : 'text-text-secondary'"
          >
            {{ cell.yours ? t("parcours.lights.yours") : cell.when }}
          </span>
          <span v-if="cell.earned" class="mt-1 block text-[13px] leading-snug text-text-secondary">
            {{ t(`parcours.lights.captions.${cell.id}`) }}
          </span>
        </span>
        <span class="light-window" aria-hidden="true">
          <StreakLight :light="cell.id" :locked="!cell.earned" :width="84" />
        </span>
      </li>
    </ul>
    <button type="button" class="btn btn-soft mt-5 min-h-11 w-full" @click="emit('close')">
      {{ t("common.close") }}
    </button>
  </BottomSheet>
</template>

<style scoped>
.light-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 12px 12px 16px;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
[dir="rtl"] .light-row {
  padding: 12px 16px 12px 12px;
}
/* La lumière de la série en cours : cerclée de la couleur du thème. */
.light-row.is-yours {
  box-shadow: inset 0 0 0 2px var(--color-brand);
}
.light-row.is-hidden {
  background: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
  box-shadow: none;
  color: var(--color-text-secondary);
}
/* Le cadre de la lumière, au bout de la ligne. */
.light-window {
  display: grid;
  flex: none;
  width: 96px;
  height: 76px;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
}
/* À découvrir : l'ombre agrandie, le cadre n'en garde qu'un morceau. */
.is-hidden .light-window > :deep(svg) {
  transform: scale(2.6);
}
</style>
