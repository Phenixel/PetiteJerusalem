/**
 * Une valeur lue à la demande, gardée le temps d'une durée de vie, avec une
 * seule requête en vol.
 *
 * Les catalogues (chiourim, séries) viennent de Firestore et changent peu :
 * on les relit au plus toutes les heures, et deux pages qui les demandent en
 * même temps partagent la requête au lieu de lire deux fois la même
 * collection. Le même mécanisme vivait, recopié, dans chaque service.
 */

export interface Cached<T> {
  /** La valeur : celle du cache si elle est fraîche, sinon rechargée. */
  get(): Promise<T>;
  /** La valeur en cache, fraîche ou non, sans rien charger. */
  peek(): T | null;
  /** Vrai si rien n'est en cache, ou si la durée de vie est passée. */
  isStale(): boolean;
  /** Oublie la valeur : la prochaine lecture recharge. */
  invalidate(): void;
}

export function cached<T>(ttlMs: number, loader: () => Promise<T>): Cached<T> {
  let entry: { data: T; fetchedAt: number } | null = null;
  let inflight: Promise<T> | null = null;

  const isStale = () => !entry || Date.now() - entry.fetchedAt >= ttlMs;

  return {
    get() {
      if (entry && !isStale()) return Promise.resolve(entry.data);
      if (!inflight) {
        inflight = loader()
          .then((data) => {
            entry = { data, fetchedAt: Date.now() };
            return data;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    },
    peek: () => entry?.data ?? null,
    isStale,
    invalidate() {
      entry = null;
    },
  };
}
