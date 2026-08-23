import type { Metadata } from "next";

/**
 * The origin the page metadata is resolved against.
 *
 * `metadataBase` has to be absolute — Open Graph consumers do not resolve
 * relative URLs — so the app needs one canonical origin per deployment. In
 * production that is the fixed domain; on a Vercel preview it is that preview's
 * own hostname, so a pasted preview link previews itself rather than silently
 * advertising production.
 */
export const SITE_URL = new URL(
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://getdencity.com",
);

export const SITE_NAME = "Dencity";

export const SITE_TAGLINE =
  "So, what's the neighborhood like? Get walking, driving and density scores for any address.";

export const OG_IMAGE_ALT =
  "Dencity — walking, driving and amenity density scores for any address";

/** The one social card, as a metadata descriptor. */
const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: OG_IMAGE_ALT,
} as const;

/**
 * The Open Graph, Twitter, and canonical blocks for one route.
 *
 * The canonical tag is here rather than at each call site because `url` is
 * already the route's one true path, and the alias host
 * `address-insights-monty.vercel.app` serves the same pages as the apex. Naming
 * the canonical means every host points search engines back at
 * `getdencity.com` instead of competing with it.
 *
 * Both routes need the same shape and the same image, and a route that declares
 * its own `openGraph` replaces its parent's **wholesale** — the image the
 * `app/opengraph-image.tsx` file convention would otherwise have contributed
 * included. That is the trap this function exists to close: naming the card
 * here means every route that sets a title also keeps a card, rather than
 * silently shipping a link preview with no image.
 *
 * It is the same static PNG for every route. There is no per-address render.
 */
export function socialMetadata({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  /** Relative to `SITE_URL`; Next resolves it against `metadataBase`. */
  url: string;
}): Pick<Metadata, "openGraph" | "twitter" | "alternates"> {
  return {
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      locale: "en_US",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}
