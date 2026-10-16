<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { dateTimeFormat } from "../services/intlCache";
import type { SupportMessageView } from "../services/support";

/**
 * Un fil de « Nous écrire », comme une messagerie : ceux de qui regarde d'un
 * côté, ceux de l'autre en face, l'heure sous chaque bulle, et le jour en
 * séparateur quand il change. Le nom n'est dit que pour l'autre côté, et
 * seulement au premier message d'une suite (« L'équipe Petite Jérusalem »).
 *
 * La même pièce sert à la personne (/contact/:id) et à l'équipe
 * (backoffice) ; `viewer` dit de quel côté on se tient. Ce qui suit le
 * dernier message (l'état du fil, dit comme une ligne de la messagerie) se
 * passe par l'emplacement par défaut.
 */
const props = defineProps<{
  messages: SupportMessageView[];
  viewer: "user" | "team";
}>();

const { t, locale } = useI18n();

const isOwn = (m: SupportMessageView) => m.from === props.viewer;

const dayKey = (ms: number) => new Date(ms).toDateString();

interface Row {
  message: SupportMessageView;
  /** Le jour, quand il change : un séparateur au-dessus. */
  day: string | null;
  /** Le nom de l'auteur, au premier message d'une suite de l'autre côté. */
  author: string | null;
}

const rows = computed<Row[]>(() =>
  props.messages.map((message, index) => {
    const previous = props.messages[index - 1];
    const newDay = message.at > 0 && (!previous || dayKey(previous.at) !== dayKey(message.at));
    const newRun = !previous || previous.from !== message.from || newDay;
    return {
      message,
      day: newDay
        ? dateTimeFormat(locale.value, { dateStyle: "long" }).format(new Date(message.at))
        : null,
      author:
        !isOwn(message) && newRun
          ? message.from === "team"
            ? t("support.team")
            : t("support.person")
          : null,
    };
  }),
);

const time = (ms: number) =>
  ms ? dateTimeFormat(locale.value, { timeStyle: "short" }).format(new Date(ms)) : "";
</script>

<template>
  <ol class="space-y-1.5">
    <li v-for="(row, index) in rows" :key="index" class="flex flex-col">
      <p v-if="row.day" class="my-3 text-center text-xs font-semibold text-text-secondary">
        {{ row.day }}
      </p>
      <p
        v-if="row.author"
        class="mb-1 mt-2 px-1 text-xs font-semibold text-text-secondary"
        :class="isOwn(row.message) ? 'self-end' : 'self-start'"
      >
        {{ row.author }}
      </p>
      <div
        class="max-w-[82%] rounded-control px-3.5 py-2"
        :class="isOwn(row.message) ? 'self-end bg-primary/15' : 'self-start bg-surface-soft'"
      >
        <p class="whitespace-pre-line break-words text-[0.9375rem] text-text-primary">
          {{ row.message.text }}
        </p>
        <p
          v-if="row.message.at"
          class="mt-0.5 text-end text-[0.6875rem] tabular-nums text-text-secondary"
        >
          {{ time(row.message.at) }}
        </p>
      </div>
    </li>
    <li v-if="$slots.default" class="pt-3">
      <slot />
    </li>
  </ol>
</template>
