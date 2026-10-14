import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { RouteLocationRaw } from "vue-router";
import type { DeckArtSpec } from "../components/parcours/home/DeckArt.vue";
import { sidourText } from "../content/sidourGroups";
import { omerDay, tehilimOfCycle } from "../services/dailyCycles";
import { localDayFrom } from "../services/dateService";
import {
  isOwnHabit,
  type DayKey,
  type MomentId,
  type Objective,
  type ProgramObjective,
} from "../services/parcours/model";
import { weekdayOf } from "../services/parcours/days";
import { dayOrder, deckOrder } from "../services/parcours/moments";
import { portionMinutes } from "../services/parcours/plan";
import { readOccasionsDone, writeOccasionDone } from "../services/parcours/occasions";
import { liveObjectives } from "../services/parcours/schedule";
import { unitOf } from "../services/parcours/texts";
import { MOMENT_TEXTS, sidourMoment } from "../services/sidourMoment";
import { computeZmanim, formatHebrewDate, hebrewDateFor } from "../services/zmanimService";
import { useCurrentMoment } from "./useCurrentMoment";
import { useOfficeTimes } from "./useOfficeTimes";
import { useParcours } from "./useParcours";
import { useParcoursViews, type TaskView } from "./useParcoursViews";
import { psalmsLabel } from "./useTehilimDay";
import { useZmanimLocation } from "./useZmanimLocation";

/**
 * Le paquet de l'accueil : les cartes d'aujourd'hui, dans l'ordre où elles se
 * présentent (docs/design.md, « Le paquet de l'accueil »).
 *
 * Une carte dit son moment (« Ce matin », « Maintenant » pour l'office de
 * l'heure), son nom, et jusqu'à quand ou à partir de quand pour un office.
 * En tête, l'office dont c'est l'heure, s'il est dans le parcours ; puis le
 * moment présent et ce qui se fait dans la journée, les moments qui
 * viennent, ceux déjà passés. Ce qu'on a remis « plus tard » passe sous le
 * paquet, le temps de la journée ; ce qui est fait, ou mis de côté pour
 * aujourd'hui, le quitte et se retrouve dans le portefeuille.
 *
 * Avec les tâches, les cartes en plus, qui ne comptent pas dans la journée :
 * les cartes d'occasion, à leur heure (la lune les nuits où on la bénit, le
 * compte du 'Omer le soir, l'allumage de 'Hanouka), qui s'ouvrent de même ;
 * et, après tout le reste, « Rattraper » pour un programme en retard, « si
 * vous avez un moment ».
 */

/** Une occasion du calendrier, et sa fois (voir services/parcours/occasions.ts). */
export interface DeckOccasion {
  kind: "hanouka" | "halevana" | "omer";
  /** La clé retenue sur l'appareil une fois faite. */
  key: string;
  /** Le soir du 'Omer, la bougie de 'Hanouka. */
  n?: number;
}

/** Une carte du paquet, ou du portefeuille. */
export interface DeckCard {
  /** Unique sur la journée. */
  key: string;
  /** La tâche du parcours ; null pour une carte en plus. */
  view: TaskView | null;
  /** Le programme à rattraper, pour la carte « Rattraper ». */
  catchUp: ProgramObjective | null;
  /** L'occasion, pour une carte d'occasion. */
  occasion: DeckOccasion | null;
  moment: MomentId;
  /** Le moment : « Ce soir », « Maintenant ». */
  kicker: string;
  /** Faite : « Fait ce matin », « Tenu aujourd'hui ». */
  doneKicker: string;
  title: string;
  meta: string;
  /** Où la toucher mène ; null : le toucher ouvre sa fiche. */
  route: RouteLocationRaw | null;
  art: DeckArtSpec | null;
  done: boolean;
  skipped: boolean;
  /** Une carte en plus : elle ne compte pas dans la journée, et se montre en clair. */
  extra: boolean;
  /** Le programme qu'elle sert : la fiche propose de le voir. */
  programId: string | null;
}

/** Ce qu'on a remis à plus tard, le jour où on l'a fait : la journée suivante repart de zéro. */
const postponed = ref<{ day: DayKey; keys: string[] }>({ day: "", keys: [] });

/** Les cartes en plus mises de côté pour aujourd'hui (« Pas aujourd'hui »). */
const dismissed = ref<{ day: DayKey; keys: string[] }>({ day: "", keys: [] });

/** Les occasions faites, retenues sur l'appareil. */
const occasionsDone = ref<string[]>(readOccasionsDone());

/**
 * Le rang d'une occasion dans la pile : l'allumage de 'Hanouka passe devant
 * l'office du soir, la lune et le 'Omer juste après lui.
 */
const HANOUKA_RANK = -2;
const OCCASION_RANK = -0.5;
/** Rattraper se range après les tâches, avant ce qu'on a remis à plus tard. */
const EXTRA_RANK = 50;
const LATER_RANK = 100;

export function useTodayDeck() {
  const { t, locale } = useI18n();
  const store = useParcours();
  const views = useParcoursViews();
  const moment = useCurrentMoment();
  const offices = useOfficeTimes();
  const now = offices.now;
  const { place } = useZmanimLocation();

  const today = store.today;
  const later = computed(() => (postponed.value.day === today.value ? postponed.value.keys : []));

  /** L'office de l'heure, quand le parcours le porte. */
  const isNow = (view: TaskView): boolean => offices.isNow(view.task.step);

  function kickerOf(view: TaskView): string {
    if (isNow(view)) return t("parcours.hub.now");
    return view.kicker;
  }

  function doneKickerOf(moment: MomentId): string {
    if (moment === "morning") return t("parcours.kickerDone.morning");
    if (moment === "anytime") return t("parcours.kickerDone.anytime");
    return t("parcours.kickerDone.other");
  }

  /** Ce que dit la carte sous son nom : l'heure d'un office, le nombre de psaumes. */
  function metaOf(view: TaskView): { title: string; meta: string } {
    const { task, objective } = view;
    if (task.step) {
      return { title: view.title, meta: offices.officeMeta(task.step) ?? view.meta };
    }
    if (objective.kind === "habit") {
      return {
        title: view.title,
        meta: isOwnHabit(objective.preset) ? t("parcours.hub.personal") : view.meta,
      };
    }
    if (objective.kind === "cycle" && objective.cycle !== "parasha") {
      const date = localDayFrom(view.day) ?? new Date();
      date.setHours(12);
      const psalms = tehilimOfCycle(objective.cycle, date).psalms;
      return { title: psalmsLabel(psalms, t), meta: views.unitsLabel("psalm", psalms.length) };
    }
    return { title: view.title, meta: view.meta };
  }

  /** Le liseré d'un volume : où en est le programme. */
  function progressOf(objective: Objective): number {
    if (objective.kind !== "program" || objective.total <= 0) return 0;
    const position = store.context.value.plans.get(objective.id)?.positionAt(today.value) ?? 0;
    return Math.min(1, position / objective.total);
  }

  /**
   * L'objet de la carte : le sidour pour un office, la lune pour le coucher,
   * le volume pour ce qui se lit. Une habitude sans texte (les tefilin, garder
   * sa langue) n'en porte pas.
   */
  function artOf(objective: Objective, step: string | undefined): DeckArtSpec | null {
    if (objective.kind === "habit") {
      if (step || objective.preset === "birkat-hamazon") return { kind: "siddur" };
      return objective.preset === "chema-al-hamita" ? { kind: "moon" } : null;
    }
    const art = views.objectiveArt(objective);
    if (art?.kind !== "volume") return null;
    return { kind: "volume", color: art.color, label: art.label, progress: progressOf(objective) };
  }

  function taskCard(view: TaskView): DeckCard {
    const { title, meta } = metaOf(view);
    return {
      key: view.key,
      view,
      catchUp: null,
      occasion: null,
      moment: view.task.moment,
      kicker: kickerOf(view),
      doneKicker: doneKickerOf(view.task.moment),
      title,
      meta,
      route: view.route,
      art: artOf(view.objective, view.task.step),
      done: view.progress === "done",
      skipped: view.skipped,
      extra: false,
      programId: view.objective.kind === "program" ? view.objective.id : null,
    };
  }

  /** « Rattraper Moed » : un programme en retard, si l'on a un moment. */
  function catchUpCard(program: ProgramObjective, behind: number): DeckCard {
    const unit = unitOf(program.corpus);
    return {
      key: `${today.value}:rattraper:${program.id}`,
      view: null,
      catchUp: program,
      occasion: null,
      moment: "anytime",
      kicker: t("parcours.hub.catchUpKicker"),
      doneKicker: t("parcours.kickerDone.other"),
      title: t("parcours.hub.catchUpTitle", { name: views.coverLabel(program) }),
      meta: t("parcours.hub.catchUpMeta", {
        units: views.unitsLabel(unit, behind),
        minutes: portionMinutes(unit, behind),
      }),
      route: { path: `/parcours/objectif/${program.id}`, query: { rattraper: "1" } },
      art: artOf(program, undefined),
      done: false,
      skipped: false,
      extra: true,
      programId: program.id,
    };
  }

  /** Une carte d'occasion : elle s'ouvre sur son texte, comme la carte du Sidour. */
  function occasionCard(
    occasion: DeckOccasion,
    look: Pick<DeckCard, "kicker" | "title" | "meta" | "route" | "art">,
  ): DeckCard {
    const done = occasionsDone.value.includes(occasion.key);
    return {
      key: `${today.value}:${occasion.key}`,
      view: null,
      catchUp: null,
      occasion,
      moment: "evening",
      doneKicker: t("parcours.kickerDone.other"),
      ...look,
      done,
      skipped: false,
      extra: true,
      programId: null,
    };
  }

  const sidour = computed(() => sidourMoment(place.value, now.value));

  /** La nuit, de la chkia au lever du soleil : le 'Omer se compte. */
  const isNight = computed(() => {
    const zmanim = computeZmanim(place.value, now.value);
    const sunrise = zmanim.find((z) => z.key === "sunrise")?.date;
    const sunset = zmanim.find((z) => z.key === "sunset")?.date;
    return (!!sunset && now.value >= sunset) || (!!sunrise && now.value < sunrise);
  });

  const occasions = computed<DeckCard[]>(() => {
    const cards: DeckCard[] = [];
    const hero = sidour.value.hero;
    const hebrewDay = hebrewDateFor(place.value, now.value, now.value);
    const year = hebrewDay.getFullYear();
    const textRoute = (key: string) => sidourText(key)?.path ?? null;
    const textTitle = (key: string) => {
      const text = sidourText(key);
      return text ? (locale.value === "he" ? text.hebrew : text.latin) : "";
    };

    if (hero?.kind === "hanouka" && hero.night) {
      const n = hero.night;
      cards.push(
        occasionCard(
          { kind: "hanouka", key: `hanouka:${year}-${n}`, n },
          {
            kicker: t("sidour.tonight"),
            title: textTitle(MOMENT_TEXTS.hanouka),
            meta: n === 1 ? t("sidour.hanouka.nightOne") : t("sidour.hanouka.night", { n }),
            route: textRoute(MOMENT_TEXTS.hanouka),
            art: { kind: "object", art: { kind: "hanoukia", night: n, lit: true } },
          },
        ),
      );
    }
    if (hero?.kind === "halevana" && hero.until) {
      const until = hero.until;
      cards.push(
        occasionCard(
          { kind: "halevana", key: `halevana:${until.getFullYear()}-${until.getMonth()}` },
          {
            kicker: t("sidour.thisNight"),
            title: t("home.birkatHalevana.title"),
            meta: t("sidour.halevana.until", { date: formatHebrewDate(until, locale.value) }),
            route: textRoute(MOMENT_TEXTS.halevana),
            art: { kind: "object", art: { kind: "moon", age: hero.moonAge ?? 10 } },
          },
        ),
      );
    }
    const omer = omerDay(hebrewDay);
    if (omer !== null && isNight.value) {
      const left = 49 - omer;
      cards.push(
        occasionCard(
          { kind: "omer", key: `omer:${year}-${omer}`, n: omer },
          {
            kicker: t("sidour.tonight"),
            title:
              omer === 1 && locale.value === "fr"
                ? t("home.omer.dayOne")
                : t("home.omer.day", { n: omer }),
            meta: left > 0 ? t("home.omer.remaining", { n: left }) : t("home.omer.last"),
            route: textRoute(MOMENT_TEXTS.arvit),
            art: { kind: "object", art: { kind: "omer" } },
          },
        ),
      );
    }
    return cards;
  });

  /**
   * Une carte de la semaine ne vient sur l'accueil que les jours qu'on lui a
   * donnés (P2-Semaine) ; elle reste dans Ma journée et sur la page du
   * programme.
   */
  function onDeckToday(objective: Objective): boolean {
    if (objective.kind !== "program" || objective.rhythm !== "weekly" || !objective.cardDays) {
      return true;
    }
    return objective.cardDays.includes(weekdayOf(today.value));
  }

  const tasks = computed<DeckCard[]>(() =>
    store.todayTasks.value
      .map((task) => views.taskView(task, today.value))
      .filter((view) => view.progress === "done" || onDeckToday(view.objective))
      .map(taskCard),
  );

  const catchUps = computed<DeckCard[]>(() => {
    const day = today.value;
    const cards: DeckCard[] = [];
    for (const objective of liveObjectives(store.data.value)) {
      if (objective.kind !== "program") continue;
      if (objective.pausedFrom !== undefined && objective.pausedFrom <= day) continue;
      const behind = store.context.value.plans.get(objective.id)?.state(day).behind ?? 0;
      if (behind > 0) cards.push(catchUpCard(objective, behind));
    }
    return cards;
  });

  /**
   * La journée entière, du matin au coucher, les occasions avec le soir, puis
   * « Rattraper » : le portefeuille.
   */
  const day = computed<DeckCard[]>(() => {
    const aside = dismissed.value.day === today.value ? dismissed.value.keys : [];
    const setAside = (card: DeckCard): DeckCard =>
      aside.includes(card.key) ? { ...card, skipped: true } : card;
    return [
      ...[...tasks.value, ...occasions.value.map(setAside)].sort(
        (a, b) => dayOrder(a.moment) - dayOrder(b.moment),
      ),
      ...catchUps.value.map(setAside),
    ];
  });

  function rank(card: DeckCard): number {
    const delayed = later.value.indexOf(card.key);
    if (delayed >= 0) return LATER_RANK + delayed;
    if (card.occasion) return card.occasion.kind === "hanouka" ? HANOUKA_RANK : OCCASION_RANK;
    if (card.extra) return EXTRA_RANK;
    if (card.view && isNow(card.view)) return -1;
    return deckOrder(card.moment, moment.value);
  }

  /** Ce qui reste à faire, la carte du dessus en premier. */
  const pending = computed(() =>
    day.value.filter((card) => !card.done && !card.skipped).sort((a, b) => rank(a) - rank(b)),
  );

  const top = computed<DeckCard | null>(() => pending.value[0] ?? null);

  /** Le compte de la journée : les tâches seules, pas les cartes en plus. */
  const count = computed(() => ({
    done: tasks.value.filter((card) => card.done).length,
    total: tasks.value.length,
  }));

  /** Le parcours porte les offices : le raccourci du Sidour de l'accueil se tait. */
  const coversOffices = computed(() => tasks.value.some((card) => card.view?.task.step));

  /** « Plus tard » : la carte passe sous le paquet (Ma journée aussi la remet). */
  function postpone(card: Pick<DeckCard, "key">): void {
    const keys = later.value.filter((key) => key !== card.key);
    postponed.value = { day: today.value, keys: [...keys, card.key] };
  }

  /** « Pas aujourd'hui », ou son contraire, pour une carte en plus (rattraper, une occasion). */
  function setAside(card: DeckCard, aside: boolean): void {
    const keys = dismissed.value.day === today.value ? dismissed.value.keys : [];
    const rest = keys.filter((key) => key !== card.key);
    dismissed.value = { day: today.value, keys: aside ? [...rest, card.key] : rest };
  }

  /** Une occasion faite, ou défaite : l'appareil s'en souvient. */
  function markOccasion(card: DeckCard, done: boolean): void {
    if (!card.occasion) return;
    occasionsDone.value = writeOccasionDone(occasionsDone.value, card.occasion.key, done);
  }

  /** Remise à plus tard aujourd'hui : son moment le dit dans le portefeuille. */
  const isLater = (card: Pick<DeckCard, "key">): boolean => later.value.includes(card.key);

  return {
    day,
    pending,
    top,
    count,
    moment,
    coversOffices,
    postpone,
    setAside,
    markOccasion,
    isLater,
  };
}
