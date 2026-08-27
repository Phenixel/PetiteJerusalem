<script setup lang="ts">
// « Je participe » : liste compacte des sessions en cours où j'ai des
// réservations (les terminées ne sont plus affichées, filtrées en amont).
// Une ligne par session (nom, type, échéance, avancement de mes lectures) ;
// le clic déplie la liste de mes réservations à cocher, sans quitter la page.
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import { appendHebrewNumeral, formatNumberWithHebrew } from "../../services/hebrewNumerals";
import type { Session, TextStudy, TextStudyReservation } from "../../models/models";
import type { User } from "../../services/authService";
import { useToast } from "../../composables/useToast";
import { analyticsService } from "../../services/analyticsService";
import CollapseTransition from "../../components/CollapseTransition.vue";
import AppIcon from "../../components/icons/AppIcon.vue";

const router = useRouter();
const { t } = useI18n();
const toast = useToast();

const props = defineProps<{
  sessions: Session[];
  currentUser: User | null;
  textStudiesMap: Map<string, TextStudy>;
}>();

// Lignes dépliées (mes réservations à cocher). La première session est
// ouverte d'office : c'est ce qu'on vient faire ici.
const expandedIds = ref<Set<string>>(
  new Set(props.sessions[0] ? [props.sessions[0].id] : []),
);

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

const myReservations = (session: Session): TextStudyReservation[] => {
  if (!props.currentUser) return [];
  return (
    session.reservations?.filter(
      (reservation) =>
        reservation.chosenById === props.currentUser?.id ||
        reservation.chosenByGuestId === props.currentUser?.email,
    ) || []
  );
};

const readCount = (session: Session) => {
  const mine = myReservations(session);
  return { done: mine.filter((r) => r.isCompleted).length, total: mine.length };
};

/** Jours restants avant la date limite (arrondi supérieur, 0 = aujourd'hui). */
const daysLeft = (session: Session): number => {
  const limit = new Date(session.dateLimit);
  limit.setHours(23, 59, 59, 999);
  return Math.max(0, Math.ceil((limit.getTime() - Date.now()) / (24 * 3600 * 1000)));
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

    const marked = props.sessions.find((s) => s.id === sessionId);
    // Troisième endroit d'où l'on coche « lu » (après la page de chaîne et le
    // lecteur), et le seul qui ne le disait pas : la liste de MES chaînes.
    // Sans lui, `section_marked_read` sous-comptait la lecture des habitués,
    // qui cochent d'ici sans rouvrir la chaîne.
    analyticsService.capture("section_marked_read", {
      session_id: sessionId,
      text_type: marked?.type,
      marked: isCompleted,
      // La liste ne s'affiche qu'à un compte : jamais un invité.
      is_guest: false,
      source: "my_sessions",
    });

    const session = props.sessions.find((s) => s.id === sessionId);
    if (session) {
      const reservation = session.reservations?.find((r) => r.id === reservationId);
      if (reservation) {
        reservation.isCompleted = isCompleted;
      }
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la réservation:", error);
    analyticsService.capture("section_mark_read_failed", {
      session_id: sessionId,
      marked: isCompleted,
      is_guest: false,
      error_message: error instanceof Error ? error.message : String(error),
      source: "my_sessions",
    });
    toast.errorFromException(error, t("profile.reservationUpdateError"));
  }
};

const goToSession = (session: Session) => {
  router.push({ name: "detail-session", params: { slug: session.slug || session.id } });
};
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <!-- Vide -->
    <div v-if="sessions.length === 0" class="flex flex-col items-center py-10 text-center">
      <AppIcon name="calendar-x" :size="28" class="text-text-secondary/40 mb-3" />
      <p class="font-semibold text-text-primary mb-1">{{ t("profile.noParticipatedSessions") }}</p>
      <p class="text-sm text-text-secondary">{{ t("profile.noParticipatedSessionsDesc") }}</p>
    </div>

    <div v-else>
      <!-- En cours : une ligne par session, dépliable -->
      <ul class="divide-y divide-line">
        <li v-for="session in sessions" :key="session.id">
          <div class="flex items-center gap-2 py-3">
            <button
              class="flex-1 min-w-0 flex items-center gap-2 text-left group"
              @click="toggleExpand(session.id)"
              :aria-expanded="expandedIds.has(session.id)"
            >
              <AppIcon
                name="chevron-right"
                :size="13"
                class="shrink-0 text-text-secondary/60 transition-transform duration-200 rtl:rotate-180"
                :class="expandedIds.has(session.id) ? '!rotate-90' : ''"
              />
              <span
                class="font-semibold text-text-primary truncate group-hover:text-primary transition-colors"
              >
                {{ session.name }}
              </span>
              <span class="chip bg-primary/10 text-primary shrink-0 hidden sm:inline-flex">
                {{ sessionService.formatTextType(session.type) }}
              </span>
              <!-- Échéance : discrète, orange quand la fin approche -->
              <span
                class="chip shrink-0"
                :class="
                  daysLeft(session) <= 3
                    ? 'bg-accent-secondary/10 text-accent-secondary'
                    : 'bg-black/5 text-text-secondary dark:bg-white/10'
                "
              >
                <AppIcon name="hourglass" :size="11" />
                {{ t("shareReading.daysLeftChip", { count: daysLeft(session) }) }}
              </span>
            </button>

            <!-- Où j'en suis dans mes lectures -->
            <span
              class="shrink-0 text-xs font-semibold inline-flex items-center gap-1"
              :class="
                readCount(session).total > 0 && readCount(session).done === readCount(session).total
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-text-secondary'
              "
            >
              <AppIcon
                v-if="readCount(session).total > 0 && readCount(session).done === readCount(session).total"
                name="circle-check"
                :size="13"
              />
              {{
                readCount(session).total > 0 &&
                readCount(session).done === readCount(session).total
                  ? t("shareReading.allRead")
                  : t("shareReading.readCount", readCount(session))
              }}
            </span>

            <button
              class="icon-btn shrink-0 !w-8 !h-8"
              :title="t('profile.viewSession')"
              :aria-label="t('profile.viewSession')"
              @click="goToSession(session)"
            >
              <AppIcon name="external-link" :size="14" />
            </button>
          </div>

          <!-- Mes réservations, à cocher sur place -->
          <CollapseTransition>
            <div v-show="expandedIds.has(session.id)">
              <div class="ms-6 mb-3 space-y-1.5">
                <p
                  v-if="myReservations(session).length === 0"
                  class="text-sm text-text-secondary italic py-1"
                >
                  {{ t("profile.noReservationFound") }}
                </p>
                <label
                  v-for="reservation in myReservations(session)"
                  :key="reservation.id"
                  class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  :class="
                    reservation.isCompleted
                      ? 'bg-green-600/5 dark:bg-green-500/10'
                      : 'bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/5 dark:hover:bg-white/10'
                  "
                >
                  <span
                    class="text-sm min-w-0 truncate"
                    :class="
                      reservation.isCompleted
                        ? 'text-text-secondary line-through decoration-green-600/40'
                        : 'text-text-primary font-medium'
                    "
                  >
                    {{ getTextStudyName(reservation.textStudyId) }}
                    <span v-if="reservation.section" class="text-text-secondary font-normal">
                      · {{ t("common.chapter") }} {{ formatNumberWithHebrew(reservation.section) }}
                    </span>
                  </span>
                  <span class="shrink-0 flex items-center gap-1.5">
                    <span class="text-xs font-medium text-text-secondary">{{
                      t("common.read")
                    }}</span>
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
                  </span>
                </label>
              </div>
            </div>
          </CollapseTransition>
        </li>
      </ul>

    </div>
  </div>
</template>
