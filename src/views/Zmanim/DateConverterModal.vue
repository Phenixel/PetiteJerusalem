<script setup lang="ts">
/**
 * Le convertisseur de dates du calendrier : passer d'une date hébraïque à la
 * date civile d'une année donnée, d'une date civile à sa date hébraïque, et
 * calculer le jour d'une bar-mitsvah (ou d'une bat-mitsvah).
 *
 * Trois questions qu'on se pose au même endroit que les fêtes de l'année, et
 * qu'on allait jusqu'ici chercher sur un autre site. Tout est calculé sur
 * l'appareil (voir hebrewDateConverter), comme le reste du calendrier : rien
 * à charger, et la fenêtre sert sans connexion.
 *
 * Le jour hébraïque commence la veille au coucher du soleil. Chaque sens le
 * dit à sa façon : la date civile d'une date hébraïque rappelle la veille au
 * soir, et une date civile demande si c'était après le coucher.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { HDate } from "@hebcal/core";
import AppModal from "../../components/AppModal.vue";
import AppSelect from "../../components/AppSelect.vue";
import AppDateField from "../../components/AppDateField.vue";
import ToggleSwitch from "../../components/ToggleSwitch.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { analyticsService } from "../../services/analyticsService";
import { dateTimeFormat } from "../../services/intlCache";
import { localDayFrom, localDayKey } from "../../services/dateService";
import {
  formatHebrewDate,
  hebrewMonthName,
  holidayNamesOn,
  isIsraelPlace,
  type ZmanimPlace,
} from "../../services/zmanimService";
import {
  civilToHebrew,
  civilYearsOf,
  hebrewDate,
  isConverterYear,
  MAX_CONVERTER_YEAR,
  MIN_CONVERTER_YEAR,
  mitzvahDate,
  monthInYear,
  monthsOfYear,
  type MitzvahKind,
} from "../../services/hebrewDateConverter";
import { getWeeklyParasha, shabbatOfWeek } from "../../services/dailyCycles";
import { hubPath } from "../../content/etudeTexts";

const props = defineProps<{
  open: boolean;
  /** Le jour d'aujourd'hui : il remplit le formulaire à l'ouverture. */
  today: HDate;
  /** Le lieu des horaires : il dit quel calendrier des fêtes et des parachiot suivre. */
  place: ZmanimPlace;
}>();

const emit = defineEmits<{ close: [] }>();

const { t, locale } = useI18n();

type Tool = "hebrew" | "civil" | "mitzvah";

/** Les trois onglets, nommés par ce qu'on connaît déjà. */
const TOOLS: { tool: Tool; labelKey: string }[] = [
  { tool: "hebrew", labelKey: "converter.tabs.hebrew" },
  { tool: "civil", labelKey: "converter.tabs.civil" },
  { tool: "mitzvah", labelKey: "converter.tabs.mitzvah" },
];

const tool = ref<Tool>("hebrew");

const segmentClass = (active: boolean) =>
  active ? "bg-surface text-primary shadow-sm" : "text-text-secondary hover:text-text-primary";

/** « jeudi 3 décembre 2026 » */
const longCivil = (date: Date): string =>
  dateTimeFormat(locale.value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

/** « mercredi 2 décembre », la veille au soir : l'année est celle de la ligne du dessus. */
const shortCivil = (date: Date): string =>
  dateTimeFormat(locale.value, { weekday: "long", day: "numeric", month: "long" }).format(date);

/** Les fêtes du jour, au calendrier du lieu (Israël ou diaspora). */
const festivalsOf = (hd: HDate): string => holidayNamesOn(props.place, hd, locale.value).join(", ");

// ---- Date hébraïque vers date civile ----------------------------------------

const hDay = ref(props.today.getDate());
const hMonth = ref(props.today.getMonth());
const hYear = ref<number | string>(props.today.getFullYear());

/** L'année tapée, si elle en est une ; la dernière valable sinon, pour les listes. */
const typedYear = computed(() => Number(hYear.value));
const yearValid = computed(() => isConverterYear(typedYear.value));
const lastValidYear = ref(props.today.getFullYear());
watch(typedYear, (year) => {
  if (isConverterYear(year)) lastValidYear.value = year;
});

/** Adar II n'existe que dans les années à treize mois : on le ramène à Adar. */
watch(lastValidYear, (year) => {
  hMonth.value = monthInYear(hMonth.value, year);
});

const monthOptions = computed(() =>
  monthsOfYear(lastValidYear.value).map((month) => ({
    value: String(month),
    label: hebrewMonthName(month, lastValidYear.value, locale.value),
  })),
);

/** Les jours du mois choisi, cette année-là : 'Hechvan et Kislev en ont 29 ou 30. */
const daysInMonth = computed(() =>
  HDate.daysInMonth(monthInYear(hMonth.value, lastValidYear.value), lastValidYear.value),
);

const dayOptions = computed(() =>
  Array.from({ length: daysInMonth.value }, (_, index) => ({
    value: String(index + 1),
    label: String(index + 1),
  })),
);

watch(daysInMonth, (last) => {
  if (hDay.value > last) hDay.value = last;
});

const hDayModel = computed({
  get: () => String(hDay.value),
  set: (value: string) => {
    hDay.value = Number(value);
  },
});

const hMonthModel = computed({
  get: () => String(hMonth.value),
  set: (value: string) => {
    hMonth.value = Number(value);
  },
});

function shiftYear(delta: number): void {
  hYear.value = lastValidYear.value + delta;
}

/** « L'année 5787 s'étend sur 2026 et 2027. » */
const yearSpan = computed(() => {
  const { from, to } = civilYearsOf(lastValidYear.value);
  return t("converter.yearSpan", { year: lastValidYear.value, from, to });
});

const hebrewResult = computed(() =>
  yearValid.value ? hebrewDate(hDay.value, hMonth.value, typedYear.value) : null,
);

// ---- Date civile vers date hébraïque ----------------------------------------

const civilDay = ref(localDayKey(props.today.greg()));
const civilAfterSunset = ref(false);

const civilResult = computed(() => {
  const date = localDayFrom(civilDay.value);
  return date ? civilToHebrew(date, civilAfterSunset.value) : null;
});

// ---- Bar-mitsvah ------------------------------------------------------------

const KINDS: { kind: MitzvahKind; labelKey: string }[] = [
  { kind: "bar", labelKey: "converter.mitzvah.kinds.bar" },
  { kind: "bat", labelKey: "converter.mitzvah.kinds.bat" },
];

const mitzvahKind = ref<MitzvahKind>("bar");
const birthDay = ref("");
const birthAfterSunset = ref(false);

const birth = computed(() => {
  const date = localDayFrom(birthDay.value);
  return date ? civilToHebrew(date, birthAfterSunset.value) : null;
});

const mitzvah = computed(() => (birth.value ? mitzvahDate(birth.value, mitzvahKind.value) : null));

const mitzvahTitle = computed(() =>
  mitzvahKind.value === "bar" ? t("converter.mitzvah.barOn") : t("converter.mitzvah.batOn"),
);

/**
 * Le premier Chabbat où l'on lit une paracha, à partir du jour de la
 * bar-mitsvah (lui compris : né un samedi, on l'est dès le vendredi soir).
 * C'est la question qui suit, celle de la paracha qu'on préparera ; un
 * Chabbat de fête n'en a pas, on passe au suivant comme le chnei mikra.
 */
const firstShabbat = computed(() => {
  if (!mitzvah.value) return null;
  const parasha = getWeeklyParasha(mitzvah.value.greg(), isIsraelPlace(props.place));
  return parasha ? { parasha, date: shabbatOfWeek(parasha.weekKey) } : null;
});

// ---- Suivi -----------------------------------------------------------------

/**
 * Un outil se compte une fois par ouverture, au premier geste qui le règle :
 * à chaque chiffre changé, l'événement ne dirait plus rien. Ni la date ni
 * l'année ne partent : une date de naissance désigne une personne.
 */
const TRACKED: Record<Tool, "hebrew_to_civil" | "civil_to_hebrew" | "bar_mitzvah"> = {
  hebrew: "hebrew_to_civil",
  civil: "civil_to_hebrew",
  mitzvah: "bar_mitzvah",
};
const used = new Set<Tool>();

function track(which: Tool): void {
  if (!props.open || used.has(which)) return;
  used.add(which);
  analyticsService.capture("date_converted", { tool: TRACKED[which] });
}

watch([hDay, hMonth, hYear], () => track("hebrew"));
watch([civilDay, civilAfterSunset], () => track("civil"));
watch([birthDay, birthAfterSunset, mitzvahKind], () => {
  if (birthDay.value) track("mitzvah");
});

watch(
  () => props.open,
  (open) => {
    if (open) used.clear();
  },
);
</script>

<template>
  <AppModal
    :open="open"
    labelledby="date-converter-title"
    panel-class="modal-panel !max-w-sm flex flex-col gap-4 animate-[scaleIn_0.3s_ease]"
    @close="emit('close')"
  >
    <div class="flex items-center justify-between gap-2">
      <h3
        id="date-converter-title"
        class="flex min-w-0 items-center gap-2 text-lg font-bold text-text-primary"
      >
        <AppIcon name="rotate" :size="17" class="shrink-0 text-primary" />
        <span class="truncate">{{ t("converter.title") }}</span>
      </h3>
      <button
        type="button"
        class="icon-btn shrink-0"
        :aria-label="t('common.close')"
        @click="emit('close')"
      >
        <AppIcon name="x" :size="18" />
      </button>
    </div>

    <!-- Ce qu'on connaît déjà : une date hébraïque, une date civile, ou la
         date de naissance d'un enfant. -->
    <div
      class="grid grid-cols-3 p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
      role="group"
      :aria-label="t('converter.title')"
    >
      <button
        v-for="option in TOOLS"
        :key="option.tool"
        type="button"
        class="rounded-control px-1 py-2 text-sm font-semibold transition-colors"
        :class="segmentClass(tool === option.tool)"
        :aria-pressed="tool === option.tool"
        @click="tool = option.tool"
      >
        {{ t(option.labelKey) }}
      </button>
    </div>

    <!-- ===== Date hébraïque vers date civile ===== -->
    <template v-if="tool === 'hebrew'">
      <div>
        <p class="text-sm font-medium text-text-primary">{{ t("converter.hebrewDate") }}</p>
        <div class="mt-1.5 flex gap-3">
          <div class="w-20 shrink-0">
            <AppSelect v-model="hDayModel" :options="dayOptions" />
          </div>
          <div class="min-w-0 flex-1">
            <AppSelect v-model="hMonthModel" :options="monthOptions" />
          </div>
        </div>
      </div>

      <!-- L'année se tape, ou se parcourt aux flèches comme celle du calendrier. -->
      <div>
        <label class="text-sm font-medium text-text-primary" for="converter-year">
          {{ t("converter.year") }}
        </label>
        <div class="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            class="icon-btn shrink-0"
            :aria-label="t('calendar.previousYear')"
            @click="shiftYear(-1)"
          >
            <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
          </button>
          <input
            id="converter-year"
            v-model="hYear"
            type="number"
            inputmode="numeric"
            class="field min-w-0 flex-1 text-center tabular-nums"
            :min="MIN_CONVERTER_YEAR"
            :max="MAX_CONVERTER_YEAR"
          />
          <button
            type="button"
            class="icon-btn shrink-0"
            :aria-label="t('calendar.nextYear')"
            @click="shiftYear(1)"
          >
            <AppIcon name="chevron-right" :size="18" class="rtl:rotate-180" />
          </button>
        </div>
        <p class="mt-1.5 text-center text-xs text-text-secondary">
          {{
            yearValid
              ? yearSpan
              : t("converter.invalidYear", { min: MIN_CONVERTER_YEAR, max: MAX_CONVERTER_YEAR })
          }}
        </p>
      </div>

      <div v-if="hebrewResult" class="rounded-card bg-surface-soft px-4 py-3.5" aria-live="polite">
        <p class="font-semibold text-text-primary">{{ longCivil(hebrewResult.greg()) }}</p>
        <p class="mt-0.5 text-xs text-text-secondary">
          {{ t("converter.startsEve", { eve: shortCivil(hebrewResult.prev().greg()) }) }}
        </p>
        <p v-if="festivalsOf(hebrewResult)" class="mt-1.5 text-sm text-primary">
          {{ festivalsOf(hebrewResult) }}
        </p>
      </div>
    </template>

    <!-- ===== Date civile vers date hébraïque ===== -->
    <template v-else-if="tool === 'civil'">
      <div>
        <label class="text-sm font-medium text-text-primary" for="converter-civil">
          {{ t("converter.civilDate") }}
        </label>
        <AppDateField
          id="converter-civil"
          v-model="civilDay"
          class="mt-1.5"
          :first-year="1900"
          :label="t('converter.civilDate')"
        />
      </div>
      <label class="flex items-center justify-between gap-3">
        <span class="min-w-0">
          <span class="block text-sm font-medium text-text-primary">
            {{ t("converter.afterSunset") }}
          </span>
          <span class="block text-xs text-text-secondary">{{
            t("converter.afterSunsetHint")
          }}</span>
        </span>
        <ToggleSwitch v-model="civilAfterSunset" />
      </label>

      <div v-if="civilResult" class="rounded-card bg-surface-soft px-4 py-3.5" aria-live="polite">
        <p class="font-semibold text-text-primary">{{ formatHebrewDate(civilResult, locale) }}</p>
        <!-- En lettres hébraïques aussi : c'est ainsi qu'elle s'écrit sur un
             faire-part ou une plaque. -->
        <p v-if="locale !== 'he'" class="mt-0.5 text-sm text-text-secondary" lang="he" dir="rtl">
          {{ civilResult.renderGematriya() }}
        </p>
        <p v-if="festivalsOf(civilResult)" class="mt-1.5 text-sm text-primary">
          {{ festivalsOf(civilResult) }}
        </p>
      </div>
    </template>

    <!-- ===== Bar-mitsvah ===== -->
    <template v-else>
      <div
        class="grid grid-cols-2 p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
        role="group"
        :aria-label="t('converter.tabs.mitzvah')"
      >
        <button
          v-for="option in KINDS"
          :key="option.kind"
          type="button"
          class="rounded-control px-2 py-2 text-sm font-semibold transition-colors"
          :class="segmentClass(mitzvahKind === option.kind)"
          :aria-pressed="mitzvahKind === option.kind"
          @click="mitzvahKind = option.kind"
        >
          {{ t(option.labelKey) }}
        </button>
      </div>

      <div>
        <label class="text-sm font-medium text-text-primary" for="converter-birth">
          {{ t("converter.mitzvah.birthDate") }}
        </label>
        <AppDateField
          id="converter-birth"
          v-model="birthDay"
          class="mt-1.5"
          :first-year="1900"
          :label="t('converter.mitzvah.birthDate')"
        />
      </div>
      <label class="flex items-center justify-between gap-3">
        <span class="min-w-0">
          <span class="block text-sm font-medium text-text-primary">
            {{ t("converter.afterSunset") }}
          </span>
          <span class="block text-xs text-text-secondary">{{
            t("converter.afterSunsetHint")
          }}</span>
        </span>
        <ToggleSwitch v-model="birthAfterSunset" />
      </label>

      <div
        v-if="birth && mitzvah"
        class="rounded-card bg-surface-soft px-4 py-3.5"
        aria-live="polite"
      >
        <p class="text-xs text-text-secondary">
          {{ t("converter.mitzvah.born", { hebrew: formatHebrewDate(birth, locale) }) }}
        </p>
        <p class="mt-2 text-sm text-text-secondary">{{ mitzvahTitle }}</p>
        <p class="font-semibold text-text-primary">{{ longCivil(mitzvah.greg()) }}</p>
        <p class="text-sm text-text-secondary">{{ formatHebrewDate(mitzvah, locale) }}</p>
        <p class="mt-1 text-xs text-text-secondary">
          {{ t("converter.mitzvah.fromNightfall", { eve: shortCivil(mitzvah.prev().greg()) }) }}
        </p>
        <!-- La paracha mène à son texte : c'est elle qu'on préparera. -->
        <p v-if="firstShabbat" class="mt-2 border-t border-line pt-2 text-sm text-text-secondary">
          {{ t("converter.mitzvah.firstShabbat", { date: shortCivil(firstShabbat.date) }) }}
          <template v-for="(entry, index) in firstShabbat.parasha.entries" :key="entry.id"
            ><span v-if="index > 0"> ·</span>{{ " "
            }}<RouterLink :to="hubPath(entry)" class="font-medium text-primary hover:underline">{{
              entry.name
            }}</RouterLink></template
          >
        </p>
      </div>
      <p v-else class="text-sm text-text-secondary">{{ t("converter.mitzvah.pickBirth") }}</p>

      <p class="text-xs leading-relaxed text-text-secondary">{{ t("converter.mitzvah.note") }}</p>
    </template>
  </AppModal>
</template>
