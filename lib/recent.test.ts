import { describe, expect, it } from "vitest";

import {
  RECENT_KEY,
  RECENT_LIMIT,
  readRecent,
  rememberRecent,
  type RecentStorage,
} from "@/lib/recent";

/*
 * Recent lookups. The list lives in one `localStorage` key and nowhere else —
 * no account, no server — so every rule about it is a rule about parsing and
 * rewriting one string, and lives here rather than in the component.
 *
 * The store is passed in rather than reached for, which is what lets these run
 * in the node environment the rest of the suite uses.
 */

const fakeStorage = (initial?: string): RecentStorage => {
  const entries = new Map<string, string>();
  if (initial !== undefined) entries.set(RECENT_KEY, initial);

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
};

const herald = {
  lat: 40.748745,
  lng: -73.987997,
  label: "1270 Broadway, New York",
};
const marfa = { lat: 30.31454, lng: -104.02297, label: "105 W Murphy St" };

describe("reading the list", () => {
  it("is empty in a browser that has never looked anything up", () => {
    expect(readRecent(fakeStorage())).toEqual([]);
  });

  it("reads back what was written", () => {
    const storage = fakeStorage();
    rememberRecent(storage, herald);

    expect(readRecent(storage)).toEqual([herald]);
  });

  it("is empty rather than thrown when the key holds something else", () => {
    expect(readRecent(fakeStorage("not json"))).toEqual([]);
    expect(readRecent(fakeStorage('{"lat":1}'))).toEqual([]);
  });

  it("drops entries that are not an address", () => {
    const storage = fakeStorage(
      JSON.stringify([herald, { label: "no point" }, { lat: 1, lng: 2 }]),
    );

    expect(readRecent(storage)).toEqual([herald]);
  });

  it("survives a store that refuses to be read", () => {
    const storage: RecentStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
    };

    expect(readRecent(storage)).toEqual([]);
  });
});

describe("remembering a lookup", () => {
  it("puts the newest first", () => {
    const storage = fakeStorage();
    rememberRecent(storage, herald);
    rememberRecent(storage, marfa);

    expect(readRecent(storage).map((entry) => entry.label)).toEqual([
      marfa.label,
      herald.label,
    ]);
  });

  it("moves an address already in the list rather than repeating it", () => {
    const storage = fakeStorage();
    rememberRecent(storage, herald);
    rememberRecent(storage, marfa);
    rememberRecent(storage, { ...herald, label: "1270 Broadway, NY 10001" });

    expect(readRecent(storage)).toEqual([
      { ...herald, label: "1270 Broadway, NY 10001" },
      marfa,
    ]);
  });

  it("keeps only the most recent few", () => {
    const storage = fakeStorage();
    for (let i = 0; i <= RECENT_LIMIT; i++) {
      rememberRecent(storage, { lat: i, lng: i, label: `address ${i}` });
    }

    const labels = readRecent(storage).map((entry) => entry.label);
    expect(labels).toHaveLength(RECENT_LIMIT);
    expect(labels[0]).toBe(`address ${RECENT_LIMIT}`);
    expect(labels).not.toContain("address 0");
  });

  it("returns the new list, so a caller need not read it back", () => {
    const storage = fakeStorage();
    rememberRecent(storage, herald);

    expect(rememberRecent(storage, marfa)).toEqual([marfa, herald]);
  });

  it("survives a store that refuses to be written", () => {
    const storage: RecentStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };

    expect(() => rememberRecent(storage, herald)).not.toThrow();
  });
});
