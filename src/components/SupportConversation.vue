<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { dateTimeFormat } from "../services/intlCache";
import type { SupportMessageView } from "../services/support";

/**
 * Un fil de « Nous écrire », message après message : ceux de qui regarde
 * d'un côté, ceux de l'autre en face, chacun signé et daté. La même pièce
 * sert à la personne (/contact) et à l'équipe (backoffice) ; `viewer` dit
 * de quel côté on se tient.
 */
const props = defineProps<{
  messages: SupportMessageView[];
  viewer: "user" | "team";
}>();

const { t, locale } = useI18n();

const isOwn = (m: SupportMessageView) => m.from === props.viewer;

function author(m: SupportMessageView): string {
  if (isOwn(m)) return t("support.you");
  return m.from === "team" ? t("support.team") : t("support.person");
}

const when = (ms: number) =>
  ms
    ? dateTimeFormat(locale.value, { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms))
    : "";
</script>

<template>
  <ol class="space-y-3">
    <li
      v-for="(m, index) in messages"
      :key="index"
      class="flex flex-col"
      :class="isOwn(m) ? 'items-end' : 'items-start'"
    >
      <div
        class="max-w-[85%] rounded-control px-3.5 py-2.5"
        :class="isOwn(m) ? 'bg-primary/10' : 'bg-surface-soft'"
      >
        <p class="whitespace-pre-line break-words text-sm text-text-primary">{{ m.text }}</p>
      </div>
      <p class="mt-1 px-1 text-xs text-text-secondary">
        <span class="font-semibold">{{ author(m) }}</span>
        <template v-if="m.at"> · {{ when(m.at) }}</template>
      </p>
    </li>
  </ol>
</template>
