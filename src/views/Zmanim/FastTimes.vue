<script setup lang="ts">
// Début et fin d'un jeûne public : le 10 Tévet, Esther, le 17 Tamouz, celui
// de Guedalia commencent à l'aube ; Tich'a beAv, comme Kippour, la veille au
// coucher du soleil. Tous finissent à la nuit, mais pas à l'heure où sort le
// Chabbat : celui-ci attend une marge qu'un jeûne n'a pas à attendre (voir
// zmanimOpinions), et la note le dit, sans quoi le cadre afficherait une
// heure et la phrase en annoncerait une autre.
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

/**
 * Le jour du jeûne, quand son début n'a pas d'heure : au nord de
 * l'Angleterre, le soleil ne descend pas à 16,1° au cœur de l'été, et l'aube
 * de l'avis par degrés n'existe pas le 17 Tamouz. Le jeûne a bien lieu ; il
 * s'annonce donc avec sa fin, et la ligne du début porte le jour et la raison
 * plutôt qu'une heure venue d'un autre calcul.
 */
const fastDay = computed(() => props.fast.day.greg());

/** Comment la fin est comptée : trois étoiles moyennes, ou minutes fixes. */
const endRule = computed(() =>
  props.fast.endMinutes === null
    ? t("zmanim.fast.endStars")
    : t("zmanim.fast.endAfterSunset", { minutes: props.fast.endMinutes }),
);

/** Comment les heures sont comptées : à l'aube, ou dès la veille au soir. */
const note = computed(() =>
  t(props.fast.fromEve ? "zmanim.fast.noteEve" : "zmanim.fast.noteDawn", { end: endRule.value }),
);
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
          <span class="block text-xs text-text-secondary">
            {{ dayOf(fast.start ?? fastDay) }}
          </span>
        </span>
        <span v-if="fast.start" class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(fast.start) }}
        </span>
        <span v-else class="max-w-[60%] shrink text-end text-xs text-text-secondary">
          {{ t("zmanim.fast.startUnknown") }}
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
