// This hook fetches the full text of a single regulation section (its
// citation, heading, body, and source link), given that section's id. Used
// by the detail view that opens when a visitor clicks a section in the
// sidebar or in the search results. Kept separate from useSectionList so
// the sidebar doesn't have to download every section's full text just to
// show a list of headings.
//
// If a search query is currently active, it's passed in too — the
// database function this calls (get_section, see schema.md) wraps every
// matching word throughout the whole body in [[H]]...[[/H]] markers, the
// same way search_sections does for the short snippets in the results
// list, so the search terms stay highlighted after opening the full text.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useSectionDetail(sectionId, query) {
  // The full section row, or null if nothing is selected (or it hasn't
  // loaded yet).
  const [section, setSection] = useState(null);
  // True while we're fetching the selected section's full text.
  const [loading, setLoading] = useState(false);

  // Runs whenever "sectionId" or "query" changes — i.e. whenever the
  // visitor opens a different section, or edits the search box while one
  // is open.
  useEffect(() => {
    // Nothing is selected — clear out whatever was shown before.
    if (!sectionId) {
      setSection(null);
      return;
    }

    // Stops us from updating state if the visitor selects something else
    // again before this fetch finishes.
    let cancelled = false;
    setLoading(true);

    supabase
      .rpc('get_section', { p_id: sectionId, p_query: query || null })
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSection(data ?? null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sectionId, query]);

  return { section, loading };
}
