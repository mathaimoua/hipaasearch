// stress_test.js
//
// Fires bursts of concurrent search requests at the live Supabase project
// to generate the kind of load the System Health page is meant to show —
// a spike in active connections, plus entries in the "slowest queries"
// table (see get_system_health()/get_slow_queries() in schema.md).
//
// Read-only: it only calls the same public search_sections function the
// app itself already uses, through the same public/publishable key — it
// can't modify or delete any data, and doesn't need the service-role key
// the ingestion scripts use.
//
// Usage:
//   node scripts/stress_test.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// A tiny stand-in for the "dotenv" package, just enough to read
// key=value pairs out of the project's root .env file — not worth adding
// a whole extra dependency for a one-off script.
function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnv(path.join(__dirname, '..', '.env'));

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// A handful of different search terms, so pg_stat_statements sees some
// variety instead of one single repeated query.
const SEARCH_TERMS = [
  'privacy',
  'security',
  'covered entity',
  'protected health information',
  'breach',
  'disclosure',
  'safeguard',
  'access',
  'administrative',
  'workforce',
];

const CONCURRENCY = 20; // requests fired at once, per burst
const BURSTS = 5; // how many bursts to run, one after another

async function runBurst(burstNumber) {
  const requests = Array.from({ length: CONCURRENCY }, (_, i) => {
    const term = SEARCH_TERMS[i % SEARCH_TERMS.length];
    return supabase.rpc('search_sections', { p_query: term, p_limit: 20 });
  });
  const start = Date.now();
  await Promise.all(requests);
  console.log(`Burst ${burstNumber}/${BURSTS}: ${CONCURRENCY} requests in ${Date.now() - start}ms`);
}

async function main() {
  console.log(
    `Stress testing ${SUPABASE_URL} with ${BURSTS} bursts of ${CONCURRENCY} concurrent requests...`
  );
  for (let i = 1; i <= BURSTS; i++) {
    await runBurst(i);
  }
  console.log('Done — check the System Health page now for a spike in stats.');
}

main();
