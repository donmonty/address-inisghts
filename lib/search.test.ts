import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSearchSession,
  insightsHref,
  retrieveAddress,
  suggestAddresses,
  type AddressSuggestion,
} from "@/lib/search";

/*
 * The address search seam. Everything the landing page's combobox knows about
 * Mapbox lives here — the two endpoints, the session token's lifetime, and the
 * href a picked suggestion turns into — so the component is left holding only
 * the debounce, the keyboard, and three lines of copy.
 *
 * The session-token rules are billing rules, not hygiene: one token per
 * address-input interaction, reused across every keystroke and across the
 * `/retrieve` that ends it. That is what the tests below pin.
 */

const TOKEN = "pk.test";

const suggestion: AddressSuggestion = {
  mapboxId: "dXJuOm1i",
  name: "1270 Broadway",
  context: "New York, New York 10001, United States",
  label: "1270 Broadway, New York, New York 10001, United States",
};

const json = (body: unknown, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  }) as Response;

/** The URL the last `fetch` was called with, parsed. */
const lastUrl = (fetchMock: ReturnType<typeof vi.fn>): URL =>
  new URL(String(fetchMock.mock.lastCall?.[0]));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the session token", () => {
  it("is one token across a whole keystroke sequence", () => {
    let minted = 0;
    const session = createSearchSession(() => `token-${++minted}`);

    expect(session.token()).toBe("token-1");
    expect(session.token()).toBe("token-1");
    expect(session.token()).toBe("token-1");
  });

  it("mints a fresh one only once the interaction has ended", () => {
    let minted = 0;
    const session = createSearchSession(() => `token-${++minted}`);

    expect(session.token()).toBe("token-1");
    session.end();

    expect(session.token()).toBe("token-2");
  });

  it("mints nothing until it is first asked for one", () => {
    const mint = vi.fn(() => "token");
    createSearchSession(mint);

    expect(mint).not.toHaveBeenCalled();
  });

  it("mints a UUIDv4 by default", () => {
    expect(createSearchSession().token()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe("suggesting addresses", () => {
  it("asks Mapbox with the browser token and the session's token", async () => {
    fetchMock.mockResolvedValue(json({ suggestions: [] }));

    await suggestAddresses({ query: "1270 Broadway", sessionToken: "abc" });

    const url = lastUrl(fetchMock);
    expect(url.pathname).toBe("/search/searchbox/v1/suggest");
    expect(url.searchParams.get("q")).toBe("1270 Broadway");
    expect(url.searchParams.get("session_token")).toBe("abc");
    expect(url.searchParams.get("access_token")).toBe(TOKEN);
    expect(url.searchParams.get("types")).toContain("address");
  });

  it("maps a suggestion to its name, its context and the label the insights page will show", async () => {
    fetchMock.mockResolvedValue(
      json({
        suggestions: [
          {
            mapbox_id: "dXJuOm1i",
            name: "1270 Broadway",
            place_formatted: "New York, New York 10001, United States",
            full_address:
              "1270 Broadway, New York, New York 10001, United States",
          },
        ],
      }),
    );

    const suggestions = await suggestAddresses({
      query: "1270 Broadway",
      sessionToken: "abc",
    });

    expect(suggestions).toEqual([suggestion]);
  });

  it("builds the label itself when Mapbox publishes no full address", async () => {
    fetchMock.mockResolvedValue(
      json({
        suggestions: [
          {
            mapbox_id: "id",
            name: "Marfa",
            place_formatted: "Texas, United States",
          },
        ],
      }),
    );

    const [only] = await suggestAddresses({
      query: "Marfa",
      sessionToken: "a",
    });

    expect(only.label).toBe("Marfa, Texas, United States");
  });

  it("drops a suggestion with no id, which could never be retrieved", async () => {
    fetchMock.mockResolvedValue(
      json({ suggestions: [{ name: "Nowhere", place_formatted: "Nowhere" }] }),
    );

    const suggestions = await suggestAddresses({
      query: "Nowhere",
      sessionToken: "abc",
    });

    expect(suggestions).toEqual([]);
  });

  it("does not spend a request on a query too short to be an address", async () => {
    const suggestions = await suggestAddresses({
      query: "12",
      sessionToken: "abc",
    });

    expect(suggestions).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when Mapbox refuses the request", async () => {
    fetchMock.mockResolvedValue(json({}, false));

    await expect(
      suggestAddresses({ query: "1270 Broadway", sessionToken: "abc" }),
    ).rejects.toThrow();
  });

  it("throws when the payload carries no suggestion list", async () => {
    fetchMock.mockResolvedValue(json({}));

    await expect(
      suggestAddresses({ query: "1270 Broadway", sessionToken: "abc" }),
    ).rejects.toThrow();
  });
});

describe("retrieving the coordinates", () => {
  const feature = {
    features: [
      {
        geometry: { coordinates: [-73.987997, 40.748745] },
        properties: {
          full_address:
            "1270 Broadway, New York, New York 10001, United States",
        },
      },
    ],
  };

  it("returns the point, on the session token the suggestions were made under", async () => {
    fetchMock.mockResolvedValue(json(feature));

    const address = await retrieveAddress({ suggestion, sessionToken: "abc" });

    expect(address).toEqual({
      lat: 40.748745,
      lng: -73.987997,
      label: "1270 Broadway, New York, New York 10001, United States",
    });
    const url = lastUrl(fetchMock);
    expect(url.pathname).toBe(
      `/search/searchbox/v1/retrieve/${suggestion.mapboxId}`,
    );
    expect(url.searchParams.get("session_token")).toBe("abc");
  });

  it("keeps the suggestion's own label when the feature publishes none", async () => {
    fetchMock.mockResolvedValue(
      json({
        features: [{ geometry: { coordinates: [1, 2] }, properties: {} }],
      }),
    );

    const address = await retrieveAddress({ suggestion, sessionToken: "abc" });

    expect(address.label).toBe(suggestion.label);
  });

  it("throws when the feature has no point on Earth", async () => {
    fetchMock.mockResolvedValue(json({ features: [] }));

    await expect(
      retrieveAddress({ suggestion, sessionToken: "abc" }),
    ).rejects.toThrow();
  });

  it("throws when Mapbox refuses the request", async () => {
    fetchMock.mockResolvedValue(json({}, false));

    await expect(
      retrieveAddress({ suggestion, sessionToken: "abc" }),
    ).rejects.toThrow();
  });
});

describe("the insights href", () => {
  it("puts the coordinates in the path and the label in q", () => {
    expect(
      insightsHref({
        lat: 40.748745,
        lng: -73.987997,
        label: "1270 Broadway, New York",
      }),
    ).toBe("/insights/40.748745,-73.987997?q=1270%20Broadway%2C%20New%20York");
  });
});
