<script setup lang="ts">
import { useHelpText } from "../../composables/useHelpText";
import type { HelpGuide } from "../../content/help/catalog";
import AppIcon from "../icons/AppIcon.vue";

/**
 * A guide in a list of the help center: its title, what it is about under
 * it, and the chevron of a row that opens a page (SettingsGroup's rows).
 */
defineProps<{ guide: HelpGuide }>();

const text = useHelpText();
</script>

<template>
  <li>
    <RouterLink :to="`/aide/${guide.slug}`" class="settings-row text-text-primary">
      <span class="min-w-0 flex-1">
        <span class="block font-medium leading-snug">{{ text(guide.title) }}</span>
        <span class="mt-0.5 block text-sm leading-snug text-text-secondary">
          {{ text(guide.summary) }}
        </span>
      </span>
      <AppIcon
        name="chevron-right"
        :size="16"
        class="shrink-0 text-text-secondary/50 rtl:rotate-180"
      />
    </RouterLink>
  </li>
</template>
