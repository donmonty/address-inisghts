import { cn } from "@/lib/utils";

/**
 * The scorecard's one badge shape: mono, uppercase, fully rounded.
 *
 * `tone="primary"` marks the `+N with a car` delta. It draws the orange in the
 * border and the text, never as a fill: orange is `--primary` and `--ring`
 * only, never a surface. A filled lozenge would also out-shout the walking
 * numeral, which is the one figure in the hero meant to lead.
 */
/**
 * The shape itself, so the nearby list's filter chips — which must be
 * `<button>`s — can be the same lozenge without a second definition of it.
 */
export const pillShape =
  "eyebrow inline-flex items-center gap-[0.4em] rounded-full border px-[0.7rem] py-[0.3rem] text-eyebrow whitespace-nowrap";

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "primary";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        pillShape,
        tone === "primary" && "border-primary font-semibold text-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}
