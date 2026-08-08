import { CATEGORY_LABELS, TIER_LABELS, formatDistance } from "@/lib/format";
import {
  CATEGORY_IDS,
  presentCategoryCount,
  type TierCoverage,
} from "@/lib/scoring";
import {
  coverageGrid,
  coverageHeader,
  coverageSection,
  tierCard,
  tierCardHeader,
  tierCardList,
  tierCardRow,
} from "@/components/insights/scorecard-shell";
import { cn } from "@/lib/utils";

/**
 * Category coverage: one card per tier, each showing its ×3 / ×2 / ×1 weight
 * and all four of its categories with the distance to the nearest one.
 *
 * This is where the walking score's working becomes visible without prose — the
 * weights and the present/absent split are exactly the terms the score is built
 * from. An absent category reads `none` in `--muted-foreground` at 55%: it is a
 * fact about the neighbourhood, never an error, so nothing here is
 * `--destructive`.
 */
export function CoverageCards({ tiers }: { tiers: TierCoverage[] }) {
  const presentCount = presentCategoryCount(tiers);

  return (
    <section className={coverageSection}>
      <header className={coverageHeader}>
        <h2 className="eyebrow text-eyebrow text-muted-foreground">
          Category coverage
        </h2>
        <span className="eyebrow text-eyebrow text-muted-foreground">
          {presentCount} of {CATEGORY_IDS.length} present
        </span>
      </header>

      <div className={coverageGrid}>
        {tiers.map((tier) => (
          <TierCard key={tier.tier} tier={tier} />
        ))}
      </div>
    </section>
  );
}

function TierCard({ tier }: { tier: TierCoverage }) {
  return (
    <div className={tierCard}>
      <div className={tierCardHeader}>
        <span className="eyebrow text-eyebrow font-semibold">
          {TIER_LABELS[tier.tier]}
        </span>
        <span className="eyebrow text-eyebrow text-muted-foreground">
          ×{tier.weight}
        </span>
      </div>

      <ul className={tierCardList}>
        {tier.categories.map((category) => {
          const absent = "text-muted-foreground opacity-[0.55]";
          return (
            <li key={category.id} className={tierCardRow}>
              <span className={cn(!category.present && absent)}>
                {CATEGORY_LABELS[category.id]}
              </span>
              <span
                className={cn(
                  "font-mono text-[0.8125rem] tabular-nums",
                  category.present ? "text-primary" : absent,
                )}
              >
                {category.nearestMeters === null
                  ? "none"
                  : formatDistance(category.nearestMeters)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
