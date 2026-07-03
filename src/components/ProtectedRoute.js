// ProtectedRoute is a "gatekeeper" component. You wrap it around any page
// that should only be visible to people who are signed in. If someone who
// isn't signed in tries to visit that page, this sends them to /login
// instead.

// Navigate: a tool from the router library that redirects (sends) the
// visitor to a different page.
import { Navigate } from 'react-router-dom';
// Our own helper for reading the current login info (see AuthContext.js).
import { useAuth } from '../context/AuthContext';

// "children" here means "whatever page was placed inside <ProtectedRoute>",
// e.g. <ProtectedRoute><Home /></ProtectedRoute> makes children = <Home />.
export function ProtectedRoute({ children }) {
  // Ask the shared login info: is anyone currently signed in?
  const { user } = useAuth();

  // If nobody is signed in, redirect them to the login page. "replace"
  // means it swaps the current page in the browser's history instead of
  // adding a new entry, so the back button doesn't bounce them between the
  // protected page and the login page.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Otherwise, someone is signed in — show the page that was wrapped.
  return children;
}
