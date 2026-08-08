import { describe, expect, it } from "vitest";

import { MissingCategoryError, RateLimitError } from "@/lib/amenities";
import { INSIGHT_ERROR_DIGEST, insightErrorCopy } from "@/lib/insight-error";

/**
 * The fan-out itself is exercised against the real API; what is pinned here is
 * the contract between the two throws and the error boundary. The digest is the
 * only part of a Server Component error that survives to the client in
 * production, so a rename that dropped it would silently turn the throttle into
 * the hard-fail state — with no type error and no failing render.
 */
describe("the errors that reach error.tsx", () => {
  // The wording itself is `lib/insight-error.test.ts`'s to pin; what these
  // assert is only that each throw routes to the state it is supposed to.
  it("stamps the hard fail with the digest its copy is keyed on", () => {
    const error = new MissingCategoryError(["cafe"]);

    expect(error.digest).toBe(INSIGHT_ERROR_DIGEST.missingCategory);
    expect(insightErrorCopy(error.digest)).toEqual(
      insightErrorCopy(INSIGHT_ERROR_DIGEST.missingCategory),
    );
  });

  it("stamps the throttle with the digest its copy is keyed on", () => {
    const error = new RateLimitError();

    expect(error.digest).toBe(INSIGHT_ERROR_DIGEST.rateLimited);
    expect(insightErrorCopy(error.digest)).toEqual(
      insightErrorCopy(INSIGHT_ERROR_DIGEST.rateLimited),
    );
  });
});
