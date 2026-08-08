import Link from "next/link";

import { EXAMPLE_ADDRESSES } from "@/lib/examples";
import { insightsHref } from "@/lib/search";

/**
 * The four calibration addresses, densest first.
 *
 * A reviewer with no address in mind can still see the scores differentiate,
 * and these are the four that guarantee it: the constants in `lib/scoring.ts`
 * were fitted to exactly this span. The band is shown because it is the reason
 * each one is here — the four read as a range, not as a list of places.
 *
 * A Server Component of plain links: coordinates are known at build time, so an
 * example costs no Search Box session and no client JavaScript, and each one
 * prefetches like any other route.
 */
export function ExampleAddresses() {
  return (
    <section>
      <h2 className="eyebrow mb-4 text-eyebrow text-muted-foreground">
        Or try one of these
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EXAMPLE_ADDRESSES.map((example) => (
          <li key={example.label}>
            <Link
              href={insightsHref(example)}
              className="flex h-full flex-col gap-1 rounded-lg border px-5 py-4 outline-none transition-colors hover:border-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-[0.9375rem] font-medium">
                {example.name}
              </span>
              <span className="eyebrow text-eyebrow text-muted-foreground">
                {example.band}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
