<script setup lang="ts">
/**
 * Mon parcours sur l'accueil : le paquet du jour, ou, tiré vers le bas, le
 * portefeuille de la journée ; la barre de la journée dessous. Sans objectif
 * encore, l'invitation à en prendre un. Dans l'app, avec ou sans compte ; sur
 * le site, pour un compte.
 *
 * Il dit à l'accueil s'il porte les offices (l'habitude des trois tefilot) :
 * le raccourci du Sidour se tait alors, la carte de l'office est dans le
 * paquet.
 *
 * Chargé à la demande (voir HomeView) : il tire le calendrier hébraïque.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../../composables/useParcours";
import type { TaskView } from "../../../composables/useParcoursViews";
import { useTodayDeck } from "../../../composables/useTodayDeck";
import { analyticsService } from "../../../services/analyticsService";
import { liveObjectives } from "../../../services/parcours/schedule";
import DayBar from "./DayBar.vue";
import TaskDeck from "./TaskDeck.vue";
import TaskSheet from "./TaskSheet.vue";
import TaskWallet from "./TaskWallet.vue";

const emit = defineEmits<{ (e: "offices", covered: boolean): void }>();

const { t } = useI18n();
const store = useParcours();
const deck = useTodayDeck();

const begun = computed(() => liveObjectives(store.data.value).length > 0);
const current = computed(() => deck.top.value?.key ?? null);
const walletOpen = ref(false);

watch(deck.coversOffices, (covered) => emit("offices", covered), { immediate: true });

function mark(view: TaskView, done: boolean, source: string): void {
  store.setDone(view.task, store.today.value, done, source);
}

function postpone(view: TaskView, source: string): void {
  deck.postpone(view);
  analyticsService.capture("parcours_task_postponed", { kind: view.task.kind, source });
}

function openWallet(source: string): void {
  walletOpen.value = true;
  analyticsService.capture("parcours_wallet_opened", { source });
}

/** Une carte touchée ouvre sa page : ce que l'accueil fait ouvrir. */
function opened(view: TaskView): void {
  analyticsService.capture("home_card_clicked", {
    card: "parcours_task",
    variant: store.signedIn.value ? "dashboard" : "landing",
    kind: view.task.kind,
  });
}

// La fiche : retrouvée par sa clé, elle suit ce qu'on y change.
const sheetKey = ref<string | null>(null);
const sheet = computed<TaskView | null>(() => {
  const key = sheetKey.value;
  if (!key) return null;
  return deck.top.value?.key === key
    ? deck.top.value
    : (deck.all.value.find((view) => view.key === key) ?? null);
});
const canPostpone = computed(
  () => !walletOpen.value && sheet.value !== null && sheet.value.progress !== "done",
);

function fromSheet(action: (view: TaskView) => void): void {
  const view = sheet.value;
  sheetKey.value = null;
  if (view) action(view);
}

function onTopDone(source: string): void {
  if (deck.top.value) mark(deck.top.value, true, source);
}
function onTopLater(source: string): void {
  if (deck.top.value) postpone(deck.top.value, source);
}
</script>

<template>
  <section :aria-label="t('parcours.hub.deck')">
    <!-- Rien encore : le parcours commence par un objectif. -->
    <div v-if="!begun" class="card px-5 py-5">
      <p class="font-display text-2xl font-bold leading-tight">{{ t("parcours.empty.title") }}</p>
      <p class="mt-1 text-sm text-text-secondary">{{ t("parcours.empty.text") }}</p>
      <RouterLink to="/parcours/nouveau" class="btn btn-primary mt-4">
        {{ t("parcours.empty.cta") }}
      </RouterLink>
    </div>

    <template v-else>
      <TaskWallet
        v-if="walletOpen"
        :views="deck.day.value"
        :current="current"
        @toggle="mark"
        @sheet="(view) => (sheetKey = view.key)"
        @opened="opened"
        @fold="walletOpen = false"
      />
      <TaskDeck
        v-else
        :top="deck.top.value"
        :has-tasks="deck.all.value.length > 0"
        @done="onTopDone"
        @later="onTopLater"
        @wallet="openWallet"
        @sheet="sheetKey = current"
        @opened="deck.top.value && opened(deck.top.value)"
      />
      <DayBar class="mt-3" :views="deck.day.value" :current="current" />
    </template>

    <TaskSheet
      :view="sheet"
      :can-postpone="canPostpone"
      @close="sheetKey = null"
      @done="(done) => fromSheet((view) => mark(view, done, 'home_sheet'))"
      @later="fromSheet((view) => postpone(view, 'sheet'))"
      @skip="
        (skipped) =>
          fromSheet((view) => store.setSkipped(view.task, store.today.value, skipped, 'home_sheet'))
      "
    />
  </section>
</template>
