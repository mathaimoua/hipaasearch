// This file sets up one shared connection ("client") to Supabase, the
// service that stores our data and handles logins. Every other file that
// needs to talk to Supabase imports this same connection instead of making
// its own, so the whole app is always talking to the same place.

// Bring in the helper tool that Supabase gives us for building a connection.
import { createClient } from '@supabase/supabase-js';

// Grab the web address (URL) of our Supabase project from the .env file.
// process.env is just a box of settings that were loaded when the app started.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
// Grab the public key (like a shared password) that lets our app read/write
// through Supabase's rules.
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

// If either the address or the key is missing, stop everything right away
// with a clear error, instead of letting the app fail confusingly later.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_PUBLISHABLE_KEY in .env'
  );
}

// Build the connection using the address and key above, and make it
// available (export it) so other files can import { supabase } and use it.
export const supabase = createClient(supabaseUrl, supabaseKey);
