<script setup lang="ts">
/**
 * Nouvel objectif, 3 (P2-Creer3) : pour quand, et à quel rythme. La date
 * qu'on se donne (Roch Hachana, Pessa'h, une autre, ou « à mon rythme », tant
 * par jour sans date), puis le rythme ; la réponse vient en couleur pleine,
 * avec son volume : ce que chaque jour d'étude (ou chaque semaine) demande,
 * en unités et en minutes, et la fin. Puis, à la semaine, les jours où la
 * carte vient sur l'accueil (écrits en entier), et le moment, posé sur le fil
 * du jour comme celui d'une habitude : une ligne dit à quoi il sert.
 */
import { HDate } from "@hebcal/core";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { bindingOf } from "../../../content/bindings";
import { useParcours } from "../../../composables/useParcours";
import { useParcoursViews } from "../../../composables/useParcoursViews";
import { localDayFrom } from "../../../services/dateService";
import { milestoneEve } from "../../../services/parcours/calendar";
import { addDays, daysBetween } from "../../../services/parcours/days";
import {
  ANCHOR_MOMENT,
  type DayKey,
  type HabitAnchor,
  type MomentId,
  type ProgramCorpus,
  type ProgramObjective,
  type ProgramPart,
  type Rhythm,
} from "../../../services/parcours/model";
import { endForRate, MINUTES_PER_UNIT, studySlots } from "../../../services/parcours/plan";
import { resolveParts, totalOf, unitOf } from "../../../services/parcours/texts";
import { formatHebrewDate } from "../../../services/zmanimService";
import AppDateField from "../../AppDateField.vue";
import ProgramVolume from "../ProgramVolume.vue";
import AnchorTrack from "../pickers/AnchorTrack.vue";

const props = defineProps<{ corpus: ProgramCorpus; parts: ProgramPart[] }>();
const end = defineModel<DayKey>("end", { required: true });
const rhythm = defineModel<Rhythm>("rhythm", { required: true });
const moment = defineModel<MomentId>("moment", { required: true });
/** Le repère sur le fil du jour ; le moment s'en déduit. */
const anchor = defineModel<HabitAnchor | null>("anchor", { required: true });
/** À la semaine : les jours où la carte vient sur l'accueil. */
const cardDays = defineModel<number[]>("cardDays", { required: true });
const emit = defineEmits<{ (e: "create"): void }>();

const { t, locale } = useI18n();
const store = useParcours();
const views = useParcoursViews();

const today = computed(() => store.today.value);
const unit = computed(() => unitOf(props.corpus));
const units = computed(() => totalOf(resolveParts(props.corpus, props.parts)));
const program = computed(
  () => ({ kind: "program", corpus: props.corpus, parts: props.parts }) as ProgramObjective,
);

const hebrewOf = (day: DayKey): HDate => {
  const date = localDayFrom(day) ?? new Date();
  date.setHours(12);
  return new HDate(date);
};

type EndChoice = "roshHashana" | "pessah" | "other" | "pace";
const choice = ref<EndChoice>("roshHashana");

const milestones = computed(() => ({
  roshHashana: milestoneEve("roshHashana", today.value),
  pessah: milestoneEve("pessah", today.value),
}));

/** « Roch Hachana 5788 » : l'année de la fête, le lendemain de la veille. */
function feastLabel(key: "roshHashana" | "pessah"): string {
  const year = hebrewOf(milestones.value[key]).next().getFullYear();
  return t("parcours.create.feastYear", { feast: t(`parcours.ends.${key}`), year });
}

const ends = computed(() => [
  {
    key: "roshHashana" as const,
    title: feastLabel("roshHashana"),
    sub: t("parcours.create.endRh", {
      n: daysBetween(today.value, milestones.value.roshHashana),
    }),
  },
  {
    key: "pessah" as const,
    title: feastLabel("pessah"),
    sub: t("parcours.create.endPessah", { n: daysBetween(today.value, milestones.value.pessah) }),
  },
  {
    key: "other" as const,
    title: t("parcours.create.endOther"),
    sub: t("parcours.create.endOtherSub"),
  },
  {
    key: "pace" as const,
    title: t("parcours.create.endPace"),
    sub: t("parcours.create.endPaceSub"),
  },
]);

/** À mon rythme : tant d'unités par jour d'étude, ou par semaine. */
const perSlot = ref(2);
const otherEnd = ref<DayKey>(addDays(today.value, 182));

function pick(key: EndChoice): void {
  choice.value = key;
  if (key === "pace") {
    // On part du pas qu'il faudrait pour Roch Hachana : un repère, qu'on ajuste.
    const slots = studySlots(
      rhythm.value,
      today.value,
      milestones.value.roshHashana,
      store.isRest.value,
    );
    perSlot.value = Math.max(1, Math.ceil(units.value / Math.max(1, slots.length)));
  }
}

// La date de fin suit le choix : la veille de la fête, la date choisie, ou celle que donne le pas.
watch(
  [choice, otherEnd, perSlot, rhythm, units],
  () => {
    if (choice.value === "roshHashana" || choice.value === "pessah") {
      end.value = milestones.value[choice.value];
    } else if (choice.value === "other") {
      end.value = otherEnd.value;
    } else {
      end.value = endForRate(
        rhythm.value,
        today.value,
        units.value,
        perSlot.value,
        store.isRest.value,
      );
    }
  },
  { immediate: true },
);

const slots = computed(() =>
  Math.max(1, studySlots(rhythm.value, today.value, end.value, store.isRest.value).length),
);
const average = computed(() =>
  choice.value === "pace" ? perSlot.value : units.value / slots.value,
);

/** « 3 michnayot », « 3 ou 4 michnayot ». */
const pace = computed(() => {
  const avg = average.value;
  const lo = Math.max(1, Math.floor(avg));
  const frac = avg - Math.floor(avg);
  if (choice.value === "pace" || frac < 0.15) return views.unitsLabel(unit.value, lo);
  if (frac > 0.85) return views.unitsLabel(unit.value, lo + 1);
  return t("parcours.create.paceOr", { a: lo, b: views.unitsLabel(unit.value, lo + 1) });
});

/** « 12 min », « 1 h 10 ». */
function duration(minutes: number): string {
  if (minutes < 60) return t("parcours.create.minutes", { n: minutes });
  return t("parcours.create.hours", {
    h: Math.floor(minutes / 60),
    m: String(minutes % 60).padStart(2, "0"),
  });
}

const endLabel = computed(() => formatHebrewDate(hebrewOf(end.value), locale.value));
const weekly = computed(() => rhythm.value === "weekly");

const effort = computed(() => {
  const minutes = Math.max(1, Math.round(average.value * MINUTES_PER_UNIT[unit.value]));
  if (choice.value === "pace") return t("parcours.create.effortPace", { end: endLabel.value });
  if (weekly.value) {
    return t("parcours.create.effortWeekly", {
      time: duration(minutes),
      weeks: slots.value,
      end: endLabel.value,
    });
  }
  return t("parcours.create.effortDaily", { time: duration(minutes), end: endLabel.value });
});

/** Plus d'une demi-heure par jour, ou de trois heures dans la semaine : on le dit. */
const tight = computed(() => {
  const minutes = average.value * MINUTES_PER_UNIT[unit.value];
  return weekly.value ? minutes > 180 : minutes > 30;
});

const RHYTHM_CHOICES: Rhythm[] = ["daily", "weekdays", "weekly"];
const CARD_DAYS = [0, 1, 2, 3, 4, 5];

/** Le rond du fil : poser un repère pose aussi le moment, le repère en dernier. */
const trackAnchor = computed({
  get: () => anchor.value,
  set: (next: HabitAnchor | null) => {
    moment.value = next ? ANCHOR_MOMENT[next] : "anytime";
    anchor.value = next;
  },
});
const momentName = computed(() =>
  anchor.value ? t(`parcours.anchors.${anchor.value}`) : t("parcours.day.moments.anytime"),
);

function toggleCardDay(day: number): void {
  cardDays.value = cardDays.value.includes(day)
    ? cardDays.value.filter((d) => d !== day)
    : [...cardDays.value, day].sort((a, b) => a - b);
}

/** Ce que la carte fera sur l'accueil. */
const cardLine = computed(() => {
  const when = t(`parcours.when.${moment.value}`);
  if (!weekly.value) return t("parcours.create.cardDaily", { when });
  if (cardDays.value.length === 0) return t("parcours.create.cardNoDay");
  const names = cardDays.value.map((d) =>
    t(`parcours.weekdays.${d}`).toLocaleLowerCase(locale.value),
  );
  return t("parcours.create.cardWeekly", { days: names.join(", "), when });
});
</script>

<template>
  <div>
    <div class="end-options mt-[18px]" role="group" :aria-label="t('parcours.form.end')">
      <button
        v-for="option in ends"
        :key="option.key"
        type="button"
        class="end-option"
        :class="{ 'is-on': choice === option.key }"
        :aria-pressed="choice === option.key"
        @click="pick(option.key)"
      >
        <span class="end-title">{{ option.title }}</span>
        <span class="mt-0.5 block text-[13px] text-text-secondary">{{ option.sub }}</span>
      </button>
    </div>
    <AppDateField
      v-if="choice === 'other'"
      v-model="otherEnd"
      class="mt-3"
      :min="addDays(today, 7)"
      :label="t('parcours.form.endDate')"
    />
    <div v-else-if="choice === 'pace'" class="mt-3 flex items-center justify-between gap-3">
      <span class="text-sm font-semibold">{{
        weekly ? t("parcours.create.perWeek") : t("parcours.create.perDay")
      }}</span>
      <span class="flex items-center gap-2">
        <button
          type="button"
          class="stepper"
          :disabled="perSlot <= 1"
          :aria-label="t('parcours.create.less')"
          @click="perSlot = Math.max(1, perSlot - 1)"
        >
          −
        </button>
        <span class="min-w-[7ch] text-center text-[15px] font-bold tabular-nums">
          {{ views.unitsLabel(unit, perSlot) }}
        </span>
        <button
          type="button"
          class="stepper"
          :aria-label="t('parcours.create.more')"
          @click="perSlot = perSlot + 1"
        >
          +
        </button>
      </span>
    </div>

    <p class="create-lab">{{ t("parcours.form.rhythm") }}</p>
    <div class="segmented" role="group" :aria-label="t('parcours.form.rhythm')">
      <button
        v-for="option in RHYTHM_CHOICES"
        :key="option"
        type="button"
        :class="{ 'is-on': rhythm === option }"
        :aria-pressed="rhythm === option"
        @click="rhythm = option"
      >
        {{ t(`parcours.create.rhythms.${option}`) }}
      </button>
    </div>
    <p class="mt-2 text-[13px] leading-normal text-text-secondary">
      {{ t(`parcours.create.rhythmNotes.${rhythm}`) }}
    </p>

    <!-- La réponse, en couleur pleine, avec son volume. -->
    <div class="pace-card">
      <ProgramVolume
        class="pace-volume"
        :color="bindingOf(corpus)"
        :lines="[views.coverLabel(program)]"
        :progress="0"
        :scale="0.75"
      />
      <p class="text-[13px] font-semibold opacity-80">
        {{ weekly ? t("parcours.create.eachWeek") : t("parcours.create.eachDay") }}
      </p>
      <p class="mt-1 text-[30px] font-extrabold leading-tight">{{ pace }}</p>
      <p class="mt-1.5 text-sm opacity-90">{{ effort }}</p>
    </div>
    <p v-if="tight" class="mt-2.5 text-[13px] leading-normal">
      <strong class="text-primary">{{ t("parcours.create.tight") }}</strong>
      {{ t("parcours.create.tightHint") }}
    </p>

    <p class="create-lab">{{ t("parcours.create.whenStudy") }}</p>
    <div
      v-if="weekly"
      class="mb-3 flex flex-wrap gap-1.5"
      role="group"
      :aria-label="t('parcours.create.cardDays')"
    >
      <button
        v-for="day in CARD_DAYS"
        :key="day"
        type="button"
        class="chip"
        :class="{ 'is-on': cardDays.includes(day) }"
        :aria-pressed="cardDays.includes(day)"
        @click="toggleCardDay(day)"
      >
        {{ t(`parcours.weekdays.${day}`) }}
      </button>
    </div>
    <!-- Le moment, sur le fil du jour : à quoi il sert, d'abord. -->
    <p class="text-[13px] leading-normal text-text-secondary">
      {{ t("parcours.create.studyWhenHint") }}
    </p>
    <AnchorTrack
      v-model:anchor="trackAnchor"
      :label="t('parcours.create.whenStudy')"
      :value-text="momentName"
    />
    <p class="mt-1.5 text-base font-bold">{{ momentName }}</p>
    <p class="mt-0.5 text-[13px] text-text-secondary">
      {{ t("parcours.create.slide") }}
      <button
        type="button"
        class="font-bold text-primary"
        :aria-pressed="anchor === null"
        @click="trackAnchor = null"
      >
        {{ t("parcours.create.allDay") }}
      </button>
    </p>
    <p class="mt-2.5 text-[13px] leading-normal text-text-secondary">{{ cardLine }}</p>

    <button
      type="button"
      class="btn btn-primary create-cta"
      :disabled="weekly && cardDays.length === 0"
      @click="emit('create')"
    >
      {{ t("parcours.create.shelve") }}
    </button>
    <p class="mt-2.5 text-center text-[13px] leading-normal text-text-secondary">
      {{ t("parcours.create.shelveHint") }}
    </p>
  </div>
</template>

<style scoped>
.create-lab {
  margin: 24px 0 10px;
  font-size: 15px;
  font-weight: 700;
}
.end-options {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.end-option {
  display: block;
  width: 100%;
  padding: 12px 16px;
  text-align: start;
}
.end-option + .end-option {
  border-top: 1px solid var(--color-line);
}
.end-option.is-on {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}
.end-title {
  display: block;
  font-size: 16px;
  font-weight: 700;
}
.end-option.is-on .end-title {
  color: var(--color-primary);
}
.stepper {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
  font-size: 18px;
  font-weight: 700;
}
.stepper:disabled {
  opacity: 0.4;
}
/* Le rythme : trois segments, celui qu'on prend en couleur pleine. */
.segmented {
  display: flex;
  padding: 3px;
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}
.segmented button {
  flex: 1;
  height: 38px;
  border-radius: 11px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-secondary);
}
.segmented button.is-on {
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.pace-card {
  position: relative;
  margin-top: 30px;
  padding-block: 18px;
  padding-inline: 18px 110px;
  border-radius: var(--radius-card);
  background: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: var(--shadow-card);
}
.pace-volume {
  position: absolute;
  inset-inline-end: 18px;
  top: -22px;
  transform: rotate(7deg);
  filter: drop-shadow(0 4px 6px rgb(30 26 18 / 0.25));
}
.chip {
  height: 38px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.chip.is-on {
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.create-cta {
  width: 100%;
  min-height: 48px;
  margin-top: 26px;
  font-size: 15px;
  font-weight: 700;
}
</style>
