<script setup lang="ts">
/**
 * Modifier un programme (P2-Reglages) : des lignes groupées, comme les
 * réglages du téléphone. Le rythme (la date de fin, les jours d'étude, ce
 * qu'on fait d'un retard), le moment, puis la pause et le rangement. Une
 * ligne touchée ouvre sa feuille, en bas de l'écran.
 *
 * Changer la date ou le rythme repart d'aujourd'hui, à la position atteinte :
 * le pas se recalcule sur ce qui reste. Mettre en pause garde tout ; ranger
 * se confirme.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import BottomSheet from "../../components/parcours/BottomSheet.vue";
import ParcoursBack from "../../components/parcours/ParcoursBack.vue";
import ChoicePill from "../../components/parcours/pickers/ChoicePill.vue";
import EndDatePicker from "../../components/parcours/pickers/EndDatePicker.vue";
import AnchorTrack from "../../components/parcours/pickers/AnchorTrack.vue";
import RhythmPicker from "../../components/parcours/pickers/RhythmPicker.vue";
import { useConfirm } from "../../composables/useConfirm";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { analyticsService } from "../../services/analyticsService";
import {
  ANCHOR_MOMENT,
  CATCH_UP_OPTIONS,
  type CatchUpOption,
  type DayKey,
  type HabitAnchor,
  type ProgramObjective,
  type Rhythm,
} from "../../services/parcours/model";
import { rebase } from "../../services/parcours/plan";

useParcoursMeta("parcours.settings.title", "/parcours");

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { confirm } = useConfirm();
const store = useParcours();
const views = useParcoursViews();

const program = computed<ProgramObjective | null>(() => {
  const found = store.data.value.objectives[String(route.params.id)];
  return found?.kind === "program" && found.deletedAt === undefined ? found : null;
});

const position = computed(() =>
  program.value
    ? (store.context.value.plans.get(program.value.id)?.positionAt(store.today.value) ?? 0)
    : 0,
);

function change(next: Partial<Pick<ProgramObjective, "end" | "rhythm">>): void {
  const p = program.value;
  if (!p) return;
  store.saveObjective(
    rebase(p, next, store.today.value, store.data.value.days, store.isRest.value),
  );
  analyticsService.capture("parcours_program_updated", { field: Object.keys(next)[0] });
}

const end = computed({
  get: () => program.value?.end ?? store.today.value,
  set: (value: DayKey) => change({ end: value }),
});
const rhythm = computed({
  get: () => program.value?.rhythm ?? "daily",
  set: (value: Rhythm) => change({ rhythm: value }),
});
const moment = computed(() => program.value?.moment ?? "evening");
/** Le repère sur le fil du jour : il pose le moment avec lui, en un seul enregistrement. */
const anchor = computed({
  get: () => program.value?.anchor ?? null,
  set: (next: HabitAnchor | null) => {
    if (!program.value) return;
    const changed: ProgramObjective = {
      ...program.value,
      moment: next ? ANCHOR_MOMENT[next] : "anytime",
    };
    if (next) changed.anchor = next;
    else delete changed.anchor;
    store.saveObjective(changed);
  },
});
const momentName = computed(() =>
  anchor.value ? t(`parcours.anchors.${anchor.value}`) : t(`parcours.day.during.${moment.value}`),
);
const paces = computed(() =>
  program.value
    ? views.paceLabels(
        program.value.corpus,
        program.value.total - position.value,
        store.today.value,
        end.value,
      )
    : { daily: "", weekdays: "", weekly: "" },
);

/** Ce qu'on fait d'un retard : demander, ou toujours la même chose. */
function setAutoCatchUp(option: CatchUpOption | null): void {
  const p = program.value;
  if (!p) return;
  const next = { ...p };
  if (option) next.autoCatchUp = option;
  else delete next.autoCatchUp;
  store.saveObjective(next);
}

const endValue = computed(() =>
  t("parcours.settings.endValue", { date: views.dayLabel(end.value) }),
);

type Sheet = "end" | "rhythm" | "late" | "moment";
const sheet = ref<Sheet | null>(null);

const paused = computed(() => program.value?.pausedFrom !== undefined);

function togglePause(): void {
  const p = program.value;
  if (!p) return;
  store.setPaused(p.id, !paused.value);
  analyticsService.capture("parcours_objective_paused", { paused: !paused.value, kind: p.kind });
}

async function remove(): Promise<void> {
  const p = program.value;
  if (!p) return;
  const accepted = await confirm({
    title: t("parcours.settings.removeTitle", { name: views.objectiveTitle(p) }),
    message: t("parcours.settings.removeText"),
    confirmLabel: t("parcours.settings.remove"),
    danger: true,
  });
  if (!accepted) return;
  store.removeObjective(p.id);
  analyticsService.capture("parcours_objective_removed", { kind: p.kind });
  void router.replace("/parcours");
}
</script>

<template>
  <main class="mx-auto w-full max-w-2xl px-4 pb-10 pt-[18px] md:px-6 md:py-12">
    <ParcoursBack
      :to="program ? `/parcours/objectif/${program.id}` : '/parcours'"
      :label="program ? views.objectiveTitle(program) : t('parcours.title')"
    />
    <h1 class="mt-1 text-center font-display text-[28px] font-bold">
      {{ t("parcours.settings.heading") }}
    </h1>
    <p class="mt-1.5 text-center text-sm text-text-secondary">{{ t("parcours.settings.intro") }}</p>

    <p v-if="!program" class="mt-16 text-center text-text-secondary">
      {{ t("parcours.objective.missing") }}
    </p>
    <template v-else>
      <p class="settings-label">{{ t("parcours.settings.rhythm") }}</p>
      <div class="settings-group">
        <button type="button" class="settings-row" @click="sheet = 'end'">
          <span class="settings-key">{{ t("parcours.settings.end") }}</span>
          <span class="settings-value">{{ endValue }}</span>
          <svg class="settings-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" class="settings-row" @click="sheet = 'rhythm'">
          <span class="settings-key">{{ t("parcours.settings.days") }}</span>
          <span class="settings-value">{{ t(`parcours.settings.rhythmValue.${rhythm}`) }}</span>
          <svg class="settings-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" class="settings-row" @click="sheet = 'late'">
          <span class="settings-key">{{ t("parcours.settings.late") }}</span>
          <span class="settings-value">{{
            program.autoCatchUp
              ? t(`parcours.catchUp.options.${program.autoCatchUp}`)
              : t("parcours.settings.ask")
          }}</span>
          <svg class="settings-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <p class="settings-label">{{ t("parcours.settings.moment") }}</p>
      <div class="settings-group">
        <button type="button" class="settings-row" @click="sheet = 'moment'">
          <span class="settings-key">{{ t("parcours.settings.when") }}</span>
          <span class="settings-value">{{ momentName }}</span>
          <svg class="settings-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div class="settings-group mt-7">
        <button type="button" class="settings-row" @click="togglePause">
          <span class="settings-key">{{
            paused ? t("parcours.settings.resume") : t("parcours.settings.pause")
          }}</span>
          <span class="settings-value">{{
            paused ? t("parcours.settings.pausedHint") : t("parcours.settings.pauseFor")
          }}</span>
        </button>
        <button type="button" class="settings-row" @click="remove">
          <span class="settings-key settings-danger">{{
            t("parcours.settings.removeVolume")
          }}</span>
        </button>
      </div>
      <p class="mt-2.5 px-1 text-[13px] leading-normal text-text-secondary">
        {{ t("parcours.settings.removeHint") }}
      </p>

      <BottomSheet
        :open="sheet !== null"
        :label="t('parcours.settings.heading')"
        @close="sheet = null"
      >
        <template v-if="sheet === 'end'">
          <p class="sheet-title">{{ t("parcours.form.end") }}</p>
          <EndDatePicker v-model="end" class="mt-3" :today="store.today.value" />
        </template>
        <template v-else-if="sheet === 'rhythm'">
          <p class="sheet-title">{{ t("parcours.form.rhythm") }}</p>
          <RhythmPicker v-model="rhythm" class="mt-3" :paces="paces" />
          <p class="mt-2 text-[13px] text-text-secondary">
            {{ t("parcours.settings.rebaseHint") }}
          </p>
        </template>
        <template v-else-if="sheet === 'late'">
          <p class="sheet-title">{{ t("parcours.settings.late") }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <ChoicePill :on="!program.autoCatchUp" @click="setAutoCatchUp(null)">
              {{ t("parcours.settings.ask") }}
            </ChoicePill>
            <ChoicePill
              v-for="option in CATCH_UP_OPTIONS"
              :key="option"
              :on="program.autoCatchUp === option"
              @click="setAutoCatchUp(option)"
            >
              {{ t(`parcours.catchUp.options.${option}`) }}
            </ChoicePill>
          </div>
        </template>
        <template v-else-if="sheet === 'moment'">
          <p class="sheet-title">{{ t("parcours.form.moment") }}</p>
          <p class="mt-1 text-[13px] leading-normal text-text-secondary">
            {{ t("parcours.create.studyWhenHint") }}
          </p>
          <AnchorTrack
            v-model:anchor="anchor"
            :label="t('parcours.form.moment')"
            :value-text="momentName"
          />
          <p v-if="anchor" class="mt-1.5 text-base font-bold">{{ momentName }}</p>
        </template>
        <button type="button" class="btn btn-primary sheet-done" @click="sheet = null">
          {{ t("common.close") }}
        </button>
      </BottomSheet>
    </template>
  </main>
</template>

<style scoped>
.settings-label {
  margin: 24px 4px 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.settings-group {
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.settings-group > .settings-row + .settings-row {
  border-top: 1px solid var(--color-line);
}
.settings-row {
  display: flex;
  width: 100%;
  min-height: 54px;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  text-align: start;
}
.settings-key {
  flex: 1;
  font-size: 15px;
}
.settings-danger {
  font-weight: 700;
  color: var(--color-danger);
}
.settings-value {
  font-size: 14px;
  color: var(--color-text-secondary);
}
.settings-chevron {
  width: 18px;
  height: 18px;
  flex: none;
  fill: none;
  stroke: var(--color-text-secondary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
[dir="rtl"] .settings-chevron {
  transform: scaleX(-1);
}
.sheet-title {
  font-size: 20px;
  font-weight: 800;
}
.sheet-done {
  width: 100%;
  min-height: 44px;
  margin-top: 18px;
  font-size: 14px;
  font-weight: 700;
}
</style>
