<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../../models/models";
import {
  countDailyProgress,
  isOfflineWriteError,
  userPreferencesService,
  type UserPreferences,
} from "../../services/userPreferencesService";
import {
  downloadBooks,
  missingBooksForEntries,
  refreshStaleDownloads,
  type OfflineBook,
} from "../../services/offlineLibraryService";
import { ensureManifestLoaded } from "../../services/offlineTextStore";
import { pushService } from "../../services/pushService";
import { bookName } from "../../services/catalogSearch";
import { widgetService } from "../../services/widgetService";
import { localDayKey } from "../../services/dateService";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { isNativeApp } from "../../composables/useNativeApp";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useAutoScroll } from "../../composables/useAutoScroll";
import { useKeepAwake } from "../../composables/useKeepAwake";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../../composables/useZmanimPlaceLabel";
import {
  coarsePlace,
  formatZmanTime,
  getSunset,
  SUNSET_REMINDER_OFFSET_MINUTES,
} from "../../services/zmanimService";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import { useOnline } from "../../composables/useOnline";
import { analyticsService } from "../../services/analyticsService";
import {
  encadrementBounds,
  encadrementOf,
  type Encadrement,
} from "../../services/encadrementService";
import DailyReadingItem from "./DailyReadingItem.vue";
import ReadingEncadrement from "../../components/ReadingEncadrement.vue";
import ReminderSettingsModal from "./ReminderSettingsModal.vue";
import ChneiMikraOptions from "../../components/ChneiMikraOptions.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";
import CatalogSearchField from "../../components/CatalogSearchField.vue";
import ProgressBar from "../../components/ProgressBar.vue";
import { useCatalogSearch } from "../../composables/useCatalogSearch";
import {
  psalmsLabel,
  useDafYomi,
  useTehilimDay,
  useWeeklyParasha,
} from "../../composables/useTehilimDay";
import { useNow } from "../../composables/useNow";
import {
  activeActionKeys,
  DAILY_ACTIONS,
  DAY_MOMENTS,
  isDailyActionKey,
  isDailyGoal,
  MAX_DAILY_GOALS,
  MAX_GOAL_LABEL_LENGTH,
  newGoalId,
  normalizeGoalLabel,
  type DailyActionMeta,
  type DailyGoal,
  type DayMoment,
  type StarterPack,
} from "../../services/dailyActions";
import {
  MAX_FREEZES,
  milestoneReached,
  previousDayKey,
  recordDayDone,
  STREAK_MILESTONES,
  streakStatus,
  type DailyStreak,
} from "../../services/dailyStreak";
import {
  DAILY_GOAL_RULES,
  daySucceeded,
  pruneHistory,
  weekOf,
  weeklyCount,
  type DailyGoalRule,
  type DailyHistory,
  type DayRecord,
} from "../../services/dailyHistory";
import { historyTotals, siyoumimOf } from "../../services/dailyStats";
import { activeChallenge, challengeProgress } from "../../services/dailyChallenges";
import { pauseRule } from "../../services/restDays";
import { dafProgress, isLastDafOf } from "../../services/dafYomi";
import { tefilaWindowsOfDay } from "../../services/sidourService";
import { shareStreakCard } from "../../services/streakShareCard";
import { useTheme } from "../../composables/useTheme";
import { latinName } from "../../content/etudeTexts";
import DailyStreakBanner from "../../components/DailyStreakBanner.vue";
import DailyWeekDots from "../../components/DailyWeekDots.vue";
import DailyMonthCalendar from "../../components/DailyMonthCalendar.vue";
import DailyCelebration from "../../components/DailyCelebration.vue";
import DailyChallengeCard from "../../components/DailyChallengeCard.vue";
import DailyStarterPacks from "../../components/DailyStarterPacks.vue";
import AppSelect from "../../components/AppSelect.vue";
import ToggleSwitch from "../../components/ToggleSwitch.vue";
import { useChneiMikraOptions } from "../../composables/useChneiMikraOptions";
import { anchorToElement } from "../../composables/scrollAnchor";
import { DAILY_OPTION_KEYS, parashaTitle, type DailyOptionKey } from "../../services/dailyCycles";
import AppIcon from "../../components/icons/AppIcon.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import { useSearchMode } from "../../composables/useSearchMode";

const props = defineProps<{ userId: string }>();
const { t, locale } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();
// Hors connexion, la page reste lisible (textes téléchargés + copie locale des
// préférences) et les lectures se cochent encore ; seule la composition de la
// liste attend le retour du réseau. Voir requireOnline et persistProgress.
const online = useOnline();
// App native : pincer dans la page agrandit le texte lu, pas la page.
useReadingPinch();
// Paracha (chnei mikra) : mêmes options d'affichage que sa page de la
// bibliothèque, verset écrit deux fois et commentaire de Rachi.
const { doubleVerses: chneiMikraDouble, withRashi: chneiMikraRashi } = useChneiMikraOptions();

// La valeur d'état de l'onglet « Tout » (envoyée telle quelle en analytics).
const ALL_TYPE = "all";

const TYPES = [
  { key: ALL_TYPE, labelKey: "study.types.all" },
  { key: "Tehilim", labelKey: "study.types.tehilim" },
  { key: "Mishna", labelKey: "study.types.mishna" },
  { key: "Talmud Bavli", labelKey: "study.types.talmud" },
  { key: "Tanakh", labelKey: "study.types.tanakh" },
];

// Type tabs that map to an actual corpus (everything except the "Tout" tab).
const CORPUS_TYPES = TYPES.filter((ty) => ty.key !== ALL_TYPE);

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const byId = new Map<string, TextStudyJsonEntry>(allTexts.map((txt) => [String(txt.id), txt]));

// La liste se lit dans l'ordre du catalogue (Tehilim 1, 4, 8… puis Michna,
// Talmud, Tanakh), pas dans l'ordre où les textes ont été ajoutés.
const catalogRank = new Map<string, number>(allTexts.map((txt, i) => [String(txt.id), i]));

function sortByCatalog(ids: string[]): string[] {
  return [...ids].sort(
    (a, b) => (catalogRank.get(a) ?? Infinity) - (catalogRank.get(b) ?? Infinity),
  );
}

const loading = ref(true);
const saving = ref(false);
const mode = ref<"reading" | "manage">("reading");
// Trois onglets en mode lecture : le quotidien d'abord, le chnei mikra
// (hebdomadaire) dans « Cette semaine » pour ne pas allonger la page du jour,
// et « Progression » pour le calendrier, les compteurs et les paliers.
type Tab = "today" | "week" | "progress";
const activeTab = ref<Tab>("today");

// Double appui sur le texte : la page descend toute seule, à l'allure choisie
// dans la pastille du bas (AutoScrollPill). Pas en mode « gérer ma liste »,
// où l'on choisit des textes au lieu d'en lire un.
useAutoScroll(() => mode.value === "reading");

// L'écran ne s'éteint pas pendant la lecture du jour ; en mode « gérer ma
// liste », on touche l'écran, il n'y a rien à retenir.
useKeepAwake(() => mode.value === "reading");

// Ids kept as strings for reliable Map lookups; converted back to numbers on save.
const selectedIds = ref<string[]>([]);
const completedIds = ref<Set<string>>(new Set());
// Chapitres lus par texte (id → index de sections) pour les textes chapitrés.
const completedSections = ref<Record<string, number[]>>({});
// Index réels des sections de chaque texte, remontés par DailyReadingItem au
// chargement : sert à savoir quand « tous les chapitres sont lus ».
const sectionIndexes = new Map<string, number[]>();
// Texts whose content is folded away (UI-only): clicking the title toggles this,
// and marking a text as read folds it so only unread texts stay expanded.
const collapsedIds = ref<Set<string>>(new Set());
// Repère de scroll par texte : le titre reste en vue quand le contenu se replie.
const articleEls = new Map<string, HTMLElement>();

function setArticleEl(id: string, el: unknown) {
  if (el instanceof HTMLElement) articleEls.set(id, el);
  else articleEls.delete(id);
}

// --- Rappels push (app native uniquement) : la cloche de l'en-tête. ---
const reminderEnabled = ref(false);
// Rappel à heure fixe : vrai par défaut, c'était le seul rappel avant le
// dernier appel d'avant-chkia (voir pushReminderDailyEnabled).
const reminderDaily = ref(true);
const reminderHour = ref(18);
const reminderMinute = ref(0);
const reminderSunset = ref(false);
const reminderBusy = ref(false);
const showReminderModal = ref(false);

// Lieu des horaires (Paris par défaut, une ville ou la position de l'appareil) :
// c'est lui qui donne la chkia du rappel « dernier appel ».
const { place: zmanimPlace } = useZmanimLocation();
const zmanimPlaceLabel = useZmanimPlaceLabel(zmanimPlace);
const sunsetToday = computed(() => {
  const sunset = getSunset(zmanimPlace.value);
  return sunset ? formatZmanTime(sunset, zmanimPlace.value.tzid, locale.value) : null;
});

const selectedEntries = computed(
  () => selectedIds.value.map((id) => byId.get(id)).filter(Boolean) as TextStudyJsonEntry[],
);

// Les passages qui encadrent une lecture (Yehi ratson des Tehilim, Léchem
// yihoud du Cantique des cantiques) : posés une fois pour tout ce qu'on lit
// du même corpus, la liste étant rangée dans l'ordre du catalogue, qui les
// tient groupés.
const encadrements = computed(() => encadrementBounds(selectedEntries.value));

// --- Lectures du moment (paracha de la semaine, cycles Tehilim) ---
const selectedOptions = ref<string[]>([]);
const completedOptions = ref<Set<string>>(new Set());

const OPTION_META: { key: DailyOptionKey; titleKey: string; descriptionKey: string }[] = [
  {
    key: "parasha",
    titleKey: "dailyReading.options.parashaTitle",
    descriptionKey: "dailyReading.options.parashaDescription",
  },
  {
    key: "tehilim-jour",
    titleKey: "dailyReading.options.tehilimDayTitle",
    descriptionKey: "dailyReading.options.tehilimDayDescription",
  },
  {
    key: "daf-yomi",
    titleKey: "dailyReading.options.dafYomiTitle",
    descriptionKey: "dailyReading.options.dafYomiDescription",
  },
];

interface DynamicReading {
  key: DailyOptionKey;
  title: string;
  subtitle: string;
  entries: TextStudyJsonEntry[];
  /** Ce qui se dit avant et après cette lecture, quand elle en a. */
  encadrement: Encadrement | null;
  /** Daf hayomi : les deux faces du daf à garder du traité (voir DailyReadingItem). */
  dafs?: string[];
  /** Où l'on en est dans le cycle (« daf 12 sur 63 · cycle 62 % »). */
  progress?: string;
}

// Le jour hébraïque et la semaine, réactifs au temps et à la chkia : une page
// laissée ouverte suit le calendrier (voir useTehilimDay).
const { cycle: tehilimCycle } = useTehilimDay();
const { parasha: currentParasha } = useWeeklyParasha();
const dafYomi = useDafYomi();
// L'horloge partagée : la série de jours se relit au changement de jour.
const now = useNow();

// Les lectures calculées pour aujourd'hui, en tête de la liste quotidienne.
// Le chnei mikra n'en fait pas partie : c'est une lecture de la semaine,
// affichée dans sa propre section (voir weeklyParasha).
const dynamicReadings = computed<DynamicReading[]>(() => {
  const out: DynamicReading[] = [];
  if (selectedOptions.value.includes("tehilim-jour")) {
    const cycle = tehilimCycle.value;
    out.push({
      key: "tehilim-jour",
      title: t("dailyReading.options.tehilimDayReading", { day: cycle.day }),
      subtitle: psalmsLabel(cycle.psalms, t),
      entries: cycle.entries,
      encadrement: encadrementOf(cycle.entries[0]),
      progress: t("dailyReading.progressChips.tehilim", { day: cycle.day }),
    });
  }
  if (selectedOptions.value.includes("daf-yomi") && dafYomi.value) {
    const daf = dafYomi.value;
    const progress = dafProgress(daf);
    out.push({
      key: "daf-yomi",
      title: t("dailyReading.options.dafYomiReading"),
      subtitle: t("dailyReading.options.dafYomiLabel", {
        tractate: daf.entry?.name ?? daf.tractate,
        daf: daf.blatt,
      }),
      entries: daf.entry ? [daf.entry] : [],
      encadrement: null,
      dafs: daf.dafs,
      // Où l'on en est dans le traité et dans le cycle : le daf devient un
      // chemin qu'on voit.
      progress: t("dailyReading.progressChips.daf", {
        index: progress.dafIndex,
        count: progress.dafCount,
        pct: Math.round((progress.cycleDay / progress.cycleDays) * 100),
      }),
    });
  }
  return out;
});

// --- Actions du jour et objectifs personnels (voir dailyActions) ---
const selectedActions = ref<string[]>([]);
const goals = ref<DailyGoal[]>([]);
const completedActions = ref<Set<string>>(new Set());
// Le libellé en cours de saisie d'un nouvel objectif.
const newGoalLabel = ref("");
const goalLimits = { max: MAX_DAILY_GOALS, maxLength: MAX_GOAL_LABEL_LENGTH };

/** Les actions choisies, dans l'ordre de la liste proposée. */
const chosenActions = computed(() =>
  DAILY_ACTIONS.filter((action) => selectedActions.value.includes(action.key)),
);
const sortedGoals = computed(() => [...goals.value].sort((a, b) => a.createdAt - b.createdAt));
/** Tout ce qui se coche hors lectures, pour le décompte du jour. */
const actionKeys = computed(() => activeActionKeys(selectedActions.value, goals.value));

function isActionSelected(key: string): boolean {
  return selectedActions.value.includes(key);
}

async function toggleAction(key: string) {
  if (!requireOnline()) return;
  const removed = isActionSelected(key);
  if (removed) {
    selectedActions.value = selectedActions.value.filter((k) => k !== key);
    const next = new Set(completedActions.value);
    next.delete(key);
    completedActions.value = next;
  } else {
    selectedActions.value = DAILY_ACTIONS.map((a) => a.key).filter(
      (k) => k === key || selectedActions.value.includes(k),
    );
  }
  saving.value = true;
  try {
    const saved = await persist({ dailyActions: [...selectedActions.value] });
    // Action retirée : sa coche du jour part aussi, sinon elle compterait encore.
    if (removed && saved) await persistProgress();
    else if (saved) void widgetService.refresh(widgetPrefs());
  } finally {
    saving.value = false;
  }
  analyticsService.capture("daily_reading_configured", {
    action: removed ? "action_removed" : "action_added",
    option: key,
    texts_count: selectedIds.value.length,
  });
}

async function toggleActionCompleted(key: string) {
  const next = new Set(completedActions.value);
  const nowDone = !next.has(key);
  if (nowDone) next.add(key);
  else next.delete(key);
  completedActions.value = next;
  await persistProgress();
  analyticsService.capture("daily_reading_marked_read", {
    marked: nowDone,
    scope: isDailyActionKey(key) ? "action" : "goal",
    option: isDailyActionKey(key) ? key : undefined,
    done_count: completedCount.value,
    total_count: totalCount.value,
    all_done: allDone.value,
  });
}

async function addGoal() {
  if (!requireOnline()) return;
  const label = normalizeGoalLabel(newGoalLabel.value);
  if (!label || goals.value.length >= MAX_DAILY_GOALS) return;
  const goal: DailyGoal = { id: newGoalId(), label, createdAt: Date.now() };
  const previous = goals.value;
  goals.value = [...goals.value, goal];
  newGoalLabel.value = "";
  saving.value = true;
  try {
    const saved = await persist({ dailyGoals: [...goals.value] });
    if (saved) void widgetService.refresh(widgetPrefs());
    else goals.value = previous;
  } finally {
    saving.value = false;
  }
  analyticsService.capture("daily_reading_configured", {
    action: "goal_added",
    goals_count: goals.value.length,
    texts_count: selectedIds.value.length,
  });
}

async function removeGoal(id: string) {
  if (!requireOnline()) return;
  goals.value = goals.value.filter((goal) => goal.id !== id);
  const next = new Set(completedActions.value);
  next.delete(id);
  completedActions.value = next;
  saving.value = true;
  try {
    const saved = await persist({ dailyGoals: [...goals.value] });
    if (saved) await persistProgress();
  } finally {
    saving.value = false;
  }
  analyticsService.capture("daily_reading_configured", {
    action: "goal_removed",
    goals_count: goals.value.length,
    texts_count: selectedIds.value.length,
  });
}

/** Les objectifs de chaque jour et ceux à fréquence, à part. */
const dailyGoals = computed(() => sortedGoals.value.filter(isDailyGoal));
const weeklyGoals = computed(() => sortedGoals.value.filter((goal) => !isDailyGoal(goal)));

/** Le choix de fréquence d'un objectif (chaque jour, ou n fois par semaine). */
const frequencyOptions = computed(() => [
  { value: "0", label: t("dailyReading.goals.everyDay") },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    value: String(n),
    label: t("dailyReading.goals.perWeek", n),
  })),
]);

async function setGoalFrequency(goal: DailyGoal, value: string) {
  if (!requireOnline()) return;
  const perWeek = Number(value) || null;
  goals.value = goals.value.map((g) => (g.id === goal.id ? { ...g, perWeek } : g));
  saving.value = true;
  try {
    const saved = await persist({ dailyGoals: [...goals.value] });
    if (saved) await persistProgress();
  } finally {
    saving.value = false;
  }
  analyticsService.capture("daily_reading_configured", {
    action: "goal_frequency",
    per_week: perWeek ?? 0,
  });
}

/** Combien de fois un objectif à fréquence a été fait cette semaine. */
function weeklyDone(goal: DailyGoal): number {
  return weeklyCount(goal.id, history.value, todayKey.value, completedActions.value.has(goal.id));
}

// --- Les actions par moment de la journée, avec la fin de plage des offices ---
const actionGroups = computed<{ moment: DayMoment; actions: DailyActionMeta[] }[]>(() =>
  DAY_MOMENTS.map((moment) => ({
    moment,
    actions: chosenActions.value.filter((action) => action.moment === moment),
  })).filter((group) => group.actions.length > 0),
);
const tefilaEnds = computed(() => {
  const ends = new Map<string, string>();
  for (const w of tefilaWindowsOfDay(zmanimPlace.value, now.value)) {
    ends.set(w.tefila, formatZmanTime(w.end, zmanimPlace.value.tzid, locale.value));
  }
  return ends;
});
function actionDeadline(action: DailyActionMeta): string | null {
  return action.tefila ? (tefilaEnds.value.get(action.tefila) ?? null) : null;
}

// --- La règle de la journée réussie et les jours de pause ---
const goalRule = ref<DailyGoalRule>("all");
const restDays = ref(true);
const todayKey = computed(() => localDayKey(now.value));
const isPause = computed(() => pauseRule(restDays.value));
const streakRules = computed(() => ({ isPause: isPause.value }));

async function setGoalRule(rule: DailyGoalRule) {
  if (!requireOnline() || goalRule.value === rule) return;
  goalRule.value = rule;
  await persist({ dailyGoalRule: rule });
  // La journée en cours se rejuge tout de suite.
  await persistProgress();
  analyticsService.capture("daily_reading_configured", { action: "goal_rule", rule });
}

async function setRestDays(value: boolean) {
  if (!requireOnline()) return;
  restDays.value = value;
  await persist({ dailyRestDays: value });
  void widgetService.refresh(widgetPrefs());
  analyticsService.capture("daily_reading_configured", { action: "rest_days", rest_days: value });
}

// --- La série de jours (voir dailyStreak) ---
const streak = ref<DailyStreak | undefined>(undefined);
const streakInfo = computed(() => streakStatus(streak.value, todayKey.value, streakRules.value));

// --- L'historique des journées (voir dailyHistory) ---
const history = ref<DailyHistory>({});
/** La journée d'aujourd'hui telle qu'elle est en ce moment, avant enregistrement. */
const todayRecord = computed<DayRecord>(() => ({
  done: completedCount.value,
  total: totalCount.value,
  ok: dayOk.value,
  keys: [
    ...[...completedIds.value].filter((id) => selectedIds.value.includes(id)),
    ...[...completedOptions.value].filter((k) => selectedOptions.value.includes(k)),
    ...[...completedActions.value].filter(
      (k) => actionKeys.value.includes(k) || weeklyGoals.value.some((g) => g.id === k),
    ),
  ],
}));
/** L'historique avec la journée en cours : ce que la semaine et le mois montrent. */
const liveHistory = computed<DailyHistory>(() =>
  totalCount.value > 0 ? { ...history.value, [todayKey.value]: todayRecord.value } : history.value,
);
const weekCells = computed(() => weekOf(todayKey.value, liveHistory.value, isPause.value));
const totals = computed(() => historyTotals(liveHistory.value));
const siyoumim = computed(() => siyoumimOf(liveHistory.value));
const milestones = computed(() =>
  STREAK_MILESTONES.map((days) => ({ days, reached: streakInfo.value.best >= days })),
);

/** La journée est réussie selon la règle choisie (voir daySucceeded). */
const dayOk = computed(() => daySucceeded(completedCount.value, totalCount.value, goalRule.value));

// --- Le défi de saison, s'il y en a un ---
const challenge = computed(() => activeChallenge(now.value));
const challengeDone = computed(() =>
  challenge.value
    ? challengeProgress(challenge.value, liveHistory.value, todayKey.value, dayOk.value)
    : 0,
);

// --- Rattraper la veille : jusqu'à midi, on peut dire qu'hier était fait ---
const canCatchUpYesterday = computed(() => {
  const yesterday = previousDayKey(todayKey.value);
  const record = history.value[yesterday];
  return (
    now.value.getHours() < 12 &&
    !streakInfo.value.doneToday &&
    !isPause.value(yesterday) &&
    !!record &&
    record.total > 0 &&
    !record.ok &&
    streak.value?.lastDate !== yesterday
  );
});

async function catchUpYesterday() {
  const yesterday = previousDayKey(todayKey.value);
  const record = history.value[yesterday];
  if (!record) return;
  history.value = { ...history.value, [yesterday]: { ...record, ok: true, done: record.total } };
  streak.value = recordDayDone(streak.value, yesterday, streakRules.value);
  await persistProgress();
  toast.success(t("dailyReading.catchUp.done"));
  analyticsService.capture("daily_streak_caught_up", { current: streak.value.current });
}

// --- La fête de la journée réussie ---
const celebration = ref<{
  milestone: number | null;
  siyoum: string | null;
  freezeEarned: boolean;
} | null>(null);

const { appliedTheme } = useTheme();

async function shareStreak() {
  const status = streakInfo.value;
  const result = await shareStreakCard(
    {
      count: String(status.current),
      countLabel: t("dailyReading.streak.days", status.current),
      best: t("dailyReading.streak.best", { n: status.best }),
      brand: "Petite Jérusalem",
      date: new Intl.DateTimeFormat(locale.value, { dateStyle: "long" }).format(now.value),
    },
    appliedTheme.value.primary,
  );
  if (result === "downloaded") toast.success(t("dailyReading.streak.shareDownloaded"));
  analyticsService.capture("daily_streak_shared", { result, current: status.current });
}

// --- Les parcours de départ : une première liste en un clic ---
async function applyPack(pack: StarterPack) {
  if (!requireOnline()) return;
  selectedOptions.value = DAILY_OPTION_KEYS.filter((k) => pack.options.includes(k));
  selectedActions.value = [...pack.actions];
  const packGoals: DailyGoal[] = pack.goalKeys.map((key, i) => ({
    id: newGoalId(),
    label: t(key),
    createdAt: Date.now() + i,
  }));
  goals.value = [...goals.value, ...packGoals];
  saving.value = true;
  try {
    const saved = await persist({
      dailyReadingOptions: [...selectedOptions.value],
      dailyActions: [...selectedActions.value],
      dailyGoals: [...goals.value],
    });
    if (saved) void widgetService.refresh(widgetPrefs());
  } finally {
    saving.value = false;
  }
  analyticsService.capture("daily_reading_configured", { action: "pack", pack: pack.id });
  const entries = dynamicReadings.value.flatMap((reading) => reading.entries);
  await proposeOfflineDownload(entries, t(pack.titleKey));
}

// --- Chnei mikra : section « Cette semaine », suivi jusqu'au changement de paracha ---
const weeklyParasha = computed(() =>
  selectedOptions.value.includes("parasha") ? currentParasha.value : null,
);
// Option paracha désactivée : l'onglet « Cette semaine » disparaît.
watch(weeklyParasha, (week) => {
  if (!week) activeTab.value = "today";
});

function switchTab(tab: Tab) {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  analyticsService.capture("daily_reading_tab_switched", { tab });
}

/** Fin de la composition de la liste : retour à la lecture, remonté en haut
    de page, le catalogue laisse sinon le lecteur loin en bas. */
function finishManage() {
  mode.value = "reading";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
const parashaCompleted = ref(false);
// Dernier suivi hebdomadaire connu, persisté tel quel : savePreferences
// REMPLACE dailyReadingProgress en entier, donc la coche de la semaine doit
// être réécrite à chaque sauvegarde même quand l'option paracha est inactive.
const storedParashaProgress = ref<{ week: string; completed: boolean } | null>(null);

const parashaSubtitle = computed(() => parashaTitle(weeklyParasha.value));

// La semaine a changé pendant que la page était ouverte (samedi soir) : la
// coche de la semaine passée ne vaut plus pour la nouvelle paracha.
watch(
  () => weeklyParasha.value?.weekKey,
  (week) => {
    parashaCompleted.value =
      !!week &&
      storedParashaProgress.value?.week === week &&
      storedParashaProgress.value.completed === true;
  },
);

async function toggleParashaCompleted() {
  if (!weeklyParasha.value) return;
  parashaCompleted.value = !parashaCompleted.value;
  storedParashaProgress.value = {
    week: weeklyParasha.value.weekKey,
    completed: parashaCompleted.value,
  };
  setCollapsed("parasha", parashaCompleted.value);
  if (parashaCompleted.value) anchorToElement(articleEls.get("parasha") ?? null);
  await persistProgress();
  analyticsService.capture("daily_reading_marked_read", {
    marked: parashaCompleted.value,
    scope: "parasha_week",
    done_count: completedCount.value,
    total_count: totalCount.value,
    all_done: allDone.value,
  });
}

function isOptionSelected(key: string): boolean {
  return selectedOptions.value.includes(key);
}

async function toggleOption(key: DailyOptionKey) {
  if (!requireOnline()) return;
  const removed = isOptionSelected(key);
  if (removed) {
    selectedOptions.value = selectedOptions.value.filter((k) => k !== key);
    const next = new Set(completedOptions.value);
    next.delete(key);
    completedOptions.value = next;
    setCollapsed(key, false);
  } else {
    // Ordre fixe des options, indépendant de l'ordre des clics.
    selectedOptions.value = DAILY_OPTION_KEYS.filter(
      (k) => k === key || selectedOptions.value.includes(k),
    );
  }
  saving.value = true;
  let saved = false;
  try {
    saved = await persist({ dailyReadingOptions: [...selectedOptions.value] });
    // Option retirée : sa complétion du jour doit disparaître aussi du cloud,
    // sinon l'accueil et le rappel push continueraient de la compter.
    if (removed && saved) await persistProgress();
    else if (saved) void widgetService.refresh(widgetPrefs());
  } finally {
    saving.value = false;
  }
  analyticsService.capture("daily_reading_configured", {
    action: removed ? "option_removed" : "option_added",
    option: key,
    texts_count: selectedIds.value.length,
  });
  // Option activée : ses textes suivent le calendrier (la paracha change
  // chaque semaine), on propose de les emporter comme un texte ajouté.
  if (!removed && saved) {
    const entries =
      key === "parasha"
        ? (weeklyParasha.value?.entries ?? [])
        : (dynamicReadings.value.find((reading) => reading.key === key)?.entries ?? []);
    const title = OPTION_META.find((opt) => opt.key === key)?.titleKey;
    await proposeOfflineDownload(entries, title ? t(title) : key);
  }
}

async function toggleOptionCompleted(key: DailyOptionKey) {
  const next = new Set(completedOptions.value);
  const nowRead = !next.has(key);
  if (nowRead) next.add(key);
  else next.delete(key);
  completedOptions.value = next;
  setCollapsed(key, nowRead);
  if (nowRead) anchorToElement(articleEls.get(key) ?? null);
  await persistProgress();
  analyticsService.capture("daily_reading_marked_read", {
    marked: nowRead,
    scope: "option",
    option: key,
    done_count: completedCount.value,
    total_count: totalCount.value,
    all_done: allDone.value,
  });
}

/**
 * Applique les préférences du compte à la page. Hors connexion, elles viennent
 * de la copie locale du dernier passage (userPreferencesService) : la liste du
 * jour et son suivi restent affichés, tels que le serveur les connaît.
 */
async function applyPreferences(prefs: UserPreferences, initial: boolean) {
  // Les listes composées avant l'introduction du tri sont réordonnées ici.
  selectedIds.value = sortByCatalog((prefs.dailyReadingIds ?? []).map(String));
  selectedOptions.value = (prefs.dailyReadingOptions ?? []).filter((k) =>
    (DAILY_OPTION_KEYS as readonly string[]).includes(k),
  );
  selectedActions.value = (prefs.dailyActions ?? []).filter(isDailyActionKey);
  goalRule.value = DAILY_GOAL_RULES.includes(prefs.dailyGoalRule) ? prefs.dailyGoalRule : "all";
  restDays.value = prefs.dailyRestDays !== false;
  goals.value = (prefs.dailyGoals ?? []).filter(
    (goal) => typeof goal?.id === "string" && typeof goal.label === "string",
  );

  reminderEnabled.value = prefs.pushReminderEnabled === true;
  reminderDaily.value = prefs.pushReminderDailyEnabled !== false;
  reminderHour.value = prefs.pushReminderHour ?? 18;
  reminderMinute.value = prefs.pushReminderMinute ?? 0;
  reminderSunset.value = prefs.pushSunsetReminderEnabled === true;

  const progress = prefs.dailyReadingProgress;
  // Le jour que le suivi affiché décrit : voir ensureSameDay.
  progressDay = localDayKey();
  // La série et l'historique traversent les jours : ils se lisent quel que
  // soit le jour du suivi.
  streak.value = progress?.streak;
  history.value = pruneHistory(progress?.history ?? {}, localDayKey());
  // Chnei mikra : la coche tient tant que la paracha n'a pas changé,
  // indépendamment de la remise à zéro quotidienne.
  storedParashaProgress.value = progress?.parashaProgress ?? null;
  const currentWeek = weeklyParasha.value?.weekKey;
  parashaCompleted.value =
    !!currentWeek &&
    progress?.parashaProgress?.week === currentWeek &&
    progress.parashaProgress.completed === true;
  if (parashaCompleted.value) setCollapsed("parasha", true);

  if (progress && progress.date === localDayKey()) {
    completedIds.value = new Set(progress.completedIds.map(String));
    completedSections.value = { ...(progress.completedSections ?? {}) };
    completedOptions.value = new Set(progress.completedOptions ?? []);
    completedActions.value = new Set(progress.completedActions ?? []);
    // Texts already read today start folded so unread ones stand out.
    collapsedIds.value = new Set([...completedIds.value, ...completedOptions.value]);
  } else {
    // New day (or never tracked): start fresh and persist the reset once.
    completedIds.value = new Set();
    completedSections.value = {};
    completedOptions.value = new Set();
    completedActions.value = new Set();
    if (
      progress &&
      (progress.completedIds.length > 0 ||
        (progress.completedOptions ?? []).length > 0 ||
        (progress.completedActions ?? []).length > 0 ||
        Object.keys(progress.completedSections ?? {}).length > 0)
    ) {
      // Pas pendant une resynchronisation : elle ne fait que réafficher ce que
      // le serveur vient de renvoyer, elle n'a rien à lui réécrire.
      if (!resyncing) await persistProgress();
    }
  }

  // Rien dans la liste du jour : on ouvre directement sur « Cette semaine ».
  // Seulement à l'ouverture : une resynchro ne doit pas changer d'onglet sous
  // les doigts de l'utilisateur.
  if (initial && weeklyParasha.value && totalCount.value === 0) activeTab.value = "week";
}

// Une resynchronisation en cours : elle réaffiche l'état du serveur, elle ne
// lui écrit rien (sans quoi un échec d'écriture pourrait se rappeler lui-même).
let resyncing = false;

/**
 * Le jour civil auquel appartiennent les coches affichées, capturé au
 * chargement. Une page laissée ouverte après minuit gardait les coches de la
 * veille et les aurait enregistrées sous la date du jour : avant d'écrire, et
 * au retour à l'écran, on vérifie que le jour est toujours le même ; sinon on
 * repart de ce que le serveur connaît, remis à zéro pour le nouveau jour.
 */
let progressDay = localDayKey();

async function ensureSameDay(): Promise<boolean> {
  if (localDayKey() === progressDay) return true;
  await loadPreferences().catch(() => {});
  return false;
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") void ensureSameDay();
}

async function loadPreferences(initial = false, resync = false) {
  const prefs = await userPreferencesService.getPreferences(props.userId);
  resyncing = resync;
  try {
    await applyPreferences(prefs, initial);
  } finally {
    resyncing = false;
  }
}

onMounted(async () => {
  try {
    // L'index des téléchargements doit être lu avant de savoir quels textes
    // manquent sur l'appareil (no-op hors app native).
    if (isNativeApp) await ensureManifestLoaded();
    await loadPreferences(true);
  } finally {
    loading.value = false;
  }
  // Fichiers téléchargés dans un format antérieur : remis à jour en tâche de
  // fond. Aucun nouveau livre n'est téléchargé sans l'accord de l'utilisateur.
  void refreshStaleDownloads();
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onUnmounted(() => document.removeEventListener("visibilitychange", onVisibilityChange));

/**
 * Le serveur a toujours raison : au retour de la connexion, on se réaligne sur
 * lui, la liste a pu changer depuis un autre appareil pendant la coupure.
 */
watch(online, (isOnline, wasOnline) => {
  if (!isOnline || wasOnline) return;
  queuedNoticeShown = false;
  // La resynchronisation renvoie au passage le suivi coché hors ligne.
  void loadPreferences().catch(() => {});
  void refreshStaleDownloads();
});

// Coupure en cours : l'avertissement « gardé sur l'appareil » a déjà été dit.
let queuedNoticeShown = false;

/**
 * La composition de la liste (textes, lectures du moment, rappels) appartient
 * au serveur : sans connexion on n'y touche pas, et on le dit plutôt que de
 * laisser croire à un changement qui serait balayé à la reconnexion. Le suivi
 * de lecture, lui, n'est pas concerné : voir persistProgress.
 */
function requireOnline(): boolean {
  if (online.value) return true;
  toast.error(t("dailyReading.offline.readOnly"));
  return false;
}

/** Écrit dans les préférences, ou dit pourquoi ça n'a pas pu se faire. */
async function persist(preferences: Partial<UserPreferences>): Promise<boolean> {
  try {
    await userPreferencesService.savePreferences(props.userId, preferences);
    return true;
  } catch (error) {
    toast.error(
      isOfflineWriteError(error) ? t("dailyReading.offline.readOnly") : t("dailyReading.saveError"),
    );
    // Connexion perdue entre-temps : on revient à ce que le serveur connaît
    // plutôt que de garder à l'écran une liste qu'il ignore.
    await loadPreferences(false, true).catch(() => {});
    return false;
  }
}

async function persistSelection(): Promise<boolean> {
  saving.value = true;
  try {
    const saved = await persist({ dailyReadingIds: selectedIds.value.map(Number) });
    // Le widget d'écran d'accueil affiche cette liste (no-op sur le web).
    if (saved) void widgetService.refresh(widgetPrefs());
    return saved;
  } finally {
    saving.value = false;
  }
}

/**
 * L'état courant, sous la forme des préférences dont dépend le widget
 * d'écran d'accueil : lui éviter de relire dans Firestore le document que la
 * page vient d'écrire (et de recalculer pour rien le payload des horaires).
 */
function widgetPrefs() {
  return {
    dailyReadingIds: selectedIds.value.map(Number),
    dailyReadingOptions: [...selectedOptions.value],
    dailyActions: [...selectedActions.value],
    dailyGoals: [...goals.value],
    dailyRestDays: restDays.value,
    dailyReadingProgress: {
      date: localDayKey(),
      completedIds: [...completedIds.value].map(Number),
      completedOptions: [...completedOptions.value].filter((k) =>
        selectedOptions.value.includes(k),
      ),
      completedActions: [...completedActions.value].filter((k) => actionKeys.value.includes(k)),
      ...(streak.value ? { streak: streak.value } : {}),
      ...(Object.keys(history.value).length ? { history: history.value } : {}),
      ...(storedParashaProgress.value ? { parashaProgress: storedParashaProgress.value } : {}),
    },
  };
}

async function persistProgress() {
  // Minuit est passé : les coches à l'écran sont celles de la veille, on
  // recharge le jour plutôt que de les écrire sous la date d'aujourd'hui.
  if (!(await ensureSameDay())) return;
  // On ne garde que les textes encore dans la liste, avec des chapitres cochés.
  const sections: Record<string, number[]> = {};
  for (const id of selectedIds.value) {
    const list = completedSections.value[id];
    if (list?.length) sections[id] = list;
  }
  // La journée s'écrit dans l'historique telle qu'elle est ; réussie, la
  // série prend son cran du jour, une fois, et la page le fête. Tout part
  // avec le suivi, dans la même écriture (hors ligne comprise).
  const today = localDayKey();
  if (totalCount.value > 0) {
    history.value = pruneHistory({ ...history.value, [today]: todayRecord.value }, today);
  }
  if (dayOk.value) {
    const previous = streak.value;
    const next = recordDayDone(previous, today, streakRules.value);
    if (next !== previous) {
      streak.value = next;
      const daf = dafYomi.value;
      celebration.value = {
        milestone: milestoneReached(next.current),
        siyoum:
          daf && completedOptions.value.has("daf-yomi") && isLastDafOf(daf)
            ? daf.entry
              ? latinName(daf.entry)
              : daf.tractate
            : null,
        freezeEarned: (next.freezes ?? 0) > (previous?.freezes ?? 0),
      };
      analyticsService.capture("daily_streak_extended", {
        current: next.current,
        best: next.best,
        total_count: totalCount.value,
        rule: goalRule.value,
      });
    }
  }
  // Le suivi, lui, s'enregistre même hors connexion : la coche est gardée sur
  // l'appareil et fusionnée avec le serveur au retour du réseau, où le « lu »
  // l'emporte toujours (voir mergeDailyProgress).
  const result = await userPreferencesService.saveDailyProgress(props.userId, {
    date: localDayKey(),
    completedIds: [...completedIds.value].map(Number),
    completedSections: sections,
    completedOptions: [...completedOptions.value].filter((k) => selectedOptions.value.includes(k)),
    completedActions: [...completedActions.value].filter(
      (k) => actionKeys.value.includes(k) || weeklyGoals.value.some((g) => g.id === k),
    ),
    // La série et l'historique traversent les jours : réécrits à chaque fois,
    // savePreferences remplaçant dailyReadingProgress en entier.
    ...(streak.value ? { streak: streak.value } : {}),
    ...(Object.keys(history.value).length ? { history: history.value } : {}),
    // Le chnei mikra vit à la semaine : sa coche est rattachée au Chabbat de
    // la paracha et survit à la remise à zéro quotidienne.
    ...(storedParashaProgress.value ? { parashaProgress: storedParashaProgress.value } : {}),
  });
  // Le widget d'écran d'accueil suit la progression, y compris une coche
  // gardée sur l'appareil en attendant le réseau (no-op sur le web).
  void widgetService.refresh(widgetPrefs());
  // Une seule fois par coupure : la coche est bien prise, mais pas encore
  // arrivée chez le serveur. Le répéter à chaque texte lu serait du bruit.
  if (result === "queued" && !queuedNoticeShown) {
    queuedNoticeShown = true;
    toast.info(t("dailyReading.offline.progressKept"));
  }
}

// --- Disponibilité hors ligne (app native) ---
// Tout ce qui s'affiche aujourd'hui : la liste choisie, les lectures du moment
// et le chnei mikra. Ce sont ces fichiers-là qui doivent être sur l'appareil
// pour que la page se lise sans connexion.
const todayEntries = computed<TextStudyJsonEntry[]>(() => [
  ...selectedEntries.value,
  ...dynamicReadings.value.flatMap((reading) => reading.entries),
  ...(weeklyParasha.value?.entries ?? []),
]);

/** Livres de la lecture du jour absents de l'appareil (vide hors app native). */
const missingBooks = computed(() => missingBooksForEntries(todayEntries.value));

const downloading = ref(false);

/** Télécharge les livres demandés et rend compte du résultat. */
async function downloadForOffline(books: OfflineBook[]): Promise<void> {
  if (books.length === 0 || downloading.value) return;
  if (!requireOnline()) return;
  downloading.value = true;
  // Le couple début/fin manquait ici aussi : seule l'issue s'écrivait, jamais
  // la tentative. Un téléchargement lancé puis abandonné (app quittée, réseau
  // coupé avant la fin) ne laissait donc aucune trace.
  analyticsService.capture("offline_download_started", {
    scope: "daily_reading",
    books_count: books.length,
  });
  try {
    const failed = await downloadBooks(books);
    if (failed.length > 0) toast.error(t("downloads.error"));
    else toast.success(t("dailyReading.offline.downloadDone"));
    const succeeded = books.length - failed.length;
    // Échec total : la lecture du jour reste illisible hors connexion, ce que
    // l'ancien `offline_download_completed { books_count: 0 }` disait sans le
    // dire. Un échec partiel garde `completed` (avec son `failed_count`), pour
    // ne pas déplacer le sens de l'événement là où il servait déjà.
    analyticsService.capture(
      succeeded > 0 ? "offline_download_completed" : "offline_download_failed",
      {
        scope: "daily_reading",
        books_count: succeeded,
        failed_count: failed.length,
        is_online: navigator.onLine,
      },
    );
  } finally {
    downloading.value = false;
  }
}

/**
 * Texte ajouté à la liste alors que son livre n'est pas sur l'appareil : on
 * prévient qu'il ne sera pas lisible hors connexion et on propose de
 * télécharger ce texte-là, tout de suite. Rien n'est téléchargé sans cet
 * accord, la place occupée reste le choix de l'utilisateur.
 */
async function proposeOfflineDownload(entries: TextStudyJsonEntry[], name: string) {
  const books = missingBooksForEntries(entries);
  if (books.length === 0) return;
  const accepted = await confirm({
    title: t("dailyReading.offline.promptTitle"),
    message: t("dailyReading.offline.promptMessage", { name }),
    confirmLabel: t("downloads.download"),
    cancelLabel: t("dailyReading.offline.promptLater"),
  });
  analyticsService.capture("daily_reading_offline_prompt", {
    accepted,
    books_count: books.length,
  });
  if (accepted) await downloadForOffline(books);
}

// Un Set : `isSelected` est appelé quatre fois par carte du catalogue à chaque rendu.
const selectedIdSet = computed(() => new Set(selectedIds.value));
function isSelected(id: string | number): boolean {
  return selectedIdSet.value.has(String(id));
}

async function toggleSelect(entry: TextStudyJsonEntry) {
  if (!requireOnline()) return;
  const id = String(entry.id);
  const removed = selectedIds.value.includes(id);
  if (removed) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
    const next = new Set(completedIds.value);
    next.delete(id);
    completedIds.value = next;
    const rest = { ...completedSections.value };
    delete rest[id];
    completedSections.value = rest;
    // Les index de sections remontés par le texte partent avec lui : un
    // texte remis plus tard les renverra au chargement.
    sectionIndexes.delete(id);
    setCollapsed(id, false);
  } else {
    selectedIds.value = sortByCatalog([...selectedIds.value, id]);
  }
  const saved = await persistSelection();
  analyticsService.capture("daily_reading_configured", {
    action: removed ? "removed" : "added",
    texts_count: selectedIds.value.length,
  });
  // Texte ajouté : s'il n'est pas sur l'appareil, on le propose maintenant.
  if (!removed && saved) {
    await proposeOfflineDownload([entry], appendHebrewNumeral(entry.name));
  }
}

async function toggleCompleted(id: string) {
  const next = new Set(completedIds.value);
  const nowRead = !next.has(id);
  if (nowRead) next.add(id);
  else next.delete(id);
  completedIds.value = next;
  // Marquer le texte entier aligne aussi ses chapitres (cohérence des coches).
  const indexes = sectionIndexes.get(id);
  if (indexes?.length) {
    completedSections.value = { ...completedSections.value, [id]: nowRead ? [...indexes] : [] };
  }
  // Marking read folds the text away; un-marking reopens it to keep reading.
  setCollapsed(id, nowRead);
  if (nowRead) anchorToElement(articleEls.get(id) ?? null);
  await persistProgress();
  analyticsService.capture("daily_reading_marked_read", {
    marked: nowRead,
    scope: "text",
    done_count: completedCount.value,
    total_count: totalCount.value,
    all_done: allDone.value,
  });
}

/** Coche/décoche un chapitre ; le texte bascule « lu » quand tout y est. */
async function toggleSection(id: string, sectionIndex: number) {
  const current = new Set(completedSections.value[id] ?? []);
  const nowRead = !current.has(sectionIndex);
  if (nowRead) current.add(sectionIndex);
  else current.delete(sectionIndex);
  completedSections.value = { ...completedSections.value, [id]: [...current] };

  const indexes = sectionIndexes.get(id) ?? [];
  const allRead = indexes.length > 0 && indexes.every((i) => current.has(i));
  const ids = new Set(completedIds.value);
  const wasComplete = ids.has(id);
  if (allRead) ids.add(id);
  else ids.delete(id);
  completedIds.value = ids;
  // Dernier chapitre coché : le texte entier se replie, comme un « marquer lu ».
  if (allRead && !wasComplete) {
    setCollapsed(id, true);
    anchorToElement(articleEls.get(id) ?? null);
  }

  await persistProgress();
  analyticsService.capture("daily_reading_marked_read", {
    marked: nowRead,
    scope: "section",
    done_count: completedCount.value,
    total_count: totalCount.value,
    all_done: allDone.value,
  });
}

/** Chapitres lus d'un texte (chip « 3/8 » de l'en-tête). */
function sectionsReadCount(id: string): number {
  return completedSections.value[id]?.length ?? 0;
}

function setCollapsed(id: string, collapsed: boolean) {
  const next = new Set(collapsedIds.value);
  if (collapsed) next.add(id);
  else next.delete(id);
  collapsedIds.value = next;
}

// Clicking a text's title folds/unfolds it (even once read, to read it again).
function toggleCollapse(id: string) {
  setCollapsed(id, !collapsedIds.value.has(id));
}

// Règle de comptage partagée avec l'accueil (le chnei mikra, hebdomadaire,
// ne compte pas dans la progression du jour ; les actions et les objectifs
// personnels comptent comme une lecture chacun).
const progressCounts = computed(() =>
  countDailyProgress({
    textIds: selectedIds.value,
    options: selectedOptions.value,
    completedTextIds: completedIds.value,
    completedOptions: completedOptions.value,
    actions: actionKeys.value,
    completedActions: completedActions.value,
  }),
);
const completedCount = computed(() => progressCounts.value.done);
const totalCount = computed(() => progressCounts.value.total);
const allDone = computed(() => totalCount.value > 0 && completedCount.value === totalCount.value);
const progressPct = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((completedCount.value / totalCount.value) * 100),
);

/** Ce que la modale des réglages renvoie une fois validée. */
interface ReminderChoice {
  enabled: boolean;
  daily: boolean;
  hour: number;
  minute: number;
  sunset: boolean;
}

// La cloche ouvre toujours les réglages : c'est là qu'on active comme qu'on
// coupe. Auparavant un second appui coupait les rappels sans un mot, et sans
// jamais laisser voir les options.
function onBellClick() {
  if (reminderBusy.value) return;
  // Les rappels s'enregistrent dans le compte : sans connexion, rien à régler.
  if (!requireOnline()) return;
  // Dénominateur des rappels : `reminder_enabled` et `reminder_disabled` ne
  // comptaient que les réglages menés à leur terme. Les ouvertures abandonnées
  // (l'écran est le seul endroit où l'on découvre les options) ne se voyaient
  // pas, alors que c'est là que se joue l'activation des notifications.
  analyticsService.capture("reminder_settings_opened", {
    enabled: reminderEnabled.value,
    daily: reminderDaily.value,
    sunset: reminderSunset.value,
  });
  showReminderModal.value = true;
}

function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Résumé des rappels retenus, pour le toast de confirmation. */
function reminderSummary(choice: ReminderChoice): string {
  const parts: string[] = [];
  if (choice.daily) {
    parts.push(
      t("notifications.summaryDaily", { time: formatReminderTime(choice.hour, choice.minute) }),
    );
  }
  if (choice.sunset) {
    parts.push(t("notifications.summarySunset", { minutes: SUNSET_REMINDER_OFFSET_MINUTES }));
  }
  return parts.join(t("notifications.summaryJoin"));
}

function saveReminder(choice: ReminderChoice) {
  if (!choice.enabled) {
    void disableReminder();
    return;
  }
  void enableReminder(choice);
}

async function enableReminder(choice: ReminderChoice) {
  reminderBusy.value = true;
  try {
    await pushService.enable(props.userId, String(locale.value), {
      daily: choice.daily,
      hour: choice.hour,
      minute: choice.minute,
      sunset: choice.sunset,
      // La position ne quitte l'appareil que pour ce rappel-là, et arrondie.
      place: choice.sunset ? coarsePlace(zmanimPlace.value) : null,
    });
    reminderEnabled.value = true;
    reminderDaily.value = choice.daily;
    reminderHour.value = choice.hour;
    reminderMinute.value = choice.minute;
    reminderSunset.value = choice.sunset;
    analyticsService.capture("reminder_enabled", {
      hour: choice.hour,
      minute: choice.minute,
      daily: choice.daily,
      sunset: choice.sunset,
    });
    toast.success(t("notifications.enabledToast", { reminders: reminderSummary(choice) }));
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "PERMISSION_DENIED") {
      // Friction push : l'utilisateur voulait le rappel mais l'OS a dit non.
      analyticsService.capture("reminder_enable_failed", { reason: "permission_denied" });
      toast.error(t("notifications.permissionDenied"));
    } else {
      // La branche générique n'avait pas d'événement : un échec d'écriture ou
      // de jeton FCM se lisait comme une absence de rappel, indistinguable
      // d'un utilisateur qui n'en veut pas.
      analyticsService.capture("reminder_enable_failed", {
        reason: "error",
        error_message: e instanceof Error ? e.message : String(e),
      });
      console.error("Activation du rappel échouée:", e);
      toast.error(t("notifications.error"));
    }
  } finally {
    reminderBusy.value = false;
  }
}

async function disableReminder() {
  reminderBusy.value = true;
  try {
    await pushService.disable(props.userId);
    reminderEnabled.value = false;
    analyticsService.capture("reminder_disabled");
    toast.success(t("notifications.disabledToast"));
  } catch (e: unknown) {
    // Contrepartie manquante de `reminder_disabled` : l'utilisateur croit
    // avoir coupé ses rappels et continue de les recevoir.
    analyticsService.capture("reminder_disable_failed", {
      error_message: e instanceof Error ? e.message : String(e),
    });
    console.error("Désactivation du rappel échouée:", e);
    toast.error(t("notifications.error"));
  } finally {
    reminderBusy.value = false;
  }
}

// --- Manage view (browse the library, like the Bibliothèque) ---
const selectedType = ref(ALL_TYPE);
// La ligne « X textes dans votre liste » se déplie pour retirer un texte
// sans avoir à le retrouver dans le catalogue.
const showSelectedPanel = ref(false);

// "Tout" shows every corpus at once; any other tab stays scoped to itself.
const isAllSelected = computed(() => selectedType.value === ALL_TYPE);

// La recherche du catalogue, la même que dans la bibliothèque (StudyPage) :
// voir useCatalogSearch. Seuls les corpus d'étude s'y composent : la liturgie
// ne figure pas dans les onglets, et une recherche qui n'y trouverait qu'une
// brakha dit « aucun résultat » plutôt que d'ouvrir une zone vide.
const {
  term: searchTerm,
  groupedByType,
  hasResults,
} = useCatalogSearch(allTexts, CORPUS_TYPES, () =>
  isAllSelected.value ? null : selectedType.value,
);
const { searching } = useSearchMode(searchTerm);

const formatBookName = bookName;
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold mb-2 text-text-primary">
          {{ t("dailyReading.title") }}
        </h1>
        <!-- Le descriptif ne sert que le site ; l'état vide explique déjà la fonction. -->
        <p v-if="!isNativeApp" class="text-text-secondary max-w-xl">
          {{ t("dailyReading.description") }}
        </p>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- App native : la cloche ouvre les réglages des rappels push. -->
        <button
          v-if="isNativeApp"
          @click="onBellClick"
          :disabled="reminderBusy"
          :class="[
            'inline-flex items-center justify-center w-11 h-11 rounded-full transition-colors',
            reminderEnabled
              ? 'bg-primary/10 text-primary'
              : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
          ]"
          :aria-label="
            reminderEnabled ? t('notifications.settingsAriaOn') : t('notifications.settingsAriaOff')
          "
          aria-haspopup="dialog"
        >
          <AppIcon v-if="reminderBusy" name="spinner" :size="20" class="animate-spin" />
          <AppIcon v-else name="bell" :size="20" />
        </button>

        <button v-if="mode === 'reading'" @click="mode = 'manage'" class="btn btn-primary">
          <AppIcon name="settings" :size="14" />
          {{ t("dailyReading.manage") }}
        </button>
        <button v-else @click="finishManage" class="btn btn-soft">
          <AppIcon name="check" :size="14" />
          {{ t("dailyReading.done") }}
        </button>
      </div>
    </div>

    <!-- Hors connexion : la page reste lisible (textes téléchargés), mais rien
         n'est modifiable, le serveur reste seul maître de la liste. -->
    <div v-if="!online" class="card p-4 mb-6 flex items-start gap-3" role="status">
      <AppIcon name="signal" :size="16" class="text-text-secondary/70 mt-0.5 shrink-0" />
      <p class="text-sm text-text-secondary leading-relaxed">
        {{ t("dailyReading.offline.banner") }}
      </p>
    </div>

    <!-- App native : des textes de la lecture du jour ne sont pas sur
         l'appareil (ajoutés ailleurs, ou paracha de la nouvelle semaine). -->
    <div
      v-else-if="isNativeApp && !loading && missingBooks.length > 0"
      class="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3"
    >
      <p class="text-sm text-text-secondary leading-relaxed flex items-start gap-2 min-w-0">
        <AppIcon name="alert-triangle" :size="16" class="text-amber-500 mt-0.5 shrink-0" />
        {{ t("dailyReading.offline.missing", missingBooks.length) }}
      </p>
      <button
        class="btn btn-soft shrink-0"
        :disabled="downloading"
        @click="downloadForOffline(missingBooks)"
      >
        <AppIcon v-if="downloading" name="spinner" :size="14" class="animate-spin" />
        <AppIcon v-else name="download" :size="14" />
        {{ t("downloads.download") }}
      </button>
    </div>

    <ReminderSettingsModal
      v-model:show="showReminderModal"
      :enabled="reminderEnabled"
      :daily="reminderDaily"
      :hour="reminderHour"
      :minute="reminderMinute"
      :sunset="reminderSunset"
      :sunset-offset="SUNSET_REMINDER_OFFSET_MINUTES"
      :sunset-time="sunsetToday"
      :place-label="zmanimPlaceLabel"
      @save="saveReminder"
    />

    <!-- Loading -->
    <div v-if="loading" class="animate-pulse space-y-4">
      <div class="h-20 rounded-card bg-black/10 dark:bg-white/10"></div>
      <div class="h-40 rounded-card bg-black/10 dark:bg-white/10"></div>
    </div>

    <!-- ===== Manage mode: pick texts from the library ===== -->
    <template v-else-if="mode === 'manage'">
      <!-- Tout ce qui précède la barre de recherche se replie dès la première
           lettre : la barre glisse en haut de l'écran, et le catalogue filtré
           occupe la place que le clavier laisse (voir useSearchMode). -->
      <CollapseTransition>
        <div v-show="!searching">
          <button
            v-if="selectedEntries.length"
            @click="showSelectedPanel = !showSelectedPanel"
            class="text-sm text-text-secondary mb-4 flex items-center gap-1.5 hover:text-text-primary transition-colors"
          >
            <AppIcon name="info" :size="14" />
            {{ t("dailyReading.selectedCount", { count: selectedEntries.length }) }}
            <AppIcon
              name="chevron-down"
              :size="12"
              class="transition-transform duration-200"
              :class="showSelectedPanel ? 'rotate-180' : ''"
            />
          </button>
          <p v-else class="text-sm text-text-secondary mb-4 flex items-center gap-1.5">
            <AppIcon name="info" :size="14" />
            {{ t("dailyReading.selectedCount", { count: selectedEntries.length }) }}
          </p>

          <!-- Les textes de la liste, retirables d'un clic -->
          <CollapseTransition>
            <div v-show="showSelectedPanel && selectedEntries.length" class="mb-6">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="entry in selectedEntries"
                  :key="entry.id"
                  class="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-primary/10 text-sm font-medium text-text-primary"
                >
                  {{ appendHebrewNumeral(entry.name) }}
                  <button
                    @click="toggleSelect(entry)"
                    class="p-0.5 rounded-full text-text-secondary hover:text-red-600 transition-colors"
                    :title="t('dailyReading.removeFromList')"
                    :aria-label="t('dailyReading.removeFromList')"
                  >
                    <AppIcon name="x" :size="13" />
                  </button>
                </span>
              </div>
            </div>
          </CollapseTransition>

          <!-- Lectures du moment : suivent le calendrier au lieu d'être choisies -->
          <section class="mb-8">
            <h3 class="text-lg font-bold text-text-primary mb-1">
              {{ t("dailyReading.options.title") }}
            </h3>
            <p class="text-sm text-text-secondary mb-3 max-w-xl">
              {{ t("dailyReading.options.description") }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="opt in OPTION_META"
                :key="opt.key"
                @click="toggleOption(opt.key)"
                :class="[
                  'flex flex-col gap-1 p-3 rounded-lg transition-colors text-left',
                  isOptionSelected(opt.key)
                    ? 'bg-primary/10'
                    : 'bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/5 dark:hover:bg-white/10',
                ]"
              >
                <span class="flex items-center justify-between gap-2">
                  <span class="font-medium text-text-primary">{{ t(opt.titleKey) }}</span>
                  <AppIcon
                    :name="isOptionSelected(opt.key) ? 'circle-check' : 'circle-plus'"
                    :size="14"
                    :class="isOptionSelected(opt.key) ? 'text-primary' : 'text-text-secondary/60'"
                    class="flex-shrink-0"
                  />
                </span>
                <span class="text-xs text-text-secondary">{{ t(opt.descriptionKey) }}</span>
              </button>
            </div>
          </section>

          <!-- Actions du jour : des gestes à se voir faire chaque jour, cochés
               comme une lecture (voir services/dailyActions) -->
          <section class="mb-8">
            <h3 class="text-lg font-bold text-text-primary mb-1">
              {{ t("dailyReading.actions.title") }}
            </h3>
            <p class="text-sm text-text-secondary mb-3 max-w-xl">
              {{ t("dailyReading.actions.description") }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="action in DAILY_ACTIONS"
                :key="action.key"
                @click="toggleAction(action.key)"
                :class="[
                  'flex flex-col gap-1 p-3 rounded-lg transition-colors text-left',
                  isActionSelected(action.key)
                    ? 'bg-primary/10'
                    : 'bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/5 dark:hover:bg-white/10',
                ]"
              >
                <span class="flex items-center justify-between gap-2">
                  <span class="font-medium text-text-primary">{{ t(action.titleKey) }}</span>
                  <AppIcon
                    :name="isActionSelected(action.key) ? 'circle-check' : 'circle-plus'"
                    :size="14"
                    :class="
                      isActionSelected(action.key) ? 'text-primary' : 'text-text-secondary/60'
                    "
                    class="flex-shrink-0"
                  />
                </span>
                <span class="text-xs text-text-secondary">{{ t(action.descriptionKey) }}</span>
              </button>
            </div>
          </section>

          <!-- Objectifs personnels : ce que la personne veut s'améliorer à faire,
               dans ses mots à elle, chaque jour ou tant de fois par semaine -->
          <section class="mb-8">
            <h3 class="text-lg font-bold text-text-primary mb-1">
              {{ t("dailyReading.goals.title") }}
            </h3>
            <p class="text-sm text-text-secondary mb-3 max-w-xl">
              {{ t("dailyReading.goals.description") }}
            </p>
            <ul v-if="sortedGoals.length" class="mb-3 space-y-2">
              <li
                v-for="goal in sortedGoals"
                :key="goal.id"
                class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-primary/10"
              >
                <span class="flex items-center gap-2.5 min-w-0 font-medium text-text-primary">
                  <AppIcon name="target" :size="14" class="shrink-0 text-primary" />
                  <span class="truncate">{{ goal.label }}</span>
                </span>
                <span class="flex items-center gap-2">
                  <AppSelect
                    :model-value="String(goal.perWeek ?? 0)"
                    :options="frequencyOptions"
                    class="w-44"
                    @update:model-value="(value) => setGoalFrequency(goal, value)"
                  />
                  <button
                    @click="removeGoal(goal.id)"
                    class="p-1 rounded-full text-text-secondary hover:text-red-600 transition-colors shrink-0"
                    :title="t('dailyReading.goals.remove')"
                    :aria-label="t('dailyReading.goals.remove')"
                  >
                    <AppIcon name="x" :size="14" />
                  </button>
                </span>
              </li>
            </ul>
            <form
              v-if="sortedGoals.length < goalLimits.max"
              class="flex flex-wrap gap-2"
              @submit.prevent="addGoal"
            >
              <input
                v-model="newGoalLabel"
                type="text"
                class="field flex-1 min-w-[12rem]"
                :maxlength="goalLimits.maxLength"
                :placeholder="t('dailyReading.goals.placeholder')"
                :aria-label="t('dailyReading.goals.add')"
              />
              <button
                type="submit"
                class="btn btn-soft"
                :disabled="saving || !normalizeGoalLabel(newGoalLabel)"
              >
                <AppIcon name="plus" :size="14" />
                {{ t("dailyReading.goals.add") }}
              </button>
            </form>
            <p v-else class="text-xs text-text-secondary/70">
              {{ t("dailyReading.goals.limit", { max: goalLimits.max }) }}
            </p>
          </section>

          <!-- La série : ce qu'il faut pour réussir une journée, et les jours
               de pause (voir dailyHistory.daySucceeded et restDays) -->
          <section class="mb-8">
            <h3 class="text-lg font-bold text-text-primary mb-1">
              {{ t("dailyReading.rules.title") }}
            </h3>
            <p class="text-sm text-text-secondary mb-3 max-w-xl">
              {{ t("dailyReading.rules.description") }}
            </p>
            <div class="flex flex-wrap gap-2 mb-4" role="radiogroup">
              <button
                v-for="rule in DAILY_GOAL_RULES"
                :key="rule"
                role="radio"
                :aria-checked="goalRule === rule"
                @click="setGoalRule(rule)"
                :class="[
                  'px-4 py-2 rounded-btn text-sm font-medium transition-colors',
                  goalRule === rule
                    ? 'bg-primary text-white'
                    : 'bg-black/5 text-text-secondary hover:bg-black/10 hover:text-text-primary dark:bg-white/10 dark:hover:bg-white/15',
                ]"
              >
                {{ t(`dailyReading.rules.${rule}`) }}
              </button>
            </div>
            <label class="card flex items-center justify-between gap-4 p-4 cursor-pointer">
              <span class="min-w-0">
                <span class="block font-medium text-text-primary">
                  {{ t("dailyReading.rules.restDays") }}
                </span>
                <span class="block text-xs text-text-secondary">
                  {{ t("dailyReading.rules.restDaysHint") }}
                </span>
              </span>
              <ToggleSwitch
                :model-value="restDays"
                :label="t('dailyReading.rules.restDays')"
                @update:model-value="setRestDays"
              />
            </label>
          </section>
        </div>
      </CollapseTransition>

      <CatalogSearchField
        v-model:term="searchTerm"
        :placeholder="t('study.searchPlaceholder')"
        class="mb-4"
      />

      <div class="flex flex-col items-center gap-4 mb-8">
        <div class="flex flex-wrap gap-2 justify-center">
          <button
            v-for="ty in TYPES"
            :key="ty.key"
            @click="selectedType = ty.key"
            :class="[
              'px-4 py-2 rounded-btn text-sm font-medium transition-colors',
              selectedType === ty.key
                ? 'bg-primary text-white'
                : 'bg-black/5 text-text-secondary hover:bg-black/10 hover:text-text-primary dark:bg-white/10 dark:hover:bg-white/15',
            ]"
          >
            {{ t(ty.labelKey) }}
          </button>
        </div>
      </div>

      <div v-if="hasResults" class="space-y-10">
        <div v-for="typeGroup in groupedByType" :key="typeGroup.key" class="space-y-8">
          <!-- Type heading: shown only on the "Tout" tab, where several corpora mix. -->
          <h2 v-if="isAllSelected" class="text-xl font-bold text-text-primary">
            {{ t(typeGroup.labelKey) }}
          </h2>
          <section v-for="(texts, livre) in typeGroup.groups" :key="livre">
            <h3 class="text-lg font-bold text-text-primary mb-3">
              {{ formatBookName(String(livre)) }}
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="text in texts"
                :key="text.id"
                @click="toggleSelect(text)"
                :class="[
                  'flex items-center justify-between gap-2 p-3 rounded-lg transition-colors text-left',
                  isSelected(text.id)
                    ? 'bg-primary/10'
                    : 'bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/5 dark:hover:bg-white/10',
                ]"
              >
                <span class="min-w-0">
                  <span class="block font-medium text-text-primary">
                    {{ appendHebrewNumeral(text.name) }}
                  </span>
                </span>
                <span
                  :class="[
                    'flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold',
                    isSelected(text.id) ? 'text-primary' : 'text-text-secondary/60',
                  ]"
                >
                  <AppIcon
                    :name="isSelected(text.id) ? 'circle-check' : 'circle-plus'"
                    :size="14"
                  />
                  {{ isSelected(text.id) ? t("dailyReading.added") : t("dailyReading.add") }}
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <AppIcon name="search" :size="32" class="text-text-secondary/40 mb-4" />
        <p class="text-text-secondary">{{ t("study.noResults") }}</p>
      </div>

      <!-- « Terminé » collé en bas de l'écran : composer sa liste fait défiler
           tout le catalogue, personne ne doit remonter en haut pour valider.
           Dans l'app native, il se pose au-dessus de la barre d'onglets. -->
      <div
        class="sticky z-20 mt-8 flex justify-center pointer-events-none"
        :class="isNativeApp ? 'bottom-[calc(4.5rem+var(--safe-bottom))]' : 'bottom-4'"
      >
        <button @click="finishManage" class="btn btn-primary shadow-pop pointer-events-auto">
          <AppIcon name="check" :size="14" />
          {{ t("dailyReading.done") }}
        </button>
      </div>
    </template>

    <!-- ===== Reading mode: the selected texts, one after another ===== -->
    <template v-else>
      <!-- Liste vide : les trois parcours de départ, ou composer soi-même -->
      <div v-if="totalCount === 0 && !weeklyParasha" class="py-6">
        <div class="text-center mb-6">
          <AppIcon name="book" :size="32" class="text-primary/50 mb-4 mx-auto" />
          <h3 class="text-xl font-semibold text-text-primary mb-2">
            {{ t("dailyReading.emptyTitle") }}
          </h3>
          <p class="text-text-secondary max-w-md mx-auto">
            {{ t("dailyReading.emptyDescription") }}
          </p>
        </div>
        <DailyStarterPacks :busy="saving" @choose="applyPack" />
        <div class="mt-6 text-center">
          <button @click="mode = 'manage'" class="btn btn-soft">
            <AppIcon name="settings" :size="14" />
            {{ t("dailyReading.packs.compose") }}
          </button>
        </div>
      </div>

      <template v-else>
        <!-- Onglets Aujourd'hui / Cette semaine / Progression + taille du texte -->
        <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div
            class="inline-flex items-center gap-1 rounded-btn bg-black/5 p-1 dark:bg-white/10"
            role="tablist"
          >
            <button
              role="tab"
              :aria-selected="activeTab === 'today'"
              @click="switchTab('today')"
              :class="[
                'px-3.5 py-1.5 rounded-control text-sm font-medium transition-colors',
                activeTab === 'today'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary',
              ]"
            >
              {{ t("dailyReading.tabToday") }}
            </button>
            <button
              v-if="weeklyParasha"
              role="tab"
              :aria-selected="activeTab === 'week'"
              @click="switchTab('week')"
              :class="[
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-control text-sm font-medium transition-colors',
                activeTab === 'week'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary',
              ]"
            >
              {{ t("dailyReading.tabWeek") }}
              <!-- Coche : chnei mikra lu cette semaine ; point : encore à lire -->
              <AppIcon
                v-if="parashaCompleted"
                name="circle-check"
                :size="13"
                :class="activeTab === 'week' ? 'text-white' : 'text-green-500'"
              />
              <span
                v-else
                class="w-1.5 h-1.5 rounded-full"
                :class="activeTab === 'week' ? 'bg-white' : 'bg-primary'"
              ></span>
            </button>
            <button
              role="tab"
              :aria-selected="activeTab === 'progress'"
              @click="switchTab('progress')"
              :class="[
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-control text-sm font-medium transition-colors',
                activeTab === 'progress'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary',
              ]"
            >
              <AppIcon name="flame" :size="13" />
              {{ t("dailyReading.tabProgress") }}
            </button>
          </div>

          <!-- Taille du texte (même réglage que le lecteur de la bibliothèque) -->
          <ReadingSizeControl v-if="activeTab !== 'progress'" class="ml-auto" />
        </div>

        <!-- Onglet « Progression » : le calendrier, les compteurs, les paliers -->
        <section v-if="activeTab === 'progress'" class="space-y-6 mb-10">
          <div class="card p-5">
            <DailyStreakBanner :status="streakInfo" />
            <p
              v-if="streakInfo.freezes > 0 || streakInfo.best >= 7"
              class="mt-3 text-xs text-text-secondary flex items-center gap-1.5"
            >
              <AppIcon name="shield" :size="13" class="text-primary" />
              {{ t("dailyReading.freezes.count", streakInfo.freezes) }}
              <span class="text-text-secondary/70">
                · {{ t("dailyReading.freezes.hint", { max: MAX_FREEZES }) }}
              </span>
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button class="btn btn-soft btn-sm" @click="shareStreak">
                <AppIcon name="share" :size="13" />
                {{ t("dailyReading.streak.share") }}
              </button>
            </div>
          </div>

          <DailyChallengeCard v-if="challenge" :challenge="challenge" :succeeded="challengeDone" />

          <div class="card p-5">
            <DailyMonthCalendar :history="liveHistory" :today="todayKey" :is-pause="isPause" />
          </div>

          <!-- Les compteurs cumulés : des chiffres qui ne redescendent jamais -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              v-for="stat in [
                { key: 'days', value: totals.days },
                { key: 'psalms', value: totals.psalms },
                { key: 'dafim', value: totals.dafim },
                { key: 'prayers', value: totals.prayers },
              ]"
              :key="stat.key"
              class="card p-4"
            >
              <p class="text-3xl font-bold tabular-nums text-text-primary leading-none">
                {{ stat.value }}
              </p>
              <p class="mt-1.5 text-xs text-text-secondary">
                {{ t(`dailyReading.totals.${stat.key}`, stat.value) }}
              </p>
            </div>
          </div>

          <!-- Les paliers de la série, et les siyoumim -->
          <div class="card p-5">
            <h2 class="font-semibold text-text-primary mb-3">
              {{ t("dailyReading.milestones.title") }}
            </h2>
            <ul class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <li
                v-for="m in milestones"
                :key="m.days"
                class="flex items-center gap-2.5 rounded-lg p-3"
                :class="m.reached ? 'bg-primary/10' : 'bg-black/[0.03] dark:bg-white/5'"
              >
                <AppIcon
                  :name="m.reached ? 'trophy' : 'flame'"
                  :size="18"
                  :class="m.reached ? 'text-primary' : 'text-text-secondary/40'"
                />
                <span class="min-w-0">
                  <span
                    class="block text-sm font-semibold"
                    :class="m.reached ? 'text-text-primary' : 'text-text-secondary'"
                  >
                    {{ t("dailyReading.milestones.days", { n: m.days }) }}
                  </span>
                  <span class="block text-[11px] text-text-secondary/80">
                    {{
                      m.reached
                        ? t("dailyReading.milestones.reached")
                        : t("dailyReading.milestones.locked")
                    }}
                  </span>
                </span>
              </li>
            </ul>
            <template v-if="siyoumim.length">
              <h3 class="mt-5 mb-2 text-sm font-semibold text-text-primary">
                {{ t("dailyReading.milestones.siyoumim") }}
              </h3>
              <ul class="flex flex-wrap gap-2">
                <li
                  v-for="siyoum in siyoumim"
                  :key="siyoum.date"
                  class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-text-primary"
                >
                  <AppIcon name="graduation-cap" :size="14" class="text-primary" />
                  {{ siyoum.tractate }}
                </li>
              </ul>
            </template>
          </div>
        </section>

        <!-- Onglet « Cette semaine » : le chnei mikra, à part de la liste du
             jour. Sa coche tient jusqu'au changement de paracha. -->
        <section v-if="weeklyParasha && activeTab === 'week'" class="mb-10">
          <p class="text-xs text-text-secondary/70 mb-3">
            {{ t("dailyReading.options.weeklyNote") }}
          </p>
          <article
            :ref="(el) => setArticleEl('parasha', el)"
            :class="parashaCompleted ? 'opacity-60' : ''"
          >
            <header class="mb-4">
              <button
                type="button"
                @click="toggleCollapse('parasha')"
                class="group flex w-full items-start gap-3 text-left"
              >
                <AppIcon
                  name="chevron-down"
                  :size="13"
                  class="mt-1.5 text-text-secondary/60 transition-transform duration-200"
                  :class="collapsedIds.has('parasha') ? '-rotate-90' : ''"
                />
                <span class="min-w-0">
                  <span class="block text-xs font-semibold text-primary">
                    {{ t("dailyReading.options.parashaReading") }}
                  </span>
                  <span
                    class="flex items-center gap-2 text-lg font-bold text-text-primary transition-colors group-hover:text-primary"
                  >
                    {{ parashaSubtitle }}
                    <AppIcon
                      v-if="parashaCompleted"
                      name="circle-check"
                      :size="15"
                      class="text-green-500"
                    />
                  </span>
                </span>
              </button>
            </header>

            <CollapseTransition>
              <div v-show="!collapsedIds.has('parasha')">
                <!-- Options de lecture : verset écrit deux fois, Rachi -->
                <ChneiMikraOptions class="mb-5" source="daily_reading" />

                <div class="space-y-8">
                  <DailyReadingItem
                    v-for="entry in weeklyParasha.entries"
                    :key="entry.id"
                    :entry="entry"
                    :with-targoum="true"
                    :double-verses="chneiMikraDouble"
                    :with-rashi="chneiMikraRashi"
                  />
                </div>

                <div class="mt-4">
                  <button
                    @click="toggleParashaCompleted"
                    :class="[
                      'inline-flex items-center gap-2 text-sm font-medium transition-colors',
                      parashaCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-text-secondary hover:text-primary',
                    ]"
                  >
                    <AppIcon v-if="parashaCompleted" name="circle-check" :size="15" />
                    <span
                      v-else
                      class="w-3.5 h-3.5 rounded-full border-2 border-current shrink-0"
                    ></span>
                    {{
                      parashaCompleted
                        ? t("dailyReading.options.readThisWeek")
                        : t("dailyReading.markRead")
                    }}
                  </button>
                </div>
              </div>
            </CollapseTransition>
          </article>
        </section>

        <!-- Onglet « Aujourd'hui » : progression et liste du jour -->
        <template v-else-if="activeTab === 'today'">
          <!-- Seul le chnei mikra est suivi : la liste du jour est vide -->
          <div
            v-if="totalCount === 0"
            class="flex flex-col items-center justify-center py-16 text-center"
          >
            <AppIcon name="book" :size="32" class="text-primary/50 mb-4" />
            <h3 class="text-xl font-semibold text-text-primary mb-2">
              {{ t("dailyReading.emptyTitle") }}
            </h3>
            <p class="text-text-secondary mb-6 max-w-sm">
              {{ t("dailyReading.emptyDescription") }}
            </p>
            <button @click="mode = 'manage'" class="btn btn-primary">
              <AppIcon name="plus" :size="14" />
              {{ t("dailyReading.addTexts") }}
            </button>
          </div>

          <template v-else>
            <!-- Daily progress -->
            <div class="card p-5 mb-8">
              <div v-if="allDone" class="flex items-start gap-3">
                <AppIcon name="circle-check" :size="20" class="text-green-500 mt-0.5" />
                <div>
                  <p class="font-semibold text-text-primary">
                    {{ t("dailyReading.allReadTitle") }}
                  </p>
                  <p class="text-sm text-text-secondary">
                    {{ t("dailyReading.allReadDescription") }}
                  </p>
                </div>
              </div>
              <template v-else>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-text-primary">
                    {{ t("dailyReading.progress", { done: completedCount, total: totalCount }) }}
                  </span>
                  <span class="text-sm font-semibold text-primary">{{ progressPct }}%</span>
                </div>
                <ProgressBar :value="progressPct" :label="t('dailyReading.title')" />
              </template>
              <p class="text-xs text-text-secondary/70 mt-3 flex items-center gap-1.5">
                <AppIcon name="rotate" :size="12" />
                {{ t("dailyReading.resetsDaily") }}
                <span v-if="goalRule !== 'all'"
                  >· {{ t(`dailyReading.rules.short.${goalRule}`) }}</span
                >
              </p>

              <!-- La semaine en cours : sept pastilles, du dimanche au Chabbat -->
              <DailyWeekDots :days="weekCells" class="mt-4 max-w-sm" />

              <!-- La série de jours : la journée réussie chaque jour, le compteur monte -->
              <DailyStreakBanner :status="streakInfo" class="mt-4 pt-4 border-t border-line" />

              <!-- Hier n'a pas été coché : jusqu'à midi, on peut le dire -->
              <div
                v-if="canCatchUpYesterday"
                class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 p-3"
              >
                <p class="text-sm text-text-primary">{{ t("dailyReading.catchUp.question") }}</p>
                <button class="btn btn-soft btn-sm" @click="catchUpYesterday">
                  <AppIcon name="check" :size="13" />
                  {{ t("dailyReading.catchUp.confirm") }}
                </button>
              </div>
            </div>

            <!-- Le défi de saison en cours ('Omer, Yamim Noraïm, 'Hanouka) -->
            <DailyChallengeCard
              v-if="challenge"
              :challenge="challenge"
              :succeeded="challengeDone"
              class="mb-8"
            />

            <!-- Texts, one after another, directly on the page background -->
            <div class="space-y-12">
              <!-- Lectures du moment : calculées pour aujourd'hui, en tête -->
              <article
                v-for="reading in dynamicReadings"
                :key="reading.key"
                :ref="(el) => setArticleEl(reading.key, el)"
                :class="completedOptions.has(reading.key) ? 'opacity-60' : ''"
              >
                <header class="mb-4">
                  <button
                    type="button"
                    @click="toggleCollapse(reading.key)"
                    class="group flex w-full items-start gap-3 text-left"
                  >
                    <AppIcon
                      name="chevron-down"
                      :size="13"
                      class="mt-1.5 text-text-secondary/60 transition-transform duration-200"
                      :class="collapsedIds.has(reading.key) ? '-rotate-90' : ''"
                    />
                    <span class="min-w-0">
                      <span class="block text-xs font-semibold text-primary">
                        {{ reading.title }}
                      </span>
                      <span
                        class="flex items-center gap-2 text-lg font-bold text-text-primary transition-colors group-hover:text-primary"
                      >
                        {{ reading.subtitle }}
                        <AppIcon
                          v-if="completedOptions.has(reading.key)"
                          name="circle-check"
                          :size="15"
                          class="text-green-500"
                        />
                      </span>
                      <!-- Où l'on en est dans le cycle : un chemin qu'on voit -->
                      <span
                        v-if="reading.progress"
                        class="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                      >
                        {{ reading.progress }}
                      </span>
                    </span>
                  </button>
                </header>

                <CollapseTransition>
                  <div v-show="!collapsedIds.has(reading.key)">
                    <!-- Ce qui se dit avant la lecture, là où on le dirait -->
                    <ReadingEncadrement
                      v-if="reading.encadrement"
                      :blocks="reading.encadrement.before"
                      :title="t('encadrement.before')"
                    />

                    <div class="space-y-8">
                      <DailyReadingItem
                        v-for="entry in reading.entries"
                        :key="entry.id"
                        :entry="entry"
                        :daf-filter="reading.dafs"
                      />
                      <!-- Le traité du jour n'est pas dans la bibliothèque -->
                      <p
                        v-if="reading.entries.length === 0"
                        class="py-2 text-sm text-text-secondary flex items-center gap-1.5"
                      >
                        <AppIcon name="info" :size="14" class="text-text-secondary/60" />
                        {{ t("dailyReading.options.dafYomiMissing") }}
                      </p>
                    </div>

                    <!-- Ce qui se dit une fois la lecture finie -->
                    <ReadingEncadrement
                      v-if="reading.encadrement"
                      :blocks="reading.encadrement.after"
                      :title="t('encadrement.after')"
                    />

                    <div class="mt-4">
                      <button
                        @click="toggleOptionCompleted(reading.key)"
                        :class="[
                          'inline-flex items-center gap-2 text-sm font-medium transition-colors',
                          completedOptions.has(reading.key)
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-text-secondary hover:text-primary',
                        ]"
                      >
                        <AppIcon
                          v-if="completedOptions.has(reading.key)"
                          name="circle-check"
                          :size="15"
                        />
                        <span
                          v-else
                          class="w-3.5 h-3.5 rounded-full border-2 border-current shrink-0"
                        ></span>
                        {{
                          completedOptions.has(reading.key)
                            ? t("dailyReading.readToday")
                            : t("dailyReading.markRead")
                        }}
                      </button>
                    </div>
                  </div>
                </CollapseTransition>
              </article>

              <template v-for="entry in selectedEntries" :key="entry.id">
                <!-- Ce qui se dit avant la lecture : une seule fois, au premier
                     texte du corpus concerné (voir encadrementBounds) -->
                <ReadingEncadrement
                  v-if="encadrements.get(String(entry.id))?.before"
                  :blocks="encadrements.get(String(entry.id))!.before!"
                  :title="t('encadrement.before')"
                />

                <article
                  :ref="(el) => setArticleEl(String(entry.id), el)"
                  :class="completedIds.has(String(entry.id)) ? 'opacity-60' : ''"
                >
                  <!-- Discreet heading: click to fold/unfold the text -->
                  <header class="mb-4">
                    <button
                      type="button"
                      @click="toggleCollapse(String(entry.id))"
                      class="group flex w-full items-start gap-3 text-left"
                    >
                      <AppIcon
                        name="chevron-down"
                        :size="13"
                        class="mt-1.5 text-text-secondary/60 transition-transform duration-200"
                        :class="collapsedIds.has(String(entry.id)) ? '-rotate-90' : ''"
                      />
                      <span class="min-w-0">
                        <span class="block text-xs font-semibold text-primary">
                          {{ formatBookName(entry.livre) }}
                        </span>
                        <span
                          class="flex items-center gap-2 text-lg font-bold text-text-primary transition-colors group-hover:text-primary"
                        >
                          {{ appendHebrewNumeral(entry.name) }}
                          <AppIcon
                            v-if="completedIds.has(String(entry.id))"
                            name="circle-check"
                            :size="15"
                            class="text-green-500"
                          />
                          <!-- Lecture par chapitres entamée : où on en est -->
                          <span
                            v-else-if="
                              entry.totalSections > 1 && sectionsReadCount(String(entry.id)) > 0
                            "
                            class="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5"
                          >
                            {{ sectionsReadCount(String(entry.id)) }}/{{ entry.totalSections }}
                          </span>
                        </span>
                      </span>
                    </button>
                  </header>

                  <!-- Text content + "mark as read", hidden (but kept loaded) when
                   folded ; le repli est animé pour ne pas faire sauter le scroll -->
                  <CollapseTransition>
                    <div v-show="!collapsedIds.has(String(entry.id))">
                      <DailyReadingItem
                        :entry="entry"
                        :read-sections="completedSections[String(entry.id)] ?? []"
                        @toggle-section="(index) => toggleSection(String(entry.id), index)"
                        @sections-loaded="
                          (indexes) => sectionIndexes.set(String(entry.id), indexes)
                        "
                      />

                      <!-- Discreet "mark as read" button -->
                      <div class="mt-4">
                        <button
                          @click="toggleCompleted(String(entry.id))"
                          :class="[
                            'inline-flex items-center gap-2 text-sm font-medium transition-colors',
                            completedIds.has(String(entry.id))
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-text-secondary hover:text-primary',
                          ]"
                        >
                          <AppIcon
                            v-if="completedIds.has(String(entry.id))"
                            name="circle-check"
                            :size="15"
                          />
                          <span
                            v-else
                            class="w-3.5 h-3.5 rounded-full border-2 border-current shrink-0"
                          ></span>
                          {{
                            completedIds.has(String(entry.id))
                              ? t("dailyReading.readToday")
                              : t("dailyReading.markRead")
                          }}
                        </button>
                      </div>
                    </div>
                  </CollapseTransition>
                </article>

                <!-- Ce qui se dit une fois le dernier texte du corpus lu -->
                <ReadingEncadrement
                  v-if="encadrements.get(String(entry.id))?.after"
                  :blocks="encadrements.get(String(entry.id))!.after!"
                  :title="t('encadrement.after')"
                />
              </template>

              <!-- Les actions du jour, rangées par moment de la journée : une
                   case chacune, la fin de plage des offices, et le texte à
                   portée quand l'application l'a -->
              <section
                v-for="group in actionGroups"
                :key="group.moment"
                :aria-label="t(`dailyReading.moments.${group.moment}`)"
              >
                <h2 class="text-xs font-semibold text-primary mb-3 flex items-center gap-2">
                  {{ t(`dailyReading.moments.${group.moment}`) }}
                  <span class="font-normal text-text-secondary/70">
                    · {{ t("dailyReading.actions.title") }}
                  </span>
                </h2>
                <ul class="space-y-2">
                  <li
                    v-for="action in group.actions"
                    :key="action.key"
                    class="card flex items-center gap-3 p-3"
                    :class="completedActions.has(action.key) ? 'opacity-60' : ''"
                  >
                    <button
                      @click="toggleActionCompleted(action.key)"
                      class="flex flex-1 items-center gap-3 text-left min-w-0"
                      :aria-pressed="completedActions.has(action.key)"
                    >
                      <AppIcon
                        v-if="completedActions.has(action.key)"
                        name="circle-check"
                        :size="20"
                        class="shrink-0 text-green-500"
                      />
                      <span
                        v-else
                        class="w-5 h-5 rounded-full border-2 border-text-secondary/50 shrink-0"
                      ></span>
                      <span class="min-w-0">
                        <span class="block font-medium text-text-primary">
                          {{ t(action.titleKey) }}
                        </span>
                        <span class="block text-xs text-text-secondary">
                          {{
                            completedActions.has(action.key)
                              ? t("dailyReading.actions.doneToday")
                              : t(action.descriptionKey)
                          }}
                          <span
                            v-if="!completedActions.has(action.key) && actionDeadline(action)"
                            class="text-primary font-medium"
                          >
                            ·
                            {{ t("dailyReading.actions.until", { time: actionDeadline(action) }) }}
                          </span>
                        </span>
                      </span>
                    </button>
                    <RouterLink
                      v-if="action.path"
                      :to="action.path"
                      class="btn btn-soft btn-sm shrink-0"
                      :aria-label="t('dailyReading.actions.open')"
                    >
                      <AppIcon name="book-open" :size="14" />
                      <span class="hidden sm:inline">{{ t("dailyReading.actions.open") }}</span>
                    </RouterLink>
                  </li>
                </ul>
              </section>

              <!-- Les objectifs personnels de chaque jour, cochés de la même façon -->
              <section v-if="dailyGoals.length">
                <h2 class="text-xs font-semibold text-primary mb-3">
                  {{ t("dailyReading.goals.title") }}
                </h2>
                <ul class="space-y-2">
                  <li
                    v-for="goal in dailyGoals"
                    :key="goal.id"
                    class="card p-3"
                    :class="completedActions.has(goal.id) ? 'opacity-60' : ''"
                  >
                    <button
                      @click="toggleActionCompleted(goal.id)"
                      class="flex w-full items-center gap-3 text-left"
                      :aria-pressed="completedActions.has(goal.id)"
                    >
                      <AppIcon
                        v-if="completedActions.has(goal.id)"
                        name="circle-check"
                        :size="20"
                        class="shrink-0 text-green-500"
                      />
                      <span
                        v-else
                        class="w-5 h-5 rounded-full border-2 border-text-secondary/50 shrink-0"
                      ></span>
                      <span class="min-w-0">
                        <span class="block font-medium text-text-primary">{{ goal.label }}</span>
                        <span
                          v-if="completedActions.has(goal.id)"
                          class="block text-xs text-text-secondary"
                        >
                          {{ t("dailyReading.actions.doneToday") }}
                        </span>
                      </span>
                    </button>
                  </li>
                </ul>
              </section>

              <!-- Les objectifs à fréquence : « 2 sur 3 cette semaine », hors
                   du décompte du jour -->
              <section v-if="weeklyGoals.length">
                <h2 class="text-xs font-semibold text-primary mb-3">
                  {{ t("dailyReading.goals.weeklyTitle") }}
                </h2>
                <ul class="space-y-2">
                  <li
                    v-for="goal in weeklyGoals"
                    :key="goal.id"
                    class="card p-3"
                    :class="completedActions.has(goal.id) ? 'opacity-60' : ''"
                  >
                    <button
                      @click="toggleActionCompleted(goal.id)"
                      class="flex w-full items-center gap-3 text-left"
                      :aria-pressed="completedActions.has(goal.id)"
                    >
                      <AppIcon
                        v-if="completedActions.has(goal.id)"
                        name="circle-check"
                        :size="20"
                        class="shrink-0 text-green-500"
                      />
                      <span
                        v-else
                        class="w-5 h-5 rounded-full border-2 border-text-secondary/50 shrink-0"
                      ></span>
                      <span class="min-w-0 flex-1">
                        <span class="block font-medium text-text-primary">{{ goal.label }}</span>
                        <span class="block text-xs text-text-secondary">
                          {{
                            t("dailyReading.goals.weeklyProgress", {
                              done: weeklyDone(goal),
                              total: goal.perWeek,
                            })
                          }}
                        </span>
                      </span>
                      <span class="flex gap-1" aria-hidden="true">
                        <span
                          v-for="i in goal.perWeek ?? 0"
                          :key="i"
                          class="h-2 w-2 rounded-full"
                          :class="
                            i <= weeklyDone(goal) ? 'bg-primary' : 'bg-black/10 dark:bg-white/15'
                          "
                        ></span>
                      </span>
                    </button>
                  </li>
                </ul>
              </section>
            </div>
          </template>
        </template>
      </template>
    </template>

    <!-- Comme les autres textes de la bibliothèque : le menu de lecture et la
         progression au bas de l'écran. Seulement devant les textes : en mode
         « gérer » et pendant le chargement, ils masquaient le bouton de
         remontée sans rien offrir à la place. -->
    <template v-if="!loading && mode === 'reading'">
      <ReadingMenu :share-title="t('dailyReading.title')" />
      <ReadingProgressBar />
    </template>

    <!-- La fête de la journée réussie, une fois par jour -->
    <DailyCelebration
      :open="celebration !== null"
      :status="streakInfo"
      :milestone="celebration?.milestone ?? null"
      :siyoum="celebration?.siyoum ?? null"
      :freeze-earned="celebration?.freezeEarned ?? false"
      @close="celebration = null"
      @share="shareStreak"
    />
  </div>
</template>
