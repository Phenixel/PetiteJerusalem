import { computed, type ComputedRef } from "vue";
import { momentAt } from "../services/parcours/moments";
import type { MomentId } from "../services/parcours/model";
import { computeZmanim } from "../services/zmanimService";
import { useNow } from "./useNow";
import { useZmanimLocation } from "./useZmanimLocation";

/**
 * Le moment présent de la journée, au soleil du lieu des horaires : le matin
 * jusqu'à 'hatsot, l'après-midi jusqu'à la chkia, le soir, puis le coucher
 * (voir services/parcours/moments.ts). Il range le paquet de l'accueil.
 */
export function useCurrentMoment(): ComputedRef<MomentId> {
  const now = useNow();
  const { place } = useZmanimLocation();
  const times = computed(() => {
    const zmanim = computeZmanim(place.value, now.value);
    const chatzot = zmanim.find((z) => z.key === "chatzot")?.date;
    const sunset = zmanim.find((z) => z.key === "sunset")?.date;
    return chatzot && sunset ? { chatzot, sunset } : null;
  });
  return computed(() => momentAt(now.value, times.value));
}
