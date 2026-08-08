import { Pill } from "@/components/insights/pill";
import {
  heroDescription,
  heroEyebrowRow,
  heroGrid,
  heroHeader,
  heroHeadline,
  heroNumeral,
  heroRule,
} from "@/components/insights/scorecard-shell";
import { SearchAnotherLink } from "@/components/insights/search-another-link";
import type { AddressInsight } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/**
 * The hero: eyebrow, the address as the headline, and the three scores as
 * oversized numerals in a rule-topped three-column grid.
 *
 * The eyebrow line carries the page's only navigation. It is typographic and
 * not a button: the scorecard's one button-shaped control class is the nearby
 * filter pills, and a second would read as a second kind of thing. It also
 * costs no vertical space, because that line was already there.
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
    <header className={heroHeader}>
      <div className={heroEyebrowRow}>
        <p className="eyebrow text-eyebrow text-muted-foreground">
          Walkability report
        </p>
        <SearchAnotherLink />
      </div>
      <h1 className={heroHeadline}>{label}</h1>

      <div className={heroGrid}>
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
      className={cn(heroRule, lead ? "border-primary" : "border-foreground")}
    >
      <span className="eyebrow block text-eyebrow text-muted-foreground">
        {label}
      </span>
      <span className={cn(heroNumeral, lead && "text-primary")}>{value}</span>
      <p className={cn(heroDescription, "text-muted-foreground")}>{children}</p>
    </div>
  );
}
