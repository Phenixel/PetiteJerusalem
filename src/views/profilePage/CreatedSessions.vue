<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import type { Session } from "../../models/models";
import type { User } from "../../services/authService";

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

const ongoingCreatedSessions = computed(() => props.sessions.filter((s) => !isSessionFinished(s)));
const finishedCreatedSessions = computed(() => props.sessions.filter((s) => isSessionFinished(s)));

const openSessionManagement = (session: Session) => {
  router.push({ name: "session-management", params: { id: session.id } });
};

const goToNewSession = () => {
  router.push("/share-reading/new-session");
};
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100">
        {{ t("profile.createdSessions") }}
      </h2>
    </div>

    <div
      v-if="sessions.length === 0"
      class="flex flex-col items-center justify-center p-12 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/40 text-center dark:bg-gray-800/40 dark:border-gray-700"
    >
      <div
        class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400 text-2xl dark:bg-gray-700 dark:text-gray-500"
      >
        <i class="fa-solid fa-plus-circle"></i>
      </div>
      <h3 class="text-xl font-semibold text-text-primary mb-2 dark:text-gray-200">
        {{ t("profile.noCreatedSessions") }}
      </h3>
      <p class="text-text-secondary mb-6 dark:text-gray-400">
        {{ t("profile.noCreatedSessionsDesc") }}
      </p>
      <button
        @click="goToNewSession"
        class="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all"
      >
        {{ t("profile.createSession") }}
      </button>
    </div>

    <div v-else>
      <div v-if="ongoingCreatedSessions.length > 0" class="mb-12">
        <h3
          class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2 dark:text-gray-200"
        >
          <i class="fa-solid fa-play-circle text-primary"></i> {{ t("common.ongoing") }}
        </h3>

        <div class="grid gap-6">
          <div
            v-for="session in ongoingCreatedSessions"
            :key="session.id"
            class="relative bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 p-6 hover:shadow-lg transition-all duration-300 dark:bg-gray-800/60 dark:border-gray-700 dark:hover:bg-gray-800/80"
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                <h3 class="text-xl font-bold text-text-primary mb-1 dark:text-gray-100">
                  {{ session.name }}
                </h3>
              </div>
              <div class="flex gap-2">
                <span
                  class="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-semibold dark:bg-primary/20"
                  >{{ sessionService.formatTextType(session.type) }}</span
                >
              </div>
            </div>

            <p class="text-text-secondary text-sm mb-6 dark:text-gray-400">
              {{ session.description }}
            </p>

            <div
              class="flex flex-wrap items-center gap-4 pt-4 border-t border-black/5 dark:border-white/10"
            >
              <button
                v-if="sessionService.canEditSession(session)"
                @click="emit('edit', session)"
                class="px-3 py-1.5 bg-white/50 hover:bg-white border border-gray-200 rounded-lg text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center gap-2 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300 dark:hover:text-primary dark:hover:bg-gray-700"
              >
                <i class="fa-solid fa-edit"></i> {{ t("common.edit") }}
              </button>
              <button
                v-if="sessionService.canManageSession(session, currentUser)"
                @click="openSessionManagement(session)"
                class="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-sm font-medium text-primary transition-colors flex items-center gap-2 dark:bg-primary/20"
              >
                <i class="fa-solid fa-cogs"></i> {{ t("common.manage") }}
              </button>
              <button
                @click="emit('share', session)"
                class="px-3 py-1.5 bg-white/50 hover:bg-white border border-gray-200 rounded-lg text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center gap-2 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300 dark:hover:text-primary dark:hover:bg-gray-700"
              >
                <i class="fa-solid fa-share"></i> {{ t("common.share") }}
              </button>
              <button
                v-if="sessionService.canEndSession(session)"
                @click="emit('end', session)"
                class="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-sm font-medium text-red-600 transition-colors flex items-center gap-2 ml-auto dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <i class="fa-solid fa-flag-checkered"></i> {{ t("common.end") }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Terminées -->
      <div v-if="finishedCreatedSessions.length > 0" class="opacity-80">
        <h3
          class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2 dark:text-gray-200"
        >
          <i class="fa-solid fa-stop-circle text-gray-500"></i> {{ t("common.finished") }}
        </h3>

        <div class="grid gap-6">
          <div
            v-for="session in finishedCreatedSessions"
            :key="session.id"
            class="relative bg-gray-50/60 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 transition-all duration-300 dark:bg-gray-800/40 dark:border-gray-700"
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                <h3 class="text-xl font-bold text-text-primary mb-1 dark:text-gray-300">
                  {{ session.name }}
                </h3>
                <div
                  class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded mb-2 dark:bg-gray-700 dark:text-gray-300"
                >
                  <i class="fa-solid fa-flag-checkered"></i> {{ t("common.finished") }}
                </div>
              </div>
              <div class="flex gap-2">
                <span
                  class="px-2 py-1 bg-gray-200 text-gray-600 rounded-md text-xs font-semibold dark:bg-gray-700 dark:text-gray-400"
                  >{{ sessionService.formatTextType(session.type) }}</span
                >
              </div>
            </div>

            <p class="text-text-secondary text-sm mb-6 dark:text-gray-500">
              {{ session.description }}
            </p>

            <div
              class="flex flex-wrap items-center gap-4 pt-4 border-t border-black/5 dark:border-white/10"
            >
              <button
                v-if="sessionService.canManageSession(session, currentUser)"
                @click="openSessionManagement(session)"
                class="px-3 py-1.5 bg-white/50 hover:bg-white border border-gray-200 rounded-lg text-sm font-medium text-text-secondary transition-colors flex items-center gap-2 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <i class="fa-solid fa-eye"></i> {{ t("common.view") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
