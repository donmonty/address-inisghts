"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { insightErrorCopy } from "@/lib/insight-error";

/**
 * The two ways this page fails, in one component.
 *
 * A category still missing after its retry and a caller past twenty cache
 * misses in a minute both throw out of `getAddressInsight`, and both land here —
 * one error component, one runtime. Which of the two it is comes off
 * `error.digest`, because Next redacts a Server Component's message before it
 * crosses to the browser; the wording itself lives in `lib/insight-error.ts`,
 * where it is testable without a DOM.
 *
 * `--destructive` is spent on the icon and the heading and nothing else — no
 * tinted panel, no red border — exactly the constraint orange runs under
 * everywhere else on this page. The state is stated, not dramatised.
 *
 * **Try again** is `retry()` rather than `reset()`: as of Next 16.3 `reset()`
 * only clears the boundary's state and re-renders the same already-failed
 * payload, while `retry()` re-fetches the segment — which is the behaviour the
 * button's label promises, and the only one that can recover a transient
 * Mapbox failure or a spent rate-limit minute.
 */
export default function InsightsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { heading, body, offersSearch } = insightErrorCopy(error.digest);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <TriangleAlert
        className="size-7 text-destructive"
        strokeWidth={1.75}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-4">
        <h1 className="headline text-3xl text-balance text-destructive sm:text-4xl">
          {heading}
        </h1>
        <p className="max-w-[46ch] text-lg text-muted-foreground">{body}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" className="eyebrow text-eyebrow" onClick={retry}>
          Try again
        </Button>
        {offersSearch && (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="eyebrow text-eyebrow"
          >
            <Link href="/">Search another address</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
