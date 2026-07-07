// This hook fetches the numbers shown on the System Health page: overall
// database stats (size, connections, cache hit ratio, content table row
// counts) plus a list of the slowest queries — all self-reported by
// Postgres automatically. See get_system_health() / get_slow_queries() in
// schema.md for where the numbers actually come from.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useSystemHealth() {
  // The single row of overall stats, or null until loaded.
  const [health, setHealth] = useState(null);
  // The list of slowest queries, empty until loaded.
  const [slowQueries, setSlowQueries] = useState([]);
  // True while the initial fetch is still in flight.
  const [loading, setLoading] = useState(true);

  // Runs once, right when whatever component uses this hook first appears.
  useEffect(() => {
    // Stops us from updating state after this component has already gone
    // away.
    let cancelled = false;

    // Ask for both things at the same time instead of one after another,
    // so the page doesn't wait twice as long to show up.
    Promise.all([
      supabase.rpc('get_system_health').maybeSingle(),
      supabase.rpc('get_slow_queries', { p_limit: 5 }),
    ]).then(([healthResult, slowQueriesResult]) => {
      if (cancelled) return;
      setHealth(healthResult.data ?? null);
      setSlowQueries(slowQueriesResult.data ?? []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { health, slowQueries, loading };
}
