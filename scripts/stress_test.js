// stress_test.js
//
// Fires bursts of concurrent requests at the live Supabase project to
// exercise the System Health page. Mixes in some deliberately heavier
// requests (see WHY HEAVIER below) and randomizes how much load each run
// generates, so running this more than once doesn't just produce the same
// numbers over and over.
//
// Read-only: everything here calls the same public search_sections /
// get_section functions the app itself already uses, through the same
// public/publishable key — it can't modify or delete any data, and
// doesn't need the service-role key the ingestion scripts use.
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

// Ordinary search phrases — the kind of thing a real visitor would type.
const LIGHT_TERMS = [
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

// WHY HEAVIER: search_sections turns every word into a "starts with"
// match (see build_prefix_tsquery in schema.md) — a single letter like
// "s" matches every word in the database starting with S, so Postgres has
// to rank far more matching rows than it would for a specific phrase like
// "covered entity". That makes these noticeably more expensive per call.
const HEAVY_TERMS = ['a', 'e', 'i', 'o', 's', 't', 'c', 'r'];

// Picks a random whole number between min and max (inclusive) — used
// below so the amount of load this script generates is different every
// time it's run, instead of the exact same 5-bursts-of-20 every time.
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(list) {
  return list[randomInt(0, list.length - 1)];
}

// Asks the database for the real list of section ids, the same way the
// sidebar does (see useSectionList.js) — get_section needs a real id to
// look up, so one can't just be made up.
async function loadSectionIds() {
  const { data } = await supabase.from('hipaa_sections').select('id');
  return (data ?? []).map((row) => row.id);
}

// Builds one randomly-chosen request:
// - 40% of the time, an ordinary search (the everyday case)
// - 20% of the time, a deliberately broad/heavier search
// - 20% of the time, fetching a whole section's full text — heavier
//   still, since get_section highlights the ENTIRE body instead of a
//   short snippet the way search_sections does (see get_section in
//   schema.md), and sometimes includes a search term so its highlighting
//   code runs too, not just a plain fetch.
// - 20% of the time, simulate_slow_query — a deliberately, reliably slow
//   call (see schema.md) that doesn't depend on real data or which search
//   terms got picked, so at least some requests are GUARANTEED to clear
//   the 10ms threshold and show up in the Slowest Queries table every
//   single run, instead of hoping the real searches happen to be slow
//   enough.
function randomRequest(sectionIds) {
  const roll = Math.random();

  if (roll < 0.4) {
    return supabase.rpc('search_sections', { p_query: pickRandom(LIGHT_TERMS), p_limit: 20 });
  }

  if (roll < 0.6) {
    return supabase.rpc('search_sections', { p_query: pickRandom(HEAVY_TERMS), p_limit: 20 });
  }

  if (roll < 0.8) {
    const query = Math.random() < 0.5 ? pickRandom(LIGHT_TERMS) : null;
    return supabase.rpc('get_section', { p_id: pickRandom(sectionIds), p_query: query });
  }

  return supabase.rpc('simulate_slow_query', { p_min_ms: 50, p_max_ms: 300 });
}

async function runBurst(burstNumber, totalBursts, concurrency, sectionIds) {
  const requests = Array.from({ length: concurrency }, () => randomRequest(sectionIds));
  const start = Date.now();
  await Promise.all(requests);
  console.log(`Burst ${burstNumber}/${totalBursts}: ${concurrency} requests in ${Date.now() - start}ms`);
}

async function main() {
  const sectionIds = await loadSectionIds();
  if (sectionIds.length === 0) {
    console.error('No sections found — has ingest_hipaa.py been run?');
    process.exit(1);
  }

  // A different total amount of load each run: somewhere between 3-8
  // bursts of 10-40 concurrent requests, so two runs back to back don't
  // put the exact same load on the database.
  const bursts = randomInt(3, 8);
  const concurrency = randomInt(10, 40);

  console.log(
    `Stress testing ${SUPABASE_URL} with ${bursts} bursts of ${concurrency} concurrent requests (mixed light/heavy)...`
  );
  for (let i = 1; i <= bursts; i++) {
    await runBurst(i, bursts, concurrency, sectionIds);
  }
  console.log('Done — check the System Health page now for a spike in stats.');
}

main();
