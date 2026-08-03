<script setup lang="ts">
// « Créées par moi » : liste compacte orientée gestion. Une ligne par
// session : nom, type, jauge de réservation, et les actions bien en avant —
// Gérer en premier, puis partager, modifier, terminer.
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import type { Session } from "../../models/models";
import type { User } from "../../services/authService";
import AppIcon from "../../components/icons/AppIcon.vue";

const router = useRouter();
const { t } = useI18n();

const props = defineProps<{
  sessions: Session[];
  currentUser: User | null;
}>();

const emit = defineEmits<{
  (e: "share", session: Session): void;
  (e: "edit", session: Session): void;
  (e: "end", session: Session): void;
}>();

const isSessionFinished = (session: Session): boolean => {
  if (session.isEnded) return true;
  const limit = new Date(session.dateLimit);
  limit.setHours(23, 59, 59, 999);
  return new Date() > limit;
};

const ongoingSessions = computed(() => props.sessions.filter((s) => !isSessionFinished(s)));
const finishedSessions = computed(() => props.sessions.filter((s) => isSessionFinished(s)));

const stats = (session: Session) => sessionService.getSessionReservationStats(session);

const openSessionManagement = (session: Session) => {
  router.push({ name: "session-management", params: { id: session.id } });
};

const goToNewSession = () => {
  router.push("/share-reading/new-session");
};
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <!-- Vide -->
    <div v-if="sessions.length === 0" class="flex flex-col items-center py-10 text-center">
      <AppIcon name="circle-plus" :size="28" class="text-text-secondary/40 mb-3" />
      <p class="font-semibold text-text-primary mb-1">{{ t("profile.noCreatedSessions") }}</p>
      <p class="text-sm text-text-secondary mb-5">{{ t("profile.noCreatedSessionsDesc") }}</p>
      <button @click="goToNewSession" class="btn btn-primary">
        {{ t("profile.createSession") }}
      </button>
    </div>

    <div v-else>
      <!-- En cours : la gestion à portée de main -->
      <ul class="divide-y divide-line">
        <li
          v-for="session in ongoingSessions"
          :key="session.id"
          class="py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="font-semibold text-text-primary truncate">{{ session.name }}</span>
              <span class="chip bg-primary/10 text-primary shrink-0">
                {{ sessionService.formatTextType(session.type) }}
              </span>
            </div>
            <!-- Jauge de réservation : l'info clé du créateur -->
            <div v-if="stats(session).total > 0" class="flex items-center gap-2.5">
              <div
                class="h-1.5 flex-1 max-w-56 bg-black/5 rounded-full overflow-hidden dark:bg-white/10"
              >
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="stats(session).percentage >= 100 ? 'bg-green-500' : 'bg-primary'"
                  :style="{ width: `${Math.min(100, stats(session).percentage)}%` }"
                ></div>
              </div>
              <span class="text-xs font-medium text-text-secondary shrink-0">
                {{ t("shareReading.reservedPercent", { percent: stats(session).percentage }) }}
              </span>
            </div>
          </div>

          <!-- Les actions, bien en avant : Gérer d'abord -->
          <div class="shrink-0 flex items-center gap-1.5">
            <button
              v-if="sessionService.canManageSession(session, currentUser)"
              @click="openSessionManagement(session)"
              class="btn btn-primary !px-3.5 !py-2 !text-sm"
            >
              <AppIcon name="settings" :size="14" /> {{ t("common.manage") }}
            </button>
            <button
              @click="emit('share', session)"
              class="btn btn-soft !px-3.5 !py-2 !text-sm"
            >
              <AppIcon name="share" :size="14" />
              <span class="hidden md:inline">{{ t("common.share") }}</span>
            </button>
            <button
              v-if="sessionService.canEditSession(session)"
              @click="emit('edit', session)"
              class="icon-btn"
              :title="t('common.edit')"
              :aria-label="t('common.edit')"
            >
              <AppIcon name="pencil" :size="15" />
            </button>
            <button
              v-if="sessionService.canEndSession(session)"
              @click="emit('end', session)"
              class="icon-btn hover:!bg-red-600/10 hover:!text-red-600 dark:hover:!text-red-400"
              :title="t('common.end')"
              :aria-label="t('common.end')"
            >
              <AppIcon name="flag" :size="15" />
            </button>
          </div>
        </li>
      </ul>

      <!-- Terminées : simple rappel, tout au bout -->
      <div v-if="finishedSessions.length > 0" class="mt-2 pt-3 border-t border-line opacity-75">
        <ul class="divide-y divide-line">
          <li
            v-for="session in finishedSessions"
            :key="session.id"
            class="flex items-center gap-2 py-2.5"
          >
            <AppIcon name="flag" :size="12" class="shrink-0 text-text-secondary/60" />
            <button
              class="flex-1 min-w-0 text-left text-sm font-medium text-text-secondary truncate hover:text-primary transition-colors"
              @click="openSessionManagement(session)"
            >
              {{ session.name }}
            </button>
            <span class="chip bg-black/5 text-text-secondary dark:bg-white/10 shrink-0">
              {{ t("common.finished") }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
