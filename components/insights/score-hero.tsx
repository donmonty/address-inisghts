import { Pill } from "@/components/insights/pill";
import type { AddressInsight } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/**
 * The hero: eyebrow, the address as the headline, and the three scores as
 * oversized numerals in a rule-topped three-column grid.
 *
 * Walking leads and is the only one of the three carrying orange — its rule and
 * its numeral. Driving and density take the neutral `--foreground` rule, so the
 * page says which number matters without a legend.
 *
 * `label` is cosmetic: it comes from `?q=` so a shared link still names the
 * address. Coordinates remain the identity and stay in the URL.
 */
export function ScoreHero({
  label,
  insight,
}: {
  label: string;
  insight: AddressInsight;
}) {
  return (
    <header className="pt-18 pb-10">
      <p className="eyebrow text-[0.6875rem] text-muted-foreground">
        Walkability report
      </p>
      <h1 className="display-headline mt-3 max-w-[16ch] text-[clamp(2rem,4.5vw,3.25rem)] text-balance">
        {label}
      </h1>

      <div className="mt-14 grid grid-cols-1 gap-8 wide:grid-cols-3">
        <Figure lead label="Walking score" value={insight.walk}>
          Tier-weighted category coverage within 1 km, plus a capped count of
          nearby places.
        </Figure>

        <Figure label="Driving score" value={insight.drive}>
          {insight.delta > 0 ? (
            <>
              <Pill tone="primary">+{insight.delta} with a car</Pill> — the same
              categories within 5 km.
            </>
          ) : (
            <>The same categories within 5 km.</>
          )}
        </Figure>

        <Figure label="Amenity density" value={insight.densityIndex}>
          <Pill>{insight.densityBand}</Pill> — places per km² within 1 km.
        </Figure>
      </div>
    </header>
  );
}

/** One rule-topped score column. `lead` is what makes it orange. */
function Figure({
  label,
  value,
  lead = false,
  children,
}: {
  label: string;
  value: number;
  lead?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-t-2 pt-4",
        lead ? "border-primary" : "border-foreground",
      )}
    >
      <span className="eyebrow block text-[0.6875rem] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "numeral mt-3 mb-2 block text-[clamp(3.5rem,9vw,6.5rem)]",
          lead && "text-primary",
        )}
      >
        {value}
      </span>
      <p className="max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
