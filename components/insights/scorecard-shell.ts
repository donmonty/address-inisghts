/**
 * The scorecard's structural classes, in one place.
 *
 * These are the strings the skeleton and the real components have to agree on:
 * `loading.tsx` claims to render the page's layout exactly, and that claim is
 * only true for as long as both sides carry the same page width, the same band
 * height, the same type clamps. Retyped in two files it is a claim nothing
 * checks — a spacing edit in `score-hero.tsx` would shift the loaded page out
 * from under a skeleton that still matched yesterday, silently.
 *
 * Only the shared *structure* lives here. Colour, state and content stay at
 * their use sites, because those are the things the two sides are supposed to
 * differ on.
 */

/** The page's own column: width, gutters, and the space under the fold. */
export const pageShell = "mx-auto w-full max-w-[1120px] flex-1 px-6 pb-24";

/** The hero block, the rule-topped score grid, and the type inside a column. */
export const heroHeader = "pt-18 pb-10";

/**
 * The eyebrow line: the report's name, and the way out of it.
 *
 * It wraps rather than truncates. At ~360px the two eyebrows do not fit on one
 * line, and the alternatives both cost more than a line of 11px type — hiding
 * the label would drop what the report *is* on the device where context matters
 * most, and shortening the link would mean two strings for one action.
 */
export const heroEyebrowRow =
  "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2";
export const heroGrid = "mt-14 grid grid-cols-1 gap-8 wide:grid-cols-3";
export const heroRule = "border-t-2 pt-4";
export const heroHeadline =
  "display-headline mt-3 max-w-[16ch] text-[clamp(2rem,4.5vw,3.25rem)] text-balance";
export const heroNumeral =
  "numeral mt-3 mb-2 block text-[clamp(3.5rem,9vw,6.5rem)]";
export const heroDescription = "max-w-[26ch] text-sm leading-relaxed";

/** The verdict strip's block, minus its prose colour. */
export const verdictStrip =
  "mt-12 rounded-lg border-l-[3px] border-primary bg-muted px-7 py-6 text-[1.0625rem] leading-[1.55]";

/**
 * The map band. 40vw so it reaches its 420px ceiling at the 1120px page width
 * and sits at ~360px where the grids collapse, rather than topping out short of
 * the height the design asks for.
 */
export const mapBand =
  "mt-12 h-[clamp(19rem,40vw,26.25rem)] overflow-hidden rounded-lg border bg-muted";

/** The coverage section, and one tier card within it. */
export const coverageSection = "mt-18";
export const coverageHeader = "mb-5 flex items-baseline justify-between gap-4";
export const coverageGrid = "grid grid-cols-1 gap-4 wide:grid-cols-3";
export const tierCard = "rounded-lg border bg-card p-5";
export const tierCardHeader = "flex items-baseline justify-between gap-4";
export const tierCardList = "mt-4 grid gap-[0.6rem]";
export const tierCardRow =
  "flex items-center justify-between gap-4 text-[0.9375rem]";
