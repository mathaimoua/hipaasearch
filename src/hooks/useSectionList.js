// This hook fetches the short list of every Part 164 section (just its
// number and heading, not the full text) for the sidebar to display, in
// section-number order.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useSectionList() {
  // The list of { id, section_number, heading } rows, empty until loaded.
  const [sections, setSections] = useState([]);
  // True while the initial fetch is still in flight.
  const [loading, setLoading] = useState(true);

  // Runs once, right when whatever component uses this hook first appears.
  useEffect(() => {
    // Stops us from updating state after this component has already gone
    // away (e.g. the visitor navigated off the page before this finished).
    let cancelled = false;

    supabase
      .from('hipaa_sections')
      // Only grab the columns the sidebar actually needs — no reason to
      // download every section's full body text just to build a list.
      .select('id, section_number, heading')
      // Sort so 164.102 comes before 164.502, matching how the sidebar
      // should read top to bottom.
      .order('section_number', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setSections(data ?? []);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { sections, loading };
}
