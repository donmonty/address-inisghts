import Link from "next/link";

/**
 * The way out of a report, at eyebrow scale.
 *
 * A real `<Link href="/">` rather than a `router.back()` button, for three
 * reasons in that order. `ScoreHero` is a Server Component, and a client
 * boundary is too much to spend on saving one navigation. A large share of this
 * page's traffic arrives from a pasted link with no history to go back *to* —
 * `generateMetadata` exists for exactly that visitor — and `back()` there does
 * nothing or leaves the site. And the copy promises the search, not the
 * previous page: on a second lookup, "back" is another report.
 *
 * "Search another address" is the same string `not-found.tsx` and `error.tsx`
 * use. Every insights state offers the same way out, in the same words.
 *
 * This is a component rather than a class string in `scorecard-shell.ts`
 * because `loading.tsx` renders the *same live link*, not a placeholder
 * standing in for one — so there is no use site for the two to differ at.
 *
 * It carries `--foreground` and a standing underline at the same weight, where
 * the eyebrow beside it is muted and bare. Both halves are load-bearing: at
 * 11px uppercase, colour alone made it read as a second caption, and an
 * underline that only appears on hover is invisible to the person who has not
 * found it yet — and absent entirely on touch. The underline is what says
 * *clickable*; the contrast is what makes it findable. Hover thickens the rule
 * rather than changing a colour, which is feedback that costs no layout.
 *
 * Not `--primary`. Orange is the page's one unlabelled signal that the walking
 * score is the number that matters; spent here it would make leaving the report
 * the loudest thing on it.
 */
export function SearchAnotherLink() {
  return (
    <Link
      href="/"
      className="eyebrow rounded-sm text-eyebrow text-foreground underline decoration-foreground underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Search another address
    </Link>
  );
}
