<script setup lang="ts">
// Entrée et sortie d'un temps de repos : le Chabbat, un Yom Tov, ou les deux
// quand ils se suivent, Roch Hachana un dimanche prolonge le Chabbat de la
// veille, et l'ensemble n'a qu'une entrée et qu'une sortie. Un seul cadre,
// donc, titré « Chabbat Roch Hachana » plutôt que deux qui se contrediraient.
//
// Composant à part parce que sa place dans la page change : à l'approche du
// repos il passe devant les horaires du jour, c'est ce qu'on vient chercher.
//
// Encadré, contrairement aux groupes d'horaires qui s'enchaînent à plat : ce
// n'est pas un moment de la journée affichée mais un rendez-vous de la
// semaine, et le cadre marque cette différence de nature.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { hubPath } from "../../content/etudeTexts";
import type { WeeklyParasha } from "../../services/dailyCycles";
import { formatZmanDay, formatZmanTime, type RestPeriod } from "../../services/zmanimService";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{
  period: RestPeriod;
  /** La paracha du Chabbat couvert, absente les semaines de fête. */
  parasha: WeeklyParasha | null;
  /** Fuseau du lieu : les heures s'affichent dedans, pas dans celui du navigateur. */
  tzid: string;
  /** Minutes d'avance de l'allumage au lieu affiché : 18, 40 à Jérusalem. */
  candleMinutes: number;
}>();

const { t, locale } = useI18n();

const clock = (date: Date) => formatZmanTime(date, props.tzid, locale.value);
const dayOf = (date: Date) => formatZmanDay(date, props.tzid, locale.value);

/** « Chabbat », « Roch Hachana », « Chabbat Roch Hachana », un seul titre. */
const title = computed(() => {
  const festivals = props.period.festivals.join(" · ");
  if (!props.period.shabbat) return festivals;
  return festivals ? `${t("zmanim.shabbat.title")} ${festivals}` : t("zmanim.shabbat.title");
});

/** Un bloc de plusieurs jours (fête, ou fête accolée au Chabbat). */
const isFestival = computed(() => props.period.festivals.length > 0);
</script>

<template>
  <section class="card p-5">
    <!-- Le titre porte le nom de la paracha : c'est l'identité de ce Chabbat-là.
         Tout tient dans un seul flux de texte, sans boîte intermédiaire : une
         icône enfermée dans son propre conteneur imposerait sa ligne de base au
         titre, et « Parachat » ne s'alignerait plus sur « Chabbat ». -->
    <h2 class="mb-3 font-bold text-text-primary">
      <AppIcon name="candle" :size="17" class="me-2 text-primary" />{{ title
      }}<span v-if="parasha" class="text-sm font-normal"
        >{{ " " }}<span class="text-text-secondary">{{ t("zmanim.shabbat.parasha") }}</span
        ><template v-for="(entry, index) in parasha.entries" :key="entry.id"
          ><span v-if="index > 0" class="text-text-secondary"> ·</span>{{ " "
          }}<RouterLink :to="hubPath(entry)" class="font-medium text-primary hover:underline">{{
            entry.name
          }}</RouterLink></template
        ></span
      >
    </h2>

    <ul class="flex flex-col divide-y divide-line">
      <li class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ t("zmanim.shabbat.candleLighting") }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(period.start) }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(period.start) }}
        </span>
      </li>
      <li class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ isFestival ? t("zmanim.rest.end") : t("zmanim.shabbat.havdalah") }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(period.end) }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(period.end) }}
        </span>
      </li>
      <!-- La sortie selon Rabbénou Tam, pour qui suit cet avis : plus tard,
           72 minutes après la chkia (l'explication est dans la note). -->
      <li v-if="period.endRabbenouTam" class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ t("zmanim.rest.rabbenouTam") }}
          </span>
          <span class="block text-xs text-text-secondary">
            {{ dayOf(period.endRabbenouTam) }}
          </span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(period.endRabbenouTam) }}
        </span>
      </li>
    </ul>

    <p class="mt-2.5 text-xs text-text-secondary">
      {{
        isFestival
          ? t("zmanim.rest.note", { minutes: candleMinutes })
          : t("zmanim.shabbat.note", { minutes: candleMinutes })
      }}<template v-if="period.endRabbenouTam"> {{ t("zmanim.rest.rabbenouTamNote") }}</template>
    </p>
  </section>
</template>
