import { cn } from "@/lib/utils";

/**
 * One paragraph's worth of bars, standing in for text that will wrap.
 *
 * The breathing room between them is padding cancelled by an equal negative
 * margin and painted with `bg-clip-content`, so each bar contributes exactly
 * one line box to the layout while showing as a line with a gap under it — a
 * real gap would make three skeleton lines taller than the three wrapped lines
 * they replace, which is the shift this file exists to avoid.
 *
 * The wrapper is a flex column for one reason: adjoining negative margins on
 * block siblings *collapse* to the most negative of the two rather than
 * summing, which quietly gave back 3px a line. Flex items never collapse their
 * margins, so the cancellation is exact.
 */
const stackedLines = "flex flex-col";
const stackedLine = "-my-[3px] bg-clip-content py-[3px]";

/**
 * The scorecard, before it has any numbers in it.
 *
 * The fan-out is twelve Mapbox requests deep, so this is on screen for a real
 * second or two — long enough that what it shows matters. It renders the actual
 * layout in `--muted` blocks: eyebrow, address, the three numerals under their
 * rules, the verdict strip, the map band, the three tier cards. The page reads
 * as *loading* rather than as *waiting*, and nothing moves when the data lands.
 *
 * **No spinner.** A spinner says "something is happening somewhere"; the shape
 * of the page says what is about to be there, which is more information for
 * less motion.
 *
 * Every block is a real element carrying the real typographic class with
 * transparent text inside it, rather than a hand-tuned `h-[…]`. That is what
 * makes "no layout shift" a property of the markup instead of a set of
 * measurements that drift the first time the type scale is touched — the
 * numeral bar is exactly as tall as a numeral because it *is* one.
 *
 * The blocks carry no visible copy and the whole skeleton is `aria-hidden`, so
 * the one thing a screen reader gets is the live region: "Loading insights".
 */
export default function InsightsLoading() {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-6 pb-24">
      <div role="status" aria-live="polite" className="sr-only">
        Loading insights
      </div>

      <div aria-hidden="true">
        <header className="pt-18 pb-10">
          <Block className="eyebrow text-eyebrow">Walkability report</Block>
          <Block className="display-headline mt-3 max-w-[16ch] text-[clamp(2rem,4.5vw,3.25rem)]">
            350 5th Avenue
          </Block>

          {/* The three columns don't share a description length, and a grid
              item's height is its own — so each one stands in for the real
              copy it will be replaced by, down to how many lines that runs to
              at `max-w-[26ch]`. */}
          <div className="mt-14 grid grid-cols-1 gap-8 wide:grid-cols-3">
            <FigureSkeleton lead label="Walking score" lines={3} />
            <FigureSkeleton label="Driving score" lines={1} />
            <FigureSkeleton label="Amenity density" lines={2} />
          </div>
        </header>

        {/* The verdict strip is a `--muted` surface already, so its lines take
            `--border` — the next step down the same neutral ladder. */}
        <div
          className={cn(
            "mt-12 rounded-lg border-l-[3px] border-primary bg-muted px-7 py-6 text-[1.0625rem] leading-[1.55]",
            stackedLines,
          )}
        >
          <Block className={cn("max-w-full bg-border", stackedLine)}>
            Twelve of twelve categories within a kilometre, which is as complete
            as this score gets.
          </Block>
          <Block className={cn("bg-border", stackedLine)}>
            Everyday errands are on foot.
          </Block>
        </div>

        <div className="mt-12 h-[clamp(19rem,40vw,26.25rem)] rounded-lg border bg-muted" />

        <section className="mt-18">
          <header className="mb-5 flex items-baseline justify-between gap-4">
            <Block className="eyebrow text-eyebrow">Category coverage</Block>
            <Block className="eyebrow text-eyebrow">12 of 12 present</Block>
          </header>

          <div className="grid grid-cols-1 gap-4 wide:grid-cols-3">
            <TierCardSkeleton />
            <TierCardSkeleton />
            <TierCardSkeleton />
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * One rule-topped score column. The rules themselves are not skeletonised —
 * they are the layout, not the data, and walking keeps its orange so the
 * hierarchy is already right when the numerals arrive.
 */
function FigureSkeleton({
  label,
  lines,
  lead = false,
}: {
  label: string;
  lines: number;
  lead?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-t-2 pt-4",
        lead ? "border-primary" : "border-foreground",
      )}
    >
      <Block className="eyebrow text-eyebrow">{label}</Block>
      <Block className="numeral mt-3 mb-2 text-[clamp(3.5rem,9vw,6.5rem)]">
        88
      </Block>
      <div className={cn("max-w-[26ch] text-sm leading-relaxed", stackedLines)}>
        {Array.from({ length: lines }, (_, line) => (
          <Block key={line} className={cn("max-w-full", stackedLine)}>
            Tier-weighted category coverage
          </Block>
        ))}
      </div>
    </div>
  );
}

/** One tier card: its weight row and its four categories. */
function TierCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <Block className="eyebrow text-eyebrow">Daily needs</Block>
        <Block className="eyebrow text-eyebrow">×3</Block>
      </div>

      <div className="mt-4 grid gap-[0.6rem]">
        {["Grocery", "Pharmacy", "Café", "Restaurant"].map((category) => (
          <div
            key={category}
            className="flex items-center justify-between gap-4 text-[0.9375rem]"
          >
            <Block>{category}</Block>
            <Block className="font-mono text-[0.8125rem]">280 m</Block>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A muted bar exactly the size of the text it stands in for. The text is really
 * there — it is what gives the bar its height and width — and it is transparent
 * on top of the fill, so nothing of it is readable and nothing of it is
 * announced (the skeleton above is `aria-hidden` wholesale).
 *
 * The transparent colour is an inline style rather than `text-transparent`,
 * because `tailwind-merge` reads the type scale's own `text-eyebrow` as a
 * *colour* and drops the utility that follows it — which showed up as legible
 * skeleton copy.
 */
function Block({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{ color: "transparent" }}
      className={cn(
        "block w-fit max-w-full rounded-sm bg-muted select-none",
        className,
      )}
    >
      {children}
    </span>
  );
}
