import { useCallback, useRef } from 'react';

/**
 * A function whose identity never changes but which always runs the latest closure. Lets a memoized
 * screen keep its props still while App re-renders every second, without ever calling a handler
 * that remembers old state.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}
