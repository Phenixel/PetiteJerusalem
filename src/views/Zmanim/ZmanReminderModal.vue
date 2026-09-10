<script setup lang="ts">
/**
 * Le réglage du rappel d'un horaire : combien de minutes avant être prévenu.
 *
 * Les délais courants sont là d'un geste ; le reste se compose au pas de cinq
 * minutes, jusqu'à trois heures avant. Une fenêtre du système (roue des
 * minutes) aurait tranché avec le reste de l'app, voir docs/design.md.
 *
 * Le rappel revient chaque jour, mais jamais à la même heure : l'horaire est
 * recalculé pour le jour et le lieu, c'est ce que dit la note du bas.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useOverlay } from "../../composables/useOverlayStack";
import {
  clampMinutes,
  MAX_MINUTES_BEFORE,
  MIN_MINUTES_BEFORE,
  MINUTE_CHOICES,
  MINUTES_STEP,
} from "../../composables/useZmanReminders";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{
  show: boolean;
  /** Nom de l'horaire réglé (« Netz haHama »). */
  name: string;
  /** Son heure du jour, mise en forme. */
  time: string;
  /** Le lieu de calcul, nommé dans la note. */
  placeLabel: string;
  /** Minutes d'avance du rappel déjà posé, null s'il n'y en a pas. */
  minutes: number | null;
  /** Le délai à proposer quand il n'y a pas encore de rappel. */
  defaultMinutes: number;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "save", minutes: number): void;
  (e: "remove"): void;
}>();

const { t } = useI18n();

const minutes = ref(props.minutes ?? props.defaultMinutes);

// À chaque ouverture, repart du rappel posé (ou du dernier délai choisi).
watch(
  () => props.show,
  (shown) => {
    if (shown) minutes.value = props.minutes ?? props.defaultMinutes;
  },
);

const existing = computed(() => props.minutes !== null);

const valueLabel = computed(() =>
  minutes.value === 0
    ? t("zmanim.reminder.atTime")
    : t("zmanim.reminder.minutes", { minutes: minutes.value }),
);

function step(delta: number): void {
  minutes.value = clampMinutes(minutes.value + delta);
}

function close(): void {
  emit("update:show", false);
}

// Le bouton retour d'Android ferme la fenêtre avant de quitter la page.
useOverlay(
  computed(() => props.show),
  close,
);

function confirm(): void {
  emit("save", minutes.value);
  close();
}

function remove(): void {
  emit("remove");
  close();
}
</script>

<template>
  <div v-if="show" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="close">
    <div class="modal-panel !max-w-sm animate-[scaleIn_0.3s_ease]" @click.stop>
      <div class="mb-1 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-lg font-bold text-text-primary">
          <AppIcon name="bell" :size="17" class="text-primary" />
          {{ t("zmanim.reminder.title") }}
        </h3>
        <button type="button" class="icon-btn" :aria-label="t('common.close')" @click="close">
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <!-- L'horaire réglé, avec son heure du jour : le rappel se pose sur un
           moment de la journée, pas sur un nom dans une liste. -->
      <p class="text-sm text-text-secondary">
        <span class="font-semibold text-text-primary">{{ name }}</span>
        <span class="tabular-nums"> · {{ time }}</span>
      </p>

      <p class="mt-4 text-sm text-text-secondary">{{ t("zmanim.reminder.chooseDelay") }}</p>

      <!-- Le délai retenu, et les deux boutons qui le composent de cinq en
           cinq quand aucun raccourci ne convient. -->
      <div class="mt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          class="icon-btn"
          :disabled="minutes <= MIN_MINUTES_BEFORE"
          :aria-label="t('zmanim.reminder.less')"
          @click="step(-MINUTES_STEP)"
        >
          <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
        </button>
        <span
          class="min-w-36 rounded-control bg-primary/10 px-3 py-1.5 text-center text-xl font-bold tabular-nums text-primary"
          aria-live="polite"
        >
          {{ valueLabel }}
        </span>
        <button
          type="button"
          class="icon-btn"
          :disabled="minutes >= MAX_MINUTES_BEFORE"
          :aria-label="t('zmanim.reminder.more')"
          @click="step(MINUTES_STEP)"
        >
          <AppIcon name="chevron-right" :size="18" class="rtl:rotate-180" />
        </button>
      </div>

      <div class="mt-3 flex flex-wrap justify-center gap-2">
        <button
          v-for="choice in MINUTE_CHOICES"
          :key="choice"
          type="button"
          :class="[
            'rounded-pill px-3 py-1 text-sm font-medium transition-colors',
            minutes === choice
              ? 'bg-primary text-white'
              : 'bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15',
          ]"
          @click="minutes = choice"
        >
          {{
            choice === 0
              ? t("zmanim.reminder.atTime")
              : t("zmanim.reminder.minutes", { minutes: choice })
          }}
        </button>
      </div>

      <p class="mt-4 text-sm text-text-secondary leading-relaxed">
        {{ t("zmanim.reminder.dailyNote", { place: placeLabel }) }}
      </p>

      <!-- Retirer sur sa propre ligne : les trois commandes côte à côte ne
           tiennent pas sur un écran de téléphone, et « Confirmer » finissait
           par tomber seul sous les deux autres. -->
      <div class="flex flex-col gap-3 pt-6">
        <button
          v-if="existing"
          type="button"
          class="btn btn-soft self-start text-primary"
          @click="remove"
        >
          <AppIcon name="trash" :size="14" />
          {{ t("zmanim.reminder.remove") }}
        </button>
        <div class="flex justify-end gap-3">
          <button type="button" class="btn btn-soft" @click="close">
            {{ t("common.cancel") }}
          </button>
          <button type="button" class="btn btn-primary" @click="confirm">
            <AppIcon name="check" :size="14" />
            {{ t("common.confirm") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
