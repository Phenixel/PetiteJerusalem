<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import { useToast } from "../../composables/useToast";

/**
 * Un lien studio tout juste créé : il ne se montre qu'une fois (le secret
 * n'est plus affiché ensuite), d'où le rappel et le bouton pour le copier.
 */
const props = defineProps<{ url: string; title?: string }>();

const { t } = useI18n();
const toast = useToast();

async function copy() {
  try {
    await navigator.clipboard.writeText(props.url);
    toast.success(t("admin.auteurs.linkCopied"));
  } catch {
    toast.error(t("admin.error"));
  }
}
</script>

<template>
  <div class="space-y-2 rounded-control bg-primary/[0.06] p-4">
    <p v-if="title" class="font-semibold text-text-primary">{{ title }}</p>
    <p class="flex items-center gap-1.5 text-xs text-text-secondary">
      <AppIcon name="alert-circle" :size="12" />
      {{ t("admin.auteurs.linkOnce") }}
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <code
        class="min-w-0 flex-1 break-all rounded-md bg-surface px-2.5 py-2 text-xs text-text-primary"
      >
        {{ url }}
      </code>
      <button type="button" class="btn btn-primary btn-sm shrink-0" @click="copy">
        <AppIcon name="copy" :size="13" />
        {{ t("admin.auteurs.copy") }}
      </button>
    </div>
  </div>
</template>
