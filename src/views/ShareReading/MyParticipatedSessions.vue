<script setup lang="ts">
// « Je participe » : liste compacte des sessions en cours où j'ai des
// réservations (les terminées ne sont plus affichées, filtrées en amont).
// Une ligne par session (nom, type, échéance, avancement de mes lectures) ;
// le clic déplie la liste de mes réservations à cocher, sans quitter la page.
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { reservationService, ReservationGoneError } from "../../services/reservationService";
import { TextTypeService } from "../../services/textTypeService";
import { endOfLocalDay } from "../../services/dateService";
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

const myReservations = (session: Session): TextStudyReservation[] => {
  if (!props.currentUser) return [];
  const user = props.currentUser;
  return (session.reservations ?? []).filter((r) => reservationService.isOwnReservation(r, user));
};

const readCount = (session: Session) => {
  const mine = myReservations(session);
  return { done: mine.filter((r) => r.isCompleted).length, total: mine.length };
};

// Lignes dépliées (mes réservations à cocher). La première session où il me
// reste à lire est ouverte d'office : c'est ce qu'on vient faire ici. Une
// session dont j'ai tout lu n'attend plus rien de moi, elle reste repliée.
const firstUnread = computed(
  () =>
    props.sessions.find((session) => {
      const { done, total } = readCount(session);
      return total > 0 && done < total;
    })?.id ?? null,
);

const expandedIds = ref<Set<string>>(new Set());
/** Vrai dès que le lecteur a ouvert ou fermé une ligne lui-même. */
const touched = ref(false);

// Le compte arrive parfois après le montage : tant que rien n'est déplié et
// que personne n'a touché aux lignes, celle qui s'ouvre d'office suit ce que
// la liste dit maintenant. Figée au montage, elle laissait tout replié quand
// mes réservations n'étaient pas encore connues.
//
// Une fois une ligne ouverte, elle le reste : cocher sa dernière lecture
// change la première session où il reste à lire, et la ligne se serait refermée
// sous la main de celui qui vient d'y cocher une case.
watch(
  firstUnread,
  (id) => {
    if (touched.value || expandedIds.value.size > 0) return;
    expandedIds.value = new Set(id ? [id] : []);
  },
  { immediate: true },
);

function toggleExpand(id: string) {
  touched.value = true;
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

/** Jours restants avant la date limite (arrondi supérieur, 0 = aujourd'hui). */
const daysLeft = (session: Session): number => {
  const limit = endOfLocalDay(new Date(session.dateLimit));
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
  const session = props.sessions.find((s) => s.id === sessionId);
  try {
    await reservationService.markReservationAsCompleted(sessionId, reservationId, isCompleted);

    const marked = session;
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

    const reservation = session?.reservations?.find((r) => r.id === reservationId);
    if (reservation) {
      reservation.isCompleted = isCompleted;
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
    // La place a été reprise (tirage expiré, ménage du créateur) : la ligne
    // disparaît de la liste, et le message le dit (errors.reservationGone).
    if (error instanceof ReservationGoneError && session?.reservations) {
      const index = session.reservations.findIndex((r) => r.id === reservationId);
      if (index > -1) session.reservations.splice(index, 1);
    }
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
            <!-- Sur un téléphone, le nom prend sa ligne et les puces passent
                 dessous : côte à côte, il ne restait de « Tehilim pour la
                 refoua de Sarah bat Rivka » que « Tehilim pour… », et deux
                 chaînes se ressemblaient. -->
            <button
              class="flex-1 min-w-0 flex items-start gap-2 text-left group sm:items-center"
              @click="toggleExpand(session.id)"
              :aria-expanded="expandedIds.has(session.id)"
            >
              <AppIcon
                name="chevron-right"
                :size="13"
                class="mt-1 shrink-0 text-text-secondary/60 transition-transform duration-200 rtl:rotate-180 sm:mt-0"
                :class="expandedIds.has(session.id) ? '!rotate-90' : ''"
              />
              <span class="min-w-0 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <!-- Sur téléphone, un nom long tient sur deux lignes plutôt
                     que de se couper au milieu ; en ligne, il se coupe. -->
                <span
                  class="font-semibold text-text-primary line-clamp-2 sm:truncate group-hover:text-primary transition-colors"
                >
                  {{ session.name }}
                </span>
                <span class="flex items-center gap-2">
                  <span class="chip bg-primary/10 text-primary shrink-0 hidden sm:inline-flex">
                    {{ TextTypeService.formatType(session.type) }}
                  </span>
                  <!-- Échéance : discrète, ambrée quand la fin approche. L'ambre
                       ne vient pas du thème : une urgence ne change pas de couleur
                       avec les goûts, et resterait indistincte de la puce voisine
                       sous le thème orange. -->
                  <span
                    class="chip shrink-0"
                    :class="
                      daysLeft(session) <= 3
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        : 'bg-black/5 text-text-secondary dark:bg-white/10'
                    "
                  >
                    <AppIcon name="hourglass" :size="11" />
                    {{ t("shareReading.daysLeftChip", { count: daysLeft(session) }) }}
                  </span>
                </span>
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
                v-if="
                  readCount(session).total > 0 &&
                  readCount(session).done === readCount(session).total
                "
                name="circle-check"
                :size="13"
              />
              {{
                readCount(session).total > 0 && readCount(session).done === readCount(session).total
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
