/**
 * The plain-English line, in a `--muted` block behind a 3px orange left border.
 *
 * It is the only long-form prose on the page, and the only place the three
 * numerals are explained in words. The sentence itself is built in
 * `lib/scoring.ts` — nothing is composed here.
 */
export function VerdictStrip({ verdict }: { verdict: string }) {
  return (
    <p className="mt-12 rounded-lg border-l-[3px] border-primary bg-muted px-7 py-6 text-[1.0625rem] leading-[1.55]">
      {verdict}
    </p>
  );
}
