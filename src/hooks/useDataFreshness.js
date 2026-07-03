// This hook finds out when the regulation data (sections + definitions)
// was last refreshed by the ingestion scripts, so the homepage can show
// visitors a "Data last updated" date and reassure them the content isn't
// stale.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useDataFreshness() {
  // The most recent "updated_at" time found across both tables, or null
  // until we've looked it up.
  const [updatedAt, setUpdatedAt] = useState(null);

  // Run once, right when whatever component uses this hook first appears.
  useEffect(() => {
    // If this component disappears before the lookup finishes (e.g. the
    // visitor navigates away fast), this flag stops us from trying to
    // update state that no longer exists.
    let cancelled = false;

    async function loadFreshness() {
      // Ask each table for just its single most-recently-touched row's
      // timestamp — much cheaper than downloading every row just to find
      // the newest one.
      const [sectionsResult, definitionsResult] = await Promise.all([
        supabase
          .from('hipaa_sections')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('hipaa_definitions')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      // Collect whichever timestamps we actually got back (a table could
      // come back empty if it's never been ingested yet), turning each one
      // into a real Date we can compare.
      const candidates = [sectionsResult.data?.updated_at, definitionsResult.data?.updated_at]
        .filter(Boolean)
        .map((value) => new Date(value));

      // Whichever table was touched most recently wins — that's the
      // overall "last updated" time to show on the page.
      if (candidates.length > 0) {
        setUpdatedAt(new Date(Math.max(...candidates)));
      }
    }

    loadFreshness();

    return () => {
      cancelled = true;
    };
  }, []);

  return updatedAt;
}
