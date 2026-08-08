/**
 * The Twitter/X card is the same static image as the Open Graph card.
 *
 * X reads `twitter:image` and does not fall back to `og:image`, so the tag has
 * to exist — but there is no second design here. Re-exporting keeps one source
 * of truth in `app/opengraph-image.tsx`.
 */
export { default, alt, size, contentType } from "./opengraph-image";
