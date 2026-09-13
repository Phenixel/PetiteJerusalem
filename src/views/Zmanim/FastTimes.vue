<script setup lang="ts">
// Début et fin d'un jeûne public : le 10 Tévet, Esther, le 17 Tamouz, celui
// de Guedalia commencent à l'aube ; Tich'a beAv, comme Kippour, la veille au
// coucher du soleil. Tous finissent à la sortie des étoiles.
//
// Encadré comme le repos (voir RestTimes) : ce n'est pas un moment de la
// journée mais un rendez-vous, et il s'annonce dès la veille, quand on
// regarde jusqu'à quelle heure on peut manger. Kippour n'y passe pas : il a
// son cadre de repos, avec son entrée et sa sortie.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatZmanDay, formatZmanTime, type FastPeriod } from "../../services/zmanimService";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{
  fast: FastPeriod;
  /** Fuseau du lieu : les heures s'affichent dedans, pas dans celui du navigateur. */
  tzid: string;
}>();

const { t, locale } = useI18n();

const clock = (date: Date) => formatZmanTime(date, props.tzid, locale.value);
const dayOf = (date: Date) => formatZmanDay(date, props.tzid, locale.value);

/** Comment les heures sont comptées : à l'aube, ou dès la veille au soir. */
const note = computed(() => t(props.fast.fromEve ? "zmanim.fast.noteEve" : "zmanim.fast.noteDawn"));
</script>

<template>
  <section class="card p-5">
    <h2 class="mb-3 font-bold text-text-primary">
      <AppIcon name="hourglass" :size="17" class="me-2 text-primary" />{{ fast.name }}
    </h2>

    <ul class="flex flex-col divide-y divide-line">
      <li class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ t("zmanim.fast.start") }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(fast.start) }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(fast.start) }}
        </span>
      </li>
      <li class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ t("zmanim.fast.end") }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(fast.end) }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(fast.end) }}
        </span>
      </li>
    </ul>

    <p class="mt-2.5 text-xs text-text-secondary">{{ note }}</p>
  </section>
</template>
