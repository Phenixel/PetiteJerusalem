<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { ChiourDoc } from "../../models/models";
import AppIcon from "../icons/AppIcon.vue";
import AdminStatus from "./AdminStatus.vue";
import { formatAgo, formatCount, formatDuration } from "../../services/adminFormat";

/**
 * Un chiour dans une liste du backoffice : son titre (qui ouvre sa fiche),
 * de qui il est et où il se range, son état, et « Publier » pour un brouillon.
 * La case de sélection n'apparaît que si la liste permet le traitement en
 * masse.
 */
defineProps<{
  chiour: ChiourDoc;
  serieName?: string | null;
  selectable?: boolean;
  selected?: boolean;
  busy?: boolean;
}>();

defineEmits<{ (e: "toggle-select"): void; (e: "toggle-published"): void }>();

const { t } = useI18n();
</script>

<template>
  <div
    class="flex items-start gap-3 p-3 md:items-center md:p-4"
    :class="{ 'bg-primary/[0.04]': selected }"
  >
    <input
      v-if="selectable"
      type="checkbox"
      class="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-primary md:mt-0"
      :checked="selected"
      :aria-label="chiour.name"
      @change="$emit('toggle-select')"
    />
    <div class="min-w-0 flex-1">
      <router-link
        :to="`/admin/chiourim/${chiour.slug}`"
        class="block break-words font-semibold text-text-primary hover:text-primary"
      >
        {{ chiour.name }}
      </router-link>
      <p class="mt-0.5 text-sm text-text-secondary">
        <span v-if="chiour.auteur">{{ chiour.auteur }}</span>
        <span v-else class="text-amber-700 dark:text-amber-300">{{
          t("admin.chiourim.noAuteur")
        }}</span>
        <template v-if="serieName">
          · {{ serieName }}<template v-if="chiour.episode"> ({{ chiour.episode }})</template>
        </template>
        <template v-if="chiour.duration"> · {{ formatDuration(chiour.duration) }}</template>
        <template v-if="chiour.createdAt"> · {{ formatAgo(chiour.createdAt, t) }}</template>
      </p>
    </div>
    <div class="flex shrink-0 flex-col items-end gap-2 md:flex-row md:items-center md:gap-3">
      <span
        v-if="chiour.published"
        class="inline-flex items-center gap-1 text-sm tabular-nums text-text-secondary"
        :title="t('common.viewsCount', { count: chiour.views ?? 0 })"
      >
        <AppIcon name="eye" :size="14" />
        {{ formatCount(chiour.views ?? 0) }}
      </span>
      <AdminStatus
        :tone="chiour.published ? 'success' : 'warning'"
        :label="
          chiour.published ? t('admin.chiourim.statusPublished') : t('admin.chiourim.statusDraft')
        "
      />
      <!-- Publier est le geste courant (les auteurs déposent des brouillons) ;
           dépublier reste sur la fiche ou en masse, loin d'un clic égaré. -->
      <button
        v-if="!chiour.published"
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="busy"
        @click="$emit('toggle-published')"
      >
        <AppIcon v-if="busy" name="spinner" :size="13" class="animate-spin" />
        {{ t("admin.chiourim.publish") }}
      </button>
    </div>
  </div>
</template>
