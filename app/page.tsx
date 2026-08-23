import { Logo } from "@/components/brand/logo";
import { AddressSearch } from "@/components/search/address-search";
import { ExampleAddresses } from "@/components/search/example-addresses";
import { RecentLookups } from "@/components/search/recent-lookups";

/**
 * The landing page: the headline, one search box, and two ways in for a visitor
 * who has no address in mind — the four calibration examples, and whatever this
 * browser has looked up before.
 *
 * Only the search box and the history are client-side; the examples are plain
 * links from the server, because their coordinates are already known.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-12 px-6 py-24">
      <div className="flex flex-col gap-4">
        <Logo />
        <h1 className="headline text-4xl text-balance sm:text-5xl">
          So, what&apos;s the neighborhood like?
        </h1>
        <p className="text-lg text-muted-foreground">
          Get walking, driving and density scores for any address.
        </p>
      </div>

      <AddressSearch />
      <RecentLookups />
      <ExampleAddresses />
    </main>
  );
}
