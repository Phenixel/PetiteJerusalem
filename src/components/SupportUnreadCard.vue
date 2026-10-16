<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { useSupportUnread } from "../composables/useSupportUnread";

/**
 * Une réponse de l'équipe attend : l'encart se pose en tête du profil (app et
 * site), avec le début de la réponse, et mène droit au fil (ou à la liste
 * quand plusieurs attendent). Tant qu'il est là, la ligne « Nous écrire »
 * quitte sa place habituelle ; une fois la réponse lue, l'encart disparaît
 * et la ligne y revient. Voir docs/design.md.
 */
const { t } = useI18n();
const { unread, unreadTarget, unreadPreview } = useSupportUnread();
</script>

<template>
  <RouterLink
    v-if="unread > 0"
    :to="unreadTarget"
    class="card card-hover flex items-start gap-3 p-4 animate-[fadeIn_0.3s_ease]"
  >
    <span
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand text-on-brand"
      aria-hidden="true"
    >
      <AppIcon name="message" :size="16" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block font-semibold text-text-primary">
        {{ t("support.unreadTitle", { n: unread }, unread) }}
      </span>
      <span v-if="unreadPreview" class="mt-0.5 line-clamp-2 block text-sm text-text-secondary">
        {{ unreadPreview }}
      </span>
    </span>
  </RouterLink>
</template>
