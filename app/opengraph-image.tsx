import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { OG_IMAGE_ALT } from "@/lib/site";

/**
 * The social preview card — one static branded image for the whole site.
 *
 * Deliberately **not** per-address. A dynamic OG image would have to score the
 * address to draw it, which means re-running the twelve-category fan-out for
 * every crawler that touches a shared link — reopening the quota question the
 * cache-miss limiter closed. This file takes no params and reads no request, so
 * Next prerenders it once at build time and every route serves that one PNG.
 *
 * The card is the dark theme's tokens verbatim (`app/globals.css`): `#16181C`
 * ground, `#F1F5F8` headline, `#8B949E` support, and orange `#F4511E` used only
 * as the walking rule — never as a surface. Fonts are the committed Geist TTFs
 * rather than a build-time download, because Satori needs TTF/OTF/WOFF and
 * `next/font/google` only ever produces woff2.
 *
 * The one exception is the wordmark itself: the Dencity lockup's exact
 * approved colors (`#EEF2F3` / `#FF5C1A`), not the surrounding dark-theme
 * tokens, in the same Space Grotesk Bold TTF the in-app `Logo` component
 * renders with the browser's own font loading — see `components/brand/logo.tsx`.
 *
 * No scores appear on it. Three labelled rules echo the hero's shape without
 * fabricating numbers for an address the card isn't about.
 */

export const alt = OG_IMAGE_ALT;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "assets", "fonts");

const [geistBold, geistRegular, geistMonoMedium, spaceGroteskBold] =
  await Promise.all([
    readFile(join(FONT_DIR, "Geist-Bold.ttf")),
    readFile(join(FONT_DIR, "Geist-Regular.ttf")),
    readFile(join(FONT_DIR, "GeistMono-Medium.ttf")),
    readFile(join(FONT_DIR, "SpaceGrotesk-Bold.ttf")),
  ]);

const BACKGROUND = "#16181C";
const FOREGROUND = "#F1F5F8";
const MUTED_FOREGROUND = "#8B949E";
const BORDER = "#2A2F36";
const PRIMARY = "#F4511E";

/** The Dencity lockup's own exact colors — see `components/brand/logo.tsx`. */
const WORDMARK = "#EEF2F3";
const WORDMARK_PERIOD = "#FF5C1A";

/**
 * The hero's three rule-topped columns. Walking takes the orange rule and only
 * walking does — the same rule the scorecard follows, stated as a flag rather
 * than left to depend on this array's order.
 */
const SCORES = [
  { label: "Walking", primary: true },
  { label: "Driving", primary: false },
  { label: "Amenity density", primary: false },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BACKGROUND,
          color: FOREGROUND,
          fontFamily: "Geist",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Space Grotesk",
              fontWeight: 700,
              fontSize: 44,
              lineHeight: 0.92,
              letterSpacing: "-0.04em",
            }}
          >
            <span style={{ color: WORDMARK }}>Dencity</span>
            <span style={{ color: WORDMARK_PERIOD }}>.</span>
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            So, what&apos;s the neighborhood like?
          </div>
          <div style={{ fontSize: 30, color: MUTED_FOREGROUND, maxWidth: 860 }}>
            Get walking, driving and density scores for any address.
          </div>
        </div>

        <div style={{ display: "flex", gap: 32 }}>
          {SCORES.map(({ label, primary }) => (
            <div
              key={label}
              style={{
                display: "flex",
                flex: 1,
                paddingTop: 20,
                borderTop: `3px solid ${primary ? PRIMARY : BORDER}`,
                fontFamily: "Geist Mono",
                fontSize: 22,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: primary ? FOREGROUND : MUTED_FOREGROUND,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geistRegular, weight: 400, style: "normal" },
        { name: "Geist", data: geistBold, weight: 700, style: "normal" },
        {
          name: "Geist Mono",
          data: geistMonoMedium,
          weight: 500,
          style: "normal",
        },
        {
          name: "Space Grotesk",
          data: spaceGroteskBold,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
