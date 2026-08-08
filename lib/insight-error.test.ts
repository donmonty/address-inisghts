import { describe, expect, it } from "vitest";

import { INSIGHT_ERROR_DIGEST, insightErrorCopy } from "@/lib/insight-error";

describe("insightErrorCopy", () => {
  it("names the throttle when the digest is the rate limiter's", () => {
    expect(insightErrorCopy(INSIGHT_ERROR_DIGEST.rateLimited)).toEqual({
      heading: "Too many lookups",
      body: "You’ve hit the rate limit that protects this demo’s Mapbox quota. Try again in a minute.",
      offersSearch: false,
    });
  });

  it("says why there is no number when a category is missing", () => {
    expect(insightErrorCopy(INSIGHT_ERROR_DIGEST.missingCategory)).toEqual({
      heading: "Couldn’t score this address",
      body: "Mapbox didn’t return complete data for this location, so any score shown would be wrong. This is usually temporary.",
      offersSearch: true,
    });
  });

  it("falls back to the hard-fail copy for an unrecognised digest", () => {
    // Anything else that reaches the boundary is also a page that could not
    // produce a score, and "we couldn't score this" stays true for all of it.
    expect(insightErrorCopy("2913470196")).toEqual(
      insightErrorCopy(INSIGHT_ERROR_DIGEST.missingCategory),
    );
  });

  it("falls back to the hard-fail copy when there is no digest at all", () => {
    expect(insightErrorCopy(undefined)).toEqual(
      insightErrorCopy(INSIGHT_ERROR_DIGEST.missingCategory),
    );
  });
});
