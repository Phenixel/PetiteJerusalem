<script setup lang="ts">
/**
 * Mon parcours sur l'accueil (P2-Accueil) : le paquet du jour, replié en
 * pile ou étalé en portefeuille, la barre de la journée dessous, et la fiche
 * d'une carte. Sans objectif encore, l'invitation à en prendre un. Dans
 * l'app, avec ou sans compte ; sur le site, pour un compte.
 *
 * It tells the home page whether it has begun: the Sidour shortcut and the
 * banners of the moon and the 'Omer then fall silent, their cards take their
 * place in the stack (the service whose time it is too, with or without the
 * « trois tefilot » habit).
 *
 * Chargé à la demande (voir HomeView) : il tire le calendrier hébraïque.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../../composables/useParcours";
import { useSwipeHint } from "../../../composables/useSwipeHint";
import { useTodayDeck, type DeckCard } from "../../../composables/useTodayDeck";
import { analyticsService } from "../../../services/analyticsService";
import { haptic, type HapticKind } from "../../../services/haptics";
import { liveObjectives } from "../../../services/parcours/schedule";
import { trackDayViewed } from "../../../services/parcours/tracking";
import LightCelebration from "../LightCelebration.vue";
import TaskDeck from "./TaskDeck.vue";
import TaskSheet from "./TaskSheet.vue";

const emit = defineEmits<{
  (e: "begun", begun: boolean): void;
}>();

const { t } = useI18n();
const store = useParcours();
const deck = useTodayDeck();

const begun = computed(() => liveObjectives(store.data.value).length > 0);
const open = ref(false);

// The swipe shown, rarely, to whoever stays on the home page without a
// gesture: on the folded stack, a top card that can be swiped, outside the
// home page's edit mode (where the deck is inert).
const root = ref<HTMLElement | null>(null);
const { hinting } = useSwipeHint(() => {
  const top = deck.top.value;
  return begun.value && !open.value && !!top && !top.waiting && !root.value?.closest("[inert]");
});

watch(begun, (value) => emit("begun", value), { immediate: true });

/** La carte d'une pile vide : la journée pleine, et ce que devient la lampe. */
const rest = computed(() => {
  const kicker = t(`parcours.kicker.${deck.moment.value}`);
  if (deck.count.value.total === 0) {
    return { kicker, title: t("parcours.hub.nothing"), meta: "" };
  }
  return {
    kicker,
    title: t("parcours.hub.full"),
    meta: t("parcours.hub.fullMeta", { n: store.streak.value.current }),
  };
});

/** Une occasion faite ou défaite : l'appareil s'en souvient, le suivi le note. */
function markOccasion(card: DeckCard, done: boolean, source: string): void {
  if (!card.occasion) return;
  deck.markOccasion(card, done);
  analyticsService.capture("parcours_occasion_marked", {
    occasion: card.occasion.kind,
    done,
    source,
  });
}

function done(card: DeckCard, source: string): void {
  if (card.group) {
    // La lecture du jour, cochée en entier.
    for (const view of card.group) {
      if (view.progress !== "done") store.setDone(view.task, store.today.value, true, source);
    }
  } else if (card.view) {
    store.setDone(card.view.task, store.today.value, true, source);
  } else if (card.occasion) {
    markOccasion(card, true, source);
  } else if (card.catchUp) {
    // « Rattraper », c'est fait : le retard est lu, ailleurs ou d'un coup.
    const program = card.catchUp;
    const behind = store.context.value.plans.get(program.id)?.state(store.today.value).behind ?? 0;
    store.catchUp(program, "done", false);
    analyticsService.capture("parcours_caught_up", {
      option: "done",
      behind,
      remember: false,
      source,
    });
  }
}

function undo(card: DeckCard, source: string): void {
  if (card.group) {
    for (const view of card.group) {
      if (view.skipped) store.setSkipped(view.task, store.today.value, false, source);
      else if (view.progress === "done") store.setDone(view.task, store.today.value, false, source);
    }
  } else if (card.view) {
    if (card.skipped) store.setSkipped(card.view.task, store.today.value, false, source);
    else store.setDone(card.view.task, store.today.value, false, source);
  } else if (card.occasion && card.done) {
    markOccasion(card, false, source);
  } else {
    // Une carte en plus mise de côté pour aujourd'hui revient.
    deck.setAside(card, false);
  }
}

function later(card: DeckCard, source: string): void {
  deck.postpone(card);
  analyticsService.capture("parcours_task_postponed", { kind: kindOf(card), source });
}

function skip(card: DeckCard, skipped: boolean): void {
  if (card.group) {
    for (const view of card.group)
      store.setSkipped(view.task, store.today.value, skipped, "home_sheet");
  } else if (card.view) store.setSkipped(card.view.task, store.today.value, skipped, "home_sheet");
  else deck.setAside(card, skipped);
}

const kindOf = (card: DeckCard): string =>
  card.view ? card.view.task.kind : card.occasion ? "occasion" : "catch_up";

function unfold(source: string): void {
  open.value = true;
  analyticsService.capture("parcours_wallet_opened", { source });
  // La journée entière, sous les yeux : ce que disait l'arrivée sur la
  // lecture du jour, puis sur Ma journée (retirée).
  trackDayViewed(store.data.value, store.context.value, store.today.value);
}

/**
 * Une carte touchée ouvre sa page : ce que l'accueil fait ouvrir. La lune et
 * le 'Omer gardent l'événement de leur ancien bandeau.
 */
function opened(card: DeckCard): void {
  analyticsService.capture("home_card_clicked", {
    card: "parcours_task",
    variant: store.signedIn.value ? "dashboard" : "landing",
    kind: kindOf(card),
  });
  if (card.occasion?.kind === "halevana") {
    analyticsService.capture("birkat_halevana_opened", { source: "home" });
  } else if (card.occasion?.kind === "omer") {
    analyticsService.capture("omer_opened", { source: "home", day: card.occasion.n });
  }
}

// La fiche : retrouvée par sa clé, elle suit ce qu'on y change.
const sheetKey = ref<string | null>(null);
const sheet = computed<DeckCard | null>(
  () => deck.day.value.find((card) => card.key === sheetKey.value) ?? null,
);

/** Un bouton de la fiche : elle se referme, le geste agit, et se sent au doigt. */
function fromSheet(action: (card: DeckCard) => void, feel: HapticKind): void {
  const card = sheet.value;
  sheetKey.value = null;
  if (!card) return;
  haptic(feel);
  action(card);
}
</script>

<template>
  <section ref="root" :aria-label="t('parcours.hub.deck')">
    <!-- Rien encore : le parcours commence par un objectif. -->
    <div v-if="!begun" class="card mt-[34px] px-5 py-5">
      <p class="font-display text-2xl font-bold leading-tight">{{ t("parcours.empty.title") }}</p>
      <p class="mt-1 text-sm text-text-secondary">{{ t("parcours.empty.text") }}</p>
      <RouterLink to="/parcours/nouveau" class="btn btn-primary mt-4">
        {{ t("parcours.empty.cta") }}
      </RouterLink>
    </div>

    <TaskDeck
      v-else
      :day="deck.day.value"
      :pending="deck.pending.value"
      :count="deck.count.value"
      :open="open"
      :is-later="deck.isLater"
      :rest="rest"
      :hint="hinting"
      @done="done"
      @undo="undo"
      @later="later"
      @sheet="(card) => (sheetKey = card.key)"
      @opened="opened"
      @unfold="unfold"
      @fold="open = false"
    />

    <TaskSheet
      :card="sheet"
      @close="sheetKey = null"
      @done="fromSheet((card) => done(card, 'home_sheet'), 'done')"
      @undo="fromSheet((card) => undo(card, 'home_sheet'), 'undo')"
      @later="fromSheet((card) => later(card, 'sheet'), 'undo')"
      @skip="(skipped) => fromSheet((card) => skip(card, skipped), 'undo')"
      @opened="sheet && opened(sheet)"
    />

    <!-- La série franchit un palier : une nouvelle lumière. -->
    <LightCelebration v-if="begun" />
  </section>
</template>
