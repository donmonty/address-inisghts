import { Button } from "@/components/ui/button";

/**
 * Placeholder home page. It exists to prove the design system is wired up —
 * the editorial type scale, the token table under both system themes, and the
 * orange used only as --primary/--ring. The real search box arrives later.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-24">
      <div className="flex flex-col gap-4">
        <p className="eyebrow text-xs text-muted-foreground">Address Insights</p>
        <h1 className="headline text-5xl text-balance sm:text-6xl">
          What is daily life like from this front door?
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Type an address and get walking, driving and density scores for that
          exact point — with the working shown.
        </p>
      </div>

      <div className="border-l-[3px] border-primary bg-muted px-5 py-4 text-sm">
        Scaffold only. Search, scoring and the map land in later tickets.
      </div>

      <div className="flex items-center gap-4">
        <Button>Search an address</Button>
        <span className="eyebrow text-xs text-muted-foreground">
          Mono label specimen
        </span>
      </div>
    </main>
  );
}
