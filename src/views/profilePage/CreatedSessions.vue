<script setup lang="ts">
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
      <h2 class="text-2xl font-bold text-text-primary">
        {{ t("profile.createdSessions") }}
      </h2>
    </div>

    <div
      v-if="sessions.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <AppIcon name="circle-plus" :size="32" class="text-text-secondary/40 mb-4" />
      <h3 class="text-xl font-semibold text-text-primary mb-2">
        {{ t("profile.noCreatedSessions") }}
      </h3>
      <p class="text-text-secondary mb-6">
        {{ t("profile.noCreatedSessionsDesc") }}
      </p>
      <button @click="goToNewSession" class="btn btn-primary">
        {{ t("profile.createSession") }}
      </button>
    </div>

    <div v-else>
      <div v-if="ongoingCreatedSessions.length > 0" class="mb-12">
        <h3 class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <AppIcon name="play" :size="15" class="text-primary" /> {{ t("common.ongoing") }}
        </h3>

        <div class="grid gap-6">
          <div v-for="session in ongoingCreatedSessions" :key="session.id" class="card p-5">
            <div class="flex items-start justify-between gap-4 mb-3">
              <h3 class="text-xl font-bold text-text-primary">
                {{ session.name }}
              </h3>
              <span class="chip bg-primary/10 text-primary">{{
                sessionService.formatTextType(session.type)
              }}</span>
            </div>

            <p class="text-text-secondary text-sm mb-6">
              {{ session.description }}
            </p>

            <div class="flex flex-wrap items-center gap-3">
              <button
                v-if="sessionService.canEditSession(session)"
                @click="emit('edit', session)"
                class="btn btn-soft"
              >
                <AppIcon name="pencil" :size="14" /> {{ t("common.edit") }}
              </button>
              <button
                v-if="sessionService.canManageSession(session, currentUser)"
                @click="openSessionManagement(session)"
                class="btn btn-primary"
              >
                <AppIcon name="settings" :size="14" /> {{ t("common.manage") }}
              </button>
              <button @click="emit('share', session)" class="btn btn-soft">
                <AppIcon name="share" :size="14" /> {{ t("common.share") }}
              </button>
              <button
                v-if="sessionService.canEndSession(session)"
                @click="emit('end', session)"
                class="btn btn-danger ml-auto"
              >
                <AppIcon name="flag" :size="14" /> {{ t("common.end") }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Terminées -->
      <div v-if="finishedCreatedSessions.length > 0" class="opacity-80">
        <h3 class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <AppIcon name="pause" :size="15" class="text-text-secondary" />
          {{ t("common.finished") }}
        </h3>

        <div class="grid gap-6">
          <div v-for="session in finishedCreatedSessions" :key="session.id" class="card p-5">
            <div class="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 class="text-xl font-bold text-text-primary mb-2">
                  {{ session.name }}
                </h3>
                <span class="chip bg-black/5 text-text-secondary dark:bg-white/10">
                  <AppIcon name="flag" :size="12" /> {{ t("common.finished") }}
                </span>
              </div>
              <span class="chip bg-black/5 text-text-secondary dark:bg-white/10">{{
                sessionService.formatTextType(session.type)
              }}</span>
            </div>

            <p class="text-text-secondary text-sm mb-6">
              {{ session.description }}
            </p>

            <div class="flex flex-wrap items-center gap-3">
              <button
                v-if="sessionService.canManageSession(session, currentUser)"
                @click="openSessionManagement(session)"
                class="btn btn-soft"
              >
                <AppIcon name="eye" :size="14" /> {{ t("common.view") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
