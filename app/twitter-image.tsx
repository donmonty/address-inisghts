/**
 * The Twitter/X card is the same static image as the Open Graph card.
 *
 * X falls back to `og:image` when `twitter:image` is absent, so this file is
 * belt-and-braces rather than load-bearing — but it costs one build-time render
 * and removes the fallback from the list of things that have to hold. There is
 * no second design: re-exporting keeps `app/opengraph-image.tsx` the one source.
 */
export { default, alt, size, contentType } from "./opengraph-image";
