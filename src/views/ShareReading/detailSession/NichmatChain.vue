<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { Session, TextStudiesJson, TextStudyReservation } from "../../../models/models";
import type { User } from "../../../services/authService";
import { reservationService, ReservationGoneError } from "../../../services/reservationService";
import { SlotTakenError } from "../../../services/appError";
import { DateService, localDayFrom, localDayKey } from "../../../services/dateService";
import {
  NICHMAT_DAYS,
  NICHMAT_PLACES,
  NICHMAT_TEXT_ID,
  dayRecordOf,
  dayRecordTextId,
  isPlaceRecord,
  lastTickableDay,
  phaseOf,
  progressOf,
} from "../../../services/nichmatChain";
import { analyticsService } from "../../../services/analyticsService";
import { haptic } from "../../../services/haptics";
import { isOffline } from "../../../services/userPreferencesService";
import { useToast } from "../../../composables/useToast";
import { useConfirm } from "../../../composables/useConfirm";
import { hubPath } from "../../../content/etudeTexts";
import textStudiesJson from "../../../datas/textStudies.json";
import GuestIdentityModal from "../../../components/GuestIdentityModal.vue";
import ProgressBar from "../../../components/ProgressBar.vue";
import AppIcon from "../../../components/icons/AppIcon.vue";

/**
 * A Nichmat 40 chain (docs/nichmat-40-jours.md): where the forty days
 * stand, the reader's own place with its days to tick, and who holds the
 * others. It takes the place of the list of texts of an ordinary chain.
 */
const props = defineProps<{
  session: Session;
  currentUser: User | null;
  guestEmailRequired: boolean;
}>();

const emit = defineEmits<{
  /** The reservations as they now stand, for the page to keep. */
  (e: "changed", reservations: TextStudyReservation[]): void;
  /** A guest took a place: the page offers to create an account. */
  (e: "guest-reserved", email: string): void;
}>();

const { t } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();

const today = localDayKey();
const phase = computed(() => phaseOf(props.session, today));
const progress = computed(() => progressOf(props.session, today));
const tickableUntil = computed(() => lastTickableDay(phase.value));

const nichmatEntry = (textStudiesJson as TextStudiesJson).textStudies.find(
  (entry) => String(entry.id) === NICHMAT_TEXT_ID,
);
const readPath = nichmatEntry ? hubPath(nichmatEntry) : "/sidour";

const formatDay = (day: string): string => DateService.formatDate(localDayFrom(day) ?? new Date());

/** The reader's place, if they hold one (account, or guest on this device). */
const myPlace = computed(
  () =>
    progress.value.places.find((p) =>
      reservationService.isOwnReservation(p.reservation, props.currentUser),
    ) ?? null,
);

const freePlaces = computed(() => NICHMAT_PLACES - progress.value.places.length);
const canTakePlace = computed(
  () => !myPlace.value && freePlaces.value > 0 && phase.value.kind !== "done",
);

const statusTitle = computed(() => {
  const current = phase.value;
  switch (current.kind) {
    case "waiting":
      return t("nichmat.phase.waiting");
    case "upcoming":
      return t("nichmat.phase.upcoming", { date: formatDay(current.start) });
    case "running":
      return t("nichmat.phase.running", { day: current.day, total: NICHMAT_DAYS });
    default:
      return t("nichmat.phase.done");
  }
});

const statusLine = computed(() => {
  const current = phase.value;
  if (current.kind === "waiting") return t("nichmat.phase.waitingText");
  return t("nichmat.dates", { start: formatDay(current.start), end: formatDay(current.end) });
});

/** Places taken while the chain fills; readings ticked once it runs. */
const bar = computed(() => {
  const { places, reads, due } = progress.value;
  if (phase.value.kind === "waiting" || phase.value.kind === "upcoming" || due === 0) {
    const value = Math.round((places.length / NICHMAT_PLACES) * 100);
    return {
      value,
      label: t("nichmat.placesTaken", { taken: places.length, total: NICHMAT_PLACES }),
    };
  }
  const value = Math.min(100, Math.round((reads / due) * 100));
  return { value, label: t("nichmat.readsDone", { reads, due }) };
});

// ---------- Taking a place ----------

const reservationForm = ref({ name: "", email: "" });
const showGuestIdentity = ref(false);
const isTaking = ref(false);

const takePlace = () => {
  analyticsService.capture("nichmat_place_take_clicked", {
    session_id: props.session.id,
    is_guest: props.currentUser == null,
  });
  if (isOffline()) {
    toast.error(t("nichmat.offline"));
    return;
  }
  if (!props.currentUser) {
    showGuestIdentity.value = true;
    return;
  }
  void reservePlace();
};

const submitGuestIdentity = async (identity: { name: string; email: string }) => {
  reservationForm.value = { ...identity };
  await reservePlace();
  showGuestIdentity.value = false;
};

/**
 * The first free place, as this page sees it; taken in the meantime, the
 * next one. The transaction settles who gets which.
 */
const reservePlace = async () => {
  isTaking.value = true;
  const taken = new Set(progress.value.places.map((p) => p.place));
  try {
    for (let place = 1; place <= NICHMAT_PLACES; place++) {
      if (taken.has(place)) continue;
      try {
        const id = await reservationService.createReservationForUser(
          props.session.id,
          NICHMAT_TEXT_ID,
          place,
          props.currentUser,
          reservationForm.value,
          props.guestEmailRequired,
        );
        const reservation = reservationService.createLocalReservation(
          id,
          NICHMAT_TEXT_ID,
          place,
          props.currentUser,
          reservationForm.value,
        );
        emit("changed", [...props.session.reservations, reservation]);
        haptic("done");
        analyticsService.capture("nichmat_place_taken", {
          session_id: props.session.id,
          place,
          places_taken: taken.size + 1,
          is_guest: props.currentUser == null,
        });
        toast.success(t("nichmat.placeTaken", { place }));
        if (!props.currentUser) emit("guest-reserved", reservationForm.value.email);
        return;
      } catch (error) {
        if (!(error instanceof SlotTakenError)) throw error;
        taken.add(place);
      }
    }
    toast.error(t("nichmat.full"));
  } catch (error) {
    analyticsService.capture("nichmat_place_take_failed", {
      session_id: props.session.id,
      error_message: error instanceof Error ? error.message : String(error),
      is_guest: props.currentUser == null,
    });
    toast.errorFromException(error, t("detailSession.reservationError"));
  } finally {
    isTaking.value = false;
  }
};

// ---------- Leaving a place ----------

/** A place whose days have begun to be ticked stays: only the creator frees it. */
const canLeave = computed(() => myPlace.value !== null && myPlace.value.read.size === 0);

const leavePlace = async () => {
  const mine = myPlace.value;
  if (!mine) return;
  const accepted = await confirm({ title: t("nichmat.leaveConfirm"), danger: true });
  if (!accepted) return;
  try {
    await reservationService.deleteReservation(props.session.id, mine.reservation.id);
    emit(
      "changed",
      props.session.reservations.filter((r) => r.id !== mine.reservation.id),
    );
    analyticsService.capture("nichmat_place_released", {
      session_id: props.session.id,
      is_guest: props.currentUser == null,
    });
  } catch (error) {
    toast.errorFromException(error, t("detailSession.cancelError"));
  }
};

// ---------- Ticking the days ----------

const pendingDays = ref(new Set<number>());

const isRead = (day: number) => myPlace.value?.read.has(day) ?? false;

const toggleDay = async (day: number) => {
  const mine = myPlace.value;
  if (!mine || day > tickableUntil.value || pendingDays.value.has(day)) return;
  const read = !isRead(day);
  const before = props.session.reservations;

  // Optimistic: the day changes at once, and comes back if the write fails.
  const others = before.filter(
    (r) => !(r.textStudyId === dayRecordTextId(day) && r.section === mine.place),
  );
  const existing = dayRecordOf(props.session, mine.place, day);
  emit(
    "changed",
    read
      ? [
          ...others,
          {
            id: existing?.id ?? `pending-${day}`,
            textStudyId: dayRecordTextId(day),
            section: mine.place,
            isCompleted: true,
            createdAt: new Date(),
          },
        ]
      : others,
  );
  haptic(read ? "done" : "undo");
  pendingDays.value = new Set([...pendingDays.value, day]);

  try {
    await reservationService.setNichmatDayRead(props.session.id, mine.place, day, read);
    analyticsService.capture("nichmat_day_marked", {
      session_id: props.session.id,
      day,
      marked: read,
      is_today: phase.value.kind === "running" && phase.value.day === day,
      is_guest: props.currentUser == null,
      source: "session_page",
    });
  } catch (error) {
    emit("changed", before);
    analyticsService.capture("nichmat_day_mark_failed", {
      session_id: props.session.id,
      day,
      error_message: error instanceof Error ? error.message : String(error),
      is_guest: props.currentUser == null,
      source: "session_page",
    });
    if (error instanceof ReservationGoneError) {
      emit(
        "changed",
        before.filter((r) => !(isPlaceRecord(r) && r.section === mine.place)),
      );
    }
    toast.errorFromException(error, t("detailSession.updateError"));
  } finally {
    const next = new Set(pendingDays.value);
    next.delete(day);
    pendingDays.value = next;
  }
};

const todayRead = computed(() =>
  phase.value.kind === "running" ? isRead(phase.value.day) : false,
);

const trackTextOpened = () => {
  analyticsService.capture("nichmat_text_opened", { session_id: props.session.id });
};

const days = Array.from({ length: NICHMAT_DAYS }, (_, i) => i + 1);

const readerName = (reservation: TextStudyReservation): string =>
  reservation.chosenByName || t("nichmat.someone");
</script>

<template>
  <div class="max-w-3xl mx-auto w-full flex flex-col gap-6 mb-8">
    <!-- Where the forty days stand -->
    <section class="card p-5 md:p-6 flex flex-col gap-4" :aria-label="t('nichmat.statusLabel')">
      <div class="flex flex-col gap-1">
        <h2 class="text-lg md:text-xl font-bold text-text-primary">{{ statusTitle }}</h2>
        <p class="text-sm leading-relaxed text-text-secondary">{{ statusLine }}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <ProgressBar
          :value="bar.value"
          :tone="bar.value >= 100 ? 'success' : 'primary'"
          size="sm"
          :label="bar.label"
        />
        <p class="text-xs font-medium text-text-secondary">{{ bar.label }}</p>
      </div>
    </section>

    <!-- The reader's place: today's reading, then the forty days -->
    <section v-if="myPlace" class="card p-5 md:p-6 flex flex-col gap-5">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col gap-1 min-w-0">
          <h2 class="text-lg font-bold text-text-primary">
            {{ t("nichmat.myPlace", { place: myPlace.place }) }}
          </h2>
          <p class="text-sm text-text-secondary">
            {{
              t(
                "nichmat.myReads",
                { count: myPlace.read.size, total: NICHMAT_DAYS },
                myPlace.read.size,
              )
            }}
          </p>
        </div>
        <RouterLink
          :to="readPath"
          class="btn btn-soft !px-3.5 !py-1.5 !text-sm shrink-0"
          @click="trackTextOpened"
        >
          <AppIcon name="book-open" :size="14" />
          {{ t("nichmat.readText") }}
        </RouterLink>
      </div>

      <button
        v-if="phase.kind === 'running'"
        type="button"
        class="btn w-full"
        :class="todayRead ? 'btn-soft' : 'btn-primary'"
        :aria-pressed="todayRead"
        :disabled="pendingDays.has(phase.day)"
        @click="toggleDay(phase.kind === 'running' ? phase.day : 0)"
      >
        <AppIcon :name="todayRead ? 'circle-check' : 'check'" :size="16" />
        {{ todayRead ? t("nichmat.readTodayDone") : t("nichmat.readToday") }}
      </button>
      <p v-else-if="phase.kind !== 'done'" class="text-sm text-text-secondary">
        {{ t("nichmat.notStarted") }}
      </p>

      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-semibold text-text-secondary">{{ t("nichmat.myDays") }}</h3>
        <ol class="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          <li v-for="day in days" :key="day" class="flex justify-center">
            <button
              type="button"
              class="w-8 h-8 rounded-full text-xs font-semibold tabular-nums transition-colors disabled:cursor-default"
              :class="
                isRead(day)
                  ? 'bg-brand text-on-brand'
                  : day <= tickableUntil
                    ? 'bg-black/5 text-text-primary hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20'
                    : 'bg-black/[0.03] text-text-secondary/50 dark:bg-white/5'
              "
              :aria-pressed="isRead(day)"
              :aria-label="t('nichmat.dayLabel', { day })"
              :disabled="day > tickableUntil || pendingDays.has(day)"
              @click="toggleDay(day)"
            >
              {{ day }}
            </button>
          </li>
        </ol>
      </div>

      <button
        v-if="canLeave"
        type="button"
        class="self-start text-sm font-medium text-text-secondary hover:text-red-600 transition-colors"
        @click="leavePlace"
      >
        {{ t("nichmat.leave") }}
      </button>
    </section>

    <!-- Taking a place -->
    <section v-else-if="canTakePlace" class="card p-5 md:p-6 flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-bold text-text-primary">{{ t("nichmat.takeTitle") }}</h2>
        <p class="text-sm leading-relaxed text-text-secondary">
          {{ t("nichmat.takeText", { count: freePlaces }, freePlaces) }}
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary w-full sm:w-auto sm:self-start"
        :disabled="isTaking"
        @click="takePlace"
      >
        <AppIcon v-if="isTaking" name="spinner" :size="15" class="animate-spin" />
        <AppIcon v-else name="plus" :size="16" />
        {{ t("nichmat.take") }}
      </button>
    </section>
    <p
      v-else-if="!myPlace && freePlaces === 0"
      class="text-center text-sm font-medium text-text-secondary"
    >
      {{ t("nichmat.full") }}
    </p>

    <!-- Who reads -->
    <section v-if="progress.places.length > 0" class="card p-5 md:p-6 flex flex-col gap-3">
      <h2 class="text-lg font-bold text-text-primary">
        {{ t("nichmat.readers", { taken: progress.places.length, total: NICHMAT_PLACES }) }}
      </h2>
      <ol class="divide-y divide-line">
        <li
          v-for="entry in progress.places"
          :key="entry.place"
          class="flex items-center gap-3 py-2"
        >
          <span class="w-6 shrink-0 text-xs font-semibold text-text-secondary tabular-nums">
            {{ entry.place }}
          </span>
          <span class="flex-1 min-w-0 truncate text-sm font-medium text-text-primary">
            {{ readerName(entry.reservation) }}
          </span>
          <span
            v-if="phase.kind === 'running' || phase.kind === 'done'"
            class="shrink-0 text-xs font-semibold tabular-nums"
            :class="
              entry.read.size >= tickableUntil
                ? 'text-green-600 dark:text-green-400'
                : 'text-text-secondary'
            "
          >
            {{ t("nichmat.readerReads", { read: entry.read.size, due: tickableUntil }) }}
          </span>
        </li>
      </ol>
      <p v-if="freePlaces > 0" class="text-sm text-text-secondary">
        {{ t("nichmat.freePlaces", { count: freePlaces }, freePlaces) }}
      </p>
    </section>

    <GuestIdentityModal
      v-model:show="showGuestIdentity"
      :email-required="guestEmailRequired"
      :count="1"
      :name="reservationForm.name"
      :email="reservationForm.email"
      :loading="isTaking"
      :message="t('nichmat.guestMessage')"
      @confirm="submitGuestIdentity"
    />
  </div>
</template>
