import { onBeforeUnmount, onMounted, toValue, watch, type MaybeRefOrGetter } from "vue";

/**
 * L'écran reste allumé pendant la lecture d'un texte.
 *
 * On lit un office ou un chapitre de Tehilim sans toucher l'écran pendant de
 * longues minutes : le téléphone, lui, ne voit qu'un appareil inactif et se
 * met en veille au milieu du Chema. Il faut alors le rallumer, parfois le
 * déverrouiller, et retrouver la ligne, les mains prises ou en pleine amida.
 * Tant qu'un texte est ouvert, on demande donc à l'appareil de ne pas
 * s'éteindre ; le verrou est rendu dès que la page est quittée, pour ne pas
 * vider la batterie de quelqu'un qui a refermé son sidour.
 *
 * Le verrou passe par la Screen Wake Lock API du navigateur, disponible dans
 * la webview de l'app native comme sur le web mobile (Chrome depuis 84,
 * Safari et iOS depuis 16.4). Là où elle manque, la demande échoue sans
 * bruit : la lecture continue, l'écran s'éteint comme avant.
 *
 * Deux règles que le système impose et dont ce composable s'arrange :
 * l'appareil rend le verrou de lui-même dès que la page passe en arrière-plan
 * (écran verrouillé, autre application), il faut donc le reprendre au retour ;
 * et la demande n'est acceptée que sur une page visible, ce qui interdit de la
 * faire à l'aveugle.
 */

/**
 * Verrous demandés à l'échelle de l'app : un compteur plutôt qu'un drapeau, le
 * temps qu'une page de lecture remplace l'autre (la suivante se monte avant
 * que la précédente ne se démonte). Un seul verrou système suffit à tous.
 */
let holders = 0;
let sentinel: WakeLockSentinel | null = null;
/** Demande en cours : deux pages montées ensemble n'en font pas deux. */
let pending: Promise<void> | null = null;

function supported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

async function acquire(): Promise<void> {
  if (!supported() || holders === 0 || sentinel || pending) return;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  pending = navigator.wakeLock
    .request("screen")
    .then((lock) => {
      // La page a été quittée pendant la demande : le verrou est rendu aussitôt.
      if (holders === 0) {
        void lock.release();
        return;
      }
      sentinel = lock;
      // Rendu par le système (mise en arrière-plan, batterie faible) : on
      // oublie la référence, le retour à l'écran en redemandera un.
      lock.addEventListener("release", () => {
        if (sentinel === lock) sentinel = null;
      });
    })
    .catch(() => {
      // Verrou refusé (onglet caché, économiseur de batterie, navigateur sans
      // l'API) : rien à faire, l'écran garde son comportement habituel.
    })
    .finally(() => {
      pending = null;
    });
  await pending;
}

function release(): void {
  const lock = sentinel;
  sentinel = null;
  if (lock) void lock.release().catch(() => {});
}

function onVisibilityChange(): void {
  if (document.visibilityState === "visible") void acquire();
}

function listen(): void {
  if (holders === 1) document.addEventListener("visibilitychange", onVisibilityChange);
}

function unlisten(): void {
  if (holders === 0) document.removeEventListener("visibilitychange", onVisibilityChange);
}

/**
 * À appeler dans les vues de lecture. `reading` dit quand un texte est
 * réellement ouvert : l'écran ne reste allumé que là, pas devant la liste des
 * chapitres d'un traité ni pendant qu'on compose sa lecture du jour, qui se
 * parcourent au doigt et ne demandent rien de tel.
 */
export function useKeepAwake(reading: MaybeRefOrGetter<boolean> = true): void {
  let holding = false;

  function hold(): void {
    if (holding || typeof document === "undefined") return;
    holding = true;
    holders += 1;
    listen();
    void acquire();
  }

  function drop(): void {
    if (!holding) return;
    holding = false;
    holders = Math.max(0, holders - 1);
    unlisten();
    if (holders === 0) release();
  }

  onMounted(() => {
    if (toValue(reading)) hold();
  });

  watch(
    () => toValue(reading),
    (open) => (open ? hold() : drop()),
  );

  onBeforeUnmount(drop);
}
