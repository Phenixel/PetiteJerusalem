<script setup lang="ts">
/**
 * Une ligne de la page de réglages de l'app : un dessin, un nom, et, au bout,
 * l'état en cours (« Océan · Système », « Français », « 2 rappels ») avant le
 * chevron. On lit ce qui est réglé sans ouvrir la sous-page, et le chevron dit
 * qu'une page s'ouvre derrière (voir docs/design.md, « La carte est cliquable,
 * et elle le dit sans flèche » : la ligne de liste d'un panneau garde le sien).
 *
 * Trois formes, une seule allure :
 *  - `to` : une page de l'app (RouterLink), chevron ;
 *  - `href` : une page hors de l'app, flèche sortante ;
 *  - ni l'un ni l'autre : une action sur place (bouton, `click`), sans chevron,
 *    puisque rien ne s'ouvre derrière.
 *
 * `tone="danger"` : la déconnexion. Le rouge dit ce qu'elle fait, la ligne
 * reste une ligne.
 */
import { computed } from "vue";
import { RouterLink } from "vue-router";
import AppIcon from "../icons/AppIcon.vue";
import type { IconName } from "../icons/registry";

const props = withDefaults(
  defineProps<{
    icon: IconName;
    label: string;
    /** L'état en cours, lu au bout de la ligne. */
    value?: string;
    /** L'état demande attention (notifications bloquées). */
    warn?: boolean;
    to?: string;
    href?: string;
    tone?: "default" | "danger";
  }>(),
  { value: undefined, warn: false, to: undefined, href: undefined, tone: "default" },
);

defineEmits<{ (e: "click", event: MouseEvent): void }>();

const tag = computed(() => (props.to ? RouterLink : props.href ? "a" : "button"));
// Seulement les attributs de la forme choisie : un `href` vide passé au
// RouterLink écraserait celui qu'il calcule, et le lien ne mènerait nulle part.
const tagAttrs = computed(() =>
  props.to
    ? { to: props.to }
    : props.href
      ? { href: props.href, target: "_blank", rel: "noopener noreferrer" }
      : { type: "button" },
);
const danger = computed(() => props.tone === "danger");
</script>

<template>
  <li>
    <component
      :is="tag"
      v-bind="tagAttrs"
      class="settings-row"
      :class="danger ? 'text-red-600 dark:text-red-400' : 'text-text-primary'"
      @click="$emit('click', $event)"
    >
      <AppIcon :name="icon" :size="19" class="shrink-0" :class="danger ? '' : 'text-primary'" />
      <span class="min-w-0 flex-1 font-medium leading-snug">{{ label }}</span>
      <span
        v-if="value"
        class="max-w-[45%] shrink-0 text-end text-sm leading-snug"
        :class="warn ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-text-secondary'"
      >
        {{ value }}
      </span>
      <AppIcon
        v-if="to"
        name="chevron-right"
        :size="16"
        class="shrink-0 text-text-secondary/50 rtl:rotate-180"
      />
      <AppIcon
        v-else-if="href"
        name="external-link"
        :size="15"
        class="shrink-0 text-text-secondary/50"
      />
    </component>
  </li>
</template>
