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
import {
  formatMarkerDay,
  formatZmanDay,
  formatZmanTime,
  type RestPeriod,
} from "../../services/zmanimService";
import {
  describeEndRule,
  describeLightingRule,
  describeRabbenouTamRule,
} from "../../services/zmanimRules";
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
/** Un marqueur de jour se relit dans SON repère, celui de la machine. */
const markerDay = (date: Date) => formatMarkerDay(date, locale.value);

/** « Chabbat », « Roch Hachana », « Chabbat Roch Hachana », un seul titre. */
const title = computed(() => {
  const festivals = props.period.festivals.join(" · ");
  if (!props.period.shabbat) return festivals;
  return festivals ? `${t("zmanim.shabbat.title")} ${festivals}` : t("zmanim.shabbat.title");
});

/** Un bloc de plusieurs jours (fête, ou fête accolée au Chabbat). */
const isFestival = computed(() => props.period.festivals.length > 0);

/**
 * Le dernier jour du bloc, pour dater la ligne de sortie quand celle-ci n'a
 * pas d'heure : à partir de Stockholm, le soleil ne descend pas à 8,5° au
 * cœur de l'été (voir RestPeriod.end). Le Chabbat reste annoncé avec son
 * allumage ; la ligne de sortie porte alors son jour et la raison.
 */
const lastDay = computed(() => props.period.last.greg());

/**
 * La note dit comment les heures du cadre sont comptées. La règle voyage avec
 * le bloc (voir RestPeriod.endRule) plutôt que d'être relue de l'avis : elle
 * dépend aussi du LIEU, l'avis du Rav Ovadia suivant l'Or Ha'Haïm en Israël
 * et l'Amudei Horaah ailleurs, et le cadre ne connaît que son bloc.
 */
const exitRule = computed(() =>
  t("zmanim.rest.exit", { rule: describeEndRule(props.period.endRule, t, locale.value) }),
);

const rabbenouTamNote = computed(() =>
  describeRabbenouTamRule(props.period.rabbenouTamRule, t),
);

/**
 * Les allumages des soirs suivants, entre l'entrée et la sortie.
 *
 * Chacun porte sa règle : avant la chkia pour un Chabbat pris dans une fête,
 * après la sortie du Chabbat pour un Yom Tov qui le suit, à la nuit pour un
 * deuxième jour de fête. Le libellé le dit, sans quoi deux lignes du cadre
 * porteraient le même nom à des heures différentes.
 */
const lightings = computed(() =>
  props.period.lightings.map((lighting) => ({
    key: lighting.at.getTime(),
    label: describeLightingRule(lighting.rule, t),
    at: lighting.at,
  })),
);

/** Le jour où poser l'érouv tavchilin, écrit en toutes lettres. */
const eruvNote = computed(() =>
  props.period.eruvTavshilin
    ? t("zmanim.rest.eruvTavshilin", { day: markerDay(props.period.eruvTavshilin) })
    : "",
);
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
            <!-- Kippour : la même heure ouvre le repos ET le jeûne. Sans le
                 mot, qui cherche « à quelle heure commence le jeûne » ne
                 trouve rien (voir RestPeriod.fastStarts). -->
            {{
              period.fastStarts
                ? t("zmanim.shabbat.candleLightingAndFast")
                : t("zmanim.shabbat.candleLighting")
            }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(period.start) }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(period.start) }}
        </span>
      </li>
      <!-- Les allumages des soirs suivants : le deuxième soir d'une fête, le
           vendredi pris dans un bloc, le Yom Tov qui suit le Chabbat. Ils se
           rangent entre l'entrée et la sortie, dans l'ordre des soirs. -->
      <li
        v-for="lighting in lightings"
        :key="lighting.key"
        class="flex items-center justify-between gap-4 py-2"
      >
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ lighting.label }}
          </span>
          <span class="block text-xs text-text-secondary">{{ dayOf(lighting.at) }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(lighting.at) }}
        </span>
      </li>
      <li class="flex items-center justify-between gap-4 py-2">
        <span class="min-w-0">
          <span class="block font-medium leading-snug text-text-primary">
            {{ isFestival ? t("zmanim.rest.end") : t("zmanim.shabbat.havdalah") }}
          </span>
          <span class="block text-xs text-text-secondary">
            {{ period.end ? dayOf(period.end) : markerDay(lastDay) }}
          </span>
        </span>
        <span v-if="period.end" class="shrink-0 font-semibold tabular-nums text-text-primary">
          {{ clock(period.end) }}
        </span>
        <!-- Pas d'heure de sortie ici ce jour-là (voir RestPeriod.end) : on le
             dit à la place, plutôt que d'en donner une venue d'un autre calcul. -->
        <span v-else class="max-w-[60%] shrink text-end text-xs text-text-secondary">
          {{ t("zmanim.rest.endUnknown") }}
        </span>
      </li>
      <!-- La sortie selon Rabbénou Tam, pour qui suit cet avis : plus tard,
           72 minutes après la chkia, fixes ou zmaniyot selon l'avis suivi
           (l'explication est dans la note). -->
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
          ? t("zmanim.rest.note", { minutes: candleMinutes, exit: exitRule })
          : t("zmanim.shabbat.note", { minutes: candleMinutes, exit: exitRule })
      }}<template v-if="period.endRabbenouTam">{{ " " }}{{ rabbenouTamNote }}</template>
    </p>

    <!-- L'érouv tavchilin : sans lui, on ne cuisine pas le vendredi de fête
         pour le Chabbat qui suit. Il se pose l'avant-veille, et c'est donc
         maintenant qu'il faut le dire. -->
    <p v-if="eruvNote" class="mt-1.5 text-xs text-text-secondary">{{ eruvNote }}</p>
  </section>
</template>
