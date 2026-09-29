<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import { dateTimeFormat } from "../../services/intlCache";
import { ANNOUNCEMENT_ICONS, localized, type Announcement } from "../../services/announcements";

/**
 * Une information de l'équipe, telle que la liste la montre : sa nature, sa
 * date, son titre et le début du texte. `to` en fait une carte cliquable
 * (la liste) ; sans lui, une simple surface (l'aperçu du backoffice).
 */
const props = defineProps<{
  announcement: Announcement;
  /** Publiée depuis la dernière visite de la liste. */
  isNew?: boolean;
  to?: string;
}>();

const { t, locale } = useI18n();

const a = computed(() => props.announcement);
const title = computed(() => localized(a.value.title, locale.value));
// Dans la liste, le début du texte d'un seul tenant : un saut de paragraphe
// y gaspillait une des trois lignes de l'extrait.
const body = computed(() => {
  const text = localized(a.value.body, locale.value);
  return props.to ? text.replace(/\s+/g, " ") : text;
});
const date = computed(() =>
  a.value.publishedAt
    ? dateTimeFormat(locale.value, { day: "numeric", month: "long", year: "numeric" }).format(
        a.value.publishedAt,
      )
    : t("announcements.draftDate"),
);
const openIncident = computed(() => a.value.kind === "incident" && !a.value.resolved);
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'article'"
    :to="to"
    class="card block p-5 text-start"
    :class="{ 'card-hover group': to }"
  >
    <div class="mb-2 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
      <span
        class="chip"
        :class="
          openIncident
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'bg-primary/10 text-primary'
        "
      >
        <AppIcon :name="ANNOUNCEMENT_ICONS[a.kind]" :size="13" />
        {{ t(`announcements.kinds.${a.kind}`) }}
      </span>
      <span v-if="a.kind === 'incident'" class="chip">
        {{ a.resolved ? t("announcements.resolved") : t("announcements.ongoing") }}
      </span>
      <span v-if="a.version" class="chip">
        {{ t("announcements.version", { version: a.version }) }}
      </span>
      <span v-if="isNew" class="chip bg-primary text-white">{{ t("announcements.new") }}</span>
      <span class="ms-auto">{{ date }}</span>
    </div>
    <h3
      class="text-lg font-bold leading-snug text-text-primary"
      :class="{ 'transition-colors group-hover:text-primary': to }"
    >
      {{ title }}
    </h3>
    <p
      class="mt-1.5 whitespace-pre-line leading-relaxed text-text-secondary"
      :class="{ 'line-clamp-3': to }"
    >
      {{ body }}
    </p>
  </component>
</template>
