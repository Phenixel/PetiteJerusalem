import { ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";

/**
 * Le filtre d'une liste du backoffice, porté par l'adresse (`?filtre=draft`) :
 * le tableau de bord y mène directement (« 3 chiourim à relire »), et le
 * retour depuis une fiche retrouve la liste telle qu'on l'avait laissée.
 */
export function useAdminQueryFilter<F extends string>(allowed: readonly F[], fallback: F): Ref<F> {
  const route = useRoute();
  const router = useRouter();

  const read = (): F => {
    const value = route.query.filtre;
    return typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? (value as F)
      : fallback;
  };

  const filter = ref(read()) as Ref<F>;

  watch(filter, (value) => {
    const query = { ...route.query };
    if (value === fallback) delete query.filtre;
    else query.filtre = value;
    void router.replace({ query });
  });

  // Un lien du tableau de bord vers la même page change seulement la requête.
  watch(
    () => route.query.filtre,
    () => {
      const next = read();
      if (next !== filter.value) filter.value = next;
    },
  );

  return filter;
}

/**
 * Où revenir depuis une fiche : la liste telle qu'on l'a quittée (son filtre,
 * son tri), si c'est d'elle que l'on vient, sinon la liste nue. vue-router
 * garde l'adresse précédente dans `history.state.back`.
 */
export function useAdminReturnTo(listPath: string): string {
  const back = (window.history.state as { back?: unknown } | null)?.back;
  if (typeof back !== "string") return listPath;
  const path = back.split(/[?#]/)[0];
  return path === listPath ? back : listPath;
}
