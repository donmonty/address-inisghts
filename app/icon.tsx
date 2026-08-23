import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The browser-tab icon: "D." rather than the full "Dencity." wordmark.
 *
 * The README's lockup is specified down to a 20px in-app size, but a favicon
 * renders smaller still (16–32px) — too small for the full wordmark to stay
 * legible. The initial plus the trailing period keeps the one accent the
 * wordmark is built around, at a size that actually reads in a tab.
 *
 * Same Space Grotesk Bold TTF `app/opengraph-image.tsx` reads, and the exact
 * primary (dark-background) lockup colors — see `components/brand/logo.tsx`.
 */
export const size = { width: 32, height: 32 };

export const contentType = "image/png";

const spaceGroteskBold = await readFile(
  join(process.cwd(), "assets", "fonts", "SpaceGrotesk-Bold.ttf"),
);

const INK = "#0D1114";
const PAPER = "#EEF2F3";
const ORANGE = "#FF5C1A";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: INK,
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: "-0.04em",
        }}
      >
        <span style={{ color: PAPER }}>D</span>
        <span style={{ color: ORANGE }}>.</span>
      </div>
    ),
    {
      ...size,
      fonts: [
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
