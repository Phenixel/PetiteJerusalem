<script setup lang="ts">
// Page « Horaires du jour » : les zmanim d'un jour, groupés par moment de la
// journée, plus l'entrée et la sortie du Chabbat.
//
// Rien n'est chargé depuis le réseau : les horaires se calculent sur
// l'appareil (voir zmanimService), y compris pour les jours qu'on parcourt
// avec les flèches. Une fois la page ouverte, elle continue donc de servir
// sans connexion, et dans l'app native, dont les fichiers sont embarqués,
// elle s'ouvre aussi hors ligne. Le site web, lui, n'a pas de service
// worker : là, il faut le réseau pour charger la page (mais pas après).
import { computed, defineAsyncComponent, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { localeMessagesReady } from "../../i18n";
import { analyticsService } from "../../services/analyticsService";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";
import { isNativeApp } from "../../composables/useNativeApp";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../../composables/useZmanimPlaceLabel";
import { useZmanCountdown } from "../../composables/useZmanCountdown";
import { useNow } from "../../composables/useNow";
import { dateTimeFormat } from "../../services/intlCache";
import { localDayFrom, localDayKey } from "../../services/dateService";
import { getParashaForShabbat } from "../../services/dailyCycles";
import {
  candleLightingMinutes,
  chametzNear,
  computeZmanim,
  placeFromCity,
  dayHighlights,
  fastNear,
  festivalsOn,
  formatHebrewDate,
  formatZmanTime,
  hebrewDayOf,
  isIsraelPlace,
  restPeriodsNear,
  sameCivilDay,
  tachanunStatus,
  type City,
  type ZmanimPlace,
  type ZmanKey,
  nextZman,
  ZMAN_PERIODS,
  type ZmanPeriod,
  type ZmanTime,
  zmanimGap,
} from "../../services/zmanimService";
import { revealFromOrigin } from "../../composables/useRevealOrigin";
import { useToast } from "../../composables/useToast";
import { ensureNotificationPermission, useZmanReminders } from "../../composables/useZmanReminders";
import { cityInSentence, citySlug, findCityBySlug } from "../../content/zmanimCities";
import { isSectionPath, localeOfPath, sectionPath } from "../../content/seoLocales";
import RestTimes from "./RestTimes.vue";
import FastTimes from "./FastTimes.vue";
import ChametzTimes from "./ChametzTimes.vue";
import ZmanRow from "./ZmanRow.vue";
import ZmanReminderModal from "./ZmanReminderModal.vue";
import FeatureTour, { type TourStep } from "../../components/FeatureTour.vue";
import { useZmanimOpinion } from "../../composables/useZmanimOpinion";

// Chargés à la demande : la liste des hiloulot pèse 75 Ko, et la fenêtre de
// l'opinion ne sert qu'au clic sur son bouton.
const HiloulotSection = defineAsyncComponent(() => import("./HiloulotSection.vue"));
const ZmanimOpinionModal = defineAsyncComponent(() => import("./ZmanimOpinionModal.vue"));

// Chargé à la demande : le sélecteur embarque la liste des villes, inutile
// tant qu'on ne l'ouvre pas.
const CityPicker = defineAsyncComponent(() => import("./CityPicker.vue"));
import AppIcon from "../../components/icons/AppIcon.vue";
import AppModal from "../../components/AppModal.vue";
import PageTabs from "../../components/PageTabs.vue";
import { zmanimTabs } from "../../config/pageTabs";
import DayPicker from "../../components/DayPicker.vue";
import { useLocalePath } from "../../composables/useLocalePath";

/** Les pages traduites suivent l'espace de langue de l'URL ouverte. */
const { localePath } = useLocalePath();

/**
 * App native : les horaires du jour et le calendrier de l'année sont deux
 * onglets d'un même endroit. Le calendrier n'avait qu'un lien discret sous le
 * titre, que personne ne voyait ; la barre du bas, elle, est pleine. Les
 * adresses sont traduites, elles se construisent donc ici (voir PageTabs).
 */
const tabs = computed(() => zmanimTabs(localePath));

const { t, locale } = useI18n();
const location = useZmanimLocation();
const { status, locateDevice, selectCity, ensureNearby } = location;

/**
 * Le lieu de la page, distinct du lieu choisi. Sur /horaires/:ville, la page
 * montre cette ville sans rien changer aux réglages : visiter la page de
 * Lyon depuis un moteur de recherche ne doit ni remplacer le lieu mémorisé
 * de l'appareil, ni compter comme un choix de ville. Seuls le sélecteur et le
 * bouton de position touchent au lieu choisi, et ils ramènent alors sur
 * /horaires pour que l'adresse ne contredise pas ce qui est affiché.
 */
const routePlace = ref<ZmanimPlace | null>(null);
const place = computed(() => routePlace.value ?? location.place.value);

// L'horloge partagée des cartes de l'accueil : un seul tic pour toute l'app.
const now = useNow();

/** Décalage en jours par rapport à aujourd'hui (flèches de navigation). */
const dayOffset = ref(0);

const day = computed(() => {
  const date = new Date(now.value);
  date.setDate(date.getDate() + dayOffset.value);
  return date;
});
const isToday = computed(() => dayOffset.value === 0);

/**
 * Le jour affiché, vu comme une date choisissable : le calendrier s'ouvre sur
 * la date en cours d'affichage et la ramène en décalage de jours. Sans lui, un
 * jour un peu loin demandait autant d'appuis sur la flèche qu'il y a de jours.
 */
const dayPickerOpen = ref(false);
const dayKey = computed({
  get: () => localDayKey(day.value),
  set: (key: string) => {
    const picked = localDayFrom(key);
    if (!picked) return;
    const today = new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate());
    // Arrondi : les changements d'heure font des journées de 23 ou 25 heures.
    dayOffset.value = Math.round((picked.getTime() - today.getTime()) / 86_400_000);
  },
});

const times = computed(() => computeZmanim(place.value, day.value));
const upcoming = computed(() => (isToday.value ? nextZman(times.value, now.value) : null));

/**
 * Les temps de repos qui suivent le jour affiché : le Chabbat, un Yom Tov, ou
 * les deux d'un coup quand ils se touchent. Parcourir le calendrier avec les
 * flèches doit montrer ceux de cette semaine-là, pas toujours ceux d'à côté.
 */
const restPeriods = computed(() => restPeriodsNear(place.value, day.value, locale.value));

/** 18 minutes avant la chkia, 40 à Jérusalem : la note le dit au lieu affiché. */
const candleMinutes = computed(() => candleLightingMinutes(place.value));

/**
 * Le repos passe devant les horaires du jour le jour où il entre et tant qu'il
 * dure : le vendredi, l'heure d'allumage est ce qu'on vient vérifier. Les
 * autres jours, il garde sa place en bas de la page.
 */
const restFirst = computed(() => {
  const period = restPeriods.value[0];
  if (!period) return false;
  return (
    period.start.getTime() <= day.value.getTime() ||
    sameCivilDay(place.value, period.start, day.value)
  );
});

/**
 * Le jeûne du jour affiché ou du lendemain, tant qu'il n'est pas fini : il
 * s'annonce dès la veille, c'est le soir d'avant qu'on regarde à quelle heure
 * il commence. Kippour n'y passe pas, son cadre de repos le porte. Un jour
 * parcouru avec les flèches se lit comme une journée entière : son jeûne
 * reste affiché, même si l'heure du jour est déjà passée sa sortie.
 */
const fast = computed(() =>
  fastNear(place.value, day.value, locale.value, isToday.value ? now.value : null),
);

/**
 * Les limites du 'hamets, la veille de Pessah : celles du jour affiché ou
 * celles du lendemain, tant qu'elles ne sont pas passées. Annoncées dès la
 * veille comme le jeûne, et pour la même raison : c'est le soir d'avant qu'on
 * regarde jusqu'à quelle heure on pourra manger.
 */
const chametz = computed(() =>
  chametzNear(place.value, day.value, isToday.value ? now.value : null),
);

/** Le 'hamets suit le jeûne : même jour, même place dans la page. */
const chametzFirst = computed(() => {
  const deadlines = chametz.value;
  if (!deadlines) return false;
  return hebrewDayOf(place.value, day.value).abs() === deadlines.day.abs();
});

/**
 * Comme le repos, le jeûne passe devant les horaires le jour où il commence
 * et tant qu'il dure ; la veille, il attend en bas de la page. Tich'a beAv,
 * qui commence au coucher du soleil, monte donc dès la veille.
 */
const fastFirst = computed(() => {
  const period = fast.value;
  if (!period) return false;
  // Ta'anit Bekhorot n'oblige que les premiers-nés : il ne passe jamais
  // devant, et laisse la première place aux limites du 'hamets, que tout le
  // monde cherche ce jour-là (voir FastPeriod.firstbornOnly).
  if (period.firstbornOnly) return false;
  // Sans heure de début (l'aube par degrés n'existe pas ici ce jour-là, voir
  // FastPeriod.start), le jeûne monte le jour où il tombe, et pas la veille.
  if (!period.start) return hebrewDayOf(place.value, day.value).abs() === period.day.abs();
  return (
    period.start.getTime() <= day.value.getTime() ||
    sameCivilDay(place.value, period.start, day.value)
  );
});

/**
 * La paracha du Chabbat couvert par un bloc, celui dont les horaires sont
 * affichés, et non celui d'aujourd'hui : le samedi soir après la sortie, le
 * bloc montre déjà le Chabbat suivant, sa paracha doit suivre.
 */
const parashaOf = (shabbat: Date | null) =>
  shabbat ? getParashaForShabbat(shabbat, isIsraelPlace(place.value)) : null;

/**
 * Ce que l'avis suivi ne sait pas calculer ici aujourd'hui.
 *
 * Une ligne qui manque sans rien dire laisse croire à un oubli. Au nord de
 * Lille, l'aube de l'avis par degrés n'existe pas quelques semaines par an, et
 * les deux limites du Maguen Avraham, comptées depuis elle, pas davantage :
 * la note le dit, et renvoie à l'avis qui, lui, a une heure à donner.
 */
const gap = computed(() => zmanimGap(place.value, day.value));

/** Les noms des horaires absents, énumérés dans la note. */
const gapNames = computed(() =>
  (gap.value?.keys ?? []).map((key) => t(`zmanim.names.${key}`)).join(", "),
);

const byPeriod = computed(() =>
  ZMAN_PERIODS.map((period) => ({
    period,
    zmanim: times.value.filter((zman) => zman.period === period),
  })).filter((group) => group.zmanim.length > 0),
);

const PERIOD_ICONS: Record<ZmanPeriod, "sunrise" | "sun" | "clock" | "moon"> = {
  dawn: "sunrise",
  morning: "sun",
  afternoon: "clock",
  evening: "moon",
};

const clock = (date: Date) => formatZmanTime(date, place.value.tzid, locale.value);
const isNext = (zman: ZmanTime) => upcoming.value?.key === zman.key;

/**
 * Les rappels posés sur les horaires (app native seulement : une notification
 * se programme sur le téléphone qui la recevra, voir zmanReminderService).
 *
 * La page ne fait que tenir les réglages ; c'est le service, monté au
 * démarrage, qui les traduit en notifications et refait la programmation
 * quand le lieu, la langue ou le jour changent.
 */
const toast = useToast();
const { reminderFor, setReminder, clearReminder, lastMinutes, restEnabled } = useZmanReminders();
const reminderZman = ref<ZmanTime | null>(null);
const reminderOpen = ref(false);
/**
 * La ligne restée ouverte sur sa cloche, quand le geste s'est arrêté en
 * chemin. Une seule à la fois : ouvrir la suivante referme la précédente,
 * sinon la liste se couvrait de tiroirs entrouverts.
 */
const expandedZman = ref<ZmanKey | null>(null);

function expandRow(zman: ZmanTime, open: boolean): void {
  expandedZman.value = open ? zman.key : null;
}

/**
 * L'astuce des horaires, à la première visite (voir FeatureTour), en deux
 * pas. Le rappel d'abord : personne ne devine qu'une ligne se tire. Le
 * projecteur se pose sur la première ligne de la journée, qui s'ouvre
 * d'elle-même sur sa cloche et revient, le temps du pas (`demo` de ZmanRow),
 * pendant que la bulle dit le geste. Puis le lieu : le nom de la ville EST
 * le bouton qui la change, et rien ne le dit. App native seulement : sur le
 * site, la ligne ne se tire pas.
 */
const demoZman = ref<ZmanKey | null>(null);
const placeButton = ref<HTMLElement | null>(null);

const zmanimTip = computed<TourStep[]>(() => [
  {
    key: "reminder",
    icon: "bell",
    title: t("tips.zmanim.reminder.title"),
    text: t("tips.zmanim.reminder.text"),
    target: () => root.value?.querySelector<HTMLElement>("[data-zman-list] > li") ?? null,
    radius: 12,
    padding: 4,
    gesture: true,
  },
  {
    key: "place",
    icon: "map-pin",
    title: t("tips.zmanim.place.title"),
    text: t("tips.zmanim.place.text"),
    target: () => placeButton.value,
    radius: 9999,
  },
]);

function onTipStep(index: number): void {
  demoZman.value = index === 0 ? (byPeriod.value[0]?.zmanim[0]?.key ?? null) : null;
}

function onTipFinish(): void {
  demoZman.value = null;
}

/** Le délai posé sur un horaire, ou null : c'est lui que porte le triangle. */
const reminderMinutes = (zman: ZmanTime) =>
  isNativeApp ? (reminderFor(zman.key)?.minutesBefore ?? null) : null;

const zmanName = (zman: ZmanTime) => t(`zmanim.names.${zman.key}`);

function openReminder(zman: ZmanTime): void {
  expandedZman.value = null;
  reminderZman.value = zman;
  reminderOpen.value = true;
}

/**
 * Pose le rappel, la permission système obtenue. Sans elle, rien n'est
 * enregistré : un rappel qui ne peut pas sonner ne doit pas s'afficher comme
 * posé.
 */
async function applyReminder(zman: ZmanTime, minutes: number, source: string): Promise<void> {
  if (!(await ensureNotificationPermission(true))) {
    toast.error(t("zmanim.reminder.permissionDenied"));
    return;
  }
  setReminder(zman.key, minutes);
  analyticsService.capture("zman_reminder_set", { zman: zman.key, minutes, source });
  toast.success(
    minutes === 0
      ? t("zmanim.reminder.setToastNow", { name: zmanName(zman) })
      : t("zmanim.reminder.setToast", { name: zmanName(zman), minutes }),
  );
}

function removeReminder(zman: ZmanTime, source: string): void {
  clearReminder(zman.key);
  analyticsService.capture("zman_reminder_cleared", { zman: zman.key, source });
  toast.success(t("zmanim.reminder.clearedToast", { name: zmanName(zman) }));
}

/**
 * Le raccourci du glissement : pose le rappel, ou le retire, sans rien
 * demander. Le délai est le dernier réglé (15 minutes tant qu'on n'en a pas
 * choisi un autre) : qui règle ses rappels à une demi-heure les veut tous
 * ainsi, et le geste le lui épargne.
 */
function quickToggle(zman: ZmanTime): void {
  if (reminderFor(zman.key)) removeReminder(zman, "swipe");
  else void applyReminder(zman, lastMinutes.value, "swipe");
}

// « dans 2 h 15 » sous le prochain horaire, comme sur la carte de l'accueil :
// l'heure dit quand, le décompte dit s'il faut se presser.
const countdown = useZmanCountdown();
const timeLeft = computed(() => (upcoming.value ? countdown(upcoming.value.date, now.value) : ""));

const civilDate = computed(() =>
  dateTimeFormat(locale.value, {
    timeZone: place.value.tzid,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(day.value),
);
/**
 * La date hébraïque de l'en-tête : celle de la JOURNÉE civile affichée, sans
 * bascule à la chkia. Les deux dates de l'en-tête décrivent ainsi toujours le
 * même jour, du matin jusqu'à minuit ; le soir, la bascule est annoncée par
 * une ligne dédiée (nightNote) au lieu de changer la date en silence, ce qui
 * faisait cohabiter deux jours sous la même date civile.
 */
const hebrewDay = computed(() => hebrewDayOf(place.value, day.value));
const hebrewDate = computed(() => formatHebrewDate(hebrewDay.value, locale.value));

/**
 * La nuit tombée, le jour hébraïque suivant a commencé : la ligne du soir le
 * dit explicitement, avec ce que cette nuit ouvre (Roch Hodech, une fête, un
 * jeûne…), pour ne perdre aucune information en ancrant l'en-tête sur la
 * journée civile. Seulement pour aujourd'hui : un jour parcouru avec les
 * flèches se lit comme une journée, pas comme un instant.
 */
const nightNote = computed(() => {
  if (!isToday.value) return null;
  const sunset = times.value.find((zman) => zman.key === "sunset");
  if (!sunset || now.value.getTime() < sunset.date.getTime()) return null;
  const tonight = hebrewDay.value.next();
  const date = formatHebrewDate(tonight, locale.value);
  const names = [
    ...festivalsOn(place.value, tonight, locale.value),
    ...dayHighlights(place.value, tonight, locale.value),
  ];
  return names.length > 0
    ? t("zmanim.nightNoteWith", { date, names: names.join(" · ") })
    : t("zmanim.nightNote", { date });
});

/**
 * Ce que le jour a de particulier : Roch Hodech, 'Hanouka, un jeûne,
 * 'Hol haMoed… Les Yom Tov n'y sont d'ordinaire pas répétés, ils ont leur
 * cadre, avec leurs heures d'entrée et de sortie ; ils reviennent ici quand
 * aucun cadre affiché ne couvre le jour (un jour parcouru avec les flèches
 * dont le repos est déjà sorti à cette heure-là, un lieu sans chkia
 * calculable), plutôt que de laisser une fête sans nom.
 */
const holidays = computed(() => {
  const abs = hebrewDay.value.abs();
  const covered = restPeriods.value.some(
    (period) => period.first.abs() <= abs && abs <= period.last.abs(),
  );
  const festivals = covered ? [] : festivalsOn(place.value, hebrewDay.value, locale.value);
  return [...festivals, ...dayHighlights(place.value, hebrewDay.value, locale.value)];
});
/** Dit-on le tahanoun (null le Chabbat : la question ne s'y pose pas). */
const tachanun = computed(() => tachanunStatus(place.value, hebrewDay.value));

const placeLabel = useZmanimPlaceLabel(place);
// Les coordonnées restent affichées, entre parenthèses : le nom dit où l'on
// est, elles disent avec quelle précision les horaires sont calculés.
const coordinates = computed(() =>
  place.value.source === "device"
    ? `(${place.value.latitude.toFixed(3)}, ${place.value.longitude.toFixed(3)})`
    : null,
);

async function locateMe() {
  const granted = await locateDevice();
  analyticsService.capture("zmanim_location_requested", { granted });
  if (granted) leaveCityPage();
}

const pickerOpen = ref(false);

/**
 * Ce que sont ces horaires et ce qu'il advient de la position : une phrase
 * qu'on lit une fois. Elle ne tient plus la page (voir docs/design.md, « Le
 * mode d'emploi ne tient pas la page ») : un petit « i » à côté de la
 * position l'ouvre en fenêtre.
 */
const aboutOpen = ref(false);

function chooseCity(city: City) {
  selectCity(city);
  analyticsService.capture("zmanim_city_chosen", { city: city.name, country: city.country });
  leaveCityPage();
}

/** Un lieu vient d'être choisi : la page d'une ville cède la place à /horaires. */
function leaveCityPage(): void {
  if (!routeCity.value) return;
  void router.replace(sectionPath("horaires", localeOfPath(route.path)));
}

/**
 * L'avis suivi pour le calcul (Rav Posen, Rav Ovadia Yossef). Sur le SITE, il
 * se change ici : la page de réglages y est réservée aux comptes, et l'avis
 * qu'on suit ne doit pas l'être. Dans l'app, il vit dans l'onglet Préférences
 * des réglages, avec le reste, et le bouton ne charge pas la page d'un réglage
 * de plus.
 */
const { opinion } = useZmanimOpinion();
const opinionOpen = ref(false);

/** Racine de la page : cible du dévoilement circulaire (bouton rond natif). */
const root = ref<HTMLElement | null>(null);

const route = useRoute();
const router = useRouter();

/** La ville de l'URL, gardée pour reposer le titre quand la langue change. */
const routeCity = ref<City | null>(null);

/** Le titre et le canonique de la page : /horaires, ou /horaires/<ville>. */
function setMeta(city: City | null): void {
  // La page a une adresse par langue (/horaires, /en/shabbat-times,
  // /he/zmanei-shabbat) : le canonique suit celle qui est ouverte.
  const pathLocale = localeOfPath(route.path);
  const url = `${SITE_URL}${
    city
      ? sectionPath("horaires", pathLocale, citySlug(city.name))
      : sectionPath("horaires", pathLocale)
  }`;
  // Le catalogue est en français : « Genève », « Jérusalem ». Le titre d'une
  // page anglaise doit écrire Geneva, celui d'une page hébraïque ירושלים. En
  // hébreu, la préposition se colle au nom (avec un maqaf devant un nom
  // latin) : elle voyage donc avec la valeur, pas dans le gabarit.
  const uiLocale = locale.value === "en" || locale.value === "he" ? locale.value : "fr";
  const name = city ? cityInSentence(city.name, uiLocale) : "";
  seoService.setMeta({
    title: city ? t("seo.zmanimCityTitle", { city: name }) : t("seo.zmanimTitle"),
    description: city ? t("seo.zmanimCityDescription", { city: name }) : t("seo.zmanimDescription"),
    canonical: url,
    og: { url },
  });
}

/**
 * Applique la ville de l'URL (/horaires/:ville) : elle devient le lieu de
 * calcul, comme si elle avait été choisie dans le sélecteur. Le catalogue est
 * chargé à la demande, comme pour le sélecteur ; un slug inconnu ramène aux
 * horaires du lieu courant.
 */
async function applyRouteCity(): Promise<void> {
  const raw = route.params.ville;
  const slug = typeof raw === "string" ? raw.toLowerCase() : "";
  if (!slug) {
    routeCity.value = null;
    routePlace.value = null;
    setMeta(null);
    return;
  }
  const { default: cities } = await import("../../datas/cities.json");
  const city = findCityBySlug(cities as City[], slug);
  if (!city) {
    void router.replace(sectionPath("horaires", localeOfPath(route.path)));
    return;
  }
  routeCity.value = city;
  routePlace.value = placeFromCity(city);
  setMeta(city);
}

// La même page sert /horaires et /horaires/:ville : passer de l'une à l'autre
// ne remonte pas le composant, on suit donc le paramètre.
watch(
  () => route.params.ville,
  () => {
    // La même page sert six adresses (trois langues, avec et sans ville) :
    // c'est le chemin qui dit si l'on est encore chez elle, pas le nom.
    if (isSectionPath(route.path, "horaires")) void applyRouteCity();
  },
);

// Les messages en et he arrivent par import dynamique : le titre se repose
// quand ils sont là, avec le nom de la ville dans la bonne langue.
watch([locale, localeMessagesReady], () => setMeta(routeCity.value));

onMounted(() => {
  revealFromOrigin(root.value);
  // Position partagée avant que l'app ne sache la nommer : on la nomme ici,
  // sur la page où l'utilisateur regarde son lieu (le catalogue de villes y
  // est de toute façon à un clic, via le choix de ville).
  void ensureNearby();
  void applyRouteCity();
  analyticsService.capture("zmanim_viewed", { place: place.value.source });
  // Le rappel d'entrée du Chabbat et des fêtes est actif d'office : sans la
  // permission du système, il ne partirait jamais. On la demande ici, sur la
  // page où l'entrée du repos est sous les yeux, et non au lancement de
  // l'app, où la fenêtre du système surgirait sans que rien ne l'explique.
  // Le système ne pose la question qu'une fois : ensuite, l'appel ne fait rien.
  if (isNativeApp && restEnabled.value) void ensureNotificationPermission(true);
});
</script>

<template>
  <main ref="root" class="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
    <!-- App native : les horaires et le calendrier des fêtes sont deux onglets
         d'un même endroit, et ils tiennent lieu de titre (voir PageTabs). Sur
         le site, c'est le bandeau qui mène au calendrier. -->
    <PageTabs
      v-if="isNativeApp"
      :tabs="tabs"
      event="zmanim_tab_switched"
      :label="t('zmanim.navTitle')"
    />

    <h1
      class="text-center text-2xl md:text-3xl font-bold text-text-primary tracking-tight"
      :class="isNativeApp ? 'sr-only' : ''"
    >
      {{ t("zmanim.title") }}
    </h1>

    <!-- Le lieu de calcul et sa position, sur UNE ligne, centrés sous le
         titre. Le nom de la ville EST le bouton qui ouvre la liste des villes :
         c'est là qu'on cherche à cliquer, et un bouton « Choisir ma ville »
         posé à côté du nom disait deux fois la même chose. Le chevron le dit,
         comme sur toutes les listes de l'app. Les boutons sont petits et le
         second ne dit que « Ma position » : à deux, ils tiennent côte à côte
         sur un téléphone, même devant un nom de ville un peu long, qui cède
         alors la place plutôt que de renvoyer le bouton à la ligne. Sur le
         site, l'avis suivi s'y ajoute et la ligne peut se replier. -->
    <div
      class="mt-3 flex items-center justify-center gap-2"
      :class="isNativeApp ? 'flex-nowrap' : 'flex-wrap'"
    >
      <button
        ref="placeButton"
        type="button"
        class="btn btn-soft btn-sm min-w-0"
        :aria-label="t('zmanim.place.changeCity', { city: placeLabel })"
        @click="pickerOpen = true"
      >
        <AppIcon name="map-pin" :size="16" class="text-primary" />
        <span class="min-w-0 truncate font-semibold">{{ placeLabel }}</span>
        <AppIcon name="chevron-down" :size="14" class="text-text-secondary" />
      </button>
      <!-- Le site n'a pas de réglages sans compte : l'avis suivi se change
           ici, sur la page qu'il gouverne. -->
      <button
        v-if="!isNativeApp"
        type="button"
        class="btn btn-soft btn-sm"
        :aria-label="t('zmanim.opinions.change')"
        @click="opinionOpen = true"
      >
        <AppIcon name="clock" :size="16" class="text-primary" />
        <span class="font-semibold">{{ t(`zmanim.opinions.${opinion}.short`) }}</span>
        <AppIcon name="chevron-down" :size="14" class="text-text-secondary" />
      </button>
      <!-- « Ma position », et rien de plus : ce que le bouton fait au juste
           (utiliser la position, ou l'actualiser) reste dans son étiquette
           pour les lecteurs d'écran. -->
      <button
        type="button"
        class="btn btn-soft btn-sm shrink-0"
        :disabled="status === 'loading'"
        :aria-label="
          status === 'loading'
            ? t('zmanim.place.locating')
            : place.source === 'device'
              ? t('zmanim.place.refresh')
              : t('zmanim.place.useMine')
        "
        @click="locateMe"
      >
        <AppIcon
          :name="status === 'loading' ? 'spinner' : 'locate'"
          :size="16"
          :class="status === 'loading' ? 'animate-spin' : ''"
        />
        {{ status === "loading" ? t("zmanim.place.locating") : t("zmanim.place.mine") }}
      </button>
    </div>

    <!-- Les coordonnées, sous les boutons : elles disent d'où sortent les
         horaires quand la position vient de l'appareil, elles n'ont pas à
         allonger la ligne des commandes. À côté, le « i » qui ouvre
         l'explication : ce que sont ces horaires, et ce qu'il advient de la
         position. Elle ne tient plus la page en clair, on la lit une fois. -->
    <p class="mt-2 flex items-center justify-center gap-1 text-sm text-text-secondary">
      <span v-if="coordinates" class="tabular-nums">{{ coordinates }}</span>
      <button
        type="button"
        class="icon-btn !h-7 !w-7"
        :aria-label="t('zmanim.about.open')"
        @click="aboutOpen = true"
      >
        <AppIcon name="info" :size="16" />
      </button>
    </p>

    <!-- Un refus de la position se dit en clair : il est plus urgent qu'une
         explication, et il change ce qui est affiché. -->
    <p
      v-if="status === 'denied' || status === 'unavailable'"
      class="mt-2 text-center text-sm text-text-secondary leading-relaxed"
    >
      {{ status === "denied" ? t("zmanim.place.denied") : t("zmanim.place.unavailable") }}
    </p>

    <!-- Jour affiché : les flèches vont au jour d'à côté, la date elle-même
         ouvre le calendrier pour aller loin d'un geste. -->
    <div class="mx-auto mt-8 flex max-w-md items-center justify-between gap-2">
      <button
        type="button"
        class="icon-btn shrink-0"
        :aria-label="t('zmanim.previousDay')"
        @click="dayOffset--"
      >
        <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
      </button>

      <button
        type="button"
        class="min-w-0 flex-1 rounded-control px-3 py-1 text-center transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        :aria-label="t('common.chooseDate')"
        @click="dayPickerOpen = true"
      >
        <span class="block text-lg font-semibold text-text-primary first-letter:uppercase">
          {{ civilDate }}
        </span>
        <span class="block text-sm text-text-secondary">{{ hebrewDate }}</span>
      </button>

      <button
        type="button"
        class="icon-btn shrink-0"
        :aria-label="t('zmanim.nextDay')"
        @click="dayOffset++"
      >
        <AppIcon name="chevron-right" :size="18" class="rtl:rotate-180" />
      </button>
    </div>

    <!-- Ce qui caractérise le jour, sous sa date : les fêtes, puis le
         tahanoun. En italique, à même le fond : ce n'est pas une donnée qu'on
         vient chercher, c'est une précision sur la date. Le jour SANS tahanoun
         est celui qui change quelque chose à l'office : il passe en gras et en
         couleur. Les fêtes déjà portées par le cadre du repos (avec leurs
         heures) ne sont pas répétées. -->
    <div v-if="holidays.length > 0 || tachanun || nightNote" class="mt-2 text-center">
      <p v-for="name in holidays" :key="name" class="font-semibold text-primary">
        {{ name }}
      </p>
      <p
        v-if="tachanun"
        class="text-sm italic"
        :class="tachanun === 'none' ? 'font-bold text-primary' : 'text-text-secondary'"
      >
        {{ t(`zmanim.tachanun.${tachanun}`) }}
      </p>
      <!-- La bascule du soir, dite au lieu d'être appliquée en silence. La lune
           est dans le texte, devant son premier mot : posée à côté du bloc,
           elle flottait au milieu d'une phrase sur deux lignes. -->
      <p v-if="nightNote" class="mt-1 text-sm text-primary">
        <AppIcon name="moon" :size="13" class="me-1" />{{ nightNote }}
      </p>
    </div>

    <div v-if="!isToday" class="mt-3 text-center">
      <button type="button" class="btn btn-soft" @click="dayOffset = 0">
        {{ t("zmanim.backToToday") }}
      </button>
    </div>

    <!-- Le prochain horaire, mis en avant. Pas d'intitulé : une heure isolée
         au-dessus de la liste, en couleur, ne peut être que celle-là. -->
    <div
      v-if="upcoming"
      class="card mt-4 flex items-center justify-between gap-3 bg-primary/5 p-4 dark:bg-primary/10"
    >
      <span class="min-w-0">
        <span class="block font-semibold leading-snug text-text-primary">
          {{ t(`zmanim.names.${upcoming.key}`) }}
        </span>
        <!-- Le temps qui reste : c'est lui qui dit s'il faut se presser. -->
        <span v-if="timeLeft" class="block text-sm text-text-secondary">{{ timeLeft }}</span>
      </span>
      <span class="shrink-0 text-2xl font-bold tabular-nums text-primary">
        {{ clock(upcoming.date) }}
      </span>
    </div>

    <p v-if="times.length === 0" class="mt-6 text-text-secondary">{{ t("zmanim.unavailable") }}</p>

    <!-- Le jeûne commencé passe devant, comme le repos -->
    <FastTimes v-if="fast && fastFirst" :fast="fast" :tzid="place.tzid" class="mt-5" />

    <!-- La veille de Pessah, les limites du 'hamets : le jour même, elles
         passent devant comme le jeûne ; la veille, elles attendent en bas. -->
    <ChametzTimes
      v-if="chametz && chametzFirst"
      :chametz="chametz"
      :tzid="place.tzid"
      class="mt-5"
    />

    <!-- Le repos commencé passe devant : c'est ce qu'on vient vérifier -->
    <RestTimes
      v-for="period in restFirst ? restPeriods : []"
      :key="period.start.getTime()"
      :period="period"
      :parasha="parashaOf(period.shabbat)"
      :tzid="place.tzid"
      :candle-minutes="candleMinutes"
      class="mt-5"
    />

    <!-- Les horaires à la suite : chaque titre ouvre son groupe et sert de
         séparation. Sans cadres, la journée se lit d'un trait, et tient en
         beaucoup moins de défilement. -->
    <!-- Le filet d'un titre de groupe SÉPARE deux groupes : le premier n'en
         porte pas, sinon une ligne venait se coller sous ce qui précède. -->
    <section v-for="(group, index) in byPeriod" :key="group.period">
      <h2
        class="flex items-center gap-2 pb-1 text-base font-bold text-text-secondary"
        :class="index === 0 ? 'pt-6' : 'border-t border-line pt-4'"
      >
        <AppIcon :name="PERIOD_ICONS[group.period]" :size="16" class="text-primary" />
        {{ t(`zmanim.periods.${group.period}`) }}
      </h2>
      <!-- Dans l'app, chaque ligne se touche pour poser un rappel, et se tire
           vers la gauche pour le poser d'un geste (voir ZmanRow). Sur le site,
           elle reste une ligne de texte : rien à programmer dans un
           navigateur. -->
      <ul class="flex flex-col divide-y divide-line" data-zman-list>
        <ZmanRow
          v-for="zman in group.zmanim"
          :key="zman.key"
          :zman="zman"
          :time="clock(zman.date)"
          :is-next="isNext(zman)"
          :minutes-before="reminderMinutes(zman)"
          :can-remind="isNativeApp"
          :expanded="expandedZman === zman.key"
          :demo="demoZman === zman.key"
          @open="openReminder(zman)"
          @toggle="quickToggle(zman)"
          @update:expanded="expandRow(zman, $event)"
        />
      </ul>
    </section>

    <!-- Ce que l'avis suivi ne calcule pas ici aujourd'hui, dit sous la liste
         plutôt que laissé en blanc au milieu (voir zmanimGap). -->
    <p
      v-if="gap"
      class="mt-5 border-t border-line pt-3 text-sm text-text-secondary leading-relaxed"
    >
      {{ t(`zmanim.gap.${gap.reason}`, { names: gapNames }) }}
    </p>

    <!-- Le jeûne de demain, annoncé dès la veille, sous les horaires du jour -->
    <FastTimes v-if="fast && !fastFirst" :fast="fast" :tzid="place.tzid" class="mt-5" />

    <ChametzTimes
      v-if="chametz && !chametzFirst"
      :chametz="chametz"
      :tzid="place.tzid"
      class="mt-5"
    />

    <RestTimes
      v-for="period in restFirst ? [] : restPeriods"
      :key="period.start.getTime()"
      :period="period"
      :parasha="parashaOf(period.shabbat)"
      :tzid="place.tzid"
      :candle-minutes="candleMinutes"
      class="mt-5 first:mt-0"
    />

    <!-- Les hiloulot du jour, tout en bas : c'est ce qu'on trouve en arrivant
         au bout, comme au bas de la colonne d'un calendrier imprimé. -->
    <HiloulotSection :day="hebrewDay" />

    <p class="mt-5 border-t border-line pt-3 text-sm text-text-secondary leading-relaxed">
      {{ t("zmanim.disclaimer") }}
    </p>

    <CityPicker v-model:show="pickerOpen" :current="place.city" @select="chooseCity" />
    <AppModal
      :open="aboutOpen"
      :label="t('zmanim.about.title')"
      panel-class="modal-panel !max-w-sm animate-[scaleIn_0.3s_ease]"
      @close="aboutOpen = false"
    >
      <div class="mb-1 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-lg font-bold text-text-primary">
          <AppIcon name="info" :size="17" class="text-primary" />
          {{ t("zmanim.about.title") }}
        </h3>
        <button
          type="button"
          class="icon-btn -me-1.5"
          :aria-label="t('common.close')"
          @click="aboutOpen = false"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>
      <p class="text-sm text-text-secondary leading-relaxed">
        {{ t(isNativeApp ? "zmanim.descriptionOffline" : "zmanim.description") }}
      </p>
    </AppModal>
    <ZmanimOpinionModal v-if="!isNativeApp" v-model:show="opinionOpen" />
    <!-- L'astuce des horaires, une fois : la première ligne se tire toute
         seule pendant que la bulle dit le geste, puis la ville (zmanimTip). -->
    <FeatureTour
      v-if="isNativeApp"
      tip="zmanim-reminder"
      :steps="zmanimTip"
      @step="onTipStep"
      @finish="onTipFinish"
    />
    <ZmanReminderModal
      v-if="reminderZman"
      v-model:show="reminderOpen"
      :name="t(`zmanim.names.${reminderZman.key}`)"
      :time="clock(reminderZman.date)"
      :place-label="placeLabel"
      :minutes="reminderMinutes(reminderZman)"
      :default-minutes="lastMinutes"
      @save="applyReminder(reminderZman, $event, 'modal')"
      @remove="removeReminder(reminderZman, 'modal')"
    />
    <DayPicker
      v-model="dayKey"
      :open="dayPickerOpen"
      :label="t('zmanim.title')"
      @close="dayPickerOpen = false"
    />
  </main>
</template>
