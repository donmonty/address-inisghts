/**
 * `localStorage` as an external store React can subscribe to.
 *
 * The recent-lookups list is read by the component that renders it and written
 * by the search box — two components with no parent between them worth
 * threading state through. So the browser's own storage is the state, and this
 * is the `useSyncExternalStore` adapter over it.
 *
 * Every rule about the stored list itself still lives in `lib/recent.ts`. What
 * this adds is the cached snapshot — `getSnapshot` has to be referentially
 * stable or React re-renders forever — and the notification that follows a
 * write, including one from another tab.
 *
 * The server snapshot is always empty: there is no history on the server, and
 * the first client render has to agree with the HTML it is hydrating. React
 * swaps in the real list immediately afterwards.
 */

import { readRecent, rememberRecent, type RecentLookup } from "@/lib/recent";
import type { ResolvedAddress } from "@/lib/search";

const EMPTY: RecentLookup[] = [];

let snapshot: RecentLookup[] | null = null;
const listeners = new Set<() => void>();

export function subscribeRecent(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab's lookup is this tab's history too, and `storage` fires only in
  // the tabs that did not write it. One listener serves every subscriber.
  if (listeners.size === 1) window.addEventListener("storage", invalidate);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", invalidate);
  };
}

export function getRecentSnapshot(): RecentLookup[] {
  return (snapshot ??= readRecent(window.localStorage));
}

export function getRecentServerSnapshot(): RecentLookup[] {
  return EMPTY;
}

/** Writes the lookup and tells every mounted list about it. */
export function recordLookup(address: ResolvedAddress): void {
  snapshot = rememberRecent(window.localStorage, address);
  emit();
}

/** Exposed for the tests, which need a store that has not been read yet. */
export function resetRecentStore(): void {
  snapshot = null;
  listeners.clear();
}

function invalidate() {
  snapshot = null;
  emit();
}

function emit() {
  for (const listener of listeners) listener();
}
