"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { recordLookup } from "@/components/search/recent-store";
import {
  createSearchSession,
  insightsHref,
  retrieveAddress,
  suggestAddresses,
  MIN_QUERY_LENGTH,
  type AddressSuggestion,
} from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * The way in: one search box, and no way to submit an address that isn't real.
 *
 * The form's submit picks the highlighted suggestion or does nothing at all —
 * free text never reaches the router — so coordinates are always in hand before
 * navigation and "address not found" is not a page this app has to render.
 *
 * Two things here are cost, not polish. The `/suggest` call is debounced, which
 * keeps a fast typist well inside the account's 10 requests a second. And the
 * session token comes from one `createSearchSession` held for the life of the
 * box: every keystroke and the closing `/retrieve` share it, which is the
 * difference between one billable session per search and one per keystroke.
 * See `docs/research/mapbox-limits-and-tokens.md` §1.
 *
 * Everything about Mapbox lives in `lib/search.ts`. What is left here is the
 * debounce, the keyboard, and which of the three lines sits under the input.
 */

/** Long enough that a typed word is one call, short enough to feel live. */
const DEBOUNCE_MS = 220;

/** Both neutral. Neither is an error the visitor caused, so neither is red. */
const NO_MATCHES = "No matches. Try a street address, city, or ZIP.";
const UNAVAILABLE = "Search is temporarily unavailable.";

type SuggestState =
  | { status: "idle" }
  | { status: "results"; suggestions: AddressSuggestion[] }
  | { status: "empty" }
  | { status: "error" };

const IDLE: SuggestState = { status: "idle" };

export function AddressSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SuggestState>(IDLE);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [retrieving, setRetrieving] = useState(false);

  // One session for the whole box, created once and never replaced. Held in
  // state rather than in a module constant so two boxes on a page could never
  // share — Mapbox bills concurrent sessions on one token unpredictably.
  const [session] = useState(createSearchSession);
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;

  // The debounce, and the only place `/suggest` is called from. A query too
  // short to be an address is dropped here without a timer; it was already put
  // back to idle by the keystroke that shortened it.
  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const suggestions = await suggestAddresses({
          query,
          sessionToken: session.token(),
          signal: controller.signal,
        });
        setActive(0);
        setState(
          suggestions.length > 0
            ? { status: "results", suggestions }
            : { status: "empty" },
        );
      } catch {
        // A superseded keystroke aborts its own call; that is not a failure to
        // report, and the newer call is already on its way.
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, session]);

  const suggestions = state.status === "results" ? state.suggestions : [];
  const expanded = open && suggestions.length > 0;

  function type(value: string) {
    setQuery(value);
    setOpen(true);
    // Back below the minimum: neither "no matches" nor a stale list, both of
    // which would be answers to a question that is no longer being asked.
    if (value.trim().length < MIN_QUERY_LENGTH) setState(IDLE);
    // Clearing the box ends the interaction: whatever comes next is a new
    // search and deserves a new token, not the spent one.
    if (value.trim() === "") session.end();
  }

  async function pick(suggestion: AddressSuggestion) {
    setOpen(false);
    setRetrieving(true);

    try {
      const address = await retrieveAddress({
        suggestion,
        sessionToken: session.token(),
      });
      // The retrieve is what closes the session — and only a successful one, so
      // a retry after a failure stays inside the session already paid for.
      session.end();
      recordLookup(address);
      router.push(insightsHref(address));
    } catch {
      setState({ status: "error" });
      setRetrieving(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!expanded) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive(
        (current) => (current + step + suggestions.length) % suggestions.length,
      );
    }
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          // The one navigation path. With nothing highlighted there is nothing
          // to go to, and typed text is never itself an address.
          if (expanded) void pick(suggestions[active]);
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search an address
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Enter an address, city or ZIP"
          value={query}
          disabled={retrieving}
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? optionId(active) : undefined}
          onChange={(event) => type(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          className="h-15 w-full rounded-lg border bg-card pr-5 pl-13 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70 sm:text-lg [&::-webkit-search-cancel-button]:hidden"
        />
      </form>

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-lg border bg-popover shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.mapboxId}>
              <button
                type="button"
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                tabIndex={-1}
                // The pick has to survive the blur the pointer would otherwise
                // cause first, which is what would close the list under it.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void pick(suggestion)}
                onPointerEnter={() => setActive(index)}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-0.5 border-b px-5 py-3 text-left last:border-b-0",
                  index === active && "bg-accent",
                )}
              >
                <span className="text-[0.9375rem]">{suggestion.name}</span>
                {suggestion.context && (
                  <span className="text-sm text-muted-foreground">
                    {suggestion.context}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p
        aria-live="polite"
        className="mt-3 min-h-5 text-sm text-muted-foreground"
      >
        {retrieving
          ? "Locating that address…"
          : state.status === "empty"
            ? NO_MATCHES
            : state.status === "error"
              ? UNAVAILABLE
              : ""}
      </p>
    </div>
  );
}
