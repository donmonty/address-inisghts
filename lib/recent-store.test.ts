import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getRecentServerSnapshot,
  getRecentSnapshot,
  recordLookup,
  resetRecentStore,
  subscribeRecent,
} from "@/lib/recent-store";

/*
 * The `useSyncExternalStore` adapter. Two of its rules are load-bearing and
 * neither is visible from `lib/recent.ts`: the snapshot must be referentially
 * stable between writes — React re-renders forever otherwise — and a write has
 * to reach every mounted list, including one in another tab.
 *
 * `window` is stubbed rather than mocked out with a DOM, which keeps this in
 * the same node environment as the rest of the suite.
 */

const herald = {
  lat: 40.748745,
  lng: -73.987997,
  label: "1270 Broadway, New York",
};
const marfa = { lat: 30.31454, lng: -104.02297, label: "105 W Murphy St" };

let entries: Map<string, string>;
let windowListeners: Map<string, Set<() => void>>;

/** Just enough `window` for the store: a storage, and storage events. */
const fakeWindow = () => {
  entries = new Map();
  windowListeners = new Map();

  return {
    localStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
    },
    addEventListener: (event: string, listener: () => void) => {
      const set = windowListeners.get(event) ?? new Set();
      set.add(listener);
      windowListeners.set(event, set);
    },
    removeEventListener: (event: string, listener: () => void) => {
      windowListeners.get(event)?.delete(listener);
    },
  };
};

/** Another tab wrote the key; this tab hears about it. */
const storageEventFromAnotherTab = () => {
  for (const listener of windowListeners.get("storage") ?? []) listener();
};

beforeEach(() => {
  resetRecentStore();
  vi.stubGlobal("window", fakeWindow());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the snapshot", () => {
  it("is empty on the server, where there is no history", () => {
    expect(getRecentServerSnapshot()).toEqual([]);
  });

  it("is the same array every time until something is written", () => {
    recordLookup(herald);

    expect(getRecentSnapshot()).toBe(getRecentSnapshot());
  });

  it("is a new array once a lookup is recorded", () => {
    const before = getRecentSnapshot();
    recordLookup(herald);

    expect(getRecentSnapshot()).not.toBe(before);
    expect(getRecentSnapshot().map((entry) => entry.label)).toEqual([
      herald.label,
    ]);
  });
});

describe("subscribers", () => {
  it("hear about a lookup recorded in this tab", () => {
    const listener = vi.fn();
    subscribeRecent(listener);

    recordLookup(herald);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("hear about one recorded in another tab, and re-read the store", () => {
    const listener = vi.fn();
    subscribeRecent(listener);
    expect(getRecentSnapshot()).toEqual([]);

    // The other tab's write lands in the shared storage directly.
    entries.set("address-insights.recent", JSON.stringify([marfa]));
    storageEventFromAnotherTab();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getRecentSnapshot()).toEqual([marfa]);
  });

  it("hear nothing once they have unsubscribed", () => {
    const listener = vi.fn();
    subscribeRecent(listener)();

    recordLookup(herald);

    expect(listener).not.toHaveBeenCalled();
  });

  it("leave no window listener behind when the last one goes", () => {
    const first = subscribeRecent(vi.fn());
    const second = subscribeRecent(vi.fn());

    first();
    expect(windowListeners.get("storage")?.size).toBe(1);

    second();
    expect(windowListeners.get("storage")?.size).toBe(0);
  });
});
