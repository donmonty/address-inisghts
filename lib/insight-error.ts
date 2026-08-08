/**
 * Which failure the boundary is looking at, and what it is allowed to say.
 *
 * The page has exactly two ways to fail: a category Mapbox never returned, and
 * a caller who spent their minute's cache misses. Both throw out of
 * `getAddressInsight`, both land in one `error.tsx`, and the only thing that
 * distinguishes them on the client is `error.digest` — in production Next
 * redacts a Server Component's message before it crosses to the browser, so the
 * message is not something the boundary can read. A digest set on the error
 * before it is thrown survives that redaction untouched (Next respects an
 * existing `digest` rather than hashing its own), which is what makes these two
 * states tellable apart in a deployed build and not just in `next dev`.
 *
 * The copy lives here rather than in the component so the exact wording is
 * testable without a DOM, and so both states are visibly one vocabulary.
 */

export const INSIGHT_ERROR_DIGEST = {
  missingCategory: "ADDRESS_INSIGHTS_MISSING_CATEGORY",
  rateLimited: "ADDRESS_INSIGHTS_RATE_LIMITED",
} as const;

export interface InsightErrorCopy {
  heading: string;
  body: string;
  /**
   * Whether to offer a route back to search alongside **Try again**. The
   * throttle doesn't: another address is another lookup, and would spend the
   * limit the reader has already hit.
   */
  offersSearch: boolean;
}

/**
 * The hard fail. It says *why there is no number* rather than apologising —
 * the honest expression of "a partial score is a wrong score".
 */
const MISSING_CATEGORY: InsightErrorCopy = {
  heading: "Couldn’t score this address",
  body: "Mapbox didn’t return complete data for this location, so any score shown would be wrong. This is usually temporary.",
  offersSearch: true,
};

const RATE_LIMITED: InsightErrorCopy = {
  heading: "Too many lookups",
  body: "You’ve hit the rate limit that protects this demo’s Mapbox quota. Try again in a minute.",
  offersSearch: false,
};

/**
 * Anything that isn't recognisably the throttle is a page that could not
 * produce a score, which is what the hard-fail copy already says — including an
 * error with no digest at all, and Next's own hashed digests for anything
 * unforeseen. There is no third state and no generic "something went wrong".
 */
export function insightErrorCopy(digest: string | undefined): InsightErrorCopy {
  return digest === INSIGHT_ERROR_DIGEST.rateLimited
    ? RATE_LIMITED
    : MISSING_CATEGORY;
}
