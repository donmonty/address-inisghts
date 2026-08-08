"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useSelection } from "@/components/insights/selection-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DRAWER } from "@/lib/map";
import { placeCard, type PlaceLink } from "@/lib/place";

/**
 * One place, opened instantly.
 *
 * Everything on this card comes out of the `/category` feature the client
 * already holds, so there is no request here and — the point of the whole
 * section — **no loading state**. `lib/place.ts` decides what the card says;
 * this file renders the rows it returns and skips the null ones.
 *
 * Absent rows are omitted rather than placeholdered: a column of greyed "Not
 * available" reads as a broken fetch, where a short card reads as a short
 * entry. The floor is category, name, distance and Directions, so no card is
 * ever actionless.
 *
 * The container is shadcn's `Sheet` — taken, not hand-rolled — for the
 * backdrop, the focus trap, Esc-to-close and the scroll lock. It sits at the
 * right above 900px and rises from the bottom below it, so the map stays
 * visible on a phone and the pin the reader tapped stays linked to the card.
 */
export function PlaceDrawer() {
  const { selected, select, restoreFocus } = useSelection();
  const wide = useWide();

  // The place survives its own closing animation: Radix keeps the content
  // mounted while it slides out, and a card that empties itself first would
  // flash blank on the way.
  const [last, setLast] = useState(selected);
  if (selected && selected !== last) setLast(selected);
  const place = selected ?? last;

  const card = place ? placeCard(place) : null;

  return (
    <Sheet open={selected !== null} onOpenChange={(open) => open || select(null)}>
      {card && (
        <SheetContent
          side={wide ? "right" : "bottom"}
          // Radix hands focus back to a `Dialog.Trigger`; this drawer is opened
          // from a list row or a map pin and has none, so the keyboard would be
          // dropped on `<body>`. `restoreFocus` puts it back where it came from.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
          // Inline rather than Tailwind so the two numbers the map band also
          // reads are stated once, in `DRAWER`, instead of once here as an
          // arbitrary value and once there as a constant.
          style={
            wide
              ? { width: DRAWER.width, maxWidth: DRAWER.width }
              : { height: `${DRAWER.bottomShare * 100}vh` }
          }
          className="gap-0 overflow-y-auto"
        >
          {card.closure && (
            <p className="mx-4 mt-4 rounded-md border border-destructive px-3 py-2 text-[0.8125rem] text-destructive">
              {card.closure}
            </p>
          )}

          <SheetHeader className="gap-2 pt-5 pr-12 pb-0">
            <span className="eyebrow text-eyebrow text-muted-foreground">
              {card.eyebrow}
            </span>
            <SheetTitle className="headline text-[1.375rem] leading-tight">
              {card.name}
            </SheetTitle>
            <SheetDescription className="font-mono text-[0.8125rem] tabular-nums">
              {card.distance}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 px-4 pt-5">
            {card.address && (
              <p className="text-[0.9375rem] text-muted-foreground">
                {card.address}
              </p>
            )}
            {card.hours && <p className="text-[0.9375rem]">{card.hours}</p>}
            {card.phone && (
              <ContactLink link={card.phone} className="tabular-nums" />
            )}
            {card.website && (
              <ContactLink link={card.website} external>
                <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
              </ContactLink>
            )}
            {card.note && (
              <p className="text-[0.9375rem] text-muted-foreground">
                {card.note}
              </p>
            )}
          </div>

          <div className="p-4 pt-6">
            <Button asChild size="lg" className="w-full">
              {/* `noreferrer` with `noopener`: the universal link opens Google
                  Maps, which has no business knowing which address was scored. */}
              <a
                href={card.directionsHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Directions
              </a>
            </Button>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}

/** A contact row: the label as published, the href as it will be followed. */
function ContactLink({
  link,
  external = false,
  className,
  children,
}: {
  link: PlaceLink;
  external?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={link.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex w-fit items-center gap-2 text-[0.9375rem] underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
    >
      <span className={className}>{link.label}</span>
      {children}
    </a>
  );
}

/**
 * Which side the sheet takes. A media query rather than a CSS-only answer
 * because `side` decides the focus order and the slide direction, not just the
 * geometry — and the drawer only ever renders after a click, so there is no
 * server pass for it to disagree with.
 */
function useWide(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DRAWER.wideBreakpoint}px)`);
    const sync = () => setWide(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return wide;
}
