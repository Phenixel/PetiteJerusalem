<script setup lang="ts">
/**
 * Le calendrier de la maison : un mois, dans une fenêtre modale de l'app.
 *
 * Il sert partout où l'on choisit un jour, à la place du calendrier du système
 * (roue grise d'iOS, boîte bleue d'Android) : la date limite d'une chaîne
 * (AppDateField) et le jour affiché par les horaires, où il évite de cliquer
 * trente fois sur la flèche pour atteindre une date.
 *
 * La manière de s'en servir est celle des calendriers d'Android (Material 3),
 * parce qu'elle est éprouvée et que les gens la connaissent déjà :
 *
 *  - la date retenue s'écrit en toutes lettres en tête, elle se lit avant
 *    d'être validée ;
 *  - le mois affiché est un bouton : il ouvre la liste des années, pour aller
 *    loin sans user la flèche (les flèches restent, pour le mois d'à côté) ;
 *  - rien n'est choisi tant qu'on n'a pas validé. On peut donc parcourir les
 *    années sans rien casser, et renoncer d'un mot.
 *
 * L'habillage, lui, est le nôtre : les rayons, les couleurs du thème, la
 * police de l'app.
 *
 * La valeur est un jour local au format `YYYY-MM-DD`, celui que donnait un
 * `<input type="date">`. Jamais de date UTC : `new Date("2026-09-14")` se lit
 * minuit à Greenwich, soit la veille au soir à l'ouest.
 */
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppModal from "./AppModal.vue";
import AppIcon from "./icons/AppIcon.vue";
import { dateTimeFormat } from "../services/intlCache";
import { localDayKey } from "../services/dateService";

const props = defineProps<{
  open: boolean;
  /** Premier jour choisissable (les précédents sont éteints), au format YYYY-MM-DD. */
  min?: string;
  /** Ce que la fenêtre annonce, à défaut « Choisir une date ». */
  label?: string;
}>();

const emit = defineEmits<{ close: [] }>();
const model = defineModel<string>({ required: true });

const { t, locale } = useI18n();

/** Une valeur de champ (YYYY-MM-DD) en date locale. */
function parse(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

const todayKey = localDayKey();

/** Le jour retenu, pas encore validé : « Confirmer » seul le rend à l'appelant. */
const draft = ref("");
/** Le mois affiché. */
const cursor = ref(new Date());
/** La grille des jours, ou la liste des années. */
const mode = ref<"days" | "years">("days");
const yearsPanel = ref<HTMLElement | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    draft.value = model.value;
    const start = parse(model.value) ?? parse(props.min ?? "") ?? new Date();
    cursor.value = new Date(start.getFullYear(), start.getMonth(), 1);
    mode.value = "days";
  },
  { immediate: true },
);

function shiftMonth(delta: number): void {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1);
}

/**
 * Premier jour de la semaine : dimanche en hébreu, lundi ailleurs. Intl ne le
 * donne pas partout (getWeekInfo manque encore aux navigateurs que l'app
 * sert), et ces deux cas couvrent les trois langues.
 */
const weekStart = computed(() => (locale.value === "he" ? 0 : 1));

/** Les initiales des jours, dans la langue de l'interface. */
const weekdayLabels = computed(() => {
  const format = dateTimeFormat(locale.value, { weekday: "narrow" });
  // Un dimanche connu (4 janvier 1970) sert de point de départ.
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(1970, 0, 4 + ((weekStart.value + index) % 7))),
  );
});

const monthLabel = computed(() =>
  dateTimeFormat(locale.value, { month: "long", year: "numeric" }).format(cursor.value),
);

/** La date retenue, en toutes lettres, en tête de la fenêtre. */
const draftLabel = computed(() => {
  const date = parse(draft.value);
  if (!date) return t("common.chooseDate");
  return dateTimeFormat(locale.value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
});

/** Les six semaines du mois affiché, débordements des mois voisins compris. */
const weeks = computed(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1);
  const offset = (first.getDay() - weekStart.value + 7) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day);
      const key = localDayKey(date);
      return {
        key,
        day: date.getDate(),
        outside: date.getMonth() !== cursor.value.getMonth(),
        today: key === todayKey,
        chosen: key === draft.value,
        disabled: props.min ? key < props.min : false,
      };
    }),
  );
});

/**
 * Les années proposées : vingt ans de part et d'autre d'aujourd'hui, et jamais
 * avant le premier jour choisissable. Assez pour une date limite comme pour
 * remonter un calendrier ; au-delà, les flèches du mois restent là.
 */
const years = computed(() => {
  const thisYear = new Date().getFullYear();
  const minYear = props.min ? Number(props.min.slice(0, 4)) : thisYear - 20;
  const start = Math.min(minYear, cursor.value.getFullYear());
  const end = Math.max(thisYear + 20, cursor.value.getFullYear() + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
});

/**
 * L'habillage d'un jour, en une seule chaîne : deux classes de couleur posées
 * ensemble (`text-primary` d'aujourd'hui et `text-text-primary` du jour
 * ordinaire) laisseraient la feuille de style trancher, pas nous.
 */
function cellClass(cell: {
  chosen: boolean;
  disabled: boolean;
  outside: boolean;
  today: boolean;
}): string {
  const hover = "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
  if (cell.chosen) return "bg-primary font-semibold text-white";
  if (cell.disabled) return "cursor-not-allowed text-text-secondary/35";
  // Aujourd'hui, non retenu : cerclé, comme sur les calendriers d'Android.
  if (cell.today) return `font-semibold text-primary ring-1 ring-primary/50 ${hover}`;
  if (cell.outside) return `text-text-secondary/60 ${hover}`;
  return `text-text-primary ${hover}`;
}

function pickDay(key: string, disabled: boolean): void {
  if (!disabled) draft.value = key;
}

async function showYears(): Promise<void> {
  mode.value = mode.value === "years" ? "days" : "years";
  if (mode.value !== "years") return;
  await nextTick();
  yearsPanel.value?.querySelector("[data-current]")?.scrollIntoView({ block: "center" });
}

function pickYear(year: number): void {
  cursor.value = new Date(year, cursor.value.getMonth(), 1);
  mode.value = "days";
}

function confirm(): void {
  if (!draft.value) return;
  model.value = draft.value;
  emit("close");
}
</script>

<template>
  <AppModal
    :open="open"
    :label="label ?? t('common.chooseDate')"
    panel-class="modal-panel !max-w-sm !p-0 overflow-hidden animate-[scaleIn_0.3s_ease]"
    @close="emit('close')"
  >
    <!-- Ce qu'on a retenu, en tête : la date se lit en entier avant d'être
         validée, on ne valide pas un chiffre entouré dans une grille. -->
    <div class="border-b border-line px-5 pb-4 pt-5">
      <p class="text-sm text-text-secondary">{{ label ?? t("common.chooseDate") }}</p>
      <p class="mt-1 text-xl font-semibold text-text-primary first-letter:uppercase">
        {{ draftLabel }}
      </p>
    </div>

    <div class="px-4 py-4">
      <div class="mb-3 flex items-center justify-between gap-2">
        <!-- Le mois ouvre les années : c'est ce qui évite d'user la flèche
             pour atteindre un jour lointain. -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-btn px-3 py-1.5 font-semibold text-text-primary transition-colors first-letter:uppercase hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          :aria-expanded="mode === 'years'"
          @click="showYears"
        >
          {{ monthLabel }}
          <AppIcon
            name="chevron-down"
            :size="14"
            class="text-text-secondary transition-transform duration-200"
            :class="mode === 'years' ? 'rotate-180' : ''"
          />
        </button>
        <div v-if="mode === 'days'" class="flex items-center">
          <button
            type="button"
            class="icon-btn"
            :aria-label="t('common.previousMonth')"
            @click="shiftMonth(-1)"
          >
            <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
          </button>
          <button
            type="button"
            class="icon-btn"
            :aria-label="t('common.nextMonth')"
            @click="shiftMonth(1)"
          >
            <AppIcon name="chevron-right" :size="18" class="rtl:rotate-180" />
          </button>
        </div>
      </div>

      <div v-if="mode === 'days'" class="grid grid-cols-7 gap-1 text-center">
        <span
          v-for="(weekday, index) in weekdayLabels"
          :key="index"
          class="pb-1 text-xs font-semibold text-text-secondary"
        >
          {{ weekday }}
        </span>

        <template v-for="(week, weekIndex) in weeks" :key="weekIndex">
          <button
            v-for="cell in week"
            :key="cell.key"
            type="button"
            class="aspect-square rounded-pill text-sm transition-colors"
            :class="cellClass(cell)"
            :disabled="cell.disabled"
            :aria-current="cell.today ? 'date' : undefined"
            @click="pickDay(cell.key, cell.disabled)"
          >
            {{ cell.day }}
          </button>
        </template>
      </div>

      <!-- Les années, à la place de la grille : on revient au mois dès qu'on
           en a choisi une, comme sur Android. -->
      <div
        v-else
        ref="yearsPanel"
        class="grid max-h-[17rem] grid-cols-3 gap-2 overflow-y-auto py-1"
      >
        <button
          v-for="year in years"
          :key="year"
          type="button"
          class="rounded-pill py-2 text-sm transition-colors"
          :data-current="year === cursor.getFullYear() ? '' : undefined"
          :class="
            year === cursor.getFullYear()
              ? 'bg-primary font-semibold text-white'
              : 'text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          "
          @click="pickYear(year)"
        >
          {{ year }}
        </button>
      </div>
    </div>

    <!-- Rien n'est choisi tant qu'on n'a pas validé : parcourir les années ne
         change donc rien, et renoncer se fait d'un mot. -->
    <div class="flex justify-end gap-2 border-t border-line px-4 py-3">
      <button type="button" class="btn btn-soft" @click="emit('close')">
        {{ t("common.cancel") }}
      </button>
      <button type="button" class="btn btn-primary" :disabled="!draft" @click="confirm">
        {{ t("common.confirm") }}
      </button>
    </div>
  </AppModal>
</template>
