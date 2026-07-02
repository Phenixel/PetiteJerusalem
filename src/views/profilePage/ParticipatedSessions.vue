<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import { appendHebrewNumeral, formatNumberWithHebrew } from "../../services/hebrewNumerals";
import type { Session, TextStudy } from "../../models/models";
import type { User } from "../../services/authService";
import { useToast } from "../../composables/useToast";
import AppIcon from "../../components/icons/AppIcon.vue";

const router = useRouter();
const { t } = useI18n();
const toast = useToast();

const props = defineProps<{
  sessions: Session[];
  currentUser: User | null;
  textStudiesMap: Map<string, TextStudy>;
}>();

const isSessionFinished = (session: Session): boolean => {
  if (session.isEnded) return true;
  const limit = new Date(session.dateLimit);
  limit.setHours(23, 59, 59, 999);
  return new Date() > limit;
};

const ongoingParticipatedSessions = computed(() =>
  props.sessions.filter((s) => !isSessionFinished(s)),
);
const finishedParticipatedSessions = computed(() =>
  props.sessions.filter((s) => isSessionFinished(s)),
);

const getUserReservationsForSession = (session: Session) => {
  if (!props.currentUser) return [];
  return (
    session.reservations?.filter(
      (reservation) =>
        reservation.chosenById === props.currentUser?.id ||
        reservation.chosenByGuestId === props.currentUser?.email,
    ) || []
  );
};

const getTextStudyName = (textStudyId: string): string => {
  const textStudy = props.textStudiesMap.get(textStudyId);
  return textStudy ? appendHebrewNumeral(textStudy.name) : textStudyId;
};

const toggleReservationCompletion = async (
  sessionId: string,
  reservationId: string,
  isCompleted: boolean,
) => {
  try {
    await sessionService.markReservationAsCompleted(sessionId, reservationId, isCompleted);

    const session = props.sessions.find((s) => s.id === sessionId);
    if (session) {
      const reservation = session.reservations?.find((r) => r.id === reservationId);
      if (reservation) {
        reservation.isCompleted = isCompleted;
      }
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la réservation:", error);
    toast.errorFromException(error, t("profile.reservationUpdateError"));
  }
};

const goToSession = (slugOrId: string) => {
  router.push({ name: "detail-session", params: { slug: slugOrId } });
};
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-2xl font-bold text-text-primary">
        {{ t("profile.participatedSessions") }}
      </h2>
    </div>

    <div
      v-if="sessions.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <AppIcon name="calendar-x" :size="32" class="text-text-secondary/40 mb-4" />
      <h3 class="text-xl font-semibold text-text-primary mb-2">
        {{ t("profile.noParticipatedSessions") }}
      </h3>
      <p class="text-text-secondary">
        {{ t("profile.noParticipatedSessionsDesc") }}
      </p>
    </div>

    <div v-else>
      <div v-if="ongoingParticipatedSessions.length > 0" class="mb-12">
        <h3 class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <AppIcon name="hourglass" :size="15" class="text-primary" /> {{ t("common.ongoing") }}
        </h3>

        <div class="grid gap-6">
          <div v-for="session in ongoingParticipatedSessions" :key="session.id" class="card p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
              <div>
                <h3 class="text-xl font-bold text-text-primary mb-1">
                  {{ session.name }}
                </h3>
                <p class="text-text-secondary text-sm">
                  {{ session.description }}
                </p>
              </div>
              <button
                @click="goToSession(session.slug || session.id)"
                class="btn btn-soft whitespace-nowrap"
              >
                <AppIcon name="external-link" :size="14" />
                {{ t("profile.viewSession") }}
              </button>
            </div>

            <div class="flex flex-wrap gap-2 mb-6">
              <span class="chip bg-primary/10 text-primary">{{
                sessionService.formatTextType(session.type)
              }}</span>
              <span class="chip bg-black/5 text-text-secondary dark:bg-white/10"
                >{{ t("common.dateLimit") }} :
                {{ sessionService.formatDate(session.dateLimit) }}</span
              >
            </div>

            <div>
              <h4 class="text-sm font-semibold text-text-secondary mb-3">
                {{ t("profile.myReservations") }}
              </h4>
              <div
                v-if="getUserReservationsForSession(session).length === 0"
                class="text-sm text-text-secondary italic"
              >
                {{ t("profile.noReservationFound") }}
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="reservation in getUserReservationsForSession(session)"
                  :key="reservation.id"
                  class="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
                  :class="
                    reservation.isCompleted
                      ? 'bg-green-600/5 dark:bg-green-500/10'
                      : 'bg-black/[0.03] dark:bg-white/5'
                  "
                >
                  <div class="flex flex-col">
                    <span class="font-medium text-text-primary">
                      {{ getTextStudyName(reservation.textStudyId) }}
                      <span v-if="reservation.section" class="text-text-secondary font-normal">
                        - {{ t("common.chapter") }}
                        {{ formatNumberWithHebrew(reservation.section) }}
                      </span>
                    </span>
                    <span
                      v-if="reservation.isCompleted"
                      class="text-xs text-green-600 dark:text-green-400 font-semibold mt-1 flex items-center gap-1"
                    >
                      <AppIcon name="circle-check" :size="12" /> {{ t("common.finished") }}
                    </span>
                  </div>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      class="w-5 h-5 rounded accent-primary cursor-pointer"
                      :checked="reservation.isCompleted"
                      @change="
                        toggleReservationCompletion(
                          session.id,
                          reservation.id,
                          ($event.target as HTMLInputElement).checked,
                        )
                      "
                    />
                    <span class="text-xs font-medium text-text-secondary">{{
                      t("common.read")
                    }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="finishedParticipatedSessions.length > 0" class="opacity-80">
        <h3 class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <AppIcon name="check-double" :size="15" class="text-green-600 dark:text-green-400" />
          {{ t("common.finished") }}
        </h3>

        <div class="grid gap-6">
          <div v-for="session in finishedParticipatedSessions" :key="session.id" class="card p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 class="text-xl font-bold text-text-primary mb-2">
                  {{ session.name }}
                </h3>
                <span class="chip bg-black/5 text-text-secondary dark:bg-white/10">
                  <AppIcon name="flag" :size="12" /> {{ t("common.finished") }}
                </span>
              </div>
              <button
                @click="goToSession(session.slug || session.id)"
                class="btn btn-soft whitespace-nowrap"
              >
                <AppIcon name="eye" :size="14" />
                {{ t("common.view") }}
              </button>
            </div>

            <div class="text-sm text-text-secondary">
              {{
                t("profile.reservationsCount", {
                  count: getUserReservationsForSession(session).length,
                })
              }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
