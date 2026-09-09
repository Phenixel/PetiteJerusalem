/**
 * Ce qui se rejoue quand l'API App Store Connect tombe, et ce qui ne se rejoue
 * pas.
 *
 * Le provisionnement d'Apple répond de temps en temps un 500
 * « UNEXPECTED_ERROR » à une requête parfaitement valide, puis accepte la même
 * quelques secondes plus tard. Le tag v3.9.3 est mort là-dessus le 9 septembre
 * 2026 : la création du profil de l'extension de widgets a échoué 180 ms après
 * celle du profil de l'app, avec le même certificat, la même clé et le même
 * App ID que le run vert de la veille. Rien à corriger dans la demande, donc :
 * il fallait juste redemander.
 *
 * Isolé de scripts/ios-signing.mjs pour être testable sans réseau ni macOS,
 * comme certificate-quota.mjs.
 */

/**
 * Une panne d'Apple, pas une erreur de la demande : 5xx, 429, ou pas de
 * réponse du tout (fetch qui casse, `status` alors absent). Un 4xx, lui, dit
 * quelque chose de vrai sur la requête : la répéter ne ferait que la répéter.
 */
export function isTransient(error) {
  const status = error?.status;
  return status === undefined || status >= 500 || status === 429;
}

/** Trois nouvelles tentatives : Apple se remet vite, ou pas du tout. */
export const RETRY_ATTEMPTS = 3;

/** Attente avant la n-ième tentative : 3 s, puis 6 s, puis 12 s. */
export const backoffDelay = (attempt) => 3000 * 2 ** (attempt - 1);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rejoue `call` tant qu'Apple tombe, au plus `attempts` fois.
 *
 * `onFailure` est appelé APRÈS la pause, avant la tentative suivante : c'est
 * là que l'appelant journalise, et là qu'il peut rattraper le coup. S'il rend
 * autre chose qu'`undefined`, cette valeur devient le résultat et l'on
 * s'arrête ; c'est ce qui permet à une création de reprendre ce qu'Apple a
 * fabriqué avant d'échouer à le renvoyer.
 *
 * @template T
 * @param {() => Promise<T>} call
 * @param {{
 *   attempts?: number,
 *   onFailure?: (error: any, attempt: number) => (T | undefined) | Promise<T | undefined>,
 *   sleep?: (ms: number) => Promise<unknown>,
 * }} [options]
 * @returns {Promise<T>}
 */
export async function withRetry(call, { attempts = RETRY_ATTEMPTS, onFailure, sleep = wait } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (!isTransient(error) || attempt > attempts) throw error;
      await sleep(backoffDelay(attempt));
      const rescued = onFailure ? await onFailure(error, attempt) : undefined;
      if (rescued !== undefined) return rescued;
    }
  }
}
