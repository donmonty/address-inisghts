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
 * rather than a build-time download, because Satori needs TTF/OTF and
 * `next/font/google` only ever produces woff2.
 *
 * No scores appear on it. Three labelled rules echo the hero's shape without
 * fabricating numbers for an address the card isn't about.
 */

export const alt = OG_IMAGE_ALT;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "assets", "fonts");

const [geistBold, geistRegular, geistMonoMedium] = await Promise.all([
  readFile(join(FONT_DIR, "Geist-Bold.ttf")),
  readFile(join(FONT_DIR, "Geist-Regular.ttf")),
  readFile(join(FONT_DIR, "GeistMono-Medium.ttf")),
]);

const BACKGROUND = "#16181C";
const FOREGROUND = "#F1F5F8";
const MUTED_FOREGROUND = "#8B949E";
const BORDER = "#2A2F36";
const PRIMARY = "#F4511E";

/** The hero's three columns, with the orange rule on walking only. */
const SCORES = ["Walking", "Driving", "Amenity density"];

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
              fontFamily: "Geist Mono",
              fontSize: 24,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: MUTED_FOREGROUND,
            }}
          >
            Address Insights
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
            What is daily life like from this front door?
          </div>
          <div style={{ fontSize: 30, color: MUTED_FOREGROUND, maxWidth: 860 }}>
            Walking, driving and density scores for any address — with the
            working shown.
          </div>
        </div>

        <div style={{ display: "flex", gap: 32 }}>
          {SCORES.map((label, index) => (
            <div
              key={label}
              style={{
                display: "flex",
                flex: 1,
                paddingTop: 20,
                borderTop: `3px solid ${index === 0 ? PRIMARY : BORDER}`,
                fontFamily: "Geist Mono",
                fontSize: 22,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: index === 0 ? FOREGROUND : MUTED_FOREGROUND,
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
      ],
    },
  );
}
