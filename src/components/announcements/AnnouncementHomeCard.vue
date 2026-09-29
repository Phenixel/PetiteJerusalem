<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import { dateTimeFormat } from "../../services/intlCache";
import { ANNOUNCEMENT_ICONS, localized, type Announcement } from "../../services/announcements";

/**
 * Une information de l'équipe, telle que l'accueil la montre.
 *
 * - « preview » : pas encore lue. Sa nature, sa date, le titre et le début du
 *   texte, de quoi savoir de quoi il s'agit sans ouvrir.
 * - « compact » : déjà lue, ou un incident dont on connaît l'existence. Une
 *   ligne, comme les autres raccourcis du moment.
 *
 * `noLink` en fait une simple surface (l'aperçu du backoffice).
 */
const props = defineProps<{
  announcement: Announcement;
  mode: "preview" | "compact";
  unreadCount?: number;
  noLink?: boolean;
}>();

defineEmits<{ (e: "open"): void }>();

const { t, locale } = useI18n();

const a = computed(() => props.announcement);
const openIncident = computed(() => a.value.kind === "incident" && !a.value.resolved);
const title = computed(() => localized(a.value.title, locale.value));
const excerpt = computed(() => localized(a.value.body, locale.value).replace(/\s+/g, " ").trim());
const date = computed(() =>
  a.value.publishedAt
    ? dateTimeFormat(locale.value, { day: "numeric", month: "long" }).format(a.value.publishedAt)
    : "",
);
const subtitle = computed(() =>
  openIncident.value
    ? t("announcements.home.incident")
    : [t(`announcements.kinds.${a.value.kind}`), date.value].filter(Boolean).join(" · "),
);
</script>

<template>
  <component
    :is="noLink ? 'div' : 'RouterLink'"
    :to="noLink ? undefined : `/informations/${a.id}`"
    class="card group block"
    :class="[mode === 'preview' ? 'p-4 md:p-5' : 'p-4', { 'card-hover': !noLink }]"
    @click="$emit('open')"
  >
    <!-- Aperçu : la nature, puis le titre et le début du texte -->
    <template v-if="mode === 'preview'">
      <span class="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        <span
          class="chip"
          :class="
            openIncident
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              : 'bg-primary/10 text-primary'
          "
        >
          <AppIcon :name="ANNOUNCEMENT_ICONS[a.kind]" :size="12" />
          {{ t(`announcements.kinds.${a.kind}`) }}
        </span>
        <span class="chip bg-primary text-white">{{ t("announcements.new") }}</span>
        <span class="ms-auto">{{ date }}</span>
      </span>
      <span
        class="mt-2.5 block text-lg font-bold leading-snug text-text-primary"
        :class="{ 'transition-colors group-hover:text-primary': !noLink }"
      >
        {{ title }}
      </span>
      <span class="mt-1 line-clamp-2 block text-sm leading-relaxed text-text-secondary">
        {{ excerpt }}
      </span>
      <span class="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span class="font-semibold text-primary">{{ t("announcements.home.readMore") }}</span>
        <span v-if="(unreadCount ?? 0) > 1" class="text-xs text-text-secondary">
          {{
            t(
              "announcements.home.othersUnread",
              { n: (unreadCount ?? 0) - 1 },
              (unreadCount ?? 0) - 1,
            )
          }}
        </span>
      </span>
    </template>

    <!-- Déjà lue : une ligne -->
    <span v-else class="flex items-center gap-3">
      <AppIcon
        :name="openIncident ? 'alert-triangle' : 'bell'"
        :size="20"
        class="shrink-0"
        :class="openIncident ? 'text-amber-600 dark:text-amber-400' : 'text-primary'"
      />
      <span class="min-w-0">
        <span
          class="block font-medium leading-snug text-text-primary"
          :class="{ 'transition-colors group-hover:text-primary': !noLink }"
        >
          {{ title }}
        </span>
        <span class="block text-xs text-text-secondary">{{ subtitle }}</span>
      </span>
    </span>
  </component>
</template>
