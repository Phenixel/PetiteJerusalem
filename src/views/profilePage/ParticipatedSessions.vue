<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import type { Session, TextStudy } from "../../models/models";
import type { User } from "../../services/authService";

const router = useRouter();
const { t } = useI18n();

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
      (reservation) => reservation.chosenById === props.currentUser?.id,
    ) || []
  );
};

const getTextStudyName = (textStudyId: string): string => {
  const textStudy = props.textStudiesMap.get(textStudyId);
  return textStudy ? textStudy.name : textStudyId;
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
    alert(t("profile.reservationUpdateError"));
  }
};

const goToSession = (sessionId: string) => {
  router.push({ name: "detail-session", params: { id: sessionId } });
};
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100">
        {{ t("profile.participatedSessions") }}
      </h2>
    </div>

    <div
      v-if="sessions.length === 0"
      class="flex flex-col items-center justify-center p-12 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/40 text-center dark:bg-gray-800/40 dark:border-gray-700"
    >
      <div
        class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400 text-2xl dark:bg-gray-700 dark:text-gray-500"
      >
        <i class="fa-solid fa-calendar-xmark"></i>
      </div>
      <h3 class="text-xl font-semibold text-text-primary mb-2 dark:text-gray-200">
        {{ t("profile.noParticipatedSessions") }}
      </h3>
      <p class="text-text-secondary dark:text-gray-400">
        {{ t("profile.noParticipatedSessionsDesc") }}
      </p>
    </div>

    <div v-else>
      <div v-if="ongoingParticipatedSessions.length > 0" class="mb-12">
        <h3
          class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2 dark:text-gray-200"
        >
          <i class="fa-solid fa-hourglass-half text-primary"></i> {{ t("common.ongoing") }}
        </h3>

        <div class="grid gap-6">
          <div
            v-for="session in ongoingParticipatedSessions"
            :key="session.id"
            class="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 p-6 hover:shadow-lg transition-all duration-300 dark:bg-gray-800/60 dark:border-gray-700"
          >
            <div
              class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-black/5 dark:border-white/10"
            >
              <div>
                <h3 class="text-xl font-bold text-text-primary mb-1 dark:text-gray-100">
                  {{ session.name }}
                </h3>
                <p class="text-text-secondary text-sm dark:text-gray-400">
                  {{ session.description }}
                </p>
              </div>
              <button
                @click="goToSession(session.id)"
                class="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <i class="fa-solid fa-external-link-alt text-xs"></i>
                {{ t("profile.viewSession") }}
              </button>
            </div>

            <div class="flex gap-2 mb-6 text-xs">
              <span
                class="px-2 py-1 bg-primary/10 text-primary rounded-md font-semibold dark:bg-primary/20"
                >{{ sessionService.formatTextType(session.type) }}</span
              >
              <span
                class="px-2 py-1 bg-gray-100 text-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-300"
                >{{ t("common.dateLimit") }} :
                {{ sessionService.formatDate(session.dateLimit) }}</span
              >
            </div>

            <div
              class="bg-white/40 rounded-xl p-4 border border-white/40 dark:bg-gray-700/30 dark:border-gray-600/50"
            >
              <h4
                class="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide opacity-70 dark:text-gray-300"
              >
                {{ t("profile.myReservations") }}
              </h4>
              <div
                v-if="getUserReservationsForSession(session).length === 0"
                class="text-sm text-text-secondary italic dark:text-gray-400"
              >
                {{ t("profile.noReservationFound") }}
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="reservation in getUserReservationsForSession(session)"
                  :key="reservation.id"
                  class="flex items-center justify-between p-3 rounded-lg bg-white/60 border border-white/40 transition-all dark:bg-gray-700/50 dark:border-gray-600"
                  :class="{
                    'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20':
                      reservation.isCompleted,
                  }"
                >
                  <div class="flex flex-col">
                    <span class="font-medium text-text-primary dark:text-gray-200">
                      {{ getTextStudyName(reservation.textStudyId) }}
                      <span
                        v-if="reservation.section"
                        class="text-text-secondary font-normal dark:text-gray-400"
                      >
                        - {{ t("common.chapter") }} {{ reservation.section }}
                      </span>
                    </span>
                    <span
                      v-if="reservation.isCompleted"
                      class="text-xs text-green-600 font-bold mt-1 flex items-center gap-1 dark:text-green-400"
                    >
                      <i class="fa-solid fa-check-circle"></i> {{ t("common.finished") }}
                    </span>
                  </div>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      class="w-5 h-5 rounded text-primary border-gray-300 focus:ring-primary accent-primary dark:border-gray-500 dark:bg-gray-600"
                      :checked="reservation.isCompleted"
                      @change="
                        toggleReservationCompletion(
                          session.id,
                          reservation.id,
                          ($event.target as HTMLInputElement).checked,
                        )
                      "
                    />
                    <span class="text-xs font-medium text-text-secondary dark:text-gray-400">{{
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
        <h3
          class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2 dark:text-gray-200"
        >
          <i class="fa-solid fa-check-double text-green-600 dark:text-green-400"></i>
          {{ t("common.finished") }}
        </h3>

        <div class="grid gap-6">
          <div
            v-for="session in finishedParticipatedSessions"
            :key="session.id"
            class="bg-gray-50/60 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 opacity-90 hover:opacity-100 transition-all duration-300 dark:bg-gray-800/40 dark:border-gray-700"
          >
            <div
              class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-black/5 dark:border-white/10"
            >
              <div>
                <h3 class="text-xl font-bold text-text-primary mb-1 dark:text-gray-300">
                  {{ session.name }}
                </h3>
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded dark:bg-gray-700 dark:text-gray-300"
                  >
                    <i class="fa-solid fa-flag-checkered"></i> {{ t("common.finished") }}
                  </span>
                </div>
              </div>
              <button
                @click="goToSession(session.id)"
                class="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <i class="fa-solid fa-eye text-xs"></i>
                {{ t("common.view") }}
              </button>
            </div>

            <div class="text-sm text-text-secondary dark:text-gray-400 mb-2">
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
