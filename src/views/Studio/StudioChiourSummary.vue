<script setup lang="ts">
// Un chiour dans les listes du studio (épisodes d'une série, chiourim hors
// série) : titre pleine largeur, catégories, puis statut et actions en
// dessous, lisibles sur mobile.
import { useI18n } from "vue-i18n";
import type { ChiourDoc } from "../../models/models";
import AppIcon from "../../components/icons/AppIcon.vue";

defineProps<{ chiour: ChiourDoc; deleting: boolean }>();
defineEmits<{ edit: []; remove: [] }>();

const { t } = useI18n();
</script>

<template>
  <p class="font-semibold text-text-primary break-words">{{ chiour.name }}</p>
  <p v-if="chiour.categories.length" class="text-sm text-text-secondary truncate">
    {{ chiour.categories.join(", ") }}
  </p>

  <div class="flex flex-wrap items-center gap-2 mt-2.5">
    <span
      class="chip"
      :class="
        chiour.published
          ? 'bg-green-600/10 text-green-700 dark:text-green-300'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
      "
    >
      {{ chiour.published ? t("studio.published") : t("studio.draft") }}
    </span>
    <span
      v-if="chiour.published"
      class="inline-flex items-center gap-1 text-sm text-text-secondary"
    >
      <AppIcon name="eye" :size="14" />
      {{ t("common.viewsCount", { count: chiour.views ?? 0 }) }}
    </span>
    <button class="btn btn-soft" @click="$emit('edit')">
      {{ t("common.edit") }}
    </button>
    <button
      v-if="!chiour.published"
      class="btn btn-soft text-red-600 dark:text-red-400"
      :disabled="deleting"
      @click="$emit('remove')"
    >
      <AppIcon v-if="deleting" name="spinner" :size="14" class="animate-spin" />
      {{ t("common.delete") }}
    </button>
  </div>
</template>
