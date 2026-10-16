import { onScopeDispose, ref, watch, type Ref } from "vue";

/**
 * A copy of `source` that follows it `ms` after its last change: what a
 * search filters on, while the field itself stays immediate. Searching the
 * whole catalog on every key press costs up to 30 ms on a desktop for a
 * word with no match (much more on a phone), on every keystroke.
 */
export function useDebouncedValue<T>(source: Ref<T>, ms = 150): Readonly<Ref<T>> {
  const value = ref(source.value) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(source, (next) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      value.value = next;
    }, ms);
  });
  onScopeDispose(() => clearTimeout(timer));
  return value;
}
