// This file keeps track of "who is logged in right now" for the whole app.
// Unlike a typical Supabase app, we are NOT using Supabase's built-in login
// system here — there's a custom `users` table in the database instead
// (username + a securely hashed password, no email at all). This file
// checks a login attempt against that table, and remembers the result in
// the browser's own local storage so the visitor stays "logged in" even
// after refreshing the page.

// createContext: makes a shared "box" of information.
// useContext: lets a component reach into that box and read what's inside.
// useState: lets a component remember a value and re-draw itself when that
//   value changes.
import { createContext, useContext, useState } from 'react';
// Our shared connection to Supabase, used here only to call the
// verify_login database function — never to sign in through Supabase Auth.
import { supabase } from '../lib/supabaseClient';

// The name we use to save the logged-in user's info in the browser's local
// storage (a small key/value storage area that survives page refreshes).
const STORAGE_KEY = 'hipaasearch_user';

// Create the shared "box" that will hold login info. It starts out empty
// (undefined) until AuthProvider (below) fills it in.
const AuthContext = createContext(undefined);

// Look in local storage for a previously saved login, so a visitor who
// refreshes the page (or closes and reopens the tab) doesn't get logged
// out. Returns null if nothing is saved, or if what's saved is broken.
function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// AuthProvider is a wrapper component. Anything placed inside it (its
// "children") gets access to the shared login info.
export function AuthProvider({ children }) {
  // The currently signed-in user's { id, username, role }, or null if
  // nobody is signed in. We start it off with whatever readStoredUser()
  // finds, so a page refresh doesn't briefly show the login page.
  const [user, setUser] = useState(readStoredUser);

  // Attempts to log in with the given username and password. Returns
  // { error: null } on success, or { error: 'some message' } on failure —
  // the Login page uses this to decide what to show.
  const login = async (username, password) => {
    // Call the verify_login function we defined in the database. It checks
    // the password against the securely stored hash on the server side and
    // only ever hands back non-secret info (id, username, role) — never the
    // password or its hash.
    const { data, error } = await supabase.rpc('verify_login', {
      p_username: username,
      p_password: password,
    });

    // A real problem talking to the database (not just "wrong password").
    if (error) {
      return { error: error.message };
    }

    // verify_login returns a list of matching rows — either one row (a
    // correct username + password) or none at all (wrong username,
    // wrong password, or both — we can't tell which, on purpose, so
    // guessing usernames doesn't help an attacker).
    const match = data?.[0];
    if (!match) {
      return { error: 'Invalid username or password' };
    }

    // Success: remember who's logged in, both in memory (so the app
    // re-draws right away) and in local storage (so it's still there after
    // a refresh).
    setUser(match);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
    return { error: null };
  };

  // Logs the current user out by forgetting them, both in memory and in
  // local storage.
  const signOut = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Fill the shared "box" with everything components might need: the
  // current user (or null), the login function, and the signOut function.
  // Then render whatever was placed inside <AuthProvider> so it can use
  // this shared info.
  return (
    <AuthContext.Provider value={{ user, login, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// A shortcut function other components use to read the shared login info,
// instead of dealing with createContext/useContext directly themselves.
export function useAuth() {
  const ctx = useContext(AuthContext);
  // If someone tries to use this outside of an AuthProvider, the box will
  // be empty (undefined) — warn them clearly instead of failing silently.
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
