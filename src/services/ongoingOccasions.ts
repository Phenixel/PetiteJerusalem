import type { HDate } from "@hebcal/core";
import { omerDay } from "./dailyCycles";
import { liturgicalDay } from "./nightBounds";
import { hanoukaNight } from "./sidourMoment";
import {
  birkatHalevanaLastDay,
  birkatHalevanaWindow,
  computeZmanim,
  hebrewDateFor,
  hebrewDayOf,
  moonAge,
  nightfallOf,
  restPeriodAt,
  saysBirkatHalevana,
  type ZmanimPlace,
} from "./zmanimService";

/**
 * What the calendar opens for a few days, shown on the home page above the
 * times of the day, apart from the deck (HomeOngoing.vue): the blessing of
 * the moon, the 'Hanouka lighting, the counting of the 'Omer. They come
 * back for a few nights and are missed for lack of a reminder; inside the
 * deck they hid under the service of the hour, and by day they did not show
 * at all.
 *
 * Each one is offered for the night under way or, by day, for the night to
 * come (the night rule, services/nightBounds: the night runs until dawn).
 * Once marked done, the device remembers it by its key
 * (services/parcours/occasions.ts), shared with the Sidour page, and it
 * leaves the home page until its next time.
 *
 * Held by src/__tests__/ongoingOccasions.test.ts.
 */
export type OngoingOccasion =
  | {
      kind: "halevana";
      key: string;
      /** The last day it is said. */
      until: HDate;
      /** Night has fallen: it can be said right now (otherwise, from nightfall). */
      now: boolean;
      /** The moon's age, in days since the molad (its drawing). */
      moonAge: number;
    }
  | {
      kind: "hanouka";
      key: string;
      /** The candle of the night under way, or of tonight (1 to 8). */
      candle: number;
      /** Evening has come: the candles are drawn lit. */
      lit: boolean;
      /** A Friday: lit before the Shabbat candles, at this time. */
      beforeShabbat: Date | null;
    }
  | {
      kind: "omer";
      key: string;
      /** The count of the Hebrew day under way (it turns at sunset). */
      day: number;
    };

/** The key of a month's moon, by its last day: `halevana:5787-8`. */
export const halevanaKey = (until: HDate): string =>
  `halevana:${until.getFullYear()}-${until.getMonth()}`;

/**
 * The night under way or, by day, the night to come: the Hebrew day it
 * opens, and whether it has begun (from sunset; until dawn).
 */
function nightOf(place: ZmanimPlace, now: Date): { opens: HDate; begun: boolean } {
  const evening = liturgicalDay(place, now);
  const sunset = computeZmanim(place, evening).find((z) => z.key === "sunset")?.date;
  return {
    opens: hebrewDayOf(place, evening).next(),
    begun: !!sunset && now.getTime() >= sunset.getTime(),
  };
}

function moonOf(
  place: ZmanimPlace,
  now: Date,
  night: HDate,
  begun: boolean,
): OngoingOccasion | null {
  if (!saysBirkatHalevana(place, night)) return null;
  // The window closes in the middle of a night: past it, nothing is left to say.
  if (now.getTime() > birkatHalevanaWindow(night).end.getTime()) return null;
  const until = birkatHalevanaLastDay(place, night);
  const fall = nightfallOf(place, night.prev());
  return {
    kind: "halevana",
    key: halevanaKey(until),
    until,
    now: begun && !!fall && now.getTime() >= fall.getTime(),
    moonAge: moonAge(night, now),
  };
}

function hanoukaOf(place: ZmanimPlace, night: HDate, begun: boolean): OngoingOccasion | null {
  const candle = hanoukaNight(night);
  if (candle === null) return null;
  // A Friday by day: the candle is lit before Shabbat comes in.
  const friday = !begun && night.prev().getDay() === 5;
  return {
    kind: "hanouka",
    key: `hanouka:${night.getFullYear()}-${candle}`,
    candle,
    lit: begun,
    beforeShabbat: friday ? (restPeriodAt(place, night, "fr")?.start ?? null) : null,
  };
}

function omerOf(place: ZmanimPlace, now: Date): OngoingOccasion | null {
  // As the 'Omer banner did: the count of the Hebrew day under way, said at
  // its opening night and valid until the next one.
  const hd = hebrewDateFor(place, now, now);
  const day = omerDay(hd);
  return day === null ? null : { kind: "omer", key: `omer:${hd.getFullYear()}-${day}`, day };
}

/** What is going on now, in the order the home page shows it; minus what is done. */
export function ongoingOccasions(
  place: ZmanimPlace,
  now: Date,
  done: readonly string[] = [],
): OngoingOccasion[] {
  const { opens, begun } = nightOf(place, now);
  return [hanoukaOf(place, opens, begun), moonOf(place, now, opens, begun), omerOf(place, now)]
    .filter((occasion): occasion is OngoingOccasion => occasion !== null)
    .filter((occasion) => !done.includes(occasion.key));
}
