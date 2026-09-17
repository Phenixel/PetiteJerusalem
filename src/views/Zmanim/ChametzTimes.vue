<script setup lang="ts">
// Les limites du 'hamets, la veille de Pessah : deux heures et non une, on
// cesse d'en MANGER à la fin de la quatrième heure du jour, d'en POSSÉDER à la
// fin de la cinquième. Chacune est donnée selon les deux avis, comme la fin du
// Chéma et de la Amida plus haut sur la page : ce sont les mêmes heures
// zmaniyot, et les deux avis ne découpent pas le même jour.
//
// Les années où le 14 Nissan tombe un Chabbat, une troisième heure paraît : on
// ne brûle pas le 'hamets un Chabbat, la destruction se fait le vendredi, et la
// cinquième heure du Chabbat devient celle de l'annulation. Sans cela, le cadre
// annoncerait un feu le jour où l'on n'en allume pas.
//
// Encadré comme le jeûne et le repos (voir FastTimes, RestTimes) : ce n'est pas
// un moment de la journée mais un rendez-vous, et il s'annonce dès la veille.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatZmanDay, formatZmanTime, type ChametzDeadlines } from "../../services/zmanimService";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{
  chametz: ChametzDeadlines;
  /** Fuseau du lieu : les heures s'affichent dedans, pas dans celui du navigateur. */
  tzid: string;
}>();

const { t, locale } = useI18n();

const clock = (date: Date) => formatZmanTime(date, props.tzid, locale.value);
const dayOf = (date: Date) => formatZmanDay(date, props.tzid, locale.value);

/**
 * Les lignes du cadre, dans l'ordre où l'on s'en sert.
 *
 * Le vendredi vient en tête les années où le 14 tombe un Chabbat : c'est ce
 * jour-là qu'il faut brûler, et c'est donc l'heure qu'on vient chercher quand
 * le cadre paraît la veille.
 */
const rows = computed(() => {
  const c = props.chametz;
  const lines: { key: string; date: Date }[] = [];
  if (c.onShabbat && c.burningEveMGA && c.burningEve) {
    lines.push(
      { key: "burningEveMGA", date: c.burningEveMGA },
      { key: "burningEve", date: c.burningEve },
    );
  }
  lines.push({ key: "eatingMGA", date: c.eatingMGA }, { key: "eating", date: c.eating });
  // La cinquième heure du 14 : la destruction une année ordinaire, l'annulation
  // quand ce jour-là est un Chabbat et que le feu a déjà eu lieu.
  const fifth = c.onShabbat ? ["bitulMGA", "bitul"] : ["disposalMGA", "disposal"];
  lines.push({ key: fifth[0], date: c.disposalMGA }, { key: fifth[1], date: c.disposal });
  return lines;
});
</script>

<template>
  <section class="card p-5">
    <h2 class="mb-3 font-bold text-text-primary">
      <AppIcon name="hourglass" :size="17" class="me-2 text-primary" />{{
        t("zmanim.chametz.title")
      }}
    </h2>

    <ul class="flex flex-col divide-y divide-line">
      <li v-for="row in rows" :key="row.key" class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ t(`zmanim.chametz.${row.key}`) }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(row.date) }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(row.date) }}
        </span>
      </li>
    </ul>

    <p class="mt-2.5 text-xs text-text-secondary">
      {{ t(chametz.onShabbat ? "zmanim.chametz.noteShabbat" : "zmanim.chametz.note") }}
    </p>
  </section>
</template>
