// This is the sign-in page. It shows a small form (username + password) in
// a white card on a black background, and checks the login details against
// our own `users` table in the database (not Supabase's built-in login
// system — this app was set up to avoid email entirely).

// useState: lets this component remember values (like what's typed in the
// boxes) and re-draw itself whenever those values change.
import { useState } from 'react';
// Navigate: sends the visitor to a different page.
import { Navigate } from 'react-router-dom';
// Our helper for reading the current login info and attempting a login.
import { useAuth } from '../context/AuthContext';
// The styling (colors, spacing, fonts) for this page.
import './Login.css';

// The main component for this page. "export default" means this is the one
// thing other files get when they import this file.
export default function Login() {
  // Read whether someone is already signed in, and grab the login
  // function.
  const { user, login } = useAuth();
  // What the visitor has typed into the username box so far.
  const [username, setUsername] = useState('');
  // What the visitor has typed into the password box so far.
  const [password, setPassword] = useState('');
  // Any error message to show (like "wrong password"), or nothing if there
  // isn't one.
  const [error, setError] = useState(null);
  // True while we're waiting to hear back after the visitor clicks
  // "Sign in", so we can disable the button and avoid double-clicks.
  const [submitting, setSubmitting] = useState(false);

  // If someone is already signed in, there's no need to show them the
  // login form — send them straight to the main page instead.
  if (user) {
    return <Navigate to="/" replace />;
  }

  // This function runs when the visitor submits the form (clicks "Sign in"
  // or presses Enter).
  const handleSubmit = async (event) => {
    // Stop the browser's normal behavior of reloading the whole page on
    // form submit — we want to handle it ourselves instead.
    event.preventDefault();
    // Clear out any old error message before trying again.
    setError(null);
    // Show the "signing in..." state while we wait.
    setSubmitting(true);

    // Ask AuthContext to check the username and password. This pauses here
    // ("await") until we hear back.
    const { error } = await login(username, password);

    // Whether it worked or not, we're done waiting.
    setSubmitting(false);
    // If something went wrong (wrong username/password, or a connection
    // problem), show that message to the visitor. If it worked, "user" in
    // AuthContext is now set, which sends the visitor to the main page on
    // the next re-draw (see the check near the top of this file).
    if (error) {
      setError(error);
    }
  };

  // Everything below this line is what actually shows up on screen.
  return (
    // Outer full-page black background.
    <div className="login-page">
      {/* The white card sitting in the middle of the black background. */}
      <div className="login-card">
        {/* The app's name, shown as the main heading. */}
        <h1 className="login-title">HIPAA Search</h1>
        {/* A small line of helper text under the heading. */}
        <p className="login-subtitle">Sign in to continue</p>

        {/* The actual form. onSubmit runs handleSubmit (above) when
            submitted. */}
        <form className="login-form" onSubmit={handleSubmit}>
          {/* Text label above the username box, linked to the box by
              "htmlFor" matching the box's "id" — this helps screen readers
              too. */}
          <label className="login-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="login-input"
            type="text"
            autoComplete="username"
            // The box always shows whatever is currently stored in
            // "username".
            value={username}
            // Every time the visitor types, update our stored "username"
            // value.
            onChange={(e) => setUsername(e.target.value)}
            // The browser won't let the form submit until this is filled in.
            required
          />

          <label className="login-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="login-input"
            // type="password" hides the characters as dots while typing.
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* Only show this error text if there actually is an error. */}
          {error && <p className="login-error">{error}</p>}

          {/* The submit button. It's grayed out and unclickable
              ("disabled") while we're waiting to hear back, and its text
              changes to show that it's working. */}
          <button className="login-button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
