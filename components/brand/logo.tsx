import { Space_Grotesk } from "next/font/google";

import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: "700" });

/**
 * The Dencity wordmark. Pure text, no SVG or image asset — the trailing
 * period is the only accent and is never dropped, even at small sizes.
 *
 * Colors are the approved lockup's own exact values, not the app's shared
 * `--primary`/`--foreground` tokens: adopting the Dencity palette app-wide is
 * a separate, deferred decision. This component carries its own hex values
 * and switches between the light-background and dark-background pairing on
 * the same `dark:` trigger (system `prefers-color-scheme`) every other
 * themed value in the app already follows — see `app/globals.css`.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        spaceGrotesk.className,
        "text-2xl leading-[0.92] tracking-[-0.04em] text-[#0D1114] dark:text-[#EEF2F3]",
        className,
      )}
    >
      Dencity
      <span className="text-[#E04A10] dark:text-[#FF5C1A]">.</span>
    </p>
  );
}
