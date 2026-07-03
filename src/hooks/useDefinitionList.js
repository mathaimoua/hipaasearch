// This hook fetches every defined term (with its full definition) for the
// sidebar's "Terms" tab, sorted alphabetically. Unlike sections — where the
// sidebar only fetches the short heading and loads the full body later —
// definitions are short enough that it's simpler to just fetch everything
// up front and hand the whole thing to whichever term gets clicked.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useDefinitionList() {
  // The list of { id, term, definition, citation, source_url } rows,
  // empty until loaded.
  const [definitions, setDefinitions] = useState([]);
  // True while the initial fetch is still in flight.
  const [loading, setLoading] = useState(true);

  // Runs once, right when whatever component uses this hook first appears.
  useEffect(() => {
    // Stops us from updating state after this component has already gone
    // away.
    let cancelled = false;

    supabase
      .from('hipaa_definitions')
      .select('id, term, definition, citation, source_url')
      // Alphabetical order, matching how the sidebar should read top to
      // bottom.
      .order('term', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setDefinitions(data ?? []);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { definitions, loading };
}
