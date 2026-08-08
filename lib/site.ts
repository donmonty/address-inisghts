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
    : "https://address-insights-monty.vercel.app",
);

export const SITE_NAME = "Address Insights";

export const SITE_TAGLINE =
  "What is daily life like from this front door? Walking, driving and density scores for any address.";

export const OG_IMAGE_ALT =
  "Address Insights — walking, driving and amenity density scores for any address";

/**
 * The one social card, as a metadata descriptor.
 *
 * The root layout picks the image up from the `app/opengraph-image.tsx` file
 * convention automatically. Any route that declares its own `openGraph` block
 * replaces the parent's wholesale — the inherited image included — so those
 * routes name it here instead. Same static PNG either way: there is no
 * per-address render.
 */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: OG_IMAGE_ALT,
} as const;
