// This is a placeholder "you're signed in" page. It's shown once someone
// successfully logs in. Later, this is where the real HIPAA regulation
// search feature will live — for now it just proves the login worked.

// Our helper for reading the current login info (who's signed in, their
// role, and a way to sign out).
import { useAuth } from '../context/AuthContext';

export default function Home() {
  // Pull out the signed-in person's info (id, username, role) and the
  // signOut function. verify_login already gave us the role, so there's no
  // separate lookup needed here.
  const { user, signOut } = useAuth();

  return (
    <div style={{ padding: 32 }}>
      <h1>HIPAA Search</h1>
      <p>
        Signed in as {user?.username} ({user?.role})
      </p>
      {/* Clicking this button runs signOut(), logging the person out. */}
      <button onClick={signOut}>Sign out</button>
    </div>
  );
}
