import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * The third way this route ends without a report: `notFound()`, thrown by
 * `page.tsx` when the path segment isn't a real point on Earth.
 *
 * Deliberately quieter than `error.tsx`. That page spends `--destructive` on
 * its icon and heading because something went wrong — a category Mapbox never
 * returned, a spent rate-limit minute. Nothing went wrong here: a URL is
 * malformed, which is the mildest of the three states and the visitor's least
 * alarming problem. Dressing it in the page's one loud colour would spend that
 * colour on the state that least deserves it.
 *
 * The copy stays in this file rather than in `lib/` alongside
 * `insightErrorCopy`. That helper exists because mapping a `digest` to wording
 * is real branching logic worth testing without a DOM; this page has no
 * branches, and extracting it would be copying the shape of the pattern
 * without the reason for it.
 *
 * The action is the same string every other insights state offers.
 */
export default function InsightsNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <div className="flex flex-col gap-4">
        <h1 className="headline text-3xl text-balance sm:text-4xl">
          That link doesn&rsquo;t point at a place.
        </h1>
        <p className="max-w-[46ch] text-lg text-muted-foreground">
          The coordinates in this address couldn&rsquo;t be read as a point on
          Earth — the link may have been trimmed or altered on its way here.
        </p>
      </div>

      <div>
        <Button asChild size="lg" className="eyebrow text-eyebrow">
          <Link href="/">Search another address</Link>
        </Button>
      </div>
    </main>
  );
}
