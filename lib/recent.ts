/**
 * Recent lookups, browser-local.
 *
 * A returning visitor gets back to an address they were considering without an
 * account and without the app storing anything about them: the list is one
 * `localStorage` key, so it is present in the browser that did the looking and
 * absent in every other one. That is the whole privacy story, and it is also
 * why nothing here is ever sent anywhere.
 *
 * The store is a parameter rather than a global. It keeps this file free of
 * `window`, which is what lets it be a plain module the landing page's Client
 * Component calls, and testable in the node environment the suite runs in.
 *
 * Every read is defensive: the key is a string a person can edit, a previous
 * version of this app may have written a different shape into it, and Safari's
 * private mode throws on write. None of that is worth a broken landing page,
 * so a store that misbehaves reads as "no history" and writes as a no-op.
 */

import { addressKey, type ResolvedAddress } from "@/lib/search";

export const RECENT_KEY = "address-insights.recent";

/** Enough to get back to what you were comparing; short enough to scan. */
export const RECENT_LIMIT = 5;

export type RecentLookup = ResolvedAddress;

/** The two `localStorage` methods this needs, and nothing more. */
export type RecentStorage = Pick<Storage, "getItem" | "setItem">;

export function readRecent(storage: RecentStorage): RecentLookup[] {
  let raw: string | null;
  try {
    raw = storage.getItem(RECENT_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLookup).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/**
 * Records a lookup and returns the list it produced.
 *
 * Identity is the point, not the label: the same front door reached through two
 * differently-worded suggestions is one entry, carrying the label it was most
 * recently found under. It is `addressKey` doing the deciding, so two lookups
 * that would open the same insights page are one entry here too.
 */
export function rememberRecent(
  storage: RecentStorage,
  address: ResolvedAddress,
): RecentLookup[] {
  const key = addressKey(address);
  const existing = readRecent(storage).filter(
    (entry) => addressKey(entry) !== key,
  );
  const next = [address, ...existing].slice(0, RECENT_LIMIT);

  try {
    storage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // A full or locked-down store costs the visitor their history, not their
    // navigation — the lookup they just made still happens.
  }

  return next;
}

function isLookup(value: unknown): value is RecentLookup {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;

  return (
    Number.isFinite(entry.lat) &&
    Number.isFinite(entry.lng) &&
    typeof entry.label === "string" &&
    entry.label.trim() !== ""
  );
}
