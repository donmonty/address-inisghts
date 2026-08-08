import { cn } from "@/lib/utils";

/**
 * The scorecard's one badge shape: mono, uppercase, fully rounded.
 *
 * `tone="primary"` is the only filled-orange surface in the design, and it is
 * reserved for the `+N with a car` delta — see the orange budget in the spec.
 * Everything else takes the bordered neutral.
 */
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
        "eyebrow inline-flex items-center gap-[0.4em] rounded-full border px-[0.7rem] py-[0.3rem] text-[0.6875rem] whitespace-nowrap",
        tone === "primary" &&
          "border-primary bg-primary font-semibold text-primary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
