"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import {
  getRecentServerSnapshot,
  getRecentSnapshot,
  subscribeRecent,
} from "@/lib/recent-store";
import { addressKey, insightsHref } from "@/lib/search";

/**
 * The addresses this browser has scored before, newest first.
 *
 * Read straight off the browser's own storage rather than handed down, so the
 * list updates the moment the search box records a lookup — including on a
 * back-navigation, where this component is still mounted. History lives in the
 * browser only: a different browser, and a visitor, has none.
 *
 * A visitor with no history gets no section at all, which is also what the
 * server renders — an empty "Recent lookups" heading says nothing and takes the
 * same room.
 *
 * Each row is a real link, so it prefetches, opens in a new tab, and needs no
 * JavaScript of its own to work.
 */
export function RecentLookups() {
  const lookups = useSyncExternalStore(
    subscribeRecent,
    getRecentSnapshot,
    getRecentServerSnapshot,
  );

  if (lookups.length === 0) return null;

  return (
    <section>
      <h2 className="eyebrow mb-4 text-eyebrow text-muted-foreground">
        Recent lookups
      </h2>
      <ul>
        {lookups.map((lookup) => (
          <li key={addressKey(lookup)} className="border-b">
            <Link
              href={insightsHref(lookup)}
              className="block rounded-sm py-[0.7rem] text-[0.9375rem] outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {lookup.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
