// This file holds the "brain" of the search box: given whatever the
// visitor has typed, it asks the database for a matching definition (if
// the typed text is an exact defined term) and a ranked list of matching
// regulation sections, then hands both back to whichever page uses this
// hook. Splitting this logic out of the page component keeps Home.js
// focused on what to draw on screen, not how the searching works.

// useEffect: run code automatically when things change.
// useRef: remember a value across re-draws without causing a re-draw
//   itself (we use it below to ignore old, slow responses).
// useState: remember a value and re-draw when it changes.
import { useEffect, useRef, useState } from 'react';
// Our shared connection to Supabase.
import { supabase } from '../lib/supabaseClient';

// Wait this many milliseconds after the visitor stops typing before
// actually searching. Without this, we'd fire off a database search on
// every single keystroke, which is wasteful and can make slower keystrokes
// (like the very first letter) get overtaken by newer ones anyway.
const DEBOUNCE_MS = 250;
// Don't bother searching until at least this many characters have been
// typed — a 1-letter search would match almost everything and isn't
// useful.
const MIN_QUERY_LENGTH = 2;

// A custom hook: a reusable little bundle of React logic. Call
// useHipaaSearch(query) from a component and it gives back the current
// search results for that query, updating automatically as the query
// changes.
export function useHipaaSearch(query) {
  // The one exact-match definition for the typed term, or null if there
  // isn't one (or nothing has been searched yet).
  const [definition, setDefinition] = useState(null);
  // The list of regulation sections that matched, best match first.
  const [sections, setSections] = useState([]);
  // True while we're waiting to hear back from the database.
  const [loading, setLoading] = useState(false);
  // A simple counter we bump every time a new search starts. If a slow
  // search finishes after a newer one already finished, we can tell by
  // comparing numbers and throw away the outdated result instead of
  // overwriting the newer, correct one.
  const requestId = useRef(0);

  // Runs whenever "query" (what's typed in the search box) changes.
  useEffect(() => {
    const trimmed = query.trim();

    // Not enough typed yet — clear out any old results and stop here.
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setDefinition(null);
      setSections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Mark this as the newest search attempt.
    const currentRequest = ++requestId.current;

    // Wait DEBOUNCE_MS after typing stops before actually searching.
    const timer = setTimeout(async () => {
      // Ask for both things at the same time instead of one after another,
      // so the total wait is as short as possible.
      const [definitionResult, sectionsResult] = await Promise.all([
        // Look for a defined term that matches exactly (ignoring
        // upper/lowercase). ilike with no % wildcards behaves like an
        // exact, case-insensitive match. maybeSingle() means "give me one
        // result, or null if there isn't one" instead of throwing an error
        // when nothing matches.
        supabase
          .from('hipaa_definitions')
          .select('term, definition, citation, source_url')
          .ilike('term', trimmed)
          .maybeSingle(),
        // Ask the database's search_sections function (defined in
        // schema.md) for regulation sections that match, already sorted
        // best-match-first.
        supabase.rpc('search_sections', { p_query: trimmed, p_limit: 20 }),
      ]);

      // If a newer search has started since we began waiting, throw this
      // result away — showing it now would overwrite the newer, more
      // correct one with stale results.
      if (currentRequest !== requestId.current) return;

      setDefinition(definitionResult.data ?? null);
      setSections(sectionsResult.data ?? []);
      setLoading(false);
    }, DEBOUNCE_MS);

    // If the visitor types again before the timer finishes, cancel the
    // pending search — only the latest keystroke should eventually search.
    return () => clearTimeout(timer);
  }, [query]);

  // Hand back everything the page needs to display results.
  return { definition, sections, loading };
}
