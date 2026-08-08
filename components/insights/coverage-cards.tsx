import { CATEGORY_LABELS, TIER_LABELS, formatDistance } from "@/lib/format";
import { CATEGORY_IDS, type TierCoverage } from "@/lib/scoring";
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
  const categories = tiers.flatMap((tier) => tier.categories);
  const presentCount = categories.filter((c) => c.present).length;

  return (
    <section className="mt-18">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="eyebrow text-[0.6875rem] text-muted-foreground">
          Category coverage
        </h2>
        <span className="eyebrow text-[0.6875rem] text-muted-foreground">
          {presentCount} of {CATEGORY_IDS.length} present
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 wide:grid-cols-3">
        {tiers.map((tier) => (
          <TierCard key={tier.tier} tier={tier} />
        ))}
      </div>
    </section>
  );
}

function TierCard({ tier }: { tier: TierCoverage }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="eyebrow text-[0.6875rem] font-semibold">
          {TIER_LABELS[tier.tier]}
        </span>
        <span className="eyebrow text-[0.6875rem] text-muted-foreground">
          ×{tier.weight}
        </span>
      </div>

      <ul className="mt-4 grid gap-[0.6rem]">
        {tier.categories.map((category) => {
          const absent = "text-muted-foreground opacity-[0.55]";
          return (
            <li
              key={category.id}
              className="flex items-center justify-between gap-4 text-[0.9375rem]"
            >
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
