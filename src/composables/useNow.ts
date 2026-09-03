import { onMounted, onUnmounted, readonly, ref, type Ref } from "vue";

/**
 * L'heure courante, partagée : les cartes de l'accueil (horaires, 'Omer,
 * bénédiction de la lune, sidour) tenaient chacune leur propre `setInterval`,
 * quatre réveils et quatre cycles de réactivité pour la même horloge. Un seul
 * tic, tant qu'au moins un composant écoute ; la ref se remet à l'heure au
 * montage, pour ne pas servir une date figée d'un passage précédent.
 */
const TICK_MS = 30_000;

const now = ref(new Date());
let listeners = 0;
let ticker: ReturnType<typeof setInterval> | null = null;

export function useNow(): Readonly<Ref<Date>> {
  onMounted(() => {
    now.value = new Date();
    if (listeners++ === 0) {
      ticker = setInterval(() => (now.value = new Date()), TICK_MS);
    }
  });
  onUnmounted(() => {
    if (--listeners === 0 && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  });
  return readonly(now) as Readonly<Ref<Date>>;
}
